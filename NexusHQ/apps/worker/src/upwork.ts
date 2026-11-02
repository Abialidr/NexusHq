// Roadmap I + J: your Upwork activity in the admin, and the only Upwork writes the worker ever makes.
//   syncUpwork    "Check Upwork" (Upwork inbox agent, read-only tools): proposals, invites, offers, contracts and the
//                 dashboard with a brief; message rooms with a summary and a reply draft for the ones waiting on you.
//   profileSync   (Profile sync agent, read-only tools): reads your Upwork profile, compares it with the admin profile
//                 and stores proposed updates as draft upwork_actions. Nothing is sent.
//   previewAction you pressed "Preview on Upwork": update_profile creates a preview on Upwork. Changes nothing.
//   confirmAction you pressed Confirm: confirm_preview runs exactly the stored preview, or send_message sends your reply.
// Each write call allows exactly one write tool (UPWORK_CONFIRMED_TOOLS) and every other write tool stays denied.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROFILE_ACTIONS, ROOM_RETENTION_DAYS, UPWORK_ACTIVITY_TOOLS, UPWORK_WRITE_TOOLS, checkProfileParams, isProfileAction,
  type AgentConfig, type AgentId, type UpworkAction, type UpworkMessage,
} from "@nexushq/shared";
import { loadAgentConfigs, runAgent } from "./agents.ts";
import type { Schema } from "./json.ts";
import { TOOLS_ONLY, UNTRUSTED, loadProfileBrief, obj, str, strs, bool, withRules } from "./pipeline.ts";

// The agent's settings with Upwork tools: the read-only activity set, plus at most one confirmed write tool.
async function upworkCfg(supabase: SupabaseClient, agent: AgentId, write?: (typeof UPWORK_WRITE_TOOLS)[number]): Promise<AgentConfig> {
  const cfg = (await loadAgentConfigs(supabase)).find((c) => c.agent === agent);
  if (!cfg) throw new Error(`No settings for the ${agent} agent. Pick a provider in AI agents.`);
  if (cfg.provider === "codex_cli") throw new Error("Codex can't use Upwork tools. Pick Claude Code or Antigravity for this agent.");
  // agy's tool permissions are permanent allow rules in its settings file, so a write tool given to agy once would stay
  // callable in every later agy run (Search included). Claude Code's --allowedTools lasts for one call only.
  if (write && cfg.provider !== "claude_cli") throw new Error("Upwork changes run through Claude Code only. Set the Upwork inbox agent to Claude Code.");
  const allow = write ? ["list_accounts", "get_messages", write] : [...UPWORK_ACTIVITY_TOOLS];
  return { ...cfg, fallback: null, mcp: { server: "upwork", allow, deny: UPWORK_WRITE_TOOLS.filter((t) => t !== write) } };
}

const arr = (items: Schema): Schema => ({ type: "array", items });

// ---------------------------------------------------------------------------------------------------------
// I1 + J2: activity (proposals, invites, offers, contracts, dashboard) with a brief
// ---------------------------------------------------------------------------------------------------------

const ACTIVITY_SCHEMA = obj({
  org_uid: str,
  brief: str,
  dashboard: str,
  connects_balance: { type: "number" },
  proposals: arr(obj({ id: str, job_title: str, status_label: str, created: str, viewed_by_client: bool, bid: str })),
  invitations: arr(obj({ id: str, job_id: str, job_title: str, client: str, created: str, note: str })),
  offers: arr(obj({ id: str, title: str, client: str, status: str, terms: str })),
  contracts: arr(obj({ id: str, title: str, client: str, status: str, started: str })),
});
type Activity = {
  org_uid: string; brief: string; dashboard: string; connects_balance: number;
  proposals: unknown[]; invitations: unknown[]; offers: unknown[]; contracts: unknown[];
};

function activityPrompt() {
  return `You are the Upwork inbox agent of a freelancer's assistant. Use only the Upwork tools available to you; they are
read-only. ${TOOLS_ONLY}
1. Call list_accounts and use the org_uid of the Freelancer account.
2. Call get_freelancer_dashboard (action "check").
3. Call list_freelancer_proposals action "list" (status Accepted, limit 10) and action "invitations" (status pending, limit 10).
4. Call list_offers action "list_mine", and list_contracts (call get_tool_help for list_contracts first if unsure) for active contracts.
Return what you found in the schema ("" for unknown text, -1 for an unknown number, empty lists when there is nothing).
- dashboard: 2-4 short lines of what the dashboard shows (new invites, offers, messages, contract updates).
- brief: 3-6 short lines telling the freelancer what needs their attention first (invites to answer, offers, clients waiting,
  proposals the client viewed). Plain sentences, most urgent first.
${UNTRUSTED}`;
}

// ---------------------------------------------------------------------------------------------------------
// I1 + J1: message rooms, summaries and reply drafts
// ---------------------------------------------------------------------------------------------------------

const ROOMS_SCHEMA = obj({
  rooms: arr(obj({
    room_id: str, title: str, other_party: str, context: str, last_message_at: str, awaiting_reply_from: str, unread: bool,
    messages: arr(obj({ from: str, from_self: bool, at: str, text: str })),
    summary: str, reply_draft: str,
  })),
});
type RoomOut = {
  room_id: string; title: string; other_party: string; context: string; last_message_at: string; awaiting_reply_from: string;
  unread: boolean; messages: UpworkMessage[]; summary: string; reply_draft: string;
};

function roomsPrompt(profile: string, orgUid: string) {
  return `You are the Upwork inbox agent of a freelancer's assistant. Use only the Upwork tools available to you; they are
read-only and you cannot send anything. ${TOOLS_ONLY}
With org_uid "${orgUid}":
1. Call get_messages action "list_rooms" (limit 15).
2. For every room, call get_messages action "list_messages" (limit 15) and keep those messages, oldest first, text cut to
   1500 characters each.
For each room return: room_id, title, other_party (the client's name), context (e.g. "Proposal: <job title>" or
"Contract: <title>", "" if unknown), last_message_at (ISO time), awaiting_reply_from ("you", "them" or ""), unread, messages,
- summary: one or two sentences: what the conversation is about and what the client wants now.
- reply_draft: only when awaiting_reply_from is "you": a reply the freelancer could send, in first person, friendly and
  specific, using ONLY facts from the profile below (never promise dates, prices or work the freelancer hasn't stated).
  "" when no reply is needed.
${UNTRUSTED}

${profile}`;
}

export async function syncUpwork(supabase: SupabaseClient) {
  const cfg = await upworkCfg(supabase, "inbox");
  const profile = await loadProfileBrief(supabase);
  const a = (await runAgent<Activity>(cfg, withRules(activityPrompt(), cfg), ACTIVITY_SCHEMA)).data;
  if (!a.org_uid) throw new Error("Upwork returned no account (is Upwork connected for the Upwork inbox agent's CLI?)");
  const now = new Date().toISOString();
  const snap = (kind: string, data: unknown, brief = "") => ({ kind, data, brief, fetched_at: now });
  const { error: sErr } = await supabase.from("upwork_snapshots").upsert([
    snap("dashboard", { org_uid: a.org_uid, text: a.dashboard, connects_balance: a.connects_balance }, a.brief),
    snap("proposals", a.proposals), snap("invitations", a.invitations), snap("offers", a.offers), snap("contracts", a.contracts),
  ]);
  if (sErr) throw new Error(`Saving Upwork activity failed: ${sErr.message}`);

  const r = (await runAgent<{ rooms: RoomOut[] }>(cfg, withRules(roomsPrompt(profile, a.org_uid), cfg), ROOMS_SCHEMA)).data;
  // Keep a reply you were editing when the conversation hasn't moved since.
  const { data: old } = await supabase.from("upwork_rooms").select("room_id, last_message_at, reply_draft");
  const prev = new Map(((old ?? []) as { room_id: string; last_message_at: string | null; reply_draft: string }[]).map((x) => [x.room_id, x]));
  const rows = r.rooms.filter((x) => x.room_id).map((x) => {
    const at = Date.parse(x.last_message_at) ? new Date(x.last_message_at).toISOString() : null;
    const p = prev.get(x.room_id);
    const keep = p && p.reply_draft && p.last_message_at === at;
    return {
      room_id: x.room_id, title: x.title, other_party: x.other_party, context: x.context, last_message_at: at,
      awaiting_reply_from: ["you", "them"].includes(x.awaiting_reply_from) ? x.awaiting_reply_from : "",
      unread: x.unread, messages: x.messages.slice(-15), summary: x.summary,
      reply_draft: keep ? p.reply_draft : x.reply_draft, synced_at: now,
    };
  });
  if (rows.length) {
    const { error } = await supabase.from("upwork_rooms").upsert(rows);
    if (error) throw new Error(`Saving messages failed: ${error.message}`);
  }
  const cutoff = new Date(Date.now() - ROOM_RETENTION_DAYS * 86_400_000).toISOString();
  await supabase.from("upwork_rooms").delete().lt("synced_at", cutoff);
  return { rooms: rows.length, waiting_on_you: rows.filter((x) => x.awaiting_reply_from === "you").length, proposals: a.proposals.length, invitations: a.invitations.length };
}

// ---------------------------------------------------------------------------------------------------------
// I2 + J3: profile sync (read Upwork profile, compare, propose)
// ---------------------------------------------------------------------------------------------------------

const PROFILE_SCHEMA = obj({
  upwork: obj({
    title: str, overview: str, skills: strs, availability: str, hourly_rate: str,
    employment: arr(obj({ company: str, title: str, period: str })),
    education: arr(obj({ institution: str, degree: str, period: str })),
  }),
  proposals: arr(obj({
    action: { type: "string", enum: Object.keys(PROFILE_ACTIONS) }, text: str, skills: strs, capacity: str, current: str, reason: str,
  })),
  manual: strs,
});
type ProfileOut = {
  upwork: Record<string, unknown>;
  proposals: { action: string; text: string; skills: string[]; capacity: string; current: string; reason: string }[];
  manual: string[];
};

function profilePrompt(profile: string) {
  return `You are the Profile sync agent of a freelancer's assistant. Use only the Upwork tools available to you; they are
read-only. ${TOOLS_ONLY}
1. Call list_accounts (Freelancer org_uid), then get_profile action "get" (no profile_key: the freelancer's own profile).
2. Return the Upwork profile as it is now in "upwork".
3. Compare it with the freelancer's own profile below (their website/admin data, the source of truth) and propose updates
   where Upwork is missing something, out of date or clearly weaker. At most one proposal per action:
   - update_title: "text" = new title, max 70 characters.
   - update_overview: "text" = new overview, max 5000 characters, first person, plain text, built ONLY from the profile below.
   - set_skills: "skills" = the COMPLETE new skill list (max 20, Upwork skill names), keeping current skills that still fit.
   - update_availability: "capacity" = one of fullTime, partTime, lessThen, notSure, none, matching the profile's availability.
   Leave unused fields "" / []. "current" = what Upwork has now for that field (skills comma-separated). "reason" = one
   sentence. Propose nothing if Upwork already matches well. Never invent facts.
4. "manual": short notes for differences only fixable on upwork.com (employment, education, portfolio, rate).
${UNTRUSTED}

${profile}`;
}

export async function profileSync(supabase: SupabaseClient) {
  const cfg = await upworkCfg(supabase, "profile");
  const profile = await loadProfileBrief(supabase);
  const out = (await runAgent<ProfileOut>(cfg, withRules(profilePrompt(profile), cfg), PROFILE_SCHEMA)).data;
  const { error: sErr } = await supabase.from("upwork_snapshots").upsert({
    kind: "profile", data: { ...out.upwork, manual: out.manual }, brief: out.manual.join("\n"), fetched_at: new Date().toISOString(),
  });
  if (sErr) throw new Error(`Saving the Upwork profile failed: ${sErr.message}`);
  // New proposals replace earlier ones you haven't acted on.
  await supabase.from("upwork_actions").update({ status: "cancelled" }).eq("kind", "profile_update").eq("status", "draft");
  const rows = [];
  for (const p of out.proposals) {
    if (!isProfileAction(p.action)) continue;
    const key = PROFILE_ACTIONS[p.action].param;
    const value = p.action === "set_skills" ? p.skills.slice(0, 20) : p.action === "update_availability" ? p.capacity : p.text;
    const params = { [key]: value };
    if (checkProfileParams(p.action, params)) continue;
    rows.push({ kind: "profile_update", action: p.action, params, label: PROFILE_ACTIONS[p.action].label, reason: p.reason, current: p.current });
  }
  if (rows.length) {
    const { error } = await supabase.from("upwork_actions").insert(rows);
    if (error) throw new Error(`Saving the proposed updates failed: ${error.message}`);
  }
  return { proposed: rows.length, manual: out.manual.length };
}

// ---------------------------------------------------------------------------------------------------------
// I3: writes after your click
// ---------------------------------------------------------------------------------------------------------

// confirm_preview's type for each update_profile action (get_tool_help confirm_preview).
const CONFIRM_TYPE: Record<string, string> = {
  update_title: "profile_update_title", update_overview: "profile_update_overview",
  update_availability: "profile_update_availability", set_skills: "profile_set_skills",
};

async function loadAction(supabase: SupabaseClient, id: string): Promise<UpworkAction> {
  const { data, error } = await supabase.from("upwork_actions").select("*").eq("id", id).single();
  if (error || !data) throw new Error(`Update not found: ${error?.message ?? id}`);
  return data as UpworkAction;
}
const setAction = (supabase: SupabaseClient, id: string, patch: Record<string, unknown>) => supabase.from("upwork_actions").update(patch).eq("id", id);

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

const PREVIEW_SCHEMA = obj({ preview_id: str, params_sent: str, preview_text: str, warnings: strs });

// "Preview on Upwork": update_profile only creates a preview (Upwork keeps it server-side); nothing changes yet.
export async function previewAction(supabase: SupabaseClient, id: string) {
  const act = await loadAction(supabase, id);
  if (act.kind !== "profile_update" || !isProfileAction(act.action)) throw new Error("Only profile updates have an Upwork preview.");
  if (!["draft", "preview_ready", "error"].includes(act.status)) throw new Error(`This update is ${act.status}.`);
  const bad = checkProfileParams(act.action, act.params);
  if (bad) throw new Error(bad);
  await setAction(supabase, id, { status: "previewing", error: null });
  try {
    const cfg = await upworkCfg(supabase, "inbox", "update_profile");
    const prompt = `You prepare a profile update PREVIEW on Upwork for a freelancer who asked for it in their admin panel.
${TOOLS_ONLY}
1. Call list_accounts (Freelancer org_uid).
2. Call update_profile with action "${act.action}" and params EXACTLY ${JSON.stringify(act.params)} (no other changes).
   This only creates a preview; it does not change the profile. Do NOT call confirm_preview or anything else.
Return preview_id from the response, params_sent = the params object you passed as compact JSON, preview_text = what
the preview says will change (as returned), warnings = any rejected values or notes from Upwork.`;
    const r = (await runAgent<{ preview_id: string; params_sent: string; preview_text: string; warnings: string[] }>(cfg, prompt, PREVIEW_SCHEMA)).data;
    let sent: unknown = null;
    try { sent = JSON.parse(r.params_sent); } catch { /* checked below */ }
    if (!r.preview_id) throw new Error(`Upwork returned no preview. ${r.warnings.join(" ")}`.trim());
    if (!sameJson(sent, act.params)) throw new Error("The preview was made with different values than yours, so it was not kept. Try again.");
    await setAction(supabase, id, { status: "preview_ready", preview_id: r.preview_id, preview: { text: r.preview_text, warnings: r.warnings } });
    return { preview_id: r.preview_id };
  } catch (e) {
    await setAction(supabase, id, { status: "error", error: (e as Error).message.slice(0, 1000) });
    throw e;
  }
}

const CONFIRM_SCHEMA = obj({ ok: bool, detail: str });
const SEND_SCHEMA = obj({ ok: bool, detail: str, newest_own_message: str });

// You pressed Confirm. Profile: confirm_preview runs the preview Upwork stored (it ignores any other params). Message:
// send_message sends your text, then the newest message you sent is read back and compared with it.
export async function confirmAction(supabase: SupabaseClient, id: string) {
  const act = await loadAction(supabase, id);
  if (act.status !== "confirming") throw new Error(`This update is ${act.status}; press Confirm in the admin first.`);
  try {
    if (act.kind === "profile_update") {
      if (!act.preview_id || !CONFIRM_TYPE[act.action]) throw new Error("Make a preview first.");
      const cfg = await upworkCfg(supabase, "inbox", "confirm_preview");
      const prompt = `The freelancer reviewed this Upwork preview in their admin panel and pressed Confirm, which is their explicit
approval. ${TOOLS_ONLY}
1. Call list_accounts (Freelancer org_uid).
2. Call confirm_preview with action "confirm" and params {"type": "${CONFIRM_TYPE[act.action]}", "preview_id": "${act.preview_id}"}.
   Call nothing else. Return ok = whether Upwork reported success, detail = Upwork's response in one or two sentences.`;
      const r = (await runAgent<{ ok: boolean; detail: string }>(cfg, prompt, CONFIRM_SCHEMA)).data;
      if (!r.ok) throw new Error(`Upwork didn't apply it: ${r.detail}`);
      await setAction(supabase, id, { status: "done", result: r });
      return r;
    }
    const roomId = String(act.params.room_id ?? ""), text = String(act.params.message ?? "");
    if (!roomId || !text.trim()) throw new Error("Missing room or message.");
    const cfg = await upworkCfg(supabase, "inbox", "send_message");
    const prompt = `The freelancer wrote this reply in their admin panel and pressed Send, which is their explicit approval.
${TOOLS_ONLY}
1. Call list_accounts (Freelancer org_uid).
2. Call send_message with action "send" and params {"room_id": ${JSON.stringify(roomId)}, "message": <the text between the
   markers, exactly, character for character>}. Send it once. Do not edit, shorten or add anything.
3. Call get_messages action "list_messages" with that room_id and limit 3; newest_own_message = the text of the newest
   message with from_self true.
Return ok = whether the send succeeded, detail = one sentence.
<<<MESSAGE
${text}
MESSAGE>>>`;
    const r = (await runAgent<{ ok: boolean; detail: string; newest_own_message: string }>(cfg, prompt, SEND_SCHEMA)).data;
    if (!r.ok) throw new Error(`Upwork didn't send it: ${r.detail}`);
    const exact = norm(r.newest_own_message) === norm(text);
    await setAction(supabase, id, {
      status: exact ? "done" : "error", result: r,
      error: exact ? null : "Sent, but the text on Upwork differs from yours. Check the conversation on Upwork.",
    });
    if (exact) await supabase.from("upwork_rooms").update({ reply_draft: "", awaiting_reply_from: "them" }).eq("room_id", roomId);
    return { ...r, exact };
  } catch (e) {
    await setAction(supabase, id, { status: "error", error: (e as Error).message.slice(0, 1000) });
    throw e;
  }
}
