// Running local CLIs (claude, codex, gemini) safely: no shell, prompt on stdin, hard timeout, whole process tree
// killed on timeout (plan §5.7).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WIN = process.platform === "win32";

export interface Resolved {
  file: string;
  prefix: string[]; // args placed before the caller's args (e.g. the JS entry of an npm .cmd shim)
}

// Finds a command on PATH. On Windows, npm installs CLIs as .cmd shims, which Node refuses to spawn without a
// shell; for those we read the shim, find the JS entry it runs and spawn it with this Node binary instead.
export function resolveCommand(name: string): Resolved | null {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const exts = WIN ? [".exe", ".cmd", ""] : [""];
  for (const dir of dirs) {
    for (const ext of exts) {
      const file = path.join(dir, name + ext);
      if (!existsSync(file)) continue;
      if (!WIN || ext === ".exe") return { file, prefix: [] };
      if (ext === ".cmd") {
        const m = readFileSync(file, "utf8").match(/"%~?dp0%?\\([^"]+?\.(?:c?js|mjs))"/i);
        if (m) return { file: process.execPath, prefix: [path.join(dir, m[1])] };
        const exe = readFileSync(file, "utf8").match(/"%~?dp0%?\\([^"]+?\.exe)"/i);
        if (exe) return { file: path.join(dir, exe[1]), prefix: [] };
      }
    }
  }
  return null;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  ms: number;
}

// `env` replaces the environment entirely (see childEnv), so a login-backed CLI can't silently pick up an API
// key that happens to be set in the worker's own environment.
// `signal` (the Stop button) kills the whole tree at once and rejects with StoppedError.
export function run(cmd: Resolved, args: string[], opts: { input?: string; timeoutMs: number; env?: NodeJS.ProcessEnv; cwd?: string; signal?: AbortSignal }): Promise<RunResult> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new StoppedError());
    const child = spawn(cmd.file, [...cmd.prefix, ...args], {
      shell: false, windowsHide: true, cwd: opts.cwd, env: opts.env ?? process.env, detached: !WIN,
    });
    let stdout = "", stderr = "", timedOut = false, stopped = false;
    child.stdout.setEncoding("utf8").on("data", (d: string) => { stdout += d; });
    child.stderr.setEncoding("utf8").on("data", (d: string) => { stderr += d; });
    child.on("error", reject);
    let done = false, grace: NodeJS.Timeout | undefined;
    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer); clearTimeout(grace);
      opts.signal?.removeEventListener("abort", onAbort);
      if (stopped) return reject(new StoppedError());
      resolve({ code, stdout, stderr, timedOut, ms: Date.now() - started });
    };
    // A leftover grandchild can keep the stdout pipe open so "close" never fires after a kill (the run then hangs
    // forever); give it a few seconds, then drop the pipes and finish anyway.
    const kill = () => {
      killTree(child.pid);
      grace = setTimeout(() => { child.stdout.destroy(); child.stderr.destroy(); finish(null); }, 10_000);
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, opts.timeoutMs);
    const onAbort = () => { stopped = true; kill(); };
    opts.signal?.addEventListener("abort", onAbort, { once: true });
    child.on("close", finish);
    child.stdin.end(opts.input ?? "");
  });
}

// Thrown when the user pressed Stop; never retried.
export class StoppedError extends Error {
  constructor() { super("Stopped by you"); this.name = "StoppedError"; }
}

function killTree(pid: number | undefined) {
  if (!pid) return;
  if (WIN) spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  else try { process.kill(-pid, "SIGINT"); } catch { try { process.kill(pid, "SIGKILL"); } catch {} }
}

// The worker's environment minus `drop`, plus `add` (undefined values are skipped).
export function childEnv(drop: string[], add: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of drop) delete env[k];
  for (const [k, v] of Object.entries(add)) if (v) env[k] = v;
  return env;
}

// An empty working directory per call, so a CLI never loads a project's .mcp.json, hooks or instructions.
export async function inTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(path.join(tmpdir(), "nexushq-agent-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
