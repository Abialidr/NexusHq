"use client";

// Upwork cockpit → Job radar. "Find jobs" queues one pipeline run on the worker (search → gates → rank → drafts);
// every job it saw is listed under the stage it reached, with the reason, score, suggested bid and draft. You decide
// and bid on upwork.com yourself; Bid / Skip here only records what you did.
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useToast } from "@/components/ui";
import { HOSTED } from "@/lib/hosted";
import { queueCommand, saveDraft, setJobStage, stopRun } from "@/app/actions";
import { JOB_STAGE_LABEL, type JobAssessment, type JobDetail, type JobDraft, type JobStage, type JobSummary, type SuggestedBid } from "@nexushq/shared";

export interface JobRow {
  id: string; upwork_id: string; title: string; url: string; summary: JobSummary; detail: JobDetail | null; stage: JobStage;
  reason: string; score: number | null; rank: number | null; suggested_bid: SuggestedBid | null; draft: JobDraft | null; found_at: string;
  assessment: JobAssessment | null;
}
export interface RunRow {
  id: string; focus: string; status: "running" | "stopping" | "stopped" | "done" | "error"; counts: Record<string, number>; log: string[];
  error: string | null; started_at: string; finished_at: string | null;
}

type Tab = "shortlisted" | "all" | "gated_out" | "filtered_out" | "bid" | "skipped";
const TABS: { id: Tab; label: string }[] = [
  { id: "shortlisted", label: "Shortlist" }, { id: "all", label: "Found" }, { id: "gated_out", label: "Gated out" },
  { id: "filtered_out", label: "Filtered out" }, { id: "bid", label: "Bid" }, { id: "skipped", label: "Skipped" },
];
const STAGE_CHIP: Record<JobStage, string> = {
  found: "plain", gated_out: "hidden", filtered_out: "hidden", shortlisted: "pub", bid: "label", skipped: "draft",
};

function ago(iso: string | null | undefined) {
  if (!iso) return "";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(0, s)} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const RUN_LABEL: Record<RunRow["status"], string> = {
  running: "Running", stopping: "Stopping…", stopped: "Last run stopped", done: "Last run done", error: "Last run failed",
};

const money = (n: number | null | undefined) => (n == null ? "?" : `$${Math.round(n).toLocaleString("en-US")}`);
const bidText = (b: SuggestedBid) => `${money(b.amount)}${b.unit === "hour" ? "/hr" : " fixed"}`;

export default function JobRadar({ jobs, runs, pending, online, needsMigration }: {
  jobs: JobRow[]; runs: RunRow[]; pending: { kind: string; payload: Record<string, unknown>; status: string }[];
  online: boolean; needsMigration: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("shortlisted");
  const [focus, setFocus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = runs[0];
  const live = run?.status === "running" || run?.status === "stopping";
  const running = pending.some((p) => p.kind === "run_now") || live;

  // Poll while a run or draft is in flight so progress shows up; slowly otherwise.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), pending.length || live ? 4000 : 30000);
    return () => clearInterval(t);
  }, [pending.length, live, router]);

  const stop = () => start(async () => {
    if (!run) return;
    const r = await stopRun(run.id);
    if (r.ok) { toast("Stopping… the current agent is ended within a few seconds"); router.refresh(); } else toast(r.error);
  });

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { shortlisted: 0, all: jobs.length, gated_out: 0, filtered_out: 0, bid: 0, skipped: 0 };
    for (const j of jobs) if (j.stage in c) c[j.stage as Tab]++;
    return c;
  }, [jobs]);

  const list = useMemo(() => {
    const rows = tab === "all" ? jobs : jobs.filter((j) => j.stage === tab);
    // Shortlist best first; everything else newest first.
    return tab === "shortlisted" ? [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)) : rows;
  }, [jobs, tab]);

  const findJobs = () => start(async () => {
    const r = await queueCommand("run_now", { focus });
    if (r.ok) { toast("Finding jobs… this takes a few minutes"); router.refresh(); } else toast(r.error);
  });

  const mark = (id: string, stage: "bid" | "skipped" | "shortlisted", done: string) => start(async () => {
    const r = await setJobStage(id, stage);
    if (r.ok) { toast(done); router.refresh(); } else toast(r.error);
  });

  const draft = (id: string) => start(async () => {
    const r = await queueCommand("draft_job", { job_id: id });
    if (r.ok) { toast("Writing a draft…"); router.refresh(); } else toast(r.error);
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Upwork cockpit</div><h1>Job radar</h1>
          <p>Find jobs that fit your profile, see why each one was kept or dropped, and read the drafts. You bid on Upwork yourself.</p>
        </div>
        {!HOSTED && <div className="actions">
          <input className="input" style={{ minWidth: 220 }} placeholder="Focus (optional), e.g. Next.js dashboards" value={focus}
            onChange={(e) => setFocus(e.target.value)} disabled={running} />
          <button className="btn primary" onClick={findJobs} disabled={!online || running || busy || needsMigration}
            title={!online ? "The worker is offline" : running ? "A run is in progress" : ""}>
            <Icon name="search" /> {running ? "Finding jobs…" : "Find jobs"}
          </button>
        </div>}
      </div>

      {needsMigration && (
        <div className="notice"><Icon name="info" /><div>The Job radar needs new database migrations. Open <a href="/setup">Setup</a>, add a Supabase access token and press Finish.</div></div>
      )}
      {!online && !needsMigration && (
        <div className="notice"><Icon name="info" /><div>{HOSTED
          ? "The worker on your PC is offline, so no run is in progress."
          : <>The worker is offline. Start it with <code className="mono">yarn dev</code> to find jobs.</>}</div></div>
      )}

      {run && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="row-flex" style={{ flexWrap: "wrap", gap: 10 }}>
            <span className={`chip ${run.status === "done" ? "pub" : run.status === "error" ? "draft" : run.status === "stopped" ? "hidden" : "pending"}`}>
              {RUN_LABEL[run.status]}
            </span>
            {run.status === "running" && !HOSTED && (
              <button className="btn sm ghost" disabled={busy} onClick={stop} title="Ends the agent that's running now; jobs not checked yet are marked as such">
                <Icon name="x" /> Stop
              </button>
            )}
            <span className="faint">{ago(run.started_at)}{run.focus ? ` · focus "${run.focus}"` : ""}</span>
            {["found", "new", "gated_out", "filtered_out", "shortlisted", "drafted"].map((k) => run.counts?.[k] != null && (
              <span key={k} className="chip plain">{k.replace("_", " ")} {run.counts[k]}</span>
            ))}
          </div>
          {run.error && <p className="err" style={{ margin: "10px 0 0" }}>{run.error}</p>}
          {run.log?.length > 0 && (
            <details style={{ marginTop: 10 }} open={run.status === "running"}>
              <summary className="faint" style={{ cursor: "pointer", fontSize: 13 }}>Run log</summary>
              <div className="cmd-detail mono" style={{ marginTop: 6 }}>{run.log.slice(-12).join("\n")}</div>
            </details>
          )}
        </div>
      )}

      <div className="tabs" role="tablist" style={{ marginBottom: 14, flexWrap: "wrap", width: "fit-content", maxWidth: "100%" }}>
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label} · {counts[t.id]}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="card empty">{jobs.length ? "Nothing in this tab." : "No jobs yet. Press Find jobs."}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((j) => {
            const isOpen = open === j.id;
            const drafting = pending.some((p) => p.kind === "draft_job" && p.payload.job_id === j.id);
            const d = j.detail;
            return (
              <div key={j.id} className="card">
                <button className="row-flex" style={{ width: "100%", padding: "14px 18px", textAlign: "left", gap: 12, alignItems: "flex-start" }}
                  onClick={() => setOpen(isOpen ? null : j.id)} aria-expanded={isOpen}>
                  {j.score != null && <span className="chip pub plain" style={{ minWidth: 42, justifyContent: "center" }} title="Fit score">{j.score}</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block" }}>{j.title || "(untitled job)"}</b>
                    <span className="faint" style={{ fontSize: 13 }}>
                      {[j.summary.budget, j.summary.job_type, j.summary.experience_level, j.summary.proposals_tier, j.summary.client_country].filter(Boolean).join(" · ")}
                    </span>
                    {j.reason && <span style={{ display: "block", fontSize: 13, marginTop: 4 }}>{j.reason}</span>}
                  </span>
                  <span className="row-flex" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {j.assessment?.win_chance != null && <span className="chip pending plain" title="Estimated chance of winning">Win {j.assessment.win_chance}%</span>}
                    {j.suggested_bid && <span className="chip label plain" title={j.suggested_bid.reason}>Bid {bidText(j.suggested_bid)}</span>}
                    {j.draft && <span className="chip pub plain">Draft</span>}
                    {tab === "all" && <span className={`chip ${STAGE_CHIP[j.stage]} plain`}>{JOB_STAGE_LABEL[j.stage]}</span>}
                    <span className="faint" style={{ fontSize: 12 }}>{ago(j.found_at)}</span>
                  </span>
                </button>

                {isOpen && (
                  <div className="card-pad" style={{ borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="row-flex" style={{ gap: 8, flexWrap: "wrap" }}>
                      {j.url && <a className="btn sm" href={j.url} target="_blank" rel="noreferrer">Open on Upwork ↗</a>}
                      {j.draft?.resume && <a className="btn sm" href={`/resume?job=${j.id}`}>Tailored resume</a>}
                      {j.stage !== "bid" && <button className="btn sm primary" disabled={busy} onClick={() => mark(j.id, "bid", "Marked as bid")}>I bid on this</button>}
                      {j.stage !== "skipped" && <button className="btn sm ghost" disabled={busy} onClick={() => mark(j.id, "skipped", "Skipped")}>Skip</button>}
                      {(j.stage === "skipped" || j.stage === "bid") && <button className="btn sm ghost" disabled={busy} onClick={() => mark(j.id, "shortlisted", "Back on the shortlist")}>Back to shortlist</button>}
                      {!HOSTED && <button className="btn sm ghost" disabled={busy || drafting || !online} onClick={() => draft(j.id)}>
                        {drafting ? "Writing…" : j.draft ? "Rewrite draft" : "Draft this anyway"}
                      </button>}
                    </div>

                    <AssessmentView job={j} />

                    {j.suggested_bid && (
                      <p style={{ margin: 0, fontSize: 14 }}><b>Suggested bid {bidText(j.suggested_bid)}</b> <span className="muted">· {j.suggested_bid.reason}</span></p>
                    )}

                    {d && (
                      <div className="faint" style={{ fontSize: 13 }}>
                        Client: spent {money(d.client_spend_total)} · hire rate {d.client_hire_rate_percent ?? "?"}% · {d.client_jobs_posted ?? "?"} jobs posted
                        · rating {d.client_feedback_score ?? "?"} · Connects {d.connects_cost ?? "?"}
                        {d.bid_stats ? ` · others bid: ${d.bid_stats}` : ""}
                      </div>
                    )}

                    {(d?.description || j.summary.description_snippet) && (
                      <details>
                        <summary className="faint" style={{ cursor: "pointer", fontSize: 13 }}>Job description</summary>
                        <p className="muted" style={{ whiteSpace: "pre-wrap", fontSize: 14, marginTop: 6 }}>
                          {(d?.description || j.summary.description_snippet || "").replace(/<\/?untrusted_participant_content>/g, "").trim()}
                        </p>
                      </details>
                    )}

                    {j.draft && <DraftView key={JSON.stringify(j.draft)} jobId={j.id} draft={j.draft} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// Why the job was found and the Filter & rank agent's verdict: fit for your skills, applicants, win chance, why.
function AssessmentView({ job }: { job: JobRow }) {
  const a = job.assessment;
  if (!a && !job.summary.found_by) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14 }}>
      {job.summary.found_by && <span className="faint" style={{ fontSize: 13 }}>Found by: {job.summary.found_by}</span>}
      {a && (
        <>
          <div className="row-flex" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="chip pub plain">Fit {a.fit_score}/100</span>
            {a.win_chance != null && <span className="chip pending plain">Win chance {a.win_chance}%</span>}
            {a.competition && <span className="chip plain">Applicants: {a.competition}</span>}
            {a.stage === "pre" && <span className="chip hidden plain">First pass only</span>}
          </div>
          <span><b>{job.stage === "shortlisted" || job.stage === "bid" ? "Why kept" : "Why not"}:</b> {a.why}</span>
          {a.matched_skills?.length > 0 && <span className="muted" style={{ fontSize: 13 }}>Matches your skills: {a.matched_skills.join(", ")}</span>}
          {a.missing_skills?.length > 0 && <span className="muted" style={{ fontSize: 13 }}>Not in your profile: {a.missing_skills.join(", ")}</span>}
        </>
      )}
    </div>
  );
}

const toLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

// The draft, read-only until you press Edit; Save keeps your version (Rewrite draft replaces it with a new one).
function DraftView({ jobId, draft }: { jobId: string; draft: JobDraft }) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [letter, setLetter] = useState(draft.cover_letter);
  const [highlights, setHighlights] = useState((draft.resume_highlights ?? []).join("\n"));
  const [questions, setQuestions] = useState((draft.questions ?? []).join("\n"));
  const [saving, start] = useTransition();
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Copy failed: select the text instead"); }
  };
  const save = () => start(async () => {
    const r = await saveDraft(jobId, { cover_letter: letter, resume_highlights: toLines(highlights), questions: toLines(questions) });
    if (r.ok) { toast("Draft saved"); setEditing(false); router.refresh(); } else toast(r.error);
  });

  if (editing) return (
    <fieldset className="fieldset">
      <legend>Edit draft</legend>
      <div className="field full">
        <label htmlFor={`cl-${jobId}`}>Cover letter <span className="faint">· {letter.length} chars</span></label>
        <textarea id={`cl-${jobId}`} rows={12} value={letter} onChange={(e) => setLetter(e.target.value)} />
      </div>
      <div className="field full">
        <label htmlFor={`hl-${jobId}`}>Resume highlights (one per line)</label>
        <textarea id={`hl-${jobId}`} rows={5} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
      </div>
      <div className="field full">
        <label htmlFor={`q-${jobId}`}>Questions to ask (one per line)</label>
        <textarea id={`q-${jobId}`} rows={3} value={questions} onChange={(e) => setQuestions(e.target.value)} />
      </div>
      <div className="row-flex" style={{ gap: 8 }}>
        <button className="btn sm primary" disabled={saving} onClick={save}><Icon name="check" /> {saving ? "Saving…" : "Save"}</button>
        <button className="btn sm ghost" disabled={saving} onClick={() => {
          setEditing(false); setLetter(draft.cover_letter);
          setHighlights((draft.resume_highlights ?? []).join("\n")); setQuestions((draft.questions ?? []).join("\n"));
        }}>Cancel</button>
      </div>
    </fieldset>
  );

  return (
    <fieldset className="fieldset">
      <legend>Draft</legend>
      <div className="row-flex" style={{ gap: 6 }}>
        <b style={{ fontSize: 14 }}>Cover letter</b>
        <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setEditing(true)}>Edit</button>
        <button className="btn sm ghost" onClick={() => copy(draft.cover_letter)}>Copy</button>
      </div>
      <p style={{ whiteSpace: "pre-wrap", fontSize: 14, margin: 0 }}>{draft.cover_letter}</p>
      {draft.resume_highlights?.length > 0 && (
        <>
          <b style={{ fontSize: 14 }}>Resume highlights for this job</b>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{draft.resume_highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </>
      )}
      {draft.questions && draft.questions.length > 0 && (
        <>
          <b style={{ fontSize: 14 }}>Questions to ask</b>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{draft.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </>
      )}
    </fieldset>
  );
}
