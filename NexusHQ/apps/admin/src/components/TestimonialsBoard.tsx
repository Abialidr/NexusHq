"use client";

// Testimonials: review queue (text / video / audio), editor with placement, personal request links and the open
// collection link. Submissions arrive from the public /kind-words page as Pending.
import { useEffect, useMemo, useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { Drawer, Modal, Status, useToast } from "@/components/ui";
import { Tags, Upload } from "@/components/Fields";
import type { Row } from "@/lib/database.types";
import {
  createRequest, deleteRequest, deleteTestimonial, reorderRows, saveSettings, saveTestimonial, setTestimonialState, type ActionResult,
} from "@/app/actions";

export type TestimonialView = Row<"testimonials"> & { mediaUrl: string; avatarUrl: string };
type Edit = Partial<Row<"testimonials">> & { id?: string };
const TABS = ["pending", "approved", "archived", "rejected", "all"] as const;
const PLACES = [["home", "Home"], ["about", "About"], ["projects", "Projects page"], ["cafe", "3D café"]] as const;

function Media({ t }: { t: TestimonialView }) {
  if (t.kind === "video" && t.mediaUrl) return <video className="media" src={t.mediaUrl} controls preload="metadata" />;
  if (t.kind === "audio" && t.mediaUrl) return <audio className="media" src={t.mediaUrl} controls preload="metadata" />;
  if (t.kind !== "text") return <div className="notice" style={{ margin: 0 }}><Icon name="info" /><div>No recording attached.</div></div>;
  return null;
}

export default function TestimonialsBoard({ items, requests, projects, openEnabled }: {
  items: TestimonialView[]; requests: Row<"testimonial_requests">[]; projects: { id: string; name: string; slug: string }[]; openEnabled: boolean;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>(items.some((t) => t.state === "pending") ? "pending" : "approved");
  const [kind, setKind] = useState<"any" | "text" | "video" | "audio">("any");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [req, setReq] = useState<{ client_name: string; email: string; project_id: string; note: string; allowed_kinds: string[] } | null>(null);
  const [sentLink, setSentLink] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const shown = useMemo(() => items.filter((t) => (tab === "all" || t.state === tab) && (kind === "any" || t.kind === kind)), [items, tab, kind]);
  const count = (s: string) => (s === "all" ? items.length : items.filter((t) => t.state === s).length);
  const approved = items.filter((t) => t.state === "approved");
  const rated = items.filter((t) => t.rating);
  const avg = rated.length ? (rated.reduce((n, t) => n + (t.rating ?? 0), 0) / rated.length).toFixed(1) : "—";
  const replied = requests.filter((r) => r.status === "submitted").length;
  const projectSlug = (id: string | null) => projects.find((p) => p.id === id)?.slug;

  const run = (fn: () => Promise<ActionResult>, msg: string, after?: () => void) => start(async () => {
    setError("");
    const res = await fn();
    if (res.ok) { toast(msg); after?.(); } else { setError(res.error); toast(res.error); }
  });
  const copy = async (text: string) => { await navigator.clipboard.writeText(text); toast("Link copied"); };


  const move = (id: string, direction: -1 | 1) => {
    if (pending) return;
    const ids = approved.map((item) => item.id);
    const from = ids.indexOf(id), to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    run(() => reorderRows("testimonials", ids), "Display order saved");
  };

  const placesFor = (e: Edit) => {
    const slug = projectSlug(e.project_id ?? null);
    return [...PLACES, ...(slug ? [[`project:${slug}`, `Project page: ${projects.find((p) => p.slug === slug)?.name}`] as const] : [])];
  };

  return (
    <>
      <div className="page-head">
        <div><div className="kicker">Portfolio</div><h1>Testimonials</h1><p>Collect text, video and audio testimonials with a share link, review them, then choose where they show.</p></div>
        <div className="actions">
          <button className="btn" onClick={() => { setError(""); setEdit({ kind: "text", name: "", role: "", quote: "", consent: true, placements: [], rating: 5 }); }}><Icon name="plus" /> Add manually</button>
          <button className="btn primary" onClick={() => { setError(""); setSentLink(""); setReq({ client_name: "", email: "", project_id: "", note: "", allowed_kinds: ["text", "video", "audio"] }); }}><Icon name="link" /> Request testimonial</button>
        </div>
      </div>

      <div className="grid stats" style={{ marginBottom: 16 }}>
        <div className="card stat"><span className="muted">Waiting for review</span><b>{count("pending")}</b><small>arrive from your links</small></div>
        <div className="card stat"><span className="muted">Published</span><b>{approved.length}</b><small>{["video", "audio", "text"].map((k) => `${approved.filter((t) => t.kind === k).length} ${k}`).join(" · ")}</small></div>
        <div className="card stat"><span className="muted">Requests sent</span><b>{requests.length}</b><small>{requests.length ? `${Math.round((replied / requests.length) * 100)}% replied` : "none yet"}</small></div>
        <div className="card stat"><span className="muted">Average rating</span><b>{avg}</b><small>★ from {rated.length} {rated.length === 1 ? "person" : "people"}</small></div>
      </div>

      <div className="grid two" style={{ marginTop: 0, gridTemplateColumns: "minmax(0,1fr) 340px", alignItems: "start" }}>
        <div className="card">
          <div className="toolbar">
            <div className="tabs" role="tablist">
              {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)} <span className="faint">{count(t)}</span></button>)}
            </div>
            <div className="tabs" style={{ marginLeft: "auto" }} aria-label="Format filter">
              {(["any", "text", "video", "audio"] as const).map((k) => (
                <button key={k} aria-selected={kind === k} onClick={() => setKind(k)} aria-label={k} title={k}>{k === "any" ? "Any" : <Icon name={k === "audio" ? "mic" : k} />}</button>
              ))}
            </div>
          </div>
          <p className="hint" style={{ margin: "12px 20px" }}>Use ↑ and ↓ on approved testimonials to change their order. Changes save automatically for the 2D site and 3D café.</p>
          {shown.length ? (
            <div className="grid t-grid">
              {shown.map((t) => (
                <article key={t.id} className={`t-card ${t.state === "pending" ? "is-pending" : ""}`}>
                  {t.state === "approved" && <div className="row-flex" style={{ gap: 8, marginBottom: 12 }}>
                    <span className="faint" style={{ fontSize: 12 }}>Position {approved.findIndex((item) => item.id === t.id) + 1}</span>
                    <span className="spacer" />
                    <button type="button" className="btn sm" aria-label={`Move ${t.name} up`} disabled={pending || approved[0]?.id === t.id} onClick={() => move(t.id, -1)}>↑ Move up</button>
                    <button type="button" className="btn sm" aria-label={`Move ${t.name} down`} disabled={pending || approved[approved.length - 1]?.id === t.id} onClick={() => move(t.id, 1)}>↓ Move down</button>
                  </div>}
                  <div className="t-head">
                    <div className="avatar" style={t.avatarUrl ? { backgroundImage: `url("${t.avatarUrl}")`, backgroundSize: "cover" } : undefined}>{t.avatarUrl ? "" : t.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
                    <div style={{ minWidth: 0 }}><b>{t.name}</b><small>{t.role || "—"}</small></div>
                    <span className="chip plain"><Icon name={t.kind === "audio" ? "mic" : t.kind} /> {t.kind}</span>
                  </div>
                  <Media t={t} />
                  {t.kind === "text" ? <p className="t-quote">{t.quote}</p> : (t.transcript || t.quote) && <p className="transcript"><b>Transcript:</b> {t.transcript || t.quote}</p>}
                  <div className="row-flex">
                    {t.rating ? <span className="stars">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</span> : null}
                    <span className="faint" style={{ fontSize: 12, marginLeft: "auto" }}>{new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · via {t.source}{!t.consent && " · no consent"}</span>
                    <Status value={t.state} />
                  </div>
                  <div className="t-foot">
                    {t.state === "pending" ? (
                      <>
                        <button className="btn sm ghost danger" disabled={pending} onClick={() => run(() => setTestimonialState(t.id, "rejected"), "Testimonial rejected")}>Reject</button>
                        <span className="spacer" />
                        <button className="btn sm" onClick={() => { setError(""); setEdit({ ...t }); }}>Edit</button>
                        <button className="btn sm primary" disabled={pending} onClick={() => run(() => setTestimonialState(t.id, "approved"), "Approved — now choose where it shows", () => setEdit({ ...t, state: "approved" }))}><Icon name="check" /> Approve</button>
                      </>
                    ) : (
                      <>
                        <span className="faint" style={{ fontSize: 12 }}>{t.placements.length ? `Shows on: ${t.placements.join(", ")}` : "Not placed anywhere"}</span>
                        <span className="spacer" />
                        <button className="btn sm" onClick={() => { setError(""); setEdit({ ...t }); }}>Edit</button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty">Nothing here yet.</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card"><div className="card-head"><h2>Open collection link</h2></div>
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p className="muted" style={{ fontSize: 13 }}>Anyone with this link can leave a text, video or audio testimonial. Everything lands here as <b>Pending</b> first.</p>
              <div className="linkbox"><code>{origin}/kind-words</code><button className="btn sm" onClick={() => copy(`${origin}/kind-words`)}><Icon name="copy" /> Copy</button></div>
              <a className="btn sm ghost" href="/kind-words" target="_blank"><Icon name="eye" /> Preview the client form ↗</a>
              <label className="toggle"><input type="checkbox" defaultChecked={openEnabled} onChange={(e) => run(() => saveSettings({ open_collection_enabled: e.target.checked }), e.target.checked ? "Accepting submissions" : "Open link paused")} /> Accepting submissions</label>
            </div>
          </div>
          <div className="card"><div className="card-head"><h2>Requests</h2></div>
            {requests.length ? (
              <ul className="req-list">{requests.map((r) => (
                <li key={r.id}>
                  <div className="cell-main" style={{ flex: 1, minWidth: 0 }}><b>{r.client_name}</b><small>{r.email} · sent {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</small></div>
                  <Status value={new Date(r.expires_at) < new Date() && r.status !== "submitted" ? "expired" : r.status} />
                  {r.status !== "submitted" && <button className="icon-btn" title="Copy link" aria-label="Copy link" onClick={() => copy(`${origin}/kind-words/${r.id}`)}><Icon name="copy" /></button>}
                  <button className="icon-btn" title="Delete request" aria-label="Delete request" onClick={() => confirm("Delete this request? Its link stops working.") && run(() => deleteRequest(r.id), "Request deleted")}><Icon name="trash" /></button>
                </li>
              ))}</ul>
            ) : <div className="empty" style={{ padding: 24 }}>No requests yet.</div>}
          </div>
        </div>
      </div>

      <Drawer open={!!edit} onClose={() => setEdit(null)} kicker={`Testimonial · ${edit?.kind ?? ""}`} title={edit?.id ? edit.name || "Untitled" : "Add a testimonial"}
        footer={<>
          {edit?.id && <button className="btn ghost danger sm" disabled={pending} onClick={() => confirm("Delete this testimonial and its files?") && run(() => deleteTestimonial(edit.id!), "Deleted", () => setEdit(null))}><Icon name="trash" /> Delete</button>}
          {edit?.id && edit.state !== "archived" && <button className="btn ghost sm" disabled={pending} onClick={() => run(() => setTestimonialState(edit.id!, "archived"), "Archived", () => setEdit(null))}>Archive</button>}
          {error && <span className="err">{error}</span>}
          <span className="spacer" />
          <button className="btn sm" disabled={pending} onClick={() => edit && run(() => saveTestimonial(edit.id ?? null, edit), "Saved", () => setEdit(null))}>Save</button>
          {edit?.id && edit.state !== "approved" && (
            <button className="btn primary sm" disabled={pending} onClick={() => edit && run(async () => {
              const r = await saveTestimonial(edit.id!, edit);
              return r.ok ? setTestimonialState(edit.id!, "approved") : r;
            }, "Approved and published", () => setEdit(null))}><Icon name="check" /> Approve & publish</button>
          )}
        </>}>
        {edit && (() => {
          const set = (k: keyof Edit, v: unknown) => setEdit((e) => (e ? { ...e, [k]: v } : e));
          const view = items.find((t) => t.id === edit.id);
          return (
            <>
              {!edit.id && (
                <fieldset className="fieldset"><legend>Format</legend>
                  <div className="seg" style={{ alignSelf: "flex-start" }}>
                    {(["text", "video", "audio"] as const).map((k) => (
                      <label key={k}><input type="radio" name="t_kind" checked={edit.kind === k} onChange={() => set("kind", k)} /><Icon name={k === "audio" ? "mic" : k} /> {k}</label>
                    ))}
                  </div>
                  {edit.kind !== "text" && <div className="field"><label>Recording file</label><Upload value={edit.media_path ?? ""} set={(v) => set("media_path", v)} folder="testimonials" accept={edit.kind === "video" ? "video/*" : "audio/*"} /></div>}
                </fieldset>
              )}
              {view && view.kind !== "text" && (
                <fieldset className="fieldset"><legend>Recording</legend>
                  <Media t={view} />
                  <div className="fields">
                    <div className="field"><label>Trim start (s)</label><input type="number" min={0} value={edit.trim_start_s ?? 0} onChange={(e) => set("trim_start_s", e.target.value)} /></div>
                    <div className="field"><label>Trim end (s)</label><input type="number" min={0} value={edit.trim_end_s ?? ""} onChange={(e) => set("trim_end_s", e.target.value)} placeholder={view.duration_s ? String(view.duration_s) : ""} /></div>
                    {view.kind === "video" && <div className="field full"><label>Poster frame</label><Upload value={edit.poster_path ?? ""} set={(v) => set("poster_path", v)} folder="testimonials" /></div>}
                  </div>
                </fieldset>
              )}
              <fieldset className="fieldset"><legend>Words</legend><div className="fields">
                {edit.kind === "text"
                  ? <div className="field full"><label>Testimonial</label><textarea value={edit.quote ?? ""} onChange={(e) => set("quote", e.target.value)} /></div>
                  : <div className="field full"><label>Transcript (used as captions and as a quote)</label><textarea value={edit.transcript ?? ""} onChange={(e) => set("transcript", e.target.value)} /></div>}
                <div className="field full"><label>Short pull-quote</label><input value={edit.pull_quote ?? ""} onChange={(e) => set("pull_quote", e.target.value)} /><span className="hint">Used on cards where space is tight</span></div>
              </div></fieldset>
              <fieldset className="fieldset"><legend>Person</legend><div className="fields">
                <div className="field"><label>Name *</label><input value={edit.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
                <div className="field"><label>Role & company</label><input value={edit.role ?? ""} onChange={(e) => set("role", e.target.value)} /></div>
                <div className="field"><label>Rating</label>
                  <select value={edit.rating ?? ""} onChange={(e) => set("rating", e.target.value)}><option value="">No rating</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}</select></div>
                <div className="field"><label>Link to project</label>
                  <select value={edit.project_id ?? ""} onChange={(e) => set("project_id", e.target.value)}><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="field full"><label>Photo</label><Upload value={edit.avatar_path?.startsWith("incoming/") ? "" : edit.avatar_path ?? ""} set={(v) => set("avatar_path", v)} folder="testimonials" /><span className="hint">Optional. Initials are used otherwise.</span></div>
                <div className="field full"><label className="toggle"><input type="checkbox" checked={!!edit.consent} onChange={(e) => set("consent", e.target.checked)} /> They agreed to be shown publicly</label><span className="hint">Without consent it never appears on the site, even when approved.</span></div>
              </div></fieldset>
              <fieldset className="fieldset"><legend>Original review source</legend><div className="fields">
                <div className="field"><label>Source label</label><input value={edit.source_label ?? ""} onChange={(e) => set("source_label", e.target.value)} placeholder="e.g. Upwork" /></div>
                <div className="field"><label>Review date</label><input type="date" value={edit.reviewed_on ?? ""} onChange={(e) => set("reviewed_on", e.target.value)} /></div>
                <div className="field full"><label>Public source link</label><input type="url" value={edit.source_url ?? ""} onChange={(e) => set("source_url", e.target.value)} placeholder="https://..." /><span className="hint">Shown with the review. Leave the date empty if it was not supplied.</span></div>
              </div></fieldset>
              <fieldset className="fieldset"><legend>Where it shows</legend><div className="fields">
                {placesFor(edit).map(([k, l]) => (
                  <div className="field" key={k}><label className="toggle"><input type="checkbox" checked={(edit.placements ?? []).includes(k)}
                    onChange={(e) => set("placements", e.target.checked ? [...(edit.placements ?? []), k] : (edit.placements ?? []).filter((p) => p !== k))} /> {l}</label></div>
                ))}
              </div></fieldset>
            </>
          );
        })()}
      </Drawer>

      <Modal open={!!req} onClose={() => setReq(null)} kicker="Testimonials" title="Request a testimonial"
        footer={sentLink
          ? <><span className="spacer" /><button className="btn primary sm" onClick={() => setReq(null)}>Done</button></>
          : <>{error && <span className="err">{error}</span>}<span className="spacer" /><button className="btn sm" onClick={() => setReq(null)}>Cancel</button>
            <button className="btn primary sm" disabled={pending} onClick={() => req && start(async () => {
              setError("");
              const res = await createRequest(req);
              if (!res.ok) return setError(res.error);
              setSentLink(`${origin}/kind-words/${res.id}`);
              toast("Request created");
            })}>
              <Icon name="link" /> Create link</button></>}>
        {req && (sentLink ? (
          <div className="fields">
            <div className="field full"><label>Personal link for {req.client_name}</label>
              <div className="linkbox"><code>{sentLink}</code><button className="btn sm" onClick={() => copy(sentLink)}><Icon name="copy" /> Copy</button></div>
              <span className="hint">Pre-fills their name and project. Expires in 30 days and works once.</span></div>
            <div className="field full"><a className="btn sm" href={`mailto:${req.email}?subject=${encodeURIComponent("A quick favour — a few words about our work together?")}&body=${encodeURIComponent(`${req.note}\n\n${sentLink}`)}`}><Icon name="mail" /> Open in your email app</a></div>
          </div>
        ) : (
          <div className="fields">
            <div className="field"><label>Client name *</label><input value={req.client_name} onChange={(e) => setReq({ ...req, client_name: e.target.value })} /></div>
            <div className="field"><label>Email *</label><input type="email" value={req.email} onChange={(e) => setReq({ ...req, email: e.target.value })} /></div>
            <div className="field full"><label>Project</label><select value={req.project_id} onChange={(e) => setReq({ ...req, project_id: e.target.value })}><option value="">Other / general</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field full"><label>Allowed formats</label><Tags value={req.allowed_kinds} set={(v) => setReq({ ...req, allowed_kinds: v.filter((x) => ["text", "video", "audio"].includes(x)) })} /><span className="hint">text, video, audio</span></div>
            <div className="field full"><label>Personal note</label><textarea value={req.note} placeholder="Hi Sara, it was great working on the booking flow together…" onChange={(e) => setReq({ ...req, note: e.target.value })} /></div>
          </div>
        ))}
      </Modal>
    </>
  );
}
