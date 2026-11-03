// NexusHQ's own MCP server for the scout (the Search agent v2). It runs inside the worker on 127.0.0.1 over
// streamable HTTP (plain JSON responses, no SSE) and uses the worker's Supabase session, so the agent never sees a
// credential. Tools only act on the run that is currently open (setScoutRun); outside a run every call is refused.
// The agent reads the portfolio piece by piece, keeps a daily scratchpad, and records every decision here:
// accept_job saves a job, reject_job remembers a reject (never shown as a job). Upwork stays a separate, read-only server.
import http from "node:http";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Gates, JobSummary } from "@nexushq/shared";

export const SCOUT_SERVER = "nexushq";
export const SCOUT_PORT = Number(process.env.SCOUT_MCP_PORT) || 3299;
export const SCOUT_URL = `http://127.0.0.1:${SCOUT_PORT}/mcp`;
const SECTIONS = ["fit_card", "searches", "notes", "lessons"] as const;
// Upwork job ids are long numbers (sometimes with a leading "~"); anything else is a made-up or test id.
const UPWORK_ID = /^~?\d{6,}$/;
type Section = (typeof SECTIONS)[number];

export interface ScoutRun {
  supabase: SupabaseClient;
  runId: string;
  target: number;
  gates: Gates;
  gate: (j: JobSummary, g: Gates) => string | null;
  lessons: () => Promise<string>;
  log: (line: string) => Promise<void>;
  stats: { accepted: number; rejected: number; judged: number; searches: number; query: string; reasons: Map<string, number>; lastAgentAt: number; lastAgentLine: string };
}

let current: ScoutRun | null = null;
export const setScoutRun = (run: ScoutRun | null) => { current = run; };

const today = () => new Date().toISOString().slice(0, 10);
const text = (v: unknown) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v) }] });
const fail = (msg: string) => ({ ...text(msg), isError: true });
const s = { type: "string" } as const;
const schema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });

const CLIENT = schema({
  key: { ...s, description: "Upwork client id if shown, else \"<client name>|<country>\"" },
  name: s, company: { ...s, description: "Company name if the client states one" }, website: s,
  facts: { type: "object", description: "payment_verified, total_spent, hire_rate, jobs_posted, rating, member_since, country, open_jobs, notable review quotes" },
  red_flags: { type: "array", items: s },
}, ["key"]);
const JOB = schema({
  id: s, title: s, url: s, description_snippet: s, skills: { type: "array", items: s }, budget: s, job_type: s,
  experience_level: s, proposals_tier: s, client_country: s, client_verified: { type: "boolean" }, published_date: s,
}, ["id", "title"]);

// Tool names carry the server prefix, like Upwork's (upwork__find_jobs), so the adapters' naming rule fits both.
const TOOLS: { name: string; description: string; inputSchema: unknown; run: (a: Record<string, any>, r: ScoutRun) => Promise<unknown> }[] = [
  { name: "get_profile", description: "The freelancer's profile: headline, about, stack, skill groups, and an index of projects and experience (ids + one line each). Start here.",
    inputSchema: schema({}), run: async (_a, r) => {
      const db = r.supabase;
      const [p, sk, ex, pr] = await Promise.all([
        db.from("profile").select("name, role, headline, intro, location, work_mode, availability, stack").maybeSingle(),
        db.from("skill_groups").select("title, skills").eq("status", "published").order("sort_order"),
        db.from("experiences").select("id, role, company, start_label, end_label").eq("status", "published").order("sort_order"),
        db.from("projects").select("id, name, kind, category, year, summary").eq("status", "published").order("sort_order"),
      ]);
      return { profile: p.data, skills: sk.data, experience: ex.data, projects: (pr.data ?? []).map((x) => ({ ...x, summary: String(x.summary ?? "").slice(0, 160) })) };
    } },
  { name: "get_project", description: "Everything about one project: problem, what was built, decisions, results, skills, role, links.",
    inputSchema: schema({ id: s }, ["id"]), run: async (a, r) => {
      const { data } = await r.supabase.from("projects")
        .select("id, name, kind, category, year, summary, skills, role, timeline, team, problem, built, decisions, results, links").eq("id", a.id).maybeSingle();
      return data ?? fail(`No project with id ${a.id}`);
    } },
  { name: "list_experience", description: "All work experience in full: role, company, dates, summary, highlights, skills.",
    inputSchema: schema({}), run: async (_a, r) => (await r.supabase.from("experiences")
      .select("role, company, place, employment_type, start_label, end_label, summary, highlights, skills").eq("status", "published").order("sort_order")).data },
  { name: "scratchpad_read", description: "Today's scratchpad (your working memory): fit_card, searches, notes, lessons. If today has no fit_card, the latest earlier one is returned with its date.",
    inputSchema: schema({ section: { ...s, enum: [...SECTIONS] } }), run: async (a, r) => {
      let q = r.supabase.from("search_scratchpad").select("day, section, body, updated_at").eq("day", today());
      if (a.section) q = q.eq("section", a.section);
      const rows = (await q).data ?? [];
      if ((!a.section || a.section === "fit_card") && !rows.some((x) => x.section === "fit_card")) {
        const { data: old } = await r.supabase.from("search_scratchpad").select("day, section, body, updated_at")
          .eq("section", "fit_card").order("day", { ascending: false }).limit(1);
        if (old?.length) rows.push({ ...old[0], section: `fit_card (from ${old[0].day}; refresh it if your portfolio may have changed)` });
      }
      return rows.length ? rows : "Scratchpad is empty for today.";
    } },
  { name: "scratchpad_write", description: "Write to today's scratchpad. mode \"append\" (default for searches/notes) adds a line; \"replace\" (default for fit_card/lessons) overwrites the section.",
    inputSchema: schema({ section: { ...s, enum: [...SECTIONS] }, text: s, mode: { ...s, enum: ["append", "replace"] } }, ["section", "text"]),
    run: async (a, r) => {
      const section = a.section as Section;
      if (!SECTIONS.includes(section)) return fail(`section must be one of ${SECTIONS.join(", ")}`);
      const mode = a.mode ?? (section === "fit_card" || section === "lessons" ? "replace" : "append");
      let body = String(a.text ?? "");
      if (mode === "append") {
        const { data } = await r.supabase.from("search_scratchpad").select("body").eq("day", today()).eq("section", section).maybeSingle();
        body = [data?.body, `${new Date().toISOString().slice(11, 16)} ${body}`].filter(Boolean).join("\n").slice(-40_000);
      }
      const { error } = await r.supabase.from("search_scratchpad").upsert({ day: today(), section, body, updated_at: new Date().toISOString() });
      return error ? fail(error.message) : `saved (${section}, ${body.length} chars)`;
    } },
  { name: "get_lessons", description: "What past runs taught: every past search with how its jobs ended up (accepted, Claude shortlisted, you bid, you skipped, rejected), the latest reasons, what the freelancer actually proposed on Upwork, and earlier days' lessons. Read before planning searches.",
    inputSchema: schema({}), run: async (_a, r) => r.lessons() },
  { name: "start_search", description: "Call before each Upwork search; returns a search_id to pass to accept_job / reject_job, so results are tied to the query that found them.",
    inputSchema: schema({ query: { ...s, description: "the keywords, or \"\" for Upwork's recommended jobs" }, why: s }, ["query", "why"]),
    run: async (a, r) => {
      if (/^\s*test\b/i.test(String(a.query ?? ""))) return fail("Don't test the tools; start a real search.");
      const { data, error } = await r.supabase.from("job_searches").insert({ run_id: r.runId, query: a.query || null, why: a.why ?? "" }).select("id").single();
      if (error) return fail(error.message);
      r.stats.searches++; r.stats.query = a.query || "recommended";
      await r.log(`🔎 searching ${a.query ? `"${a.query}"` : "Upwork recommended"} — ${a.why ?? ""}`);
      return { search_id: data.id };
    } },
  { name: "check_seen", description: "Which of these Upwork job ids were already judged (saved or rejected) in any run. Never judge those again.",
    inputSchema: schema({ job_ids: { type: "array", items: s } }, ["job_ids"]), run: async (a, r) => {
      const ids: string[] = (a.job_ids ?? []).map(String).slice(0, 200);
      const seen = await seenIds(r.supabase, ids);
      return { seen: ids.filter((i) => seen.has(i)), unseen: ids.filter((i) => !seen.has(i)) };
    } },
  { name: "get_client", description: "The stored dossier for an Upwork client (facts, red flags, trust verdict), if any. Reuse it instead of researching again; refresh if older than 30 days.",
    inputSchema: schema({ key: s }, ["key"]), run: async (a, r) =>
      (await r.supabase.from("clients").select("*").eq("client_key", a.key).maybeSingle()).data ?? "No dossier for this client yet." },
  { name: "accept_job", description: "Save a job you are confident about. Needs why (one or two sentences), proof (project names or roles that prove the fit) and the client dossier. Refused if already seen, if it fails the hard gates, or when the target is reached.",
    inputSchema: schema({ search_id: s, job: JOB, why: s, proof: { type: "array", items: s }, client: CLIENT }, ["search_id", "job", "why", "proof", "client"]),
    run: async (a, r) => {
      const job = a.job as JobSummary;
      if (!job?.id || !UPWORK_ID.test(String(job.id))) return fail("job.id must be the real Upwork job id from find_jobs.");
      if (r.stats.accepted >= r.target) return fail(`Target of ${r.target} already reached. Stop searching and write your lessons.`);
      if ((await seenIds(r.supabase, [job.id])).has(job.id)) return fail("Already seen in an earlier run; skip it.");
      const gate = r.gate(job, r.gates);
      if (gate) {
        await reject(r, a.search_id, job.id, job.title, `Hard gate: ${gate}`, a.client?.key, "gates");
        return fail(`Rejected by a hard gate the freelancer set: ${gate}`);
      }
      const clientKey = await saveClient(r.supabase, a.client);
      const { error } = await r.supabase.from("jobs").insert({
        upwork_id: job.id, run_id: r.runId, search_id: a.search_id || null, title: job.title, url: job.url ?? "",
        summary: { ...job, found_by: r.stats.query }, stage: "found", client_key: clientKey,
        proof: { why: a.why, projects: a.proof ?? [] },
      });
      if (error) return fail(error.message);
      r.stats.accepted++; r.stats.judged++;
      await bumpSearch(r.supabase, a.search_id, "accepted");
      await r.log(`✅ accepted ${r.stats.accepted}/${r.target}: "${job.title.slice(0, 70)}" — ${String(a.why).slice(0, 160)}`);
      return `Saved. ${r.stats.accepted}/${r.target} accepted.`;
    } },
  { name: "reject_job", description: "Record a job you won't save, with a one-sentence reason. Every judged job must be accepted or rejected.",
    inputSchema: schema({ search_id: s, job_id: s, title: s, why: s, client: CLIENT }, ["search_id", "job_id", "title", "why"]),
    run: async (a, r) => {
      const id = String(a.job_id ?? "");
      if (!UPWORK_ID.test(id)) return fail("job_id must be the real Upwork job id from find_jobs.");
      // Judged before (this run or earlier): don't count or log it twice.
      if ((await seenIds(r.supabase, [id])).has(id)) return "Already judged earlier; skip it and move on.";
      if (a.client?.key) await saveClient(r.supabase, a.client);
      await reject(r, a.search_id, String(a.job_id), String(a.title ?? ""), String(a.why ?? ""), a.client?.key, "search");
      return `Rejected. ${r.stats.accepted}/${r.target} accepted so far.`;
    } },
  { name: "log", description: "Tell the freelancer what you are doing right now, in one line. Call it at every step change.",
    // Agents sometimes name the argument message/msg instead of text; accept any of them rather than print "undefined".
    inputSchema: schema({ text: s }, ["text"]), run: async (a, r) => {
      const t = a.text ?? a.message ?? a.msg ?? a.summary ?? Object.values(a).find((v) => typeof v === "string");
      if (!t) return fail("Pass the line to show as \"text\".");
      await r.log(`💬 ${String(t).slice(0, 300)}`);
      return "ok";
    } },
  { name: "progress", description: "A short plain-English status: what you've done, what you're doing next and why. Call it every few jobs.",
    inputSchema: schema({ summary: s }, ["summary"]), run: async (a, r) => {
      a.summary ??= a.text ?? a.message ?? Object.values(a).find((v) => typeof v === "string");
      if (!a.summary) return fail("Pass the status as \"summary\".");
      await r.log(`📋 ${String(a.summary).slice(0, 600)}`);
      const { data } = await r.supabase.from("search_scratchpad").select("body").eq("day", today()).eq("section", "notes").maybeSingle();
      await r.supabase.from("search_scratchpad").upsert({ day: today(), section: "notes", updated_at: new Date().toISOString(),
        body: [data?.body, `${new Date().toISOString().slice(11, 16)} ${a.summary}`].filter(Boolean).join("\n").slice(-40_000) });
      return "ok";
    } },
];
export const SCOUT_TOOLS = TOOLS.map((t) => t.name);

async function seenIds(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const [a, b] = await Promise.all([
    supabase.from("jobs").select("upwork_id").in("upwork_id", ids),
    supabase.from("job_rejects").select("upwork_id").in("upwork_id", ids),
  ]);
  return new Set([...(a.data ?? []), ...(b.data ?? [])].map((x) => x.upwork_id as string));
}

async function saveClient(supabase: SupabaseClient, c: Record<string, any> | undefined): Promise<string | null> {
  if (!c?.key) return null;
  const { error } = await supabase.from("clients").upsert({
    client_key: String(c.key), name: c.name ?? "", company: c.company ?? "", website: c.website ?? "",
    facts: c.facts ?? {}, red_flags: c.red_flags ?? [], researched_by: "search", updated_at: new Date().toISOString(),
  }, { onConflict: "client_key" });
  return error ? null : String(c.key);
}

// Per-search counts the trigger doesn't keep (it only counts jobs rows): judged, accepted, screened_out, gated_out.
async function bumpSearch(supabase: SupabaseClient, searchId: string | undefined, key: string) {
  if (!searchId) return;
  const { data } = await supabase.from("job_searches").select("new, stages").eq("id", searchId).maybeSingle();
  if (!data) return;
  const stages = { ...(data.stages ?? {}), [key]: ((data.stages ?? {})[key] ?? 0) + 1 };
  await supabase.from("job_searches").update({ new: (data.new ?? 0) + 1, found: (data.new ?? 0) + 1, stages }).eq("id", searchId);
}

async function reject(r: ScoutRun, searchId: string | undefined, id: string, title: string, why: string, clientKey: string | undefined, by: "gates" | "search") {
  await r.supabase.from("job_rejects").upsert({
    upwork_id: id, search_id: searchId || null, run_id: r.runId, title, client_key: clientKey ?? null, rejected_by: by, reason: why,
  }, { onConflict: "upwork_id" });
  r.stats.rejected++; r.stats.judged++;
  const short = why.split(/[.;:—-]/)[0].trim().toLowerCase().slice(0, 60);
  r.stats.reasons.set(short, (r.stats.reasons.get(short) ?? 0) + 1);
  await bumpSearch(r.supabase, searchId, by === "gates" ? "gated_out" : "screened_out");
  await r.log(`❌ rejected "${title.slice(0, 70)}" — ${why.slice(0, 160)}`);
}

// ---------------------------------------------------------------------------------------------------------
// MCP over HTTP: initialize, tools/list, tools/call, ping. Notifications get 202.
// ---------------------------------------------------------------------------------------------------------

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, any> };

async function handle(msg: Rpc): Promise<unknown | undefined> {
  if (msg.id === undefined || msg.id === null) return undefined; // notification
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id, result });
  const error = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  switch (msg.method) {
    case "initialize":
      return reply({ protocolVersion: msg.params?.protocolVersion ?? "2025-06-18", capabilities: { tools: {} },
        serverInfo: { name: "nexushq-scout", version: "1.0.0" } });
    case "ping": return reply({});
    case "tools/list":
      return reply({ tools: TOOLS.map((t) => ({ name: `${SCOUT_SERVER}__${t.name}`, description: t.description, inputSchema: t.inputSchema })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "").replace(`${SCOUT_SERVER}__`, "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return error(-32602, `Unknown tool ${msg.params?.name}`);
      const run = current;
      if (!run) return reply(fail("No Find jobs run is active; the NexusHQ tools only work during a run."));
      run.stats.lastAgentAt = Date.now();
      try {
        const out = await tool.run(msg.params?.arguments ?? {}, run);
        return reply(out && typeof out === "object" && "content" in (out as object) ? out : text(out ?? "ok"));
      } catch (e) {
        return reply(fail((e as Error).message));
      }
    }
    default: return error(-32601, `Method not found: ${msg.method}`);
  }
}

let server: http.Server | null = null;

// Starts the server once per worker process. Listens on 127.0.0.1 only.
export function startScoutServer(): Promise<void> {
  if (server) return Promise.resolve();
  server = http.createServer(async (req, res) => {
    if (req.url?.split("?")[0] !== "/mcp") { res.writeHead(404).end(); return; }
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed: Rpc | Rpc[];
    try { parsed = JSON.parse(body); } catch {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
      return;
    }
    const out = Array.isArray(parsed) ? (await Promise.all(parsed.map(handle))).filter(Boolean) : await handle(parsed);
    if (out === undefined || (Array.isArray(out) && !out.length)) { res.writeHead(202).end(); return; }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(out));
  });
  return new Promise((resolve, reject) => {
    server!.once("error", (e) => { server = null; reject(new Error(`Scout MCP server could not listen on ${SCOUT_PORT}: ${e.message}`)); });
    server!.listen(SCOUT_PORT, "127.0.0.1", () => resolve());
  });
}
