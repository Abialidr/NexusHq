// The scout (Search agent v2): one long, autonomous agent session that reads the portfolio piece by piece, keeps a
// daily scratchpad, searches Upwork, vets each job and its client, and saves only the jobs it can justify (through
// NexusHQ's own MCP server, scout-mcp.ts). Sessions end (target reached, timeout, quota); the scout resumes from its
// scratchpad until the target is reached, Upwork runs dry, or the time cap is hit. A heartbeat reports progress
// every few minutes no matter what the agent is doing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { UPWORK_READ_TOOLS, UPWORK_WRITE_TOOLS, type AgentConfig, type Gates } from "@nexushq/shared";
import { adapterFor } from "./adapters/index.ts";
import { agyCommand } from "./adapters/cli.ts";
import type { Schema } from "./json.ts";
import { gateSummary, loadSearchHistory, UNTRUSTED } from "./pipeline.ts";
import { inTempDir, resolveCommand, run, StoppedError } from "./proc.ts";
import { SCOUT_SERVER, SCOUT_TOOLS, SCOUT_URL, setScoutRun, startScoutServer, type ScoutRun } from "./scout-mcp.ts";

const SESSION_MS = 60 * 60_000;        // one agent session; the scout resumes from its scratchpad after
const QUOTA_RETRY_MS = 5 * 60_000;     // while agy is out of quota / signed out
const SILENT_WARN_MS = 10 * 60_000;
const MAX_IDLE_SESSIONS = 6;           // sessions in a row that accepted or rejected nothing (each one waits longer first)
const IDLE_BACKOFF_MAX_MIN = 10;       // pause after an empty session: 1, 2, 4, 8, 10 min

const SCOUT_SCHEMA: Schema = {
  type: "object", additionalProperties: false, required: ["status", "summary"],
  properties: { status: { type: "string", enum: ["target_reached", "exhausted", "continue"] }, summary: { type: "string" } },
};

const QUOTA = /quota|rate.?limit|resource.?exhausted|429|too many requests|unauthenticated|not (signed|logged) in|sign in again|login required|credits/i;

// Registers NexusHQ's MCP server in the Search agent's CLI once (user scope), like the Upwork server.
async function ensureRegistered(provider: string) {
  if (provider === "agy_cli") {
    const cmd = agyCommand();
    if (!cmd) throw new Error("`agy` not found");
    const list = await inTempDir((cwd) => run(cmd, ["mcp", "list"], { timeoutMs: 60_000, cwd }));
    if (list.stdout.split(/\r?\n/).some((l) => l.trim().split(/\s+/)[0] === SCOUT_SERVER)) return;
    const r = await inTempDir((cwd) => run(cmd, ["mcp", "add", SCOUT_SERVER, SCOUT_URL], { timeoutMs: 60_000, cwd }));
    if (r.code !== 0) throw new Error(`agy mcp add ${SCOUT_SERVER} failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
  } else if (provider === "claude_cli") {
    const cmd = resolveCommand("claude");
    if (!cmd) throw new Error("`claude` not found");
    const get = await inTempDir((cwd) => run(cmd, ["mcp", "get", SCOUT_SERVER], { timeoutMs: 90_000, cwd }));
    if (!/No MCP server named/i.test(`${get.stdout}${get.stderr}`) && get.code === 0) return;
    const r = await inTempDir((cwd) => run(cmd, ["mcp", "add", "--transport", "http", "--scope", "user", SCOUT_SERVER, SCOUT_URL], { timeoutMs: 60_000, cwd }));
    if (r.code !== 0) throw new Error(`claude mcp add ${SCOUT_SERVER} failed: ${(r.stderr || r.stdout).slice(0, 300)}`);
  } else {
    throw new Error("The scout needs Antigravity CLI or Claude Code as the Search agent (it uses MCP tools).");
  }
}

// What past runs taught, for the get_lessons tool: per-query outcomes, Claude's and your decisions, what you proposed
// on Upwork, and the scout's own lessons from earlier days.
export async function loadLessons(supabase: SupabaseClient): Promise<string> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [history, lessons, outcomes, proposals] = await Promise.all([
    loadSearchHistory(supabase),
    supabase.from("search_scratchpad").select("day, body").eq("section", "lessons").lt("day", new Date().toISOString().slice(0, 10))
      .order("day", { ascending: false }).limit(7),
    supabase.from("jobs").select("title, stage, reason").gte("found_at", since).in("stage", ["shortlisted", "bid", "skipped", "filtered_out"])
      .order("updated_at", { ascending: false }).limit(120),
    supabase.from("upwork_snapshots").select("data, fetched_at").eq("kind", "proposals").maybeSingle(),
  ]);
  const by = (stage: string, n: number) => ((outcomes.data ?? []) as { title: string; stage: string; reason: string | null }[])
    .filter((j) => j.stage === stage).slice(0, n).map((j) => `- ${j.title.slice(0, 90)}${j.reason ? ` — ${j.reason.slice(0, 140)}` : ""}`);
  const props = (Array.isArray(proposals.data?.data) ? proposals.data.data : []) as { job_title?: string; status_label?: string; bid?: string }[];
  const parts = [
    history || "No past searches yet.",
    `## You bid on (last 30 days)\n${by("bid", 15).join("\n") || "none yet"}`,
    `## Your proposals on Upwork${proposals.data ? ` (synced ${String(proposals.data.fetched_at).slice(0, 10)})` : ""}\n` +
      (props.slice(0, 15).map((p) => `- ${p.job_title ?? "?"} (${p.status_label ?? ""}${p.bid ? `, ${p.bid}` : ""})`).join("\n") || "none synced"),
    `## You skipped\n${by("skipped", 10).join("\n") || "none"}`,
    `## Claude shortlisted\n${by("shortlisted", 15).join("\n") || "none yet"}`,
    `## Claude dropped (its reasons)\n${by("filtered_out", 15).join("\n") || "none yet"}`,
    `## Your lessons from earlier days\n${((lessons.data ?? []) as { day: string; body: string }[]).map((l) => `### ${l.day}\n${l.body.slice(0, 1500)}`).join("\n") || "none yet"}`,
  ];
  return parts.join("\n\n").slice(0, 20_000);
}

function scoutPrompt(o: { target: number; accepted: number; focus: string; resumed: number }) {
  const t = (n: string) => `${SCOUT_SERVER}__${n}`;
  return `You are the scout: the Search agent of a freelancer's Upwork job finder. Your job decides everything after you:
only jobs you save reach the Filter agent (Claude), who picks the finest to bid on. Save NO garbage. Quality over speed;
take as long as you need.

GOAL: ${o.target - o.accepted} more good, never-seen jobs (target ${o.target}, ${o.accepted} saved so far)${o.focus ? `, focused on: "${o.focus}"` : ""}.
${o.resumed ? `This is session ${o.resumed + 1}: an earlier session stopped. Read the scratchpad and continue where it left off; do not repeat searches it lists unless they may have new jobs.\n` : ""}
TOOLS: NexusHQ tools (${t("…")}) for the freelancer's data, your scratchpad and your decisions; Upwork tools (read-only)
for searching. Call tools directly, one at a time. No shell commands, scripts or files. Never call a tool just to test
it: every search and every decision is recorded for real. Use real Upwork job ids from find_jobs only.

KEEP THE FREELANCER INFORMED: call ${t("log")} at every step change (reading a project, starting a search, opening a job)
and ${t("progress")} every 5 jobs or so with what you've done and what's next.

STEPS
1. ${t("scratchpad_read")}. If there is no fit_card for today (or it may be outdated), build one: ${t("get_profile")}, then
   ${t("get_project")} for EVERY project and ${t("list_experience")}. Write the fit_card (${t("scratchpad_write")}, section fit_card):
   core skills each with the project/role that proves it, project types done, seniority, domains, what the freelancer clearly does not do.
2. ${t("get_lessons")}: past searches and outcomes, what Claude kept/dropped, what the freelancer bid on or skipped, earlier lessons.
   Derive today's criteria from them yourself (patterns in what wins and what gets dropped).
3. Plan searches (2-5 keyword queries each) from the fit card + lessons: reuse winners, avoid wasters, always explore some new.
4. For each search: ${t("start_search")} → Upwork list_accounts (once, for org_uid) → find_jobs ("search" with the query, or
   "smart_search" for recommended; page through results) → ${t("check_seen")} on the ids (ALWAYS, before judging; never
   judge a seen id) → first a quick pass on the list data: a job that is closed, already hired/filled, or posted more than
   7 days ago gets ${t("reject_job")} right away ("closed" / "already hired" / "older than 7 days") WITHOUT opening it.
   Then judge every remaining UNSEEN job:
   a) Can the freelancer do it? Name the project(s)/role that prove it. If unsure, ${t("get_project")} to check.
   b) Is it real work? Clear scope; not spam, not a disguised free "test task", not vague.
   c) Is the client trustworthy? Open the job (find_jobs "get") for client facts. ${t("get_client")} first; build the dossier:
      payment verified, total spent, hire rate, jobs posted, rating, member since, country, notable review quotes,
      company + website if stated, red flags.
      HARD REJECT: asks to contact/pay outside Upwork (Telegram, WhatsApp, email), asks to install/run something,
      unpaid test that is the real work, reviews mentioning non-payment or scams.
      SOFT FLAGS (record in red_flags, still may accept): unverified payment with $0 spent, low hire rate with many posts,
      brand-new account claiming a big company, budget far above the scope.
   Accept only when (a), (b), (c) all pass: ${t("accept_job")} with why, proof and the client dossier.
   Otherwise ${t("reject_job")} with a one-sentence reason. Unsure after checking → reject. Every unseen job gets one decision.
5. After each search: ${t("scratchpad_write")} section "searches": the query, how many judged, accepted, and what kind of
   junk it brought (so later sessions and days learn).
6. Stop when accept_job says the target is reached, or when good searches keep returning only seen/rejected jobs.
   Before stopping write section "lessons" (replace): what worked, what to avoid, which queries to try next time.

PACE: do at most 3 searches in this session, then stop and return; the next session continues from the scratchpad.
Your decisions are already saved by the tools, so stopping loses nothing.

ALWAYS finish with the final JSON answer, even if something went wrong: status "target_reached", "exhausted" (Upwork
has nothing more worth saving now) or "continue" (more to do), and a 2-3 sentence summary.
${UNTRUSTED}`;
}

export interface ScoutResult { accepted: number; rejected: number; searches: number; status: string; minutes: number }

export async function runScout(supabase: SupabaseClient, o: {
  runId: string; focus: string; target: number; hours: number; progressMin: number; gates: Gates;
  searchCfg: AgentConfig; signal: AbortSignal; log: (line: string) => Promise<void>;
}): Promise<ScoutResult> {
  await startScoutServer();
  await ensureRegistered(o.searchCfg.provider);
  const cfg: AgentConfig = {
    ...o.searchCfg, fallback: null, options: { ...o.searchCfg.options, timeoutMs: SESSION_MS },
    mcp: { server: "upwork", allow: UPWORK_READ_TOOLS, deny: UPWORK_WRITE_TOOLS, extra: [{ server: SCOUT_SERVER, allow: SCOUT_TOOLS }] },
  };
  const started = Date.now();
  const stats: ScoutRun["stats"] = { accepted: 0, rejected: 0, judged: 0, searches: 0, query: "", reasons: new Map(), lastAgentAt: Date.now(), lastAgentLine: "" };
  const log = async (line: string) => { stats.lastAgentLine = line; await o.log(line); };
  setScoutRun({ supabase, runId: o.runId, target: o.target, gates: o.gates, gate: gateSummary, lessons: () => loadLessons(supabase), log, stats });

  const mins = () => Math.round((Date.now() - started) / 60_000);
  const heartbeat = setInterval(() => {
    const top = [...stats.reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, n]) => `${r} (${n})`).join(", ");
    const silent = Date.now() - stats.lastAgentAt;
    void o.log(`⏱ ${mins()} min · accepted ${stats.accepted}/${o.target} · rejected ${stats.rejected} · searches ${stats.searches}` +
      (stats.query ? ` · now: "${stats.query}"` : "") + (top ? ` · top rejects: ${top}` : "") +
      (silent > SILENT_WARN_MS ? ` · ⚠ agent silent ${Math.round(silent / 60_000)} min (still thinking or stuck in a tool call)` : ""));
  }, o.progressMin * 60_000);

  let status = "continue", idle = 0, session = 0;
  try {
    while (stats.accepted < o.target && Date.now() - started < o.hours * 3_600_000) {
      if (o.signal.aborted) throw new StoppedError();
      const before = stats.judged;
      await o.log(`🤖 scout session ${session + 1} starting (${stats.accepted}/${o.target} accepted)`);
      try {
        const r = await adapterFor(cfg.provider).complete<{ status: string; summary: string }>(
          scoutPrompt({ target: o.target, accepted: stats.accepted, focus: o.focus, resumed: session }), SCOUT_SCHEMA, cfg, { signal: o.signal });
        status = r.data.status;
        await o.log(`🤖 session ${session + 1} ended: ${status} — ${r.data.summary.slice(0, 400)}`);
      } catch (e) {
        if (e instanceof StoppedError) throw e;
        const msg = (e as Error).message;
        if (QUOTA.test(msg)) {
          await o.log(`⏸ ${cfg.provider} looks out of quota or signed out (${msg.slice(0, 160)}). Switch/re-login the account; ` +
            `retrying in ${QUOTA_RETRY_MS / 60_000} min. Progress is kept.`);
          await sleep(QUOTA_RETRY_MS, o.signal);
          continue;
        }
        // agy sometimes ends a long tool session without the final JSON; the decisions are saved, so just carry on.
        await o.log(/no structured_output/i.test(msg)
          ? `🤖 session ${session + 1} ended without a summary (decisions are saved); continuing`
          : `⚠ session ${session + 1} stopped: ${msg.slice(0, 300)}`);
        status = "continue";
      }
      session++;
      if (status === "exhausted" || stats.accepted >= o.target) break;
      idle = stats.judged === before ? idle + 1 : 0;
      if (idle >= MAX_IDLE_SESSIONS) { await o.log(`scout made no progress in ${idle} sessions in a row; stopping the search`); break; }
      if (idle > 0) {
        // Quick empty sessions are usually agy hiccups or a rate limit, not "nothing left": wake it up again after a growing pause.
        const waitMin = Math.min(2 ** (idle - 1), IDLE_BACKOFF_MAX_MIN);
        await o.log(`😴 session ${session} judged nothing (${idle}/${MAX_IDLE_SESSIONS} empty in a row); waiting ${waitMin} min, then waking the scout again`);
        await sleep(waitMin * 60_000, o.signal);
      }
    }
  } finally {
    clearInterval(heartbeat);
    setScoutRun(null);
  }
  if (stats.accepted >= o.target) status = "target_reached";
  else if (status === "continue") status = Date.now() - started >= o.hours * 3_600_000 ? "time_cap" : "stopped_early";
  return { accepted: stats.accepted, rejected: stats.rejected, searches: stats.searches, status, minutes: mins() };
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); reject(new StoppedError()); }, { once: true });
  });
}
