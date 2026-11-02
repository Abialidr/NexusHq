"use client";

// Upwork cockpit → AI agents. One card per pipeline agent (filter, judge, writer): Mode → Provider → Model,
// options and a fallback. Everything the worker knows (hardware, which providers work, models, test results)
// arrives through worker_status; everything the admin asks of the worker goes out as a command row, because
// the worker never accepts inbound connections (docs/UPWORK_AGENT_PLAN.md §5.8).
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import McpConnections, { cliUsers } from "@/components/McpConnections";
import { useToast } from "@/components/ui";
import { queueCommand, saveAgentSettings, setAgentSecret } from "@/app/actions";
import {
  AGENTS, COMING_LATER, COST_LIMITS, GATES, INSTRUCTIONS_MAX, LISTINGS_LIMITS, MODES, PROVIDERS, SECRETS, SHORTLIST_LIMITS, WORKER_ONLINE_MS, describeHardware, isModeEnabled,
  providersFor, recommendLocalModels,
  type AgentId, type AgentOptions, type AgentTest, type Backend, type Fit, type Hardware, type Mode, type ProviderChoice,
  type McpStatusMap, type ProviderId, type ProviderStatus,
} from "@nexushq/shared";

export interface SettingsRow {
  agent: AgentId; provider: ProviderId; model: string; backend: Backend | null; base_url: string | null;
  options: AgentOptions | null; fallback: ProviderChoice | null; updated_at: string;
}
export interface WorkerStatus {
  worker_name: string; version: string; hardware: Hardware | Record<string, never>;
  providers: Partial<Record<ProviderId, ProviderStatus>>; tests: Partial<Record<AgentId, AgentTest>>;
  mcp?: McpStatusMap; started_at: string | null; last_seen_at: string | null;
}
export interface CommandItem {
  id: string; kind: string; payload: Record<string, unknown>; status: "queued" | "running" | "done" | "error";
  result: unknown; error: string | null; created_at: string; finished_at: string | null;
}

export interface SecretStatus { name: string; is_set: boolean; updated_at: string | null }

type Send = (kind: string, payload: Record<string, unknown>, done: string) => Promise<void>;
type Draft = { provider: ProviderId; model: string; backend: Backend | null; base_url: string | null; options: AgentOptions; fallback: ProviderChoice | null };

const BACKEND_LABEL: Record<Backend, string> = { login: "Subscription login", api_key: "API key", bedrock: "AWS Bedrock", vertex: "Google Vertex" };
const FIT_CHIP: Record<Fit, string> = { recommended: "pub", ok: "plain", slow: "draft", too_big: "hidden" };
const FIT_LABEL: Record<Fit, string> = { recommended: "Recommended", ok: "Fits", slow: "Slow", too_big: "Too big" };
const CMD_LABEL: Record<string, string> = {
  test_agent: "Test connection", refresh_models: "Refresh models", pull_model: "Pull model",
  mcp_check: "Check MCP", mcp_add: "Add MCP server", mcp_login: "MCP sign-in", mcp_remove: "Remove MCP server",
  run_now: "Find jobs", draft_job: "Write draft",
  upwork_sync: "Check Upwork", profile_sync: "Check my profile", upwork_preview: "Upwork preview", upwork_confirm: "Upwork change (confirmed)",
};
// Example rules shown in each card's empty "Extra instructions" box.
const INSTRUCTION_HINT: Partial<Record<AgentId, string>> = {
  search: "e.g. Also search for Supabase and Stripe jobs. Skip WordPress.",
  filter: "e.g. Prefer long-term hourly work and clients in the US/EU. Score anything crypto/NFT below 30.",
  writer: "e.g. Keep it under 900 characters. Mention I can start this week. Sign off with just my first name.",
  inbox: "e.g. Keep replies short and warm. Always offer a quick call. Never discuss rates in a reply.",
  profile: "e.g. Keep my title focused on Next.js and AI apps. Don't propose removing skills.",
};

function ago(iso: string | null | undefined, now: number) {
  if (!iso) return "never";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(0, s)} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Fallbacks are no longer offered, so any old one is dropped here and cleared on the next save.
function fromRow(r: SettingsRow): Draft {
  return { provider: r.provider, model: r.model ?? "", backend: r.backend, base_url: r.base_url, options: r.options ?? {}, fallback: null };
}

// Defaults when switching provider: the local model recommended for this PC, the login backend for CLIs, the
// provider's default local URL.
function defaultsFor(provider: ProviderId, hw: Hardware | undefined): Pick<Draft, "provider" | "model" | "backend" | "base_url"> {
  const def = PROVIDERS[provider];
  const model = provider === "ollama" ? recommendLocalModels(hw).find((m) => m.fit === "recommended")?.id ?? "qwen3:4b" : "";
  return { provider, model, backend: def.backends ? "login" : null, base_url: def.defaultBaseUrl ?? null };
}

function modelIds(provider: ProviderId, status: WorkerStatus | null) {
  const live = status?.providers?.[provider]?.models ?? [];
  return [...new Set([...live.map((m) => m.id), ...PROVIDERS[provider].curatedModels])];
}

export default function AgentSettings({ settings, status, commands, secrets }: {
  settings: SettingsRow[]; status: WorkerStatus | null; commands: CommandItem[]; secrets: SecretStatus[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const busy = commands.some((c) => c.status === "queued" || c.status === "running");

  // Poll while a command is in flight (fast) and otherwise slowly, so the online dot and results stay current.
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); router.refresh(); }, busy ? 2500 : 15000);
    return () => clearInterval(t);
  }, [busy, router]);

  const online = !!status?.last_seen_at && now - new Date(status.last_seen_at).getTime() < WORKER_ONLINE_MS;
  const hw = status?.hardware && "ramGb" in status.hardware ? (status.hardware as Hardware) : undefined;

  const send: Send = async (kind, payload, done) => {
    const r = await queueCommand(kind, payload);
    if (r.ok) { toast(done); router.refresh(); } else toast(r.error);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="kicker">Upwork cockpit</div><h1>AI agents</h1>
          <p>Choose which model runs each step of the job pipeline: a local model on this PC, a CLI you&rsquo;re already logged in to, or a cloud API.</p>
        </div>
        <div className="actions">
          <button className="btn" disabled={!online} title={online ? "" : "Worker is offline"} onClick={() => send("refresh_models", {}, "Asked the worker to re-check every provider")}>
            <Icon name="search" /> Re-check all providers
          </button>
        </div>
      </div>

      <div className="card card-pad worker-card">
        <div className="row-flex" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className={`chip ${online ? "pub" : "hidden"}`}>{online ? "Worker online" : status ? "Worker offline" : "Worker never connected"}</span>
          {status && <b>{status.worker_name || "worker"}</b>}
          {status && <span className="faint">v{status.version} · last seen {ago(status.last_seen_at, now)}</span>}
        </div>
        <p className="muted" style={{ margin: "10px 0 0" }}>
          {hw ? <>This PC: {describeHardware(hw)} · {hw.freeRamGb} GB free</> : "Hardware is reported once the worker starts."}
        </p>
        {!online && (
          <div className="notice" style={{ margin: "14px 0 0" }}>
            <Icon name="info" />
            <div>Settings and API keys save without the worker, but testing, model lists and pulls need it running. On the worker machine:
              <code className="mono"> yarn dev</code> or <code className="mono">npm run worker</code> (first-time setup: <span className="mono">apps/worker/README.md</span>).</div>
          </div>
        )}
      </div>

      {/* status.mcp is missing (not just empty) only while the mcp migration isn't applied */}
      <McpConnections mcp={status ? status.mcp : {}} cliStatus={status?.providers ?? {}} online={online} usedBy={cliUsers(settings)} commands={commands} send={send} now={now} />

      <SecretsCard secrets={secrets} now={now} />

      {AGENTS.map((a) => {
        const row = settings.find((s) => s.agent === a.id);
        return row ? <AgentCard key={a.id} agent={a} row={row} status={status} hw={hw} online={online} send={send} now={now} /> : null;
      })}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><b>Recent worker commands</b></div>
        {commands.length === 0 ? <p className="card-pad muted" style={{ margin: 0 }}>Nothing sent yet.</p> : (
          <ul className="cmd-list">
            {commands.map((c) => (
              <li key={c.id}>
                <span className={`chip ${c.status === "done" ? "pub" : c.status === "error" ? "hidden" : "pending"}`}>{c.status}</span>
                <b>{CMD_LABEL[c.kind] ?? c.kind}</b>
                <span className="faint mono">{Object.values(c.payload ?? {}).join(" ")}</span>
                <span className="faint" style={{ marginLeft: "auto" }}>{ago(c.created_at, now)}</span>
                {c.error && <div className="cmd-detail err">{c.error}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function AgentCard({ agent, row, status, hw, online, send, now }: {
  agent: (typeof AGENTS)[number]; row: SettingsRow; status: WorkerStatus | null; hw: Hardware | undefined;
  online: boolean; send: Send; now: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => fromRow(row));
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [pending, start] = useTransition();
  const def = PROVIDERS[draft.provider];
  const mode = def.mode;
  const dirty = JSON.stringify(draft) !== JSON.stringify(fromRow(row));
  const ps = status?.providers?.[draft.provider];
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setOpt = (k: keyof AgentOptions, v: string, scale = 1) =>
    set({ options: { ...draft.options, [k]: v === "" ? undefined : Number(v) * scale } });

  const save = () => start(async () => {
    setError("");
    const r = await saveAgentSettings(agent.id, draft as unknown as Record<string, unknown>);
    if (r.ok) { toast(`${agent.label} agent saved`); router.refresh(); } else setError(r.error);
  });

  const ids = modelIds(draft.provider, status);
  const installed = new Set((status?.providers?.ollama?.models ?? []).map((m) => m.id));

  return (
    <div className="card agent-card">
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 16 }}>{agent.label}</b>
          <div className="faint" style={{ fontSize: 13 }}>{agent.job}</div>
          {agent.usesUpwork && <span className="chip label plain" style={{ marginTop: 6 }}>Upwork: read-only tools · needs Upwork connected in Connections</span>}
        </div>
        <div className="row-flex" style={{ marginLeft: "auto", gap: 8 }}>
          {error && <span className="err">{error}</span>}
          <ConnectionSign ps={ps} online={online} label={def.label} />
          <button className="btn sm primary" disabled={!dirty || pending} onClick={save}><Icon name="check" /> {pending ? "Saving…" : "Save"}</button>
        </div>
      </div>

      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="seg" role="radiogroup" aria-label={`${agent.label} mode`}>
          {MODES.map((m) => {
            const on = isModeEnabled(m.id);
            return (
              <label key={m.id} title={on ? m.blurb : COMING_LATER} data-disabled={!on || undefined}
                onClick={on ? undefined : (e) => { e.preventDefault(); toast(COMING_LATER); }}>
                <input type="radio" name={`mode-${agent.id}`} checked={mode === m.id} disabled={!on}
                  onChange={() => set(defaultsFor(providersFor(m.id as Mode)[0].id, hw))} />
                <span>{m.label}{!on && <small className="soon"> · later</small>}</span>
              </label>
            );
          })}
        </div>
        <p className="faint" style={{ margin: "-6px 0 0", fontSize: 13 }}>{MODES.find((m) => m.id === mode)?.blurb}</p>

        <div className="fields">
          <div className="field">
            <label htmlFor={`prov-${agent.id}`}>Provider</label>
            <select id={`prov-${agent.id}`} value={draft.provider} onChange={(e) => set(defaultsFor(e.target.value as ProviderId, hw))}>
              {providersFor(mode).map((p) => {
                const noTools = agent.usesUpwork && p.id === "codex_cli"; // no verified read-only tool allowlist
                return <option key={p.id} value={p.id} disabled={noTools}>{p.label}{noTools ? " (can't use Upwork tools)" : ""}</option>;
              })}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`model-${agent.id}`}>Model</label>
            <input id={`model-${agent.id}`} list={`models-${agent.id}`} value={draft.model}
              placeholder={mode === "cli" ? "Provider default" : "Pick or type a model id"}
              onChange={(e) => set({ model: e.target.value.trim() })} />
            <datalist id={`models-${agent.id}`}>{ids.map((id) => <option key={id} value={id} />)}</datalist>
            <span className="hint">
              {ps?.models?.length ? `${ps.models.length} available from the worker` : "Suggestions are the curated list until the worker reports live models"}
              {online && <> · <button className="linklike" onClick={() => send("refresh_models", { provider: draft.provider }, "Refreshing models…")}>refresh</button></>}
            </span>
          </div>

          {/* CLIs normally run on the subscription login, which needs no key. API key / Bedrock / Vertex billing is
              an advanced choice, so it stays hidden unless asked for or already selected. */}
          {def.backends && (draft.backend ?? "login") === "login" && !advanced && (
            <div className="field full">
              <span className="hint">
                Uses the subscription you&rsquo;re logged in to on the worker machine. No API key needed.{" "}
                {isModeEnabled("cloud")
                  ? <button className="linklike" onClick={() => setAdvanced(true)}>Bill through an API key or a cloud account instead</button>
                  : <button className="linklike soon" title={COMING_LATER} onClick={() => toast(COMING_LATER)}>API key / AWS / Google Cloud billing: coming later</button>}
              </span>
            </div>
          )}
          {def.backends && ((draft.backend ?? "login") !== "login" || advanced) && (
            <div className="field full">
              <label>Billing (advanced)</label>
              <div className="seg" role="radiogroup" aria-label="Billing">
                {def.backends.map((b) => (
                  <label key={b}><input type="radio" name={`backend-${agent.id}`} checked={(draft.backend ?? "login") === b} onChange={() => set({ backend: b })} /><span>{BACKEND_LABEL[b]}</span></label>
                ))}
              </div>
              <span className="hint">Only change this if you pay through an Anthropic API key or a company AWS / Google Cloud account; set its key under API keys.</span>
              {draft.backend && draft.backend !== "login" && !draft.model && <span className="hint err">Pick a model: on this billing option the CLI default is Opus.</span>}
            </div>
          )}

          {mode === "local" && (
            <div className="field full">
              <label htmlFor={`url-${agent.id}`}>Server URL</label>
              <input id={`url-${agent.id}`} value={draft.base_url ?? ""} placeholder={def.defaultBaseUrl} onChange={(e) => set({ base_url: e.target.value.trim() })} />
            </div>
          )}
        </div>

        {draft.provider === "ollama" && (
          <fieldset className="fieldset"><legend>Recommended for this PC</legend>
            <ul className="model-list">
              {recommendLocalModels(hw).map((m) => (
                <li key={m.id} data-active={draft.model === m.id}>
                  <b className="mono">{m.id}</b>
                  <span className={`chip ${FIT_CHIP[m.fit]}`}>{FIT_LABEL[m.fit]}</span>
                  <span className="faint">{m.params} · ~{m.sizeGb} GB · {m.why}</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {installed.has(m.id)
                      ? <span className="chip pub plain">Installed</span>
                      : <button className="btn sm ghost" disabled={!online || m.fit === "too_big"} onClick={() => send("pull_model", { model: m.id }, `Pulling ${m.id}… (this can take a while)`)}><Icon name="upload" /> Pull</button>}
                    <button className="btn sm" disabled={draft.model === m.id} onClick={() => set({ model: m.id })}>Use</button>
                  </span>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {agent.id === "search" && (
          <div className="field">
            <label htmlFor={`max-${agent.id}`}>Max listings per run</label>
            <input id={`max-${agent.id}`} type="number" min={LISTINGS_LIMITS.min} max={LISTINGS_LIMITS.max} step={10}
              value={draft.options.maxListings ?? ""} placeholder={String(LISTINGS_LIMITS.default)} onChange={(e) => setOpt("maxListings", e.target.value)} />
            <span className="hint">
              How many Upwork listings one Find jobs run collects ({LISTINGS_LIMITS.min}–{LISTINGS_LIMITS.max}). More listings take longer:
              roughly 1 search round per 30.
            </span>
          </div>
        )}
        {agent.id === "filter" && (
          <div className="field">
            <label htmlFor={`pct-${agent.id}`}>Shortlist %</label>
            <input id={`pct-${agent.id}`} type="number" min={SHORTLIST_LIMITS.min} max={SHORTLIST_LIMITS.max} step={1}
              value={draft.options.shortlistPercent ?? ""} placeholder={String(SHORTLIST_LIMITS.default)} onChange={(e) => setOpt("shortlistPercent", e.target.value)} />
            <span className="hint">
              Keep the best this-% of the listings found ({SHORTLIST_LIMITS.min}–{SHORTLIST_LIMITS.max}%); each one gets a draft.
              E.g. 200 listings at 5% = 10 shortlisted.
            </span>
          </div>
        )}
        {agent.id === "filter" && (
          <>
            <div className="field">
              <label htmlFor={`cost-${agent.id}`}>Cost limit per run (USD)</label>
              <input id={`cost-${agent.id}`} type="number" min={COST_LIMITS.min} max={COST_LIMITS.max} step={0.5}
                value={draft.options.maxCostUsd ?? ""} placeholder="no limit" onChange={(e) => setOpt("maxCostUsd", e.target.value)} />
              <span className="hint">
                Stops the AI steps of a run once this much is spent; what was ranked so far is kept. Only Claude Code reports a
                cost (on a subscription it&rsquo;s the API-price equivalent); Antigravity and Codex don&rsquo;t.
              </span>
            </div>
            <fieldset className="fieldset"><legend>Free checks before ranking</legend>
              <div className="fields opts">
                <div className="field"><label>Min hourly rate ($/hr)</label><input type="number" min={0} value={draft.options.gateMinHourly ?? ""} placeholder={String(GATES.minHourlyMax)} onChange={(e) => setOpt("gateMinHourly", e.target.value)} /></div>
                <div className="field"><label>Min fixed budget ($)</label><input type="number" min={0} value={draft.options.gateMinFixed ?? ""} placeholder={String(GATES.minFixed)} onChange={(e) => setOpt("gateMinFixed", e.target.value)} /></div>
              </div>
              <label className="row-flex" style={{ gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={draft.options.gateRequireVerified ?? GATES.requireVerifiedPayment}
                  onChange={(e) => set({ options: { ...draft.options, gateRequireVerified: e.target.checked } })} />
                Drop clients whose payment isn&rsquo;t verified
              </label>
              <label className="row-flex" style={{ gap: 8, fontSize: 14 }}>
                <input type="checkbox" checked={draft.options.gateSkipCrowded ?? GATES.skipCrowded}
                  onChange={(e) => set({ options: { ...draft.options, gateSkipCrowded: e.target.checked } })} />
                Drop jobs with 50+ proposals (off: the ranking keeps them with a low win chance)
              </label>
            </fieldset>
          </>
        )}

        <div className="field full">
          <label htmlFor={`rules-${agent.id}`}>Extra instructions</label>
          <textarea id={`rules-${agent.id}`} rows={3} maxLength={INSTRUCTIONS_MAX} value={draft.options.instructions ?? ""}
            placeholder={INSTRUCTION_HINT[agent.id] ?? ""}
            onChange={(e) => set({ options: { ...draft.options, instructions: e.target.value || undefined } })} />
          <span className="hint">Your own rules, added to the end of this agent&rsquo;s prompt. Upwork safety rules always stay on.</span>
        </div>

        <fieldset className="fieldset"><legend>Options</legend>
          <div className="fields opts">
            <div className="field"><label>Temperature</label><input type="number" min={0} max={2} step={0.1} value={draft.options.temperature ?? ""} placeholder="default" onChange={(e) => setOpt("temperature", e.target.value)} /></div>
            <div className="field"><label>Max output tokens</label><input type="number" min={1} value={draft.options.maxTokens ?? ""} placeholder="default" onChange={(e) => setOpt("maxTokens", e.target.value)} /></div>
            <div className="field"><label>Timeout (seconds)</label><input type="number" min={5} value={draft.options.timeoutMs != null ? draft.options.timeoutMs / 1000 : ""} placeholder="120" onChange={(e) => setOpt("timeoutMs", e.target.value, 1000)} /></div>
            <div className="field"><label>Daily call cap</label><input type="number" min={0} value={draft.options.dailyCap ?? ""} placeholder="no cap" onChange={(e) => setOpt("dailyCap", e.target.value)} /></div>
          </div>
        </fieldset>

      </div>
    </div>
  );
}

// Green when the worker reports this provider ready (installed + logged in), red otherwise. Connecting happens in the
// Connections section above, never on the agent card.
function ConnectionSign({ ps, online, label }: { ps: ProviderStatus | undefined; online: boolean; label: string }) {
  const ok = online && !!ps?.available;
  const why = !online ? "Worker is offline" : !ps ? "Not checked yet" : ps.detail;
  return (
    <span className={`chip ${ok ? "pub" : "draft"}`} title={why}>
      {ok ? "Connected" : `Not connected: connect ${label} in Connections above`}
    </span>
  );
}

// Provider API keys and cloud credentials, stored encrypted in Supabase Vault. Write-only: the page only knows
// whether each is set; saving replaces, Clear removes. The worker fetches the values itself.
function SecretsCard({ secrets, now }: { secrets: SecretStatus[]; now: number }) {
  const toast = useToast();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const isSet = (n: string) => secrets.find((s) => s.name === n);
  const groups = [...new Set(SECRETS.map((s) => s.group))];
  const enabled = isModeEnabled("cloud"); // keys only matter for cloud APIs / API-key billing, both switched off for now

  const save = async (name: string, value: string, label: string) => {
    setBusy(name);
    const r = await setAgentSecret(name, value);
    setBusy("");
    if (!r.ok) return toast(r.error);
    setValues((v) => ({ ...v, [name]: "" }));
    toast(value ? `${label} saved` : `${label} cleared`);
    router.refresh();
  };

  return (
    <div className="card agent-card" data-disabled={!enabled || undefined}>
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div>
          <b style={{ fontSize: 16 }}>API keys &amp; credentials {!enabled && <span className="chip draft plain">Coming later</span>}</b>
          <div className="faint" style={{ fontSize: 13 }}>Stored encrypted in Supabase Vault. Only the worker can read them back; this page only shows whether each is set.</div>
        </div>
      </div>
      {!enabled && (
        <div className="card-pad" style={{ paddingBottom: 0 }}>
          <div className="notice" style={{ margin: 0 }}><Icon name="info" /><div>{COMING_LATER} The CLI tools use the logins on the worker machine, so no keys are needed.</div></div>
        </div>
      )}
      <fieldset disabled={!enabled} className="bare" onClick={enabled ? undefined : () => toast(COMING_LATER)}>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => (
          <fieldset className="fieldset" key={g}><legend>{g}</legend>
            <ul className="secret-list">
              {SECRETS.filter((s) => s.group === g).map((s) => {
                const st = isSet(s.name);
                const v = values[s.name] ?? "";
                return (
                  <li key={s.name}>
                    <label htmlFor={`sec-${s.name}`}>
                      <b>{s.label}</b>
                      {st?.is_set ? <span className="chip pub plain">Set{st.updated_at ? ` · ${ago(st.updated_at, now)}` : ""}</span> : <span className="chip hidden plain">Not set</span>}
                      {s.hint && <span className="hint">{s.hint}</span>}
                    </label>
                    <div className="row-flex" style={{ gap: 8 }}>
                      <input id={`sec-${s.name}`} className="input" type={s.secret ? "password" : "text"} autoComplete="off" spellCheck={false}
                        value={v} placeholder={st?.is_set ? (s.secret ? "•••••••• (enter a new value to replace)" : "Set — enter a new value to replace") : s.placeholder ?? ""}
                        onChange={(e) => setValues((x) => ({ ...x, [s.name]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) save(s.name, v, s.label); }} />
                      <button className="btn sm primary" disabled={!v.trim() || busy === s.name} onClick={() => save(s.name, v, s.label)}>Save</button>
                      {st?.is_set && <button className="btn sm ghost danger" disabled={busy === s.name} onClick={() => save(s.name, "", s.label)}>Clear</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
        <p className="faint" style={{ margin: 0, fontSize: 13 }}>
          The worker picks up changes on its next command or heartbeat (within ~30 s). Subscription CLIs (Claude Code, Codex, Antigravity CLI on the login backend) need no key here: they use the login stored on the worker machine.
        </p>
      </div>
      </fieldset>
    </div>
  );
}

