"use client";

// Upwork cockpit → Upwork inbox (roadmap I + J). "Check Upwork" runs the Upwork inbox agent (read-only): a brief,
// message rooms with summaries and reply drafts, proposals, invites, offers and contracts. "Check my profile" runs the
// Profile sync agent: proposed Upwork profile updates. Upwork only changes when you press Send (a reply) or, after a
// preview on Upwork, Confirm (a profile update).
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useToast } from "@/components/ui";
import {
  addSkillToGroup, cancelUpworkAction, confirmProfileAction, previewProfileAction, queueCommand, saveProfileAction, saveReplyDraft, sendReply,
} from "@/app/actions";
import { AVAILABILITY, MESSAGE_MAX, PROFILE_ACTIONS, type ActionStatus, type ProfileAction, type UpworkAction, type UpworkRoom } from "@nexushq/shared";

export interface Snapshot { kind: string; data: Record<string, unknown> & unknown[]; brief: string; fetched_at: string }
export interface SkillSuggestions {
  groups: { id: string; title: string }[];
  list: { name: string; jobs: number; missing: number; upwork: boolean }[];
}
type Pending = { kind: string; payload: Record<string, unknown> };
type Tab = "messages" | "proposals" | "deals" | "profile" | "skills" | "history";

const STATUS_LABEL: Record<ActionStatus, string> = {
  draft: "Not sent", previewing: "Asking Upwork for a preview…", preview_ready: "Preview ready: check and confirm",
  confirming: "Sending to Upwork…", done: "Done on Upwork", error: "Failed", cancelled: "Cancelled",
};
const STATUS_CHIP: Record<ActionStatus, string> = {
  draft: "plain", previewing: "pending", preview_ready: "label", confirming: "pending", done: "pub", error: "draft", cancelled: "hidden",
};

function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
const list = (s: Snapshot | undefined) => (Array.isArray(s?.data) ? (s!.data as Record<string, unknown>[]) : []);
const txt = (v: unknown) => (v == null ? "" : String(v));

export default function UpworkInbox({ snapshots, rooms, actions, pending, online, needsMigration, skills }: {
  snapshots: Record<string, Snapshot>; rooms: UpworkRoom[]; actions: UpworkAction[]; pending: Pending[];
  online: boolean; needsMigration: boolean; skills: SkillSuggestions;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("messages");
  const [busy, start] = useTransition();
  const syncing = pending.some((p) => p.kind === "upwork_sync");
  const profiling = pending.some((p) => p.kind === "profile_sync");
  const inFlight = pending.length > 0 || actions.some((a) => a.status === "previewing" || a.status === "confirming");

  useEffect(() => {
    const t = setInterval(() => router.refresh(), inFlight ? 4000 : 30000);
    return () => clearInterval(t);
  }, [inFlight, router]);

  const run = (kind: "upwork_sync" | "profile_sync", msg: string) => start(async () => {
    const r = await queueCommand(kind);
    if (r.ok) { toast(msg); router.refresh(); } else toast(r.error);
  });

  const dash = snapshots.dashboard;
  const waiting = rooms.filter((r) => r.awaiting_reply_from === "you").length;
  const profileActions = actions.filter((a) => a.kind === "profile_update" && a.status !== "done");
  const history = actions.filter((a) => a.status === "done" || (a.status === "error" && a.kind === "message"));
  const TABS: { id: Tab; label: string; n?: number }[] = [
    { id: "messages", label: "Messages", n: waiting || undefined },
    { id: "proposals", label: "Proposals & invites", n: list(snapshots.invitations).length || undefined },
    { id: "deals", label: "Offers & contracts" },
    { id: "profile", label: "Profile sync", n: profileActions.length || undefined },
    { id: "skills", label: "Skills to add", n: skills.list.length || undefined },
    { id: "history", label: "Sent / applied" },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Upwork cockpit</div><h1>Upwork inbox</h1>
          <p>Your Upwork messages, proposals, invites, offers and contracts in one place, with reply drafts and profile updates.
            Nothing is sent or changed on Upwork until you press Send or Confirm.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => run("profile_sync", "Checking your Upwork profile…")} disabled={!online || busy || profiling || needsMigration}>
            <Icon name="user" /> {profiling ? "Checking profile…" : "Check my profile"}
          </button>
          <button className="btn primary" onClick={() => run("upwork_sync", "Checking Upwork… this takes a few minutes")} disabled={!online || busy || syncing || needsMigration}>
            <Icon name="mail" /> {syncing ? "Checking Upwork…" : "Check Upwork"}
          </button>
        </div>
      </div>

      {needsMigration && <div className="notice"><Icon name="info" /><div>The Upwork inbox needs new database migrations. Open <a href="/setup">Setup</a> and press Finish.</div></div>}
      {!online && !needsMigration && <div className="notice"><Icon name="info" /><div>The worker is offline. Start it with <code className="mono">yarn dev</code>.</div></div>}

      {dash ? (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-flex" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <b>Brief</b>
            <span className="faint" style={{ fontSize: 13 }}>checked {ago(dash.fetched_at)}</span>
            {typeof dash.data?.connects_balance === "number" && dash.data.connects_balance >= 0 && (
              <span className="chip plain" style={{ marginLeft: "auto" }}>Connects {dash.data.connects_balance as number}</span>
            )}
          </div>
          {dash.brief ? <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{dash.brief}</p> : <p className="faint" style={{ margin: 0 }}>Nothing needs your attention.</p>}
          {txt(dash.data?.text) && <p className="faint" style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", fontSize: 13 }}>{txt(dash.data.text)}</p>}
        </div>
      ) : !needsMigration && (
        <div className="card empty" style={{ marginBottom: 16 }}>Press <b>Check Upwork</b> to read your messages, proposals and invites.</div>
      )}

      <div className="tabs" role="tablist" style={{ marginBottom: 14, flexWrap: "wrap", width: "fit-content", maxWidth: "100%" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}{t.n ? ` · ${t.n}` : ""}</button>
        ))}
      </div>

      {tab === "messages" && <Messages rooms={rooms} actions={actions} online={online} />}
      {tab === "proposals" && <Proposals snapshots={snapshots} />}
      {tab === "deals" && <Deals snapshots={snapshots} />}
      {tab === "profile" && <ProfileSync snapshot={snapshots.profile} actions={profileActions} pending={pending} online={online} />}
      {tab === "skills" && <SkillsToAdd skills={skills} />}
      {tab === "history" && <History actions={history} />}
    </>
  );
}

// ---- Messages: summary, thread, reply draft, Send (two clicks) ----------------------------------------------------

function Messages({ rooms, actions, online }: { rooms: UpworkRoom[]; actions: UpworkAction[]; online: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => [...rooms].sort((a, b) => Number(b.awaiting_reply_from === "you") - Number(a.awaiting_reply_from === "you")), [rooms]);
  if (!rooms.length) return <div className="card empty">No conversations yet. Press Check Upwork.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((r) => {
        const last = actions.find((a) => a.kind === "message" && a.params.room_id === r.room_id);
        const isOpen = open === r.room_id;
        return (
          <div key={r.room_id} className="card">
            <button className="row-flex" style={{ width: "100%", padding: "14px 18px", textAlign: "left", gap: 12, alignItems: "flex-start" }}
              onClick={() => setOpen(isOpen ? null : r.room_id)} aria-expanded={isOpen}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block" }}>{r.other_party || r.title || "Conversation"}</b>
                {r.context && <span className="faint" style={{ fontSize: 13 }}>{r.context}</span>}
                {r.summary && <span style={{ display: "block", fontSize: 13, marginTop: 4 }}>{r.summary}</span>}
              </span>
              <span className="row-flex" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {r.awaiting_reply_from === "you" && <span className="chip pending plain">Waiting on you</span>}
                {r.unread && <span className="chip label plain">Unread</span>}
                {last && last.status !== "done" && <span className={`chip ${STATUS_CHIP[last.status]} plain`}>{STATUS_LABEL[last.status]}</span>}
                <span className="faint" style={{ fontSize: 12 }}>{ago(r.last_message_at)}</span>
              </span>
            </button>
            {isOpen && <Room room={r} last={last} online={online} />}
          </div>
        );
      })}
    </div>
  );
}

function Room({ room, last, online }: { room: UpworkRoom; last?: UpworkAction; online: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState(room.reply_draft);
  const [armed, setArmed] = useState(false);
  const [busy, start] = useTransition();
  const sending = last?.status === "confirming";

  const save = () => start(async () => {
    const r = await saveReplyDraft(room.room_id, text);
    if (r.ok) toast("Draft saved"); else toast(r.error);
  });
  const send = () => start(async () => {
    if (!armed) { setArmed(true); return; }
    setArmed(false);
    const r = await sendReply(room.room_id, text);
    if (r.ok) { toast("Sending on Upwork…"); router.refresh(); } else toast(r.error);
  });

  return (
    <div className="card-pad" style={{ borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
        {room.messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from_self ? "flex-end" : "flex-start", maxWidth: "85%", background: m.from_self ? "var(--accent-soft)" : "var(--surface-2)", borderRadius: 12, padding: "8px 12px" }}>
            <div className="faint" style={{ fontSize: 12 }}>{m.from_self ? "You" : m.from} · {ago(m.at)}</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{m.text.replace(/<\/?untrusted_participant_content>/g, "")}</div>
          </div>
        ))}
      </div>
      {last?.status === "error" && <p className="err" style={{ margin: 0 }}>{last.error}</p>}
      <div className="field full">
        <label htmlFor={`reply-${room.room_id}`}>Your reply <span className="faint">· {text.length} chars · drafted by the Upwork inbox agent, edit freely</span></label>
        <textarea id={`reply-${room.room_id}`} rows={6} maxLength={MESSAGE_MAX} value={text} onChange={(e) => { setText(e.target.value); setArmed(false); }}
          placeholder="Write a reply…" />
      </div>
      <div className="row-flex" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn sm ghost" disabled={busy || sending} onClick={save}>Save draft</button>
        <button className={`btn sm ${armed ? "danger" : "primary"}`} disabled={busy || sending || !online || !text.trim()} onClick={send}>
          <Icon name="mail" /> {sending ? "Sending…" : armed ? "Click again to send on Upwork" : "Send on Upwork"}
        </button>
        {armed && <button className="btn sm ghost" onClick={() => setArmed(false)}>Cancel</button>}
        <span className="faint" style={{ fontSize: 12 }}>Sends exactly this text to {room.other_party || "the client"}. It can&rsquo;t be unsent.</span>
      </div>
    </div>
  );
}

// ---- Proposals, invites, offers, contracts (read-only) -------------------------------------------------------------

function Rows({ title, rows, cols, empty }: { title: string; rows: Record<string, unknown>[]; cols: [string, string][]; empty: string }) {
  return (
    <div className="card card-pad" style={{ marginBottom: 12 }}>
      <b>{title}</b>
      {rows.length ? (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="table" style={{ width: "100%", fontSize: 14 }}>
            <thead><tr>{cols.map(([, label]) => <th key={label} style={{ textAlign: "left" }}>{label}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([k]) => <td key={k}>{typeof r[k] === "boolean" ? (r[k] ? "Yes" : "No") : txt(r[k])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : <p className="faint" style={{ margin: "6px 0 0" }}>{empty}</p>}
    </div>
  );
}

function Proposals({ snapshots }: { snapshots: Record<string, Snapshot> }) {
  return (
    <>
      <Rows title="Invitations" rows={list(snapshots.invitations)} empty="No pending invitations."
        cols={[["job_title", "Job"], ["client", "Client"], ["note", "Note"], ["created", "Received"]]} />
      <Rows title="Your recent proposals" rows={list(snapshots.proposals)} empty="No submitted proposals found."
        cols={[["job_title", "Job"], ["status_label", "Status"], ["viewed_by_client", "Client viewed"], ["bid", "Bid"], ["created", "Sent"]]} />
      <p className="faint" style={{ fontSize: 13 }}>Answer invitations and submit proposals on upwork.com; the Job radar drafts the cover letter.</p>
    </>
  );
}

function Deals({ snapshots }: { snapshots: Record<string, Snapshot> }) {
  return (
    <>
      <Rows title="Offers" rows={list(snapshots.offers)} empty="No offers." cols={[["title", "Offer"], ["client", "Client"], ["status", "Status"], ["terms", "Terms"]]} />
      <Rows title="Contracts" rows={list(snapshots.contracts)} empty="No active contracts." cols={[["title", "Contract"], ["client", "Client"], ["status", "Status"], ["started", "Started"]]} />
      <p className="faint" style={{ fontSize: 13 }}>Accepting offers is legally binding and stays on upwork.com.</p>
    </>
  );
}

// ---- Profile sync: Upwork profile now, proposed updates, preview on Upwork, Confirm --------------------------------

function ProfileSync({ snapshot, actions, pending, online }: { snapshot?: Snapshot; actions: UpworkAction[]; pending: Pending[]; online: boolean }) {
  const p = (snapshot?.data ?? {}) as Record<string, unknown>;
  const manual = Array.isArray(p.manual) ? (p.manual as string[]) : [];
  if (!snapshot) return <div className="card empty">Press <b>Check my profile</b> to compare your admin profile with Upwork.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card card-pad">
        <div className="row-flex" style={{ gap: 8 }}><b>Your Upwork profile now</b><span className="faint" style={{ fontSize: 13 }}>checked {ago(snapshot.fetched_at)}</span></div>
        <p style={{ margin: "8px 0 4px" }}><b>{txt(p.title) || "(no title)"}</b>{txt(p.hourly_rate) && <span className="faint"> · {txt(p.hourly_rate)}</span>}</p>
        {Array.isArray(p.skills) && <p className="faint" style={{ margin: 0, fontSize: 13 }}>Skills: {(p.skills as string[]).join(", ") || "none"}</p>}
        {txt(p.overview) && <details style={{ marginTop: 6 }}><summary className="faint" style={{ cursor: "pointer", fontSize: 13 }}>Overview</summary><p style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{txt(p.overview)}</p></details>}
        {manual.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <b style={{ fontSize: 14 }}>Fix these on upwork.com</b>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 14 }}>{manual.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}
      </div>
      {actions.length === 0
        ? <div className="card empty">No updates proposed: your Upwork profile matches your admin profile.</div>
        : actions.map((a) => <ProfileUpdate key={a.id} act={a} online={online} queued={pending.some((x) => x.payload.action_id === a.id)} />)}
    </div>
  );
}

function ProfileUpdate({ act, online, queued }: { act: UpworkAction; online: boolean; queued: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const def = PROFILE_ACTIONS[act.action as ProfileAction];
  const value = act.params[def.param];
  const [draft, setDraft] = useState(Array.isArray(value) ? value.join(", ") : txt(value));
  const [busy, start] = useTransition();
  const dirty = draft !== (Array.isArray(value) ? value.join(", ") : txt(value));
  const working = queued || act.status === "previewing" || act.status === "confirming";
  const preview = act.preview as { text?: string; warnings?: string[] } | null;

  const go = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => start(async () => {
    const r = await fn();
    if (r.ok) { toast(done); router.refresh(); } else toast(r.error ?? "Failed");
  });
  const save = () => go(() => saveProfileAction(act.id, {
    [def.param]: act.action === "set_skills" ? draft.split(",").map((s) => s.trim()).filter(Boolean) : draft,
  }), "Saved. Preview it on Upwork next.");

  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row-flex" style={{ gap: 8, flexWrap: "wrap" }}>
        <b>{act.label}</b>
        <span className={`chip ${STATUS_CHIP[act.status]} plain`}>{queued && act.status === "draft" ? "Queued…" : STATUS_LABEL[act.status]}</span>
      </div>
      {act.reason && <p className="muted" style={{ margin: 0, fontSize: 14 }}>{act.reason}</p>}
      {act.current && <p className="faint" style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}><b>On Upwork now:</b> {act.current}</p>}
      <div className="field full">
        <label htmlFor={`pa-${act.id}`}>New value{def.max > 0 && act.action !== "set_skills" ? ` · ${draft.length}/${def.max}` : act.action === "set_skills" ? " · comma-separated, max 20" : ""}</label>
        {act.action === "update_availability" ? (
          <select id={`pa-${act.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={working}>
            {AVAILABILITY.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        ) : (
          <textarea id={`pa-${act.id}`} rows={act.action === "update_overview" ? 10 : 2} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={working} />
        )}
      </div>
      {act.status === "error" && <p className="err" style={{ margin: 0 }}>{act.error}</p>}
      {act.status === "preview_ready" && preview && (
        <fieldset className="fieldset">
          <legend>Upwork&rsquo;s preview</legend>
          <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 14 }}>{preview.text || "(Upwork returned no preview text)"}</p>
          {preview.warnings?.length ? <p className="err" style={{ margin: "6px 0 0" }}>{preview.warnings.join(" ")}</p> : null}
        </fieldset>
      )}
      <div className="row-flex" style={{ gap: 8, flexWrap: "wrap" }}>
        {dirty && <button className="btn sm" disabled={busy || working} onClick={save}>Save changes</button>}
        {!dirty && act.status !== "preview_ready" && (
          <button className="btn sm primary" disabled={busy || working || !online} onClick={() => go(() => previewProfileAction(act.id), "Asking Upwork for a preview…")}>
            <Icon name="eye" /> Preview on Upwork
          </button>
        )}
        {!dirty && act.status === "preview_ready" && (
          <button className="btn sm primary" disabled={busy || working || !online} onClick={() => go(() => confirmProfileAction(act.id), "Applying on Upwork…")}>
            <Icon name="check" /> Confirm: apply on Upwork
          </button>
        )}
        <button className="btn sm ghost" disabled={busy || working} onClick={() => go(() => cancelUpworkAction(act.id), "Dismissed")}>Dismiss</button>
      </div>
    </div>
  );
}

// ---- Skills to add: seen on Upwork / in jobs but not in your admin skills; one click adds it to a group --------------

function SkillsToAdd({ skills }: { skills: SkillSuggestions }) {
  const router = useRouter();
  const toast = useToast();
  const [group, setGroup] = useState(skills.groups[0]?.id ?? "");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, start] = useTransition();
  const [filter, setFilter] = useState("");
  if (!skills.groups.length) return <div className="card empty">Create a skill group first under Portfolio → Skills, then come back here.</div>;
  const shown = skills.list.filter((s) => !added.has(s.name) && s.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const add = (name: string) => start(async () => {
    const r = await addSkillToGroup(group, name);
    if (r.ok) { setAdded((a) => new Set(a).add(name)); toast(`Added ${name}`); router.refresh(); } else toast(r.error);
  });
  return (
    <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Skills on your Upwork profile, in jobs the Job radar found, and ones the Filter said your profile doesn&rsquo;t show, that
        aren&rsquo;t in your admin skills yet. Click the ones you really have: they&rsquo;re added to the group below, and the agents use them
        from the next run (only published groups are read).
      </p>
      <div className="row-flex" style={{ gap: 8, flexWrap: "wrap" }}>
        <label className="faint" htmlFor="skill-group" style={{ fontSize: 13 }}>Add to</label>
        <select id="skill-group" value={group} onChange={(e) => setGroup(e.target.value)} style={{ maxWidth: 260 }}>
          {skills.groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <input className="input" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220 }} />
      </div>
      {shown.length === 0 ? <p className="faint" style={{ margin: 0 }}>Nothing to suggest{filter ? " for this filter" : ""}. Run Find jobs or Check my profile to collect more.</p> : (
        <div className="row-flex" style={{ gap: 6, flexWrap: "wrap" }}>
          {shown.map((s) => (
            <button key={s.name} className="chip plain" disabled={busy} onClick={() => add(s.name)}
              title={[s.upwork && "on your Upwork profile", s.jobs && `in ${s.jobs} job${s.jobs > 1 ? "s" : ""}`, s.missing && `missing in ${s.missing} assessment${s.missing > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
              style={{ cursor: "pointer" }}>
              <Icon name="plus" /> {s.name}{s.upwork ? " · Upwork" : ""}{s.jobs + s.missing > 1 ? ` · ${s.jobs + s.missing}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function History({ actions }: { actions: UpworkAction[] }) {
  if (!actions.length) return <div className="card empty">Nothing sent or applied yet.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {actions.map((a) => (
        <div key={a.id} className="card card-pad">
          <div className="row-flex" style={{ gap: 8, flexWrap: "wrap" }}>
            <b>{a.label}</b><span className={`chip ${STATUS_CHIP[a.status]} plain`}>{STATUS_LABEL[a.status]}</span>
            <span className="faint" style={{ fontSize: 12, marginLeft: "auto" }}>{ago(a.updated_at)}</span>
          </div>
          {a.kind === "message" && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0", fontSize: 14 }}>{txt(a.params.message)}</p>}
          {a.error && <p className="err" style={{ margin: "6px 0 0" }}>{a.error}</p>}
        </div>
      ))}
    </div>
  );
}
