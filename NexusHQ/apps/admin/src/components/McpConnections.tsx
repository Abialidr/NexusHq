"use client";

// AI agents → Connections: which MCP servers (Upwork) are added to and signed in on each local CLI. Every button is
// a command the worker runs with that CLI's own `mcp` subcommands; "Connect" opens the OAuth sign-in in a browser on
// the worker's machine. Rows that are already connected need nothing.
import Icon from "@/components/Icon";
import {
  AGENTS, MCP_CLI_CAPS, MCP_CLIS, MCP_LOGIN_TIMEOUT_MS, MCP_SERVER_IDS, MCP_SERVERS, PROVIDERS,
  type McpAuth, type McpCli, type McpServerId, type McpStatusMap, type ProviderId,
} from "@nexushq/shared";

interface PendingCommand {
  kind: string;
  payload: Record<string, unknown>;
  status: string;
}

type Send = (kind: string, payload: Record<string, unknown>, done: string) => Promise<void>;

const AUTH_CHIP: Record<McpAuth, [string, string]> = {
  connected: ["pub", "Connected"],
  needs_auth: ["pending", "Sign-in needed"],
  failed: ["draft", "Error"],
  not_added: ["hidden", "Not added"],
  unknown: ["plain", "Added"],
};

export default function McpConnections({ mcp, cliStatus, online, usedBy, commands, send, now }: {
  mcp: McpStatusMap | undefined;
  cliStatus: Partial<Record<ProviderId, { available: boolean; detail: string }>>;
  online: boolean;
  usedBy: Partial<Record<ProviderId, string[]>>;
  commands: PendingCommand[];
  send: Send;
  now: number;
}) {
  const inFlight = (cli: McpCli, server: McpServerId) =>
    commands.find((c) => (c.status === "queued" || c.status === "running") && c.kind.startsWith("mcp_") &&
      (c.payload.cli === undefined || c.payload.cli === cli) && (c.payload.server === undefined || c.payload.server === server));

  return (
    <div className="card agent-card">
      <div className="card-head" style={{ flexWrap: "wrap" }}>
        <div>
          <b style={{ fontSize: 16 }}>Connections</b>
          <div className="faint" style={{ fontSize: 13 }}>
            Connect everything once here; the agent cards below only pick from it. Log in to each CLI once in a terminal (steps
            below), then add Upwork and sign in to it from this page. Sign-in pages open in a browser on the worker machine.
          </div>
        </div>
        <button className="btn sm" disabled={!online || !mcp} onClick={() => send("mcp_check", {}, "Checking every connection…")}>
          <Icon name="search" /> Check all
        </button>
      </div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!mcp && (
          <div className="notice" style={{ margin: 0 }}>
            <Icon name="info" />
            <div>
              Connections need database migration <code className="mono">20261023120000_mcp_connections</code>. Open{" "}
              <a href="/setup">Setup</a>, add a Supabase access token and press Finish to install it.
            </div>
          </div>
        )}
        <fieldset className="fieldset">
          <legend>CLIs (log in once in a terminal)</legend>
          <ul className="secret-list">
            {MCP_CLIS.map((cli) => {
              const def = PROVIDERS[cli];
              const ps = cliStatus[cli];
              const ok = online && !!ps?.available;
              const busy = commands.some((c) => (c.status === "queued" || c.status === "running") && c.kind === "refresh_models" && (c.payload.provider ?? cli) === cli);
              return (
                <li key={cli}>
                  <label>
                    <b>{def.label}</b>
                    <span className={`chip ${ok ? "pub" : "draft"} plain`}>{busy ? "Checking…" : ok ? "Connected" : "Not connected"}</span>
                    {(usedBy[cli] ?? []).length > 0 && <span className="chip label plain">Used by {usedBy[cli]!.join(", ")}</span>}
                    <span className="hint">{!online ? "Start the worker to check." : ps ? ps.detail : "Not checked yet."}</span>
                  </label>
                  <div className="row-flex" style={{ gap: 8 }}>
                    <button className="btn sm ghost" disabled={!online || busy} onClick={() => send("refresh_models", { provider: cli }, `Checking ${def.label}…`)}>Check</button>
                  </div>
                  {!ok && (
                    <details className="setup">
                      <summary>How to install and log in to {def.label}</summary>
                      <ol>{def.setup.map((s, i) => <li key={i}><Code text={s} /></li>)}</ol>
                      {def.note && <p className="faint">{def.note}</p>}
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>

        {MCP_SERVER_IDS.map((serverId) => {
          const server = MCP_SERVERS[serverId];
          return (
            <fieldset className="fieldset" key={serverId}>
              <legend>{server.label}</legend>
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>{server.description} <span className="mono faint">{server.url}</span></p>
              {server.warning && <div className="notice" style={{ margin: 0 }}><Icon name="info" /><div style={{ fontSize: 13 }}>{server.warning}</div></div>}
              <ul className="secret-list">
                {MCP_CLIS.map((cli) => {
                  const caps = MCP_CLI_CAPS[cli];
                  const st = mcp?.[cli]?.[serverId];
                  const auth: McpAuth = st?.auth ?? "not_added";
                  const busy = inFlight(cli, serverId);
                  const users = usedBy[cli] ?? [];
                  const cliReady = cliStatus[cli]?.available ?? false; // installed + its own account login works
                  const disabled = !online || !mcp || !!busy || !cliReady;
                  const target = { cli, server: serverId };
                  return (
                    <li key={cli}>
                      <label>
                        <b>{caps.label}</b>
                        <span className={`chip ${AUTH_CHIP[auth][0]} plain`}>{busy ? "Working…" : AUTH_CHIP[auth][1]}</span>
                        {users.length > 0 && <span className="chip label plain">Used by {users.join(", ")}</span>}
                        <span className="hint">
                          {online && !cliReady
                            ? `${caps.label} isn't connected yet: log in to it first (CLIs, above).`
                            : busy?.kind === "mcp_login"
                            ? `A terminal window opened on the worker machine and it opens ${server.short} in your browser: approve there, the window closes by itself (up to ${MCP_LOGIN_TIMEOUT_MS / 60_000} min).`
                            : st ? `${st.detail} · checked ${ago(st.checkedAt, now)}` : online ? "Not checked yet." : "Start the worker to check."}
                        </span>
                      </label>
                      <div className="row-flex" style={{ gap: 8, flexWrap: "wrap" }}>
                        {!st?.added && (
                          <button className="btn sm primary" disabled={disabled} onClick={() => send("mcp_add", target, `Adding ${server.label} to ${caps.label}…`)}>Add</button>
                        )}
                        {caps.canLogin && auth !== "connected" && (
                          <button className={`btn sm ${st?.added ? "primary" : ""}`} disabled={disabled}
                            onClick={() => send("mcp_login", target, `Opening the ${server.label} sign-in on the worker machine…`)}>
                            {st?.added ? `Sign in to ${server.short}` : `Add & sign in to ${server.short}`}
                          </button>
                        )}
                        <button className="btn sm ghost" disabled={disabled} onClick={() => send("mcp_check", target, `Checking ${caps.label}…`)}>Check</button>
                        {st?.added && (
                          <button className="btn sm ghost danger" disabled={disabled}
                            onClick={() => { if (confirm(`Remove ${server.label} from ${caps.label}? Its sign-in is kept by the CLI until you log out there.`)) send("mcp_remove", target, `Removing from ${caps.label}…`); }}>
                            Remove
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}

// Which agents use each CLI, from the saved agent settings (shown as "Used by Judge, Writer").
export function cliUsers(settings: { agent: string; provider: ProviderId }[]): Partial<Record<ProviderId, string[]>> {
  const out: Partial<Record<ProviderId, string[]>> = {};
  for (const s of settings) {
    if (!(PROVIDERS[s.provider]?.mode === "cli")) continue;
    (out[s.provider] ??= []).push(AGENTS.find((a) => a.id === s.agent)?.label ?? s.agent);
  }
  return out;
}

// Renders `inline code` spans in setup steps.
function Code({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/).map((part, i) => (part.startsWith("`") ? <code key={i} className="mono">{part.slice(1, -1)}</code> : part))}</>;
}

function ago(iso: string, now: number) {
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.max(0, s)} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}
