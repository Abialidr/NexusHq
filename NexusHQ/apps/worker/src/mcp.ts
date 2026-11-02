// Adds, logs in to, checks and removes MCP servers in each local CLI, using the CLI's own `mcp` subcommands, so the
// result is exactly what you'd get typing them in a terminal (the OAuth tokens stay inside each CLI). Every call
// runs from an empty temp dir so no project .mcp.json shows up in the output. Claude Code servers go to user scope,
// so they exist for every folder; Codex and agy have one global config.
// Output formats verified with claude 2.1.308, codex 0.163.0 and agy 1.4.4.
import { MCP_CLI_CAPS, MCP_LOGIN_TIMEOUT_MS, MCP_SERVERS, type McpAuth, type McpCli, type McpEntryStatus, type McpServerId } from "@nexushq/shared";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { agyCommand } from "./adapters/cli.ts";
import { inTempDir, resolveCommand, run, type Resolved, type RunResult } from "./proc.ts";

const CHECK_TIMEOUT_MS = 90_000; // `claude mcp get` health-checks the server
const EDIT_TIMEOUT_MS = 60_000;

function command(cli: McpCli): Resolved | null {
  if (cli === "claude_cli") return resolveCommand("claude");
  if (cli === "codex_cli") return resolveCommand("codex");
  return agyCommand();
}

function exec(cmd: Resolved, args: string[], timeoutMs: number): Promise<RunResult> {
  return inTempDir((cwd) => run(cmd, args, { timeoutMs, cwd }));
}

const output = (r: RunResult) => `${r.stdout}\n${r.stderr}`.trim();

function ensureOk(what: string, r: RunResult) {
  if (r.timedOut) throw new Error(`${what} timed out`);
  if (r.code !== 0) throw new Error(`${what} failed: ${output(r).slice(0, 800) || `exit ${r.code}`}`);
}

const entry = (added: boolean, auth: McpAuth, detail: string): McpEntryStatus => ({ added, auth, detail, checkedAt: new Date().toISOString() });

// ---------------------------------------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------------------------------------

async function claudeStatus(cmd: Resolved, server: McpServerId): Promise<McpEntryStatus> {
  const r = await exec(cmd, ["mcp", "get", server], CHECK_TIMEOUT_MS);
  const out = output(r);
  if (/No MCP server named/i.test(out)) return entry(false, "not_added", "Not added to Claude Code yet.");
  if (r.timedOut) return entry(true, "unknown", "The health check timed out.");
  const status = /Status:\s*(.+)/i.exec(out)?.[1]?.trim() ?? "";
  if (/connected/i.test(status) && !/not|fail/i.test(status)) return entry(true, "connected", status);
  if (/auth/i.test(status)) return entry(true, "needs_auth", status || "Sign-in needed.");
  if (/fail|✗|error/i.test(status)) return entry(true, "failed", status);
  return entry(true, "unknown", status || out.slice(0, 300));
}

// codex `auth_status`: o_auth (signed in), not_logged_in, bearer_token, unsupported.
async function codexStatus(cmd: Resolved, server: McpServerId): Promise<McpEntryStatus> {
  const r = await exec(cmd, ["mcp", "list", "--json"], CHECK_TIMEOUT_MS);
  ensureOk("codex mcp list", r);
  const list = JSON.parse(r.stdout) as { name: string; enabled: boolean; disabled_reason: string | null; auth_status?: string }[];
  const s = list.find((x) => x.name === server);
  if (!s) return entry(false, "not_added", "Not added to Codex yet.");
  if (!s.enabled) return entry(true, "failed", `Disabled${s.disabled_reason ? `: ${s.disabled_reason}` : ""}`);
  if (s.auth_status === "o_auth" || s.auth_status === "bearer_token") return entry(true, "connected", "Signed in (OAuth).");
  if (s.auth_status === "not_logged_in") return entry(true, "needs_auth", "Added, not signed in yet.");
  return entry(true, "unknown", `Codex reports auth "${s.auth_status ?? "?"}".`);
}

// agy prints a table (NAME TYPE STATUS COMMAND/URL) and nothing about sign-in.
async function agyStatus(cmd: Resolved, server: McpServerId): Promise<McpEntryStatus> {
  const r = await exec(cmd, ["mcp", "list"], CHECK_TIMEOUT_MS);
  ensureOk("agy mcp list", r);
  const row = r.stdout.split(/\r?\n/).map((l) => l.trim().split(/\s+/)).find((cols) => cols[0] === server);
  if (!row) return entry(false, "not_added", "Not added to Antigravity yet.");
  if (row[2] === "disabled") return entry(true, "failed", "Added but disabled in agy.");
  return agySignedIn(MCP_SERVERS[server].url)
    ? entry(true, "connected", "Signed in (OAuth) inside agy.")
    : entry(true, "needs_auth", MCP_CLI_CAPS.agy_cli.loginHint);
}

// agy has no status command for sign-in, but keeps MCP OAuth tokens per server URL in
// ~/.gemini/antigravity-cli/mcp_oauth_tokens.json (verified with agy 1.4.6). Only the presence of a token is checked;
// its value is never read out or sent anywhere.
function agySignedIn(url: string): boolean {
  try {
    const file = path.join(os.homedir(), ".gemini", "antigravity-cli", "mcp_oauth_tokens.json");
    const tokens = JSON.parse(readFileSync(file, "utf8")) as Record<string, { token?: { access_token?: string; refresh_token?: string } }>;
    const t = tokens[url]?.token;
    return !!(t?.refresh_token || t?.access_token);
  } catch {
    return false;
  }
}

export async function mcpStatus(cli: McpCli, server: McpServerId): Promise<McpEntryStatus> {
  const cmd = command(cli);
  if (!cmd) return entry(false, "not_added", `${MCP_CLI_CAPS[cli].label} is not installed on this machine.`);
  try {
    if (cli === "claude_cli") return await claudeStatus(cmd, server);
    if (cli === "codex_cli") return await codexStatus(cmd, server);
    return await agyStatus(cmd, server);
  } catch (e) {
    return entry(false, "unknown", (e as Error).message);
  }
}

// ---------------------------------------------------------------------------------------------------------
// add / login / remove
// ---------------------------------------------------------------------------------------------------------

function need(cli: McpCli): Resolved {
  const cmd = command(cli);
  if (!cmd) throw new Error(`${MCP_CLI_CAPS[cli].label} is not installed on this machine.`);
  return cmd;
}

export async function mcpAdd(cli: McpCli, server: McpServerId) {
  const cmd = need(cli);
  const current = await mcpStatus(cli, server);
  if (current.added) return; // already there: nothing to do
  const { url } = MCP_SERVERS[server];
  const args =
    cli === "claude_cli" ? ["mcp", "add", "--transport", "http", "--scope", "user", server, url]
    : cli === "codex_cli" ? ["mcp", "add", server, "--url", url]
    : ["mcp", "add", server, url];
  ensureOk(`Adding ${server} to ${MCP_CLI_CAPS[cli].label}`, await exec(cmd, args, EDIT_TIMEOUT_MS));
}

// Opens the browser on this machine for the OAuth sign-in and waits until it's finished (or times out).
export async function mcpLogin(cli: McpCli, server: McpServerId) {
  if (!MCP_CLI_CAPS[cli].canLogin) throw new Error(MCP_CLI_CAPS[cli].loginHint);
  const cmd = need(cli);
  const current = await mcpStatus(cli, server);
  if (!current.added) await mcpAdd(cli, server);
  if (current.auth === "connected") return;
  const r = await inTerminalWindow(cmd, ["mcp", "login", server], `NexusHQ: sign in to ${MCP_SERVERS[server].short}`);
  if (r.timedOut) throw new Error(`Sign-in wasn't finished within ${MCP_LOGIN_TIMEOUT_MS / 60_000} minutes. Press Sign in to try again.`);
  const after = await mcpStatus(cli, server);
  if (after.auth !== "connected") {
    throw new Error(`Sign-in didn't finish (${after.detail}). If the window closed with an error, run \`${cliName(cli)} mcp login ${server}\` in a terminal.`);
  }
}

const cliName = (cli: McpCli) => (cli === "claude_cli" ? "claude" : cli === "codex_cli" ? "codex" : "agy");

// `<cli> mcp login` refuses to run without a real terminal ("stdin isn't a terminal", verified with claude 2.1.308),
// so the sign-in runs in its own visible console window on this machine: it opens the browser, waits for the
// OAuth redirect and closes when done. We wait for the window (or time out and close it).
async function inTerminalWindow(cmd: Resolved, args: string[], title: string): Promise<RunResult> {
  if (process.platform !== "win32") {
    throw new Error(`Run \`${[cmd.file, ...cmd.prefix, ...args].join(" ")}\` in a terminal on the worker machine to sign in.`);
  }
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`; // PowerShell single-quoted literal
  const argList = [...cmd.prefix, ...args].map((a) => q(a.includes(" ") ? `"${a}"` : a)).join(",");
  const script =
    `$host.UI.RawUI.WindowTitle = ${q(title)}; ` +
    `$p = Start-Process -FilePath ${q(cmd.file)} -ArgumentList @(${argList}) -PassThru; $p.WaitForExit(); exit $p.ExitCode`;
  const shell = resolveCommand("powershell");
  if (!shell) throw new Error("PowerShell not found; run the sign-in in a terminal instead.");
  return run(shell, ["-NoProfile", "-Command", script], { timeoutMs: MCP_LOGIN_TIMEOUT_MS });
}

export async function mcpRemove(cli: McpCli, server: McpServerId) {
  const cmd = need(cli);
  const args = cli === "claude_cli" ? ["mcp", "remove", server, "--scope", "user"] : ["mcp", "remove", server];
  const r = await exec(cmd, args, EDIT_TIMEOUT_MS);
  if (r.code !== 0 && /not found|no mcp server|does not exist|no server/i.test(output(r))) return;
  ensureOk(`Removing ${server} from ${MCP_CLI_CAPS[cli].label}`, r);
}
