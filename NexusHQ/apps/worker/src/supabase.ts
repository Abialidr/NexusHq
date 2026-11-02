// The worker's only link to the admin: it signs in to Supabase as its own user (app_metadata.role = 'worker'),
// so RLS limits it to agent_settings (read), worker_status (own row) and commands. Outbound only.
// Connection details come from nexushq.config.json (written by the admin's setup wizard), falling back to .env.local.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readConfig } from "@nexushq/shared/config";
import { getLocalSecret } from "./secrets.ts";

export interface WorkerLogin {
  url: string;
  publishableKey: string;
  email: string;
  password: string;
  name?: string;
}

// Everything the worker needs to sign in, or the reason it can't yet (shown while it waits for setup).
export function workerLogin(): WorkerLogin | { missing: string } {
  const config = readConfig();
  if (!config) return { missing: "Supabase URL and publishable key" };
  if (!config.workerEmail) return { missing: "worker email" };
  const password = getLocalSecret("worker_password") ?? process.env.WORKER_PASSWORD;
  if (!password) return { missing: "worker password" };
  return { url: config.supabaseUrl, publishableKey: config.publishableKey, email: config.workerEmail, password, name: config.workerName };
}

export async function connect(login: WorkerLogin): Promise<SupabaseClient> {
  const supabase = createClient(login.url, login.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email: login.email, password: login.password });
  if (error) throw new Error(`Worker sign-in failed: ${error.message}`);
  const role = (data.user.app_metadata as { role?: string }).role;
  if (role !== "worker") throw new Error(`Signed in as ${data.user.email}, but its app_metadata.role is "${role ?? "none"}", not "worker" (see apps/worker/README.md).`);
  return supabase;
}
