"use client";

// The setup wizard: 1 connect Supabase (URL + keys) → 2 database (migrations, access token only if needed)
// → 3 accounts (admin, worker) → Finish. All work happens in app/setup/actions.ts; the secret key and access token
// are sent with each request and never stored.
import { useState, useTransition } from "react";
import { checkSetupAction, runSetupAction } from "@/app/setup/actions";
import type { SetupCheck, SetupStep } from "@/lib/setup";

interface Defaults {
  supabaseUrl: string;
  publishableKey: string;
  workerEmail: string;
}

const DB_CHIP: Record<SetupCheck["db"]["state"], [string, string]> = {
  ready: ["pub", "Ready"],
  pending: ["pending", "Will install"],
  needs_token: ["draft", "Needs access token"],
  manual: ["draft", "Manual step"],
};
const STEP_CHIP: Record<SetupStep["status"], [string, string]> = { done: ["pub", "Done"], skipped: ["plain", "Skipped"], error: ["draft", "Failed"] };

export default function SetupWizard({ defaults, rerun }: { defaults: Defaults; rerun: boolean }) {
  const [conn, setConn] = useState({ supabaseUrl: defaults.supabaseUrl, publishableKey: defaults.publishableKey, secretKey: "", accessToken: "" });
  const [admin, setAdmin] = useState({ email: "", password: "" });
  const [workerEmail, setWorkerEmail] = useState(defaults.workerEmail);
  const [editWorker, setEditWorker] = useState(false);
  const [check, setCheck] = useState<SetupCheck | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; steps: SetupStep[] } | null>(null);
  const [pending, start] = useTransition();

  // Any change to the connection invalidates the last check.
  const edit = (k: keyof typeof conn) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConn({ ...conn, [k]: e.target.value });
    if (k !== "accessToken") setCheck(null);
    setResult(null);
  };

  const runCheck = () =>
    start(async () => {
      setError("");
      setResult(null);
      const r = await checkSetupAction(conn);
      if (r.ok) setCheck(r.check);
      else {
        setCheck(null);
        setError(r.error);
      }
    });

  const finish = () =>
    start(async () => {
      setError("");
      setResult(await runSetupAction({ ...conn, adminEmail: admin.email, adminPassword: admin.password, workerEmail }));
    });

  const needsAdmin = !!check && check.admins.length === 0;
  const canFinish =
    !!check &&
    // needs_token + a token typed in is fine too: Finish re-checks with the token before installing anything.
    (check.db.state === "ready" || check.db.state === "pending" || (check.db.state === "needs_token" && !!conn.accessToken.trim())) &&
    !!workerEmail.trim() &&
    (!needsAdmin || (!!admin.email.trim() && admin.password.length >= 8));

  if (result?.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <StepList steps={result.steps} />
        <div className="notice">
          <div>
            <b>Setup complete.</b> The worker signs in on its own within a few seconds (it is started by <code>yarn dev</code>).
            Check it under Upwork cockpit → AI agents.
          </div>
        </div>
        <a className="btn primary" style={{ justifyContent: "center", padding: 12 }} href={rerun ? "/agents" : "/login"}>
          {rerun ? "Go to AI agents" : "Sign in"}
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <fieldset className="fieldset">
        <legend>1 · Supabase project</legend>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          In the Supabase dashboard: Project Settings → API Keys (keys) and Data API (URL).
        </p>
        <div className="field">
          <label htmlFor="su-url">Project URL</label>
          <input id="su-url" value={conn.supabaseUrl} onChange={edit("supabaseUrl")} placeholder="https://abcdefghijklmnopqrst.supabase.co" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="su-pk">Publishable key</label>
          <input id="su-pk" value={conn.publishableKey} onChange={edit("publishableKey")} placeholder="sb_publishable_…" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="su-sk">Secret key</label>
          <input id="su-sk" type="password" value={conn.secretKey} onChange={edit("secretKey")} placeholder="sb_secret_…" autoComplete="off" />
          <span className="hint">Used only during setup to create the accounts. It is never saved.</span>
        </div>
        <button className="btn" style={{ alignSelf: "flex-start" }} onClick={runCheck} disabled={pending || !conn.supabaseUrl || !conn.publishableKey || !conn.secretKey}>
          {pending && !check ? "Checking…" : check ? "Check again" : "Check connection"}
        </button>
      </fieldset>

      {check && (
        <fieldset className="fieldset">
          <legend>2 · Database</legend>
          <div className="row-flex">
            <span className={`chip ${DB_CHIP[check.db.state][0]}`}>{DB_CHIP[check.db.state][1]}</span>
            <span style={{ fontSize: 13 }}>{check.db.detail}</span>
          </div>
          {check.db.pending.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }} className="muted">
              {check.db.pending.map((m) => <li key={m.version}><code>{m.version}_{m.name}</code></li>)}
            </ul>
          )}
          {check.projectRef && check.db.state !== "pending" && (
            <div className="field">
              <label htmlFor="su-pat">Personal access token {check.db.state === "ready" && <span className="muted">(optional)</span>}</label>
              <input id="su-pat" type="password" value={conn.accessToken} onChange={edit("accessToken")} placeholder="sbp_…" autoComplete="off" />
              <span className="hint">
                Create one at{" "}
                <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer">supabase.com/dashboard/account/tokens</a>.
                It runs the migrations once and is never saved; you can delete it afterwards.
              </span>
              <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={runCheck} disabled={pending || !conn.accessToken.trim()}>
                Check with token
              </button>
            </div>
          )}
        </fieldset>
      )}

      {check && (
        <fieldset className="fieldset">
          <legend>3 · Accounts</legend>
          {needsAdmin ? (
            <div className="fields">
              <div className="field">
                <label htmlFor="su-ae">Your admin email</label>
                <input id="su-ae" type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="su-ap">Admin password</label>
                <input id="su-ap" type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} autoComplete="new-password" />
                <span className="hint">At least 8 characters.</span>
              </div>
            </div>
          ) : (
            <div className="row-flex" style={{ fontSize: 13 }}>
              <span className="chip pub">Admin</span>
              <span>{check.admins.join(", ")} (kept as is)</span>
            </div>
          )}
          {/* Shown as text, not an input, unless asked: browsers autofill the user's own email into any email-like box,
              which turned a personal address into the worker account. */}
          <div className="field">
            <label htmlFor="su-we">Worker account email</label>
            {editWorker ? (
              <input id="su-we" name="nx-worker-login-id" value={workerEmail} onChange={(e) => setWorkerEmail(e.target.value)}
                autoComplete="off" data-lpignore="true" data-1p-ignore spellCheck={false} />
            ) : (
              <span className="row-flex" style={{ gap: 8 }}>
                <code className="mono">{workerEmail}</code>
                <button type="button" className="linklike" onClick={() => setEditWorker(true)}>Change</button>
              </span>
            )}
            <span className="hint">
              {check.workerExists ? "Exists; it gets a new password. " : "Will be created. "}
              The password is generated for you and stored encrypted on this PC only (apps/worker/.secrets).
            </span>
          </div>
        </fieldset>
      )}

      {error && <p className="err" role="alert">{error}</p>}
      {result && !result.ok && <StepList steps={result.steps} />}

      {check && (
        <button className="btn primary" style={{ justifyContent: "center", padding: 12 }} onClick={finish} disabled={pending || !canFinish}>
          {pending ? "Setting up…" : "Finish setup"}
        </button>
      )}
    </div>
  );
}

function StepList({ steps }: { steps: SetupStep[] }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((s) => (
        <li key={s.label} className="row-flex" style={{ alignItems: "flex-start", fontSize: 13 }}>
          <span className={`chip ${STEP_CHIP[s.status][0]}`} style={{ minWidth: 70, justifyContent: "center" }}>{STEP_CHIP[s.status][1]}</span>
          <span><b>{s.label}</b><br /><span className={s.status === "error" ? "err" : "muted"}>{s.detail}</span></span>
        </li>
      ))}
    </ul>
  );
}
