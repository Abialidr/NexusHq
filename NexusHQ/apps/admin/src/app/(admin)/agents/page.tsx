import AgentSettings, { type CommandItem, type SettingsRow, type WorkerStatus } from "@/components/AgentSettings";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "AI agents" };

// Settings → AI agents: pick provider + model per pipeline agent, see what the local worker reports, and send it
// commands (test, refresh models, pull). Reads are RLS-scoped to the admin; writes go through actions.ts.
export default async function AgentsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [settings, status, commands, secrets] = await Promise.all([
    supabase.from("agent_settings").select("*"),
    supabase.from("worker_status").select("*").eq("id", 1).maybeSingle(),
    supabase.from("commands").select("id, kind, payload, status, result, error, created_at, finished_at")
      .order("created_at", { ascending: false }).limit(12),
    supabase.rpc("agent_secret_status"), // names + set/not set only; values never reach the admin
  ]);
  if (settings.error) throw new Error(settings.error.message);
  return (
    <AgentSettings
      settings={settings.data as unknown as SettingsRow[]}
      status={status.data as unknown as WorkerStatus | null}
      commands={(commands.data ?? []) as unknown as CommandItem[]}
      secrets={secrets.data ?? []}
    />
  );
}
