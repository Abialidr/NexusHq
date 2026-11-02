// Local CLIs run headless: Claude Code, Codex, Antigravity CLI (plan §5.7). Each call runs in an empty temp dir with a
// hard timeout and no MCP tools, except in agent mode (cfg.mcp, set by the pipeline for the Search agent), where
// exactly the listed read-only tools are allowed and the write tools are blocked. Flags marked [TEST] in the plan are kept in one place per adapter so
// they're easy to adjust after checking `--help` on the installed version.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PROVIDERS, type AgentConfig, type Backend, type ProviderChoice } from "@nexushq/shared";
import { parseAndValidate, type Schema } from "../json.ts";
import { childEnv, inTempDir, resolveCommand, run, type Resolved } from "../proc.ts";
import { getSecret } from "../secrets.ts";
import { timeoutOf, type Adapter, type CallResult } from "./types.ts";

const ALL_CLAUDE_AUTH = [
  "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_MANTLE",
];

function need(name: string): Resolved {
  const cmd = resolveCommand(name);
  if (!cmd) throw new Error(`\`${name}\` not found on PATH. See the setup steps for this provider.`);
  return cmd;
}

async function versionCheck(name: string, label: string, cmd = resolveCommand(name)) {
  if (!cmd) return { ok: false, detail: `${label} not installed (\`${name}\` not on PATH)` };
  try {
    const r = await run(cmd, ["--version"], { timeoutMs: 20_000 });
    const v = (r.stdout || r.stderr).trim().split("\n")[0];
    return r.code === 0 ? { ok: true, detail: `${label} ${v}` } : { ok: false, detail: `${label} --version failed: ${v}` };
  } catch (e) {
    return { ok: false, detail: `${label} failed to start: ${(e as Error).message}` };
  }
}

function failure(label: string, r: { code: number | null; stdout: string; stderr: string; timedOut: boolean; ms: number }) {
  if (r.timedOut) return new Error(`${label} got stuck (no answer after ${Math.round(r.ms / 1000)} s) and was killed`);
  const tail = (r.stderr || r.stdout).trim().split("\n").slice(-3).join(" ");
  return new Error(`${label} exited ${r.code}: ${tail.slice(0, 400)}`);
}

const backendOf = (cfg: ProviderChoice): Backend => cfg.backend ?? "login";

// The Upwork server prefixes its own tool names with "upwork__" (find_jobs → upwork__find_jobs); each CLI then adds
// its own prefix: Claude "mcp__<server>__<tool>", agy rules "mcp(<server>/<tool>)". Seen in docs/spike/upwork-tools.json.
const serverTool = (server: string, tool: string) => `${server}__${tool}`;
const claudeToolName = (server: string, tool: string) => `mcp__${server}__${serverTool(server, tool)}`;

// --- Claude Code ------------------------------------------------------------------------------------------

function claudeEnv(backend: Backend) {
  switch (backend) {
    case "api_key":
      return childEnv(ALL_CLAUDE_AUTH, { ANTHROPIC_API_KEY: getSecret("anthropic") });
    case "bedrock":
      return childEnv(ALL_CLAUDE_AUTH, {
        CLAUDE_CODE_USE_BEDROCK: "1",
        AWS_REGION: getSecret("aws_region") ?? process.env.AWS_REGION,
        AWS_ACCESS_KEY_ID: getSecret("aws_access_key_id"),
        AWS_SECRET_ACCESS_KEY: getSecret("aws_secret_access_key"),
        AWS_SESSION_TOKEN: getSecret("aws_session_token"),
        AWS_BEARER_TOKEN_BEDROCK: getSecret("aws_bearer_token_bedrock"),
      });
    case "vertex":
      return childEnv(ALL_CLAUDE_AUTH, {
        CLAUDE_CODE_USE_VERTEX: "1",
        CLOUD_ML_REGION: getSecret("vertex_region") ?? process.env.CLOUD_ML_REGION,
        ANTHROPIC_VERTEX_PROJECT_ID: getSecret("vertex_project") ?? process.env.ANTHROPIC_VERTEX_PROJECT_ID,
      });
    default:
      return childEnv(ALL_CLAUDE_AUTH); // subscription login stored by the CLI itself
  }
}

export const claudeCli: Adapter = {
  id: "claude_cli",
  check: () => versionCheck("claude", "Claude Code"),
  listModels: async () => PROVIDERS.claude_cli.curatedModels.map((id) => ({ id })),
  keySet(cfg) {
    const b = backendOf(cfg);
    if (b === "api_key") return !!getSecret("anthropic");
    if (b === "vertex") return !!(getSecret("vertex_project") ?? process.env.ANTHROPIC_VERTEX_PROJECT_ID);
    if (b === "bedrock") return !!(getSecret("aws_region") ?? process.env.AWS_REGION);
    return undefined;
  },
  async complete<T>(prompt: string, schema: Schema, cfg: AgentConfig, opts: { signal?: AbortSignal } = {}): Promise<CallResult<T>> {
    const backend = backendOf(cfg);
    if (backend !== "login" && !cfg.model) throw new Error("Pick a model for Claude Code on this backend (the default there is Opus).");
    // Agent mode: the user-scope MCP servers load, but dontAsk refuses every tool not in --allowedTools, and the
    // write tools are named in --disallowedTools as well. Otherwise --strict-mcp-config: no MCP at all.
    const tools = cfg.mcp
      ? ["--allowedTools", cfg.mcp.allow.map((t) => claudeToolName(cfg.mcp!.server, t)).join(","),
         "--disallowedTools", cfg.mcp.deny.map((t) => claudeToolName(cfg.mcp!.server, t)).join(",")]
      : ["--strict-mcp-config"];
    const args = [
      "-p", "--output-format", "json", "--json-schema", JSON.stringify(schema),
      "--permission-mode", "dontAsk", ...tools,
      // --bare skips hooks/plugins/MCP/CLAUDE.md but also ignores the subscription login, so login runs rely on
      // the empty temp cwd for isolation instead.
      ...(backend === "login" ? [] : ["--bare"]),
      ...(cfg.model ? ["--model", cfg.model] : []),
    ];
    const r = await inTempDir((cwd) => run(need("claude"), args, { input: prompt, timeoutMs: timeoutOf(cfg), env: claudeEnv(backend), cwd, signal: opts.signal }));
    let out: { is_error?: boolean; result?: string; structured_output?: unknown; total_cost_usd?: number; usage?: { input_tokens?: number; output_tokens?: number } };
    try { out = JSON.parse(r.stdout); } catch { throw failure("Claude Code", r); }
    if (out.is_error) throw new Error(`Claude Code: ${String(out.result ?? "error").slice(0, 400)}`);
    // Absent when the run failed or Claude declined; never fall back to parsing free text here.
    if (out.structured_output === undefined) throw new Error("Claude Code returned no structured_output");
    return {
      data: parseAndValidate<T>(schema, out.structured_output),
      usage: { inputTokens: out.usage?.input_tokens, outputTokens: out.usage?.output_tokens, costUsd: out.total_cost_usd, ms: r.ms },
    };
  },
};

// --- Codex CLI --------------------------------------------------------------------------------------------

export const codexCli: Adapter = {
  id: "codex_cli",
  check: () => versionCheck("codex", "Codex CLI"),
  listModels: async () => PROVIDERS.codex_cli.curatedModels.map((id) => ({ id })),
  keySet: (cfg) => (backendOf(cfg) === "api_key" ? !!getSecret("codex") : undefined),
  async complete<T>(prompt: string, schema: Schema, cfg: AgentConfig, opts: { signal?: AbortSignal } = {}): Promise<CallResult<T>> {
    // Codex has no per-run tool allowlist we've verified, so it never gets MCP tools: --ignore-user-config drops every
    // configured MCP server for this call (the ChatGPT login still works).
    if (cfg.mcp) throw new Error("Codex can't be the Search agent (no verified tool allowlist). Pick Claude Code or Antigravity for Search.");
    const env = backendOf(cfg) === "api_key"
      ? childEnv(["OPENAI_API_KEY"], { CODEX_API_KEY: getSecret("codex") })
      : childEnv(["CODEX_API_KEY", "OPENAI_API_KEY"]);
    return inTempDir(async (cwd) => {
      const schemaFile = path.join(cwd, "schema.json"), outFile = path.join(cwd, "out.json");
      writeFileSync(schemaFile, JSON.stringify(schema));
      const args = [
        "exec", "--json", "--output-schema", schemaFile, "-o", outFile,
        "--sandbox", "read-only", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config",
        ...(cfg.model ? ["-m", cfg.model] : []), // [TEST] model flag
        "-", // prompt from stdin
      ];
      const r = await run(need("codex"), args, { input: prompt, timeoutMs: timeoutOf(cfg), env, cwd, signal: opts.signal });
      if (r.code !== 0) throw failure("Codex", r);
      let inputTokens: number | undefined, outputTokens: number | undefined;
      for (const line of r.stdout.split("\n")) {
        try {
          const ev = JSON.parse(line) as { type?: string; usage?: { input_tokens?: number; output_tokens?: number } };
          if (ev.type === "turn.completed" && ev.usage) ({ input_tokens: inputTokens, output_tokens: outputTokens } = ev.usage);
        } catch {}
      }
      return {
        data: parseAndValidate<T>(schema, readFileSync(outFile, "utf8")),
        usage: { inputTokens, outputTokens, ms: r.ms },
      };
    });
  },
};

// --- Antigravity CLI (Google `agy`) -----------------------------------------------------------------------
// Verified with agy 1.4.4: `-p` works with piped stdout (an older reported hang is gone), `--json-schema` fills
// `structured_output`, and the Google account login is used, so no API key. `agy` has no plain-text stdin mode,
// so the prompt is an argument; Windows caps a command line at ~32k chars.

const AGY_MAX_PROMPT = 24_000;

// The installer adds %LOCALAPPDATA%\agy\bin to the *user* PATH, which a worker started before the install
// doesn't see yet, so fall back to that location.
export function agyCommand(): Resolved | null {
  const found = resolveCommand("agy");
  if (found) return found;
  const local = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "agy", "bin", "agy.exe");
  return local && existsSync(local) ? { file: local, prefix: [] } : null;
}

// Adds "mcp(<server>/<tool>)" allow rules to agy's CLI settings (~/.gemini/antigravity-cli/settings.json,
// permissions.allow) so headless runs may call these tools. Only ever called with read-only tools; existing rules kept.
export function ensureAgyAllowed(server: string, tools: readonly string[]) {
  const file = path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json");
  let settings: { permissions?: { allow?: string[] } } & Record<string, unknown> = {};
  try { settings = JSON.parse(readFileSync(file, "utf8") || "{}"); } catch { /* missing or empty: start fresh */ }
  const allow = new Set(settings.permissions?.allow ?? []);
  const before = allow.size;
  for (const t of tools) allow.add(`mcp(${server}/${serverTool(server, t)})`);
  if (allow.size === before) return;
  settings.permissions = { ...settings.permissions, allow: [...allow] };
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2) + "\n");
}

// Any key in the environment would switch agy off the Google login.
const agyEnv = () => childEnv(["GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTIGRAVITY_API_KEY"]);

export const agyCli: Adapter = {
  id: "agy_cli",
  check: () => versionCheck("agy", "Antigravity CLI", agyCommand()),
  // `agy models` prints "<id>\t<label>" per line for the signed-in account.
  async listModels() {
    const cmd = agyCommand();
    if (!cmd) return PROVIDERS.agy_cli.curatedModels.map((id) => ({ id }));
    const r = await run(cmd, ["models"], { timeoutMs: 60_000, env: agyEnv() });
    const models = r.stdout.split(/\r?\n/).map((l) => l.split("\t")).filter((p) => p.length >= 2 && /^[\w.:-]+$/.test(p[0].trim()))
      .map(([id, label]) => ({ id: id.trim(), label: label.trim() }));
    return models.length ? models : PROVIDERS.agy_cli.curatedModels.map((id) => ({ id }));
  },
  async complete<T>(prompt: string, schema: Schema, cfg: AgentConfig, opts: { signal?: AbortSignal } = {}): Promise<CallResult<T>> {
    if (prompt.length > AGY_MAX_PROMPT) throw new Error(`Prompt too long for Antigravity CLI (${prompt.length} > ${AGY_MAX_PROMPT} chars)`);
    const cmd = agyCommand();
    if (!cmd) throw new Error("`agy` not found. See the setup steps for Antigravity CLI.");
    // Headless agy auto-denies every MCP tool without an allow rule (verified 1.4.6), so agent mode = allow rules for
    // exactly the listed tools; writes have none and stay denied.
    if (cfg.mcp) ensureAgyAllowed(cfg.mcp.server, cfg.mcp.allow);
    const args = [
      "-p", prompt, "--output-format", "json", "--json-schema", JSON.stringify(schema),
      "--disable-slash-commands", "--sandbox",
      ...(cfg.model ? ["--model", cfg.model] : []),
    ];
    const r = await inTempDir((cwd) => run(cmd, args, { timeoutMs: timeoutOf(cfg), env: agyEnv(), cwd, signal: opts.signal }));
    let out: { status?: string; response?: string; structured_output?: unknown; usage?: { input_tokens?: number; output_tokens?: number } };
    try { out = JSON.parse(r.stdout); } catch { throw failure("Antigravity CLI", r); }
    if (out.status !== "SUCCESS") throw new Error(`Antigravity CLI: ${out.status ?? "no status"} ${String(out.response ?? "").slice(0, 300)}`);
    if (out.structured_output === undefined) throw new Error("Antigravity CLI returned no structured_output");
    return {
      data: parseAndValidate<T>(schema, out.structured_output),
      usage: { inputTokens: out.usage?.input_tokens, outputTokens: out.usage?.output_tokens, ms: r.ms },
    };
  },
};
