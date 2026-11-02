import JobRadar, { type JobRow, type RunRow } from "@/components/JobRadar";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WORKER_ONLINE_MS } from "@nexushq/shared";

export const metadata = { title: "Job radar" };

// Upwork cockpit → Job radar: press Find jobs, then review every job the pipeline saw, grouped by the stage it reached.
export default async function JobsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [jobs, runs, status, pending] = await Promise.all([
    supabase.from("jobs").select("id, upwork_id, title, url, summary, detail, stage, reason, score, rank, suggested_bid, draft, assessment, found_at")
      .order("found_at", { ascending: false }).limit(400),
    supabase.from("job_runs").select("*").order("started_at", { ascending: false }).limit(5),
    supabase.from("worker_status").select("last_seen_at").eq("id", 1).maybeSingle(),
    supabase.from("commands").select("kind, payload, status").in("status", ["queued", "running"]).in("kind", ["run_now", "draft_job"]),
  ]);
  const missing = jobs.error && /jobs|job_runs/.test(jobs.error.message);
  if (jobs.error && !missing) throw new Error(jobs.error.message);
  const lastSeen = status.data?.last_seen_at;
  return (
    <JobRadar
      jobs={(jobs.data ?? []) as unknown as JobRow[]}
      runs={(runs.data ?? []) as unknown as RunRow[]}
      pending={(pending.data ?? []) as { kind: string; payload: Record<string, unknown>; status: string }[]}
      online={!!lastSeen && Date.now() - new Date(lastSeen).getTime() < WORKER_ONLINE_MS}
      needsMigration={!!missing}
    />
  );
}
