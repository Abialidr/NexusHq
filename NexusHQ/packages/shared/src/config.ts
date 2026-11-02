// NexusHQ runtime config: nexushq.config.json at the NexusHQ root, written by the admin's setup wizard (/setup) and
// read at runtime by the admin, api and worker, so a change needs no rebuild or restart. It holds public values only:
// the Supabase URL and publishable key already ship to every browser. Secrets never go in this file.
// Node-only (fs), so it is a separate entry point (@nexushq/shared/config) that client bundles never import.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface NexusConfig {
  supabaseUrl: string;
  publishableKey: string;
  workerEmail?: string;
  workerName?: string;
  portfolioUrl?: string;
}

let root: string | null = null;

// The nearest folder up from the cwd whose package.json declares workspaces. npm/yarn run each app's scripts from
// its own folder (apps/admin, apps/worker …), so this finds the same root from every app.
export function repoRoot(): string {
  if (root) return root;
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, "package.json");
    try {
      if (existsSync(pkg) && (JSON.parse(readFileSync(pkg, "utf8")) as { workspaces?: unknown }).workspaces) return (root = dir);
    } catch {
      // unreadable package.json: keep walking up
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return (root = process.cwd());
}

export const configPath = () => path.join(repoRoot(), "nexushq.config.json");
export const configFileExists = () => existsSync(configPath());

let cache: { mtime: number; data: Partial<NexusConfig> } | null = null;

// The config file first, then the older .env.local variables as a fallback. Null when neither gives a URL + key.
export function readConfig(): NexusConfig | null {
  const file = configPath();
  if (existsSync(file)) {
    const mtime = statSync(file).mtimeMs;
    if (cache?.mtime !== mtime) cache = { mtime, data: JSON.parse(readFileSync(file, "utf8")) as Partial<NexusConfig> };
    const c = cache.data;
    if (c.supabaseUrl && c.publishableKey) return { ...c, supabaseUrl: c.supabaseUrl, publishableKey: c.publishableKey };
  }
  const env = process.env;
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return null;
  return {
    supabaseUrl,
    publishableKey,
    workerEmail: env.WORKER_EMAIL || undefined,
    workerName: env.WORKER_NAME || undefined,
    portfolioUrl: env.NEXT_PUBLIC_PORTFOLIO_URL || undefined,
  };
}

export function writeConfig(config: NexusConfig) {
  writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n");
  cache = null;
}
