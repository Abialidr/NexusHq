import UpworkInbox, { type SkillSuggestions, type Snapshot } from "@/components/UpworkInbox";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WORKER_ONLINE_MS, type UpworkAction, type UpworkRoom } from "@nexushq/shared";

export const metadata = { title: "Upwork inbox" };

// Upwork cockpit → Upwork inbox (roadmap I + J): what the Upwork inbox and Profile sync agents found, reply drafts and
// proposed profile updates. Everything is read-only until you press Send or Confirm.
export default async function UpworkPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [snaps, rooms, actions, status, pending] = await Promise.all([
    supabase.from("upwork_snapshots").select("*"),
    supabase.from("upwork_rooms").select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(50),
    supabase.from("upwork_actions").select("*").neq("status", "cancelled").order("created_at", { ascending: false }).limit(60),
    supabase.from("worker_status").select("last_seen_at").eq("id", 1).maybeSingle(),
    supabase.from("commands").select("kind, payload").in("status", ["queued", "running"])
      .in("kind", ["upwork_sync", "profile_sync", "upwork_preview", "upwork_confirm"]),
  ]);
  const missing = snaps.error && /upwork_/.test(snaps.error.message);
  if (snaps.error && !missing) throw new Error(snaps.error.message);
  const lastSeen = status.data?.last_seen_at;
  const suggestions = await skillSuggestions(supabase, (snaps.data ?? []).find((s) => s.kind === "profile")?.data);
  return (
    <UpworkInbox
      snapshots={Object.fromEntries((snaps.data ?? []).map((s) => [s.kind, s])) as Record<string, Snapshot>}
      rooms={(rooms.data ?? []) as unknown as UpworkRoom[]}
      actions={(actions.data ?? []) as unknown as UpworkAction[]}
      pending={(pending.data ?? []) as { kind: string; payload: Record<string, unknown> }[]}
      online={!!lastSeen && Date.now() - new Date(lastSeen).getTime() < WORKER_ONLINE_MS}
      needsMigration={!!missing}
      skills={suggestions}
    />
  );
}

// Skills seen on your Upwork profile, in jobs the Job radar found and in the Filter's "missing skills" that aren't in
// any of your admin skill groups yet, most frequent first. Upwork profile skills come first (you already claim them).
async function skillSuggestions(supabase: Awaited<ReturnType<typeof createClient>>, profile: unknown): Promise<SkillSuggestions> {
  const [groups, jobs] = await Promise.all([
    supabase.from("skill_groups").select("id, title, skills").order("sort_order"),
    supabase.from("jobs").select("summary, assessment").order("found_at", { ascending: false }).limit(400),
  ]);
  const have = new Set((groups.data ?? []).flatMap((g) => g.skills ?? []).map((s) => s.trim().toLowerCase()));
  const found = new Map<string, { name: string; jobs: number; missing: number; upwork: boolean }>();
  const add = (raw: unknown, kind: "jobs" | "missing" | "upwork") => {
    const name = typeof raw === "string" ? raw.trim() : "";
    const key = name.toLowerCase();
    if (!name || name.length > 60 || have.has(key)) return;
    const s = found.get(key) ?? { name, jobs: 0, missing: 0, upwork: false };
    if (kind === "upwork") s.upwork = true; else s[kind]++;
    found.set(key, s);
  };
  const p = profile as { skills?: unknown } | undefined;
  if (Array.isArray(p?.skills)) p.skills.forEach((s) => add(s, "upwork"));
  for (const j of jobs.data ?? []) {
    const sum = j.summary as { skills?: unknown } | null, a = j.assessment as { missing_skills?: unknown } | null;
    if (Array.isArray(sum?.skills)) sum.skills.forEach((s) => add(s, "jobs"));
    if (Array.isArray(a?.missing_skills)) a.missing_skills.forEach((s) => add(s, "missing"));
  }
  const list = [...found.values()]
    .sort((x, y) => Number(y.upwork) - Number(x.upwork) || (y.jobs + y.missing) - (x.jobs + x.missing))
    .slice(0, 120);
  return { groups: (groups.data ?? []).map((g) => ({ id: g.id, title: g.title })), list };
}
