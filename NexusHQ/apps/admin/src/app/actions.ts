"use server";

// Every admin write goes through here. Each action re-checks the admin role (requireAdmin) before touching data,
// and the database enforces the same rule again through RLS, so a forged request cannot write either way.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { HOSTED, HOSTED_ONLY_LOCAL } from "@/lib/hosted";
import { createClient } from "@/lib/supabase/server";
import { LIST_SECTIONS, allFields, slugify, type Field, type ListTable } from "@/lib/sections";
import type { Database, Json } from "@/lib/database.types";
import {
  AGENTS, COMING_LATER, COST_LIMITS, INSTRUCTIONS_MAX, LISTINGS_LIMITS, MESSAGE_MAX, PROFILE_ACTIONS, SHORTLIST_LIMITS,
  checkProfileParams, isProfileAction, isBackend, isMcpCli, isMcpServerId, isModeEnabled, isProviderEnabled, isProviderId, isSecretName, PROVIDERS, V1_COMMANDS,
  type AgentId, type CommandKind, type ProviderChoice,
} from "@nexushq/shared";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

type Values = Record<string, unknown>;
type T = Database["public"]["Tables"];
const STATUSES = ["published", "draft", "hidden"];

function str(v: unknown) {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}
function strList(v: unknown) {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

// Coerce one submitted value to the column type implied by its field definition.
function coerce(f: Field, v: unknown): unknown {
  switch (f.type) {
    case "tags":
    case "lines":
      return strList(v);
    case "links":
      return (Array.isArray(v) ? v : [])
        .map((l) => ({ label: str((l as Values)?.label), url: str((l as Values)?.url) }))
        .filter((l) => l.label || l.url);
    case "media":
      return (Array.isArray(v) ? v : []).filter((item) => item && typeof item === "object").slice(0, 500)
        .map((item) => {
          const row = item as Values;
          return { kind: row.kind === "video" ? "video" : "image", path: str(row.path), label: str(row.label) };
        })
        .filter((item) => item.path && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(item.path.replace(/^https?:\/\//i, "")));
    case "toggle":
      return v === true || v === "true" || v === "on";
    case "number":
      return Number.isFinite(Number(v)) ? Number(v) : 0;
    case "image":
    case "date":
      return str(v) || null;
    case "select":
      return f.k.endsWith("_id") ? str(v) || null : str(v);
    case "status":
      return STATUSES.includes(str(v)) ? str(v) : "draft";
    default:
      return str(v);
  }
}

function fail(error: { message: string; code?: string } | null): ActionResult {
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, error: "That slug is already used by another entry." };
  return { ok: false, error: error.message };
}

// ---------------------------------------------------------------------------------------------- list sections

export async function saveRow(section: string, id: string | null, values: Values): Promise<ActionResult> {
  await requireAdmin();
  const def = LIST_SECTIONS[section];
  if (!def) return { ok: false, error: "Unknown section" };

  const row: Values = {};
  for (const f of allFields(def)) {
    if (!(f.k in values)) continue;
    row[f.k] = coerce(f, values[f.k]);
    if (f.required && !row[f.k]) return { ok: false, error: `${f.label} is required.` };
  }
  if (def.slug && !row.slug) row.slug = slugify(str(row[def.titleKey])) || crypto.randomUUID().slice(0, 8);
  if (def.table === "articles" && typeof row.body_md === "string") {
    row.read_minutes = Math.max(1, Math.round(row.body_md.split(/\s+/).filter(Boolean).length / 220));
  }

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from(def.table as ListTable).update(row as never).eq("id", id);
    if (error) return fail(error);
    revalidatePath(`/${section}`);
    return { ok: true, id };
  }
  // New rows go to the end of the list.
  const { data: last } = await supabase.from(def.table as ListTable).select("sort_order").order("sort_order", { ascending: false }).limit(1);
  row.sort_order = ((last?.[0] as { sort_order?: number } | undefined)?.sort_order ?? -1) + 1;
  const { data, error } = await supabase.from(def.table as ListTable).insert(row as never).select("id").single();
  if (error) return fail(error);
  revalidatePath(`/${section}`);
  return { ok: true, id: data.id };
}

export async function deleteRow(section: string, id: string): Promise<ActionResult> {
  await requireAdmin();
  const def = LIST_SECTIONS[section];
  if (!def) return { ok: false, error: "Unknown section" };
  const supabase = await createClient();
  const { error } = await supabase.from(def.table as ListTable).delete().eq("id", id);
  revalidatePath(`/${section}`);
  return fail(error);
}

export async function reorderRows(section: string, ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  const table = section === "testimonials" ? "testimonials" : LIST_SECTIONS[section]?.table;
  if (!table) return { ok: false, error: "Unknown section" };
  if (new Set(ids).size !== ids.length) return { ok: false, error: "Each item must appear only once." };
  const supabase = await createClient();
  const results = await Promise.all(
    ids.map((id, i) => supabase.from(table as ListTable | "testimonials").update({ sort_order: i } as never).eq("id", id)),
  );
  revalidatePath(`/${section}`);
  return fail(results.find((r) => r.error)?.error ?? null);
}

// ---------------------------------------------------------------------------------------------- singletons

const PROFILE_TEXT = ["name", "role", "headline", "intro", "location", "work_mode", "availability", "currently", "email",
  "contact_headline", "contact_lead", "contact_reply"] as const;

export async function saveProfile(values: Values): Promise<ActionResult> {
  await requireAdmin();
  const row: T["profile"]["Update"] = {};
  for (const k of PROFILE_TEXT) if (k in values) row[k] = str(values[k]);
  if ("avatar_path" in values) row.avatar_path = str(values.avatar_path) || null;
  if ("resume_path" in values) row.resume_path = str(values.resume_path) || null;
  if ("story" in values) row.story = strList(values.story);
  if ("stack" in values) row.stack = strList(values.stack);
  if ("contact_form_enabled" in values) row.contact_form_enabled = values.contact_form_enabled === true;
  if ("socials" in values) row.socials = coerce({ k: "socials", label: "", type: "links" }, values.socials) as Json;
  if ("principles" in values) {
    row.principles = (Array.isArray(values.principles) ? values.principles : [])
      .map((p) => ({ title: str((p as Values).title), body: str((p as Values).body) }))
      .filter((p) => p.title || p.body);
  }
  if ("stats" in values) {
    row.stats = (Array.isArray(values.stats) ? values.stats : [])
      .map((s) => ({
        value: Number((s as Values).value) || 0,
        prefix: str((s as Values).prefix),
        suffix: str((s as Values).suffix),
        label: str((s as Values).label),
      }))
      .filter((s) => s.label);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("profile").update(row).eq("id", true);
  revalidatePath("/profile");
  return fail(error);
}

export async function saveSettings(values: Values): Promise<ActionResult> {
  await requireAdmin();
  const row: T["site_settings"]["Update"] = {};
  for (const k of ["cafe_neon", "cafe_neon_sub", "cafe_window_neon", "cafe_door_neon", "cafe_what_i_do"] as const) {
    if (k in values) row[k] = str(values[k]);
  }
  if ("open_collection_enabled" in values) row.open_collection_enabled = values.open_collection_enabled === true;
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").update(row).eq("id", true);
  revalidatePath("/cafe");
  revalidatePath("/testimonials");
  return fail(error);
}

// ---------------------------------------------------------------------------------------------- AI agents

const AGENT_IDS: AgentId[] = AGENTS.map((a) => a.id);
const MODEL_RE = /^[\w.:/@+-]{0,200}$/;

function numOpt(v: unknown, min: number, max: number): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
}

// Validates one provider choice against the shared catalog. Base URLs only for local providers, and only
// http(s), since the worker will fetch them.
function providerChoice(v: Values): ProviderChoice | string {
  if (!isProviderId(v.provider)) return "Unknown provider.";
  if (!isProviderEnabled(v.provider)) return COMING_LATER;
  if (v.backend && v.backend !== "login") return COMING_LATER;
  const def = PROVIDERS[v.provider];
  const model = str(v.model);
  if (!MODEL_RE.test(model)) return "Model names may only contain letters, digits and . : / @ + - _";
  let base_url: string | null = null;
  if (def.mode === "local") {
    base_url = str(v.base_url) || def.defaultBaseUrl || null;
    if (base_url && !/^https?:\/\/[^\s]+$/i.test(base_url)) return "Base URL must start with http:// or https://";
  }
  const backend = def.backends ? (isBackend(v.provider, v.backend) ? v.backend : "login") : null;
  return { provider: v.provider, model, backend, base_url };
}

export async function saveAgentSettings(agent: string, values: Values): Promise<ActionResult> {
  await requireAdmin();
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL };
  if (!AGENT_IDS.includes(agent as AgentId)) return { ok: false, error: "Unknown agent." };
  const main = providerChoice(values);
  if (typeof main === "string") return { ok: false, error: main };
  // The Search agent calls Upwork tools; only CLIs with a verified read-only allowlist may do that (worker cli.ts).
  if (AGENTS.find((a) => a.id === agent)?.usesUpwork && main.provider === "codex_cli") {
    return { ok: false, error: "Codex can't be the Search agent (no read-only tool allowlist). Use Claude Code or Antigravity." };
  }
  let fallback: ProviderChoice | null = null;
  const fb = values.fallback as Values | null | undefined;
  if (fb && fb.provider) {
    const c = providerChoice(fb);
    if (typeof c === "string") return { ok: false, error: `Fallback: ${c}` };
    if (c.provider === main.provider && c.model === main.model) return { ok: false, error: "Fallback is the same as the main choice." };
    fallback = c;
  }
  const o = (values.options ?? {}) as Values;
  const options = {
    temperature: numOpt(o.temperature, 0, 2),
    maxTokens: numOpt(o.maxTokens, 1, 64000),
    timeoutMs: numOpt(o.timeoutMs, 5_000, 30 * 60_000),
    dailyCap: numOpt(o.dailyCap, 0, 100_000),
    // Role-specific sizes; stored only on the agent they belong to.
    maxListings: agent === "search" ? numOpt(o.maxListings, LISTINGS_LIMITS.min, LISTINGS_LIMITS.max) : undefined,
    shortlistPercent: agent === "filter" ? numOpt(o.shortlistPercent, SHORTLIST_LIMITS.min, SHORTLIST_LIMITS.max) : undefined,
    maxCostUsd: agent === "filter" ? numOpt(o.maxCostUsd, COST_LIMITS.min, COST_LIMITS.max) : undefined,
    gateMinHourly: agent === "filter" ? numOpt(o.gateMinHourly, 0, 500) : undefined,
    gateMinFixed: agent === "filter" ? numOpt(o.gateMinFixed, 0, 100_000) : undefined,
    gateSkipCrowded: agent === "filter" && typeof o.gateSkipCrowded === "boolean" ? o.gateSkipCrowded : undefined,
    gateRequireVerified: agent === "filter" && typeof o.gateRequireVerified === "boolean" ? o.gateRequireVerified : undefined,
    instructions: str(o.instructions).slice(0, INSTRUCTIONS_MAX) || undefined,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("agent_settings").upsert({
    agent: agent as AgentId, ...main, options: JSON.parse(JSON.stringify(options)) as Json, fallback: fallback as unknown as Json,
  });
  revalidatePath("/agents");
  return fail(error);
}

// Sets, replaces or (empty value) clears one provider key in Supabase Vault. Write-only: nothing ever reads a
// value back into the admin; the worker fetches them itself with get_agent_secrets().
export async function setAgentSecret(name: string, value: string): Promise<ActionResult> {
  await requireAdmin();
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL };
  if (!isModeEnabled("cloud")) return { ok: false, error: COMING_LATER }; // keys are unused in the CLI-only version
  if (!isSecretName(name)) return { ok: false, error: "Unknown key." };
  const v = str(value);
  if (v.length > 8000) return { ok: false, error: "That value is too long." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_agent_secret", { p_name: name, p_value: v });
  revalidatePath("/agents");
  return fail(error);
}

// Admin -> worker request. Only the kinds the v1 worker handles can be queued from the UI.
export async function queueCommand(kind: string, payload: Values = {}): Promise<ActionResult> {
  await requireAdmin();
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL };
  if (!V1_COMMANDS.includes(kind as CommandKind)) return { ok: false, error: "Unknown command." };
  let clean: Values = {};
  if (kind === "test_agent") {
    if (!AGENT_IDS.includes(payload.agent as AgentId)) return { ok: false, error: "Unknown agent." };
    clean = { agent: payload.agent };
  } else if (kind === "refresh_models") {
    clean = isProviderId(payload.provider) ? { provider: payload.provider } : {};
  } else if (kind === "pull_model") {
    const model = str(payload.model);
    if (!model || !MODEL_RE.test(model)) return { ok: false, error: "Invalid model name." };
    clean = { model };
  } else if (kind === "mcp_check") {
    clean = { ...(isMcpCli(payload.cli) ? { cli: payload.cli } : {}), ...(isMcpServerId(payload.server) ? { server: payload.server } : {}) };
  } else if (kind.startsWith("mcp_")) {
    if (!isMcpCli(payload.cli) || !isMcpServerId(payload.server)) return { ok: false, error: "Unknown CLI or MCP server." };
    clean = { cli: payload.cli, server: payload.server };
  } else if (kind === "run_now") {
    clean = { focus: str(payload.focus).slice(0, 200) };
  } else if (kind === "draft_job") {
    if (!UUID_RE.test(str(payload.job_id))) return { ok: false, error: "Unknown job." };
    clean = { job_id: str(payload.job_id) };
  } else if (kind === "upwork_preview" || kind === "upwork_confirm") {
    // Upwork writes are queued only by the actions below, after their status checks.
    return { ok: false, error: "Use the Preview / Confirm buttons." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("commands").insert({ kind, payload: clean as Json }).select("id").single();
  revalidatePath("/agents");
  revalidatePath("/jobs");
  return error ? fail(error) : { ok: true, id: data.id };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Job radar: you mark what you did with a job. Bid jobs are kept past the 30-day cleanup.
export async function setJobStage(id: string, stage: "bid" | "skipped" | "shortlisted"): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id) || !["bid", "skipped", "shortlisted"].includes(stage)) return { ok: false, error: "Invalid job or stage." };
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ stage }).eq("id", id);
  revalidatePath("/jobs");
  return error ? fail(error) : { ok: true };
}

// Stop button: asks the worker to end a running Find jobs run (it checks every few seconds and kills the agent).
export async function stopRun(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL };
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown run." };
  const supabase = await createClient();
  const { error } = await supabase.from("job_runs").update({ status: "stopping" }).eq("id", id).eq("status", "running");
  revalidatePath("/jobs");
  return error ? fail(error) : { ok: true };
}

// ---- Upwork inbox / Profile sync (roadmap I + J). Every Upwork write: you press a button here, the row moves to the
// next status, and only then is the worker command queued. The worker checks the status again before acting.

async function queueUpwork(kind: "upwork_preview" | "upwork_confirm", actionId: string) {
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL } as ActionResult;
  const supabase = await createClient();
  const { error } = await supabase.from("commands").insert({ kind, payload: { action_id: actionId } as Json });
  revalidatePath("/upwork");
  return error ? fail(error) : ({ ok: true } as ActionResult);
}

// Keeps your edited reply in the room (nothing is sent).
export async function saveReplyDraft(roomId: string, text: string): Promise<ActionResult> {
  await requireAdmin();
  if (!roomId || roomId.length > 200) return { ok: false, error: "Unknown conversation." };
  if (text.length > MESSAGE_MAX) return { ok: false, error: `Too long (${MESSAGE_MAX} characters max).` };
  const supabase = await createClient();
  const { error } = await supabase.from("upwork_rooms").update({ reply_draft: text }).eq("room_id", roomId);
  revalidatePath("/upwork");
  return error ? fail(error) : { ok: true };
}

// You pressed Send on a reply: the exact text is stored and the worker sends it (send_message has no Upwork preview).
export async function sendReply(roomId: string, text: string): Promise<ActionResult> {
  await requireAdmin();
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL };
  const message = text.trim();
  if (!message) return { ok: false, error: "The reply is empty." };
  if (message.length > MESSAGE_MAX) return { ok: false, error: `Too long (${MESSAGE_MAX} characters max).` };
  const supabase = await createClient();
  const { data: room } = await supabase.from("upwork_rooms").select("room_id, other_party").eq("room_id", roomId).maybeSingle();
  if (!room) return { ok: false, error: "Unknown conversation. Press Check Upwork first." };
  await supabase.from("upwork_rooms").update({ reply_draft: message }).eq("room_id", roomId);
  const { data, error } = await supabase.from("upwork_actions").insert({
    kind: "message", action: "send", params: { room_id: roomId, message } as Json,
    label: `Reply to ${room.other_party || "client"}`, status: "confirming",
  }).select("id").single();
  if (error) return fail(error);
  return queueUpwork("upwork_confirm", data.id);
}

// Your edits to a proposed profile update (before previewing it on Upwork).
export async function saveProfileAction(id: string, values: Values): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown update." };
  const supabase = await createClient();
  const { data: act } = await supabase.from("upwork_actions").select("action, status").eq("id", id).maybeSingle();
  if (!act || !isProfileAction(act.action)) return { ok: false, error: "Unknown update." };
  if (!["draft", "preview_ready", "error"].includes(act.status)) return { ok: false, error: `This update is ${act.status}.` };
  const key = PROFILE_ACTIONS[act.action].param;
  const params = { [key]: act.action === "set_skills" ? strList(values[key]) : str(values[key]) };
  const bad = checkProfileParams(act.action, params);
  if (bad) return { ok: false, error: bad };
  // A changed value needs a new preview.
  const { error } = await supabase.from("upwork_actions").update({ params: params as Json, status: "draft", preview: null, preview_id: null, error: null }).eq("id", id);
  revalidatePath("/upwork");
  return error ? fail(error) : { ok: true };
}

// "Preview on Upwork": Upwork prepares the change and shows what it will do. Nothing changes yet.
export async function previewProfileAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL };
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown update." };
  const supabase = await createClient();
  const { data: act } = await supabase.from("upwork_actions").select("status, kind").eq("id", id).maybeSingle();
  if (!act || act.kind !== "profile_update") return { ok: false, error: "Unknown update." };
  if (!["draft", "preview_ready", "error"].includes(act.status)) return { ok: false, error: `This update is ${act.status}.` };
  return queueUpwork("upwork_preview", id);
}

// Confirm: applies the previewed change on Upwork. Only after a preview.
export async function confirmProfileAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (HOSTED) return { ok: false, error: HOSTED_ONLY_LOCAL };
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown update." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("upwork_actions").update({ status: "confirming" })
    .eq("id", id).eq("kind", "profile_update").eq("status", "preview_ready").select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Preview it on Upwork first." };
  return queueUpwork("upwork_confirm", id);
}

export async function cancelUpworkAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown update." };
  const supabase = await createClient();
  const { error } = await supabase.from("upwork_actions").update({ status: "cancelled" }).eq("id", id).in("status", ["draft", "preview_ready", "error"]);
  revalidatePath("/upwork");
  return error ? fail(error) : { ok: true };
}

// Upwork inbox → Skills: adds one suggested skill to one of your skill groups (case-insensitive duplicates skipped).
export async function addSkillToGroup(groupId: string, skill: string): Promise<ActionResult> {
  await requireAdmin();
  const name = str(skill).slice(0, 60);
  if (!UUID_RE.test(groupId) || !name) return { ok: false, error: "Pick a skill group." };
  const supabase = await createClient();
  const { data: group, error: gErr } = await supabase.from("skill_groups").select("skills").eq("id", groupId).maybeSingle();
  if (gErr || !group) return gErr ? fail(gErr) : { ok: false, error: "Skill group not found." };
  if ((group.skills ?? []).some((s) => s.toLowerCase() === name.toLowerCase())) return { ok: true };
  const { error } = await supabase.from("skill_groups").update({ skills: [...(group.skills ?? []), name] }).eq("id", groupId);
  revalidatePath("/upwork");
  revalidatePath("/skills");
  return error ? fail(error) : { ok: true };
}

// Your edits to a job's draft (cover letter, resume highlights, questions). Rewrite draft replaces them.
export async function saveDraft(id: string, values: Values): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown job." };
  const cover_letter = str(values.cover_letter);
  if (!cover_letter) return { ok: false, error: "The cover letter is empty." };
  if (cover_letter.length > 5000) return { ok: false, error: "The cover letter is too long (5000 characters max)." };
  const lines = (v: unknown) => strList(v).slice(0, 12).map((s) => s.slice(0, 500));
  const draft = { cover_letter, resume_highlights: lines(values.resume_highlights), questions: lines(values.questions) };
  const supabase = await createClient();
  const { error } = await supabase.from("jobs").update({ draft: draft as unknown as Json }).eq("id", id);
  revalidatePath("/jobs");
  return error ? fail(error) : { ok: true };
}

export async function saveCafePanel(zone: string, values: Values): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("cafe_panels")
    .update({ kicker: str(values.kicker), title: str(values.title), body: str(values.body), menu_label: str(values.menu_label) })
    .eq("zone", zone);
  revalidatePath("/cafe");
  return fail(error);
}

export async function saveCredit(id: string | null, values: Values): Promise<ActionResult> {
  await requireAdmin();
  const row = { model: str(values.model), artist: str(values.artist), license: str(values.license) || "CC BY 4.0", source_url: str(values.source_url) };
  if (!row.model || !row.artist) return { ok: false, error: "Model and artist are required." };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("model_credits").update(row).eq("id", id);
    revalidatePath("/cafe");
    return fail(error);
  }
  const { count } = await supabase.from("model_credits").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("model_credits").insert({ ...row, sort_order: count ?? 0 });
  revalidatePath("/cafe");
  return fail(error);
}

export async function deleteCredit(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("model_credits").delete().eq("id", id);
  revalidatePath("/cafe");
  return fail(error);
}

// ---------------------------------------------------------------------------------------------- testimonials

export async function saveTestimonial(id: string | null, values: Values): Promise<ActionResult> {
  await requireAdmin();
  const kind = ["text", "video", "audio"].includes(str(values.kind)) ? (str(values.kind) as "text") : "text";
  const rating = Number(values.rating);
  const row: T["testimonials"]["Update"] = {
    name: str(values.name),
    role: str(values.role),
    quote: str(values.quote),
    pull_quote: str(values.pull_quote),
    source_label: str(values.source_label),
    source_url: str(values.source_url) || null,
    reviewed_on: str(values.reviewed_on) || null,
    transcript: str(values.transcript),
    rating: rating >= 1 && rating <= 5 ? rating : null,
    consent: values.consent === true,
    placements: strList(values.placements),
    project_id: str(values.project_id) || null,
    avatar_path: str(values.avatar_path) || null,
    poster_path: str(values.poster_path) || null,
    trim_start_s: Math.max(0, Number(values.trim_start_s) || 0),
    trim_end_s: Number(values.trim_end_s) > 0 ? Number(values.trim_end_s) : null,
  };
  if (!row.name) return { ok: false, error: "Name is required." };
  if (row.source_url && !/^https?:\/\/[^\s]+$/i.test(row.source_url)) return { ok: false, error: "Review source must be an HTTP or HTTPS link." };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("testimonials").update(row).eq("id", id);
    revalidatePath("/testimonials");
    return fail(error);
  }
  // Manually added testimonials (e.g. pasted from an email) start approved, with media uploaded to the public bucket.
  const { data, error } = await supabase
    .from("testimonials")
    .insert({ ...row, name: row.name!, kind, source: "manual", state: "approved", media_path: str(values.media_path) || null })
    .select("id")
    .single();
  revalidatePath("/testimonials");
  return error ? fail(error) : { ok: true, id: data.id };
}

// Approving moves any uploaded media from the private submissions bucket into the public portfolio bucket,
// so pending recordings are never publicly reachable.
export async function setTestimonialState(id: string, state: "approved" | "rejected" | "archived" | "pending"): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: t, error: readErr } = await supabase.from("testimonials").select("media_path, avatar_path").eq("id", id).single();
  if (readErr) return fail(readErr);

  const update: T["testimonials"]["Update"] = { state };
  if (state === "approved") {
    for (const key of ["media_path", "avatar_path"] as const) {
      const path = t[key];
      if (!path?.startsWith("incoming/")) continue;
      const dest = `testimonials/${id}-${path.split("/").pop()}`;
      const { error } = await supabase.storage.from("testimonial-uploads").copy(path, dest, { destinationBucket: "portfolio" });
      if (error) return { ok: false, error: `Could not publish media: ${error.message}` };
      update[key] = dest;
    }
  }
  const { error } = await supabase.from("testimonials").update(update).eq("id", id);
  revalidatePath("/testimonials");
  revalidatePath("/");
  return fail(error);
}

export async function deleteTestimonial(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: t } = await supabase.from("testimonials").select("media_path, avatar_path").eq("id", id).single();
  const { error } = await supabase.from("testimonials").delete().eq("id", id);
  if (!error && t) {
    const files = [t.media_path, t.avatar_path].filter((p): p is string => !!p);
    const incoming = files.filter((p) => p.startsWith("incoming/"));
    const published = files.filter((p) => !p.startsWith("incoming/"));
    if (incoming.length) await supabase.storage.from("testimonial-uploads").remove(incoming);
    if (published.length) await supabase.storage.from("portfolio").remove(published);
  }
  revalidatePath("/testimonials");
  return fail(error);
}

export async function createRequest(values: Values): Promise<ActionResult> {
  await requireAdmin();
  const allowed = strList(values.allowed_kinds).filter((k) => ["text", "video", "audio"].includes(k)) as ("text" | "video" | "audio")[];
  const row = {
    client_name: str(values.client_name),
    email: str(values.email),
    project_id: str(values.project_id) || null,
    note: str(values.note),
    allowed_kinds: allowed.length ? allowed : (["text", "video", "audio"] as ("text" | "video" | "audio")[]),
  };
  if (!row.client_name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) {
    return { ok: false, error: "A client name and a valid email are required." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("testimonial_requests").insert(row).select("id").single();
  revalidatePath("/testimonials");
  return error ? fail(error) : { ok: true, id: data.id };
}

export async function deleteRequest(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("testimonial_requests").delete().eq("id", id);
  revalidatePath("/testimonials");
  return fail(error);
}

// ---------------------------------------------------------------------------------------------- inbox

export async function setMessageRead(id: string, read: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").update({ read_at: read ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/messages");
  return fail(error);
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").delete().eq("id", id);
  revalidatePath("/messages");
  return fail(error);
}

// ---------------------------------------------------------------------------------------------- auth

export async function signIn(_: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(form.get("email")), password: String(form.get("password") ?? "") });
  if (error) return { error: "Wrong email or password." };
  const next = str(form.get("next"));
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
