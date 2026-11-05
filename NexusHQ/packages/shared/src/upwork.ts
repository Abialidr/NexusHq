// Roadmap H/I/J vocabulary shared by the admin and the worker: tailored resumes, the Upwork inbox (rooms, snapshots)
// and Upwork writes (upwork_actions). Every write goes draft -> preview -> your Confirm; see UPWORK_CONFIRMED_TOOLS.

// The Writer's per-job resume (jobs.draft.resume). Only facts from the admin profile; the admin prints it to PDF.
export interface TailoredResume {
  headline: string;
  summary: string;
  skills: string[];                                                       // most relevant first
  experience: { role: string; company: string; period: string; bullets: string[] }[];
  projects: { name: string; line: string }[];
}

export interface UpworkMessage { from: string; from_self: boolean; at: string; text: string }

export interface UpworkRoom {
  room_id: string; title: string; other_party: string; context: string; last_message_at: string | null;
  awaiting_reply_from: string; unread: boolean; messages: UpworkMessage[]; summary: string; reply_draft: string; synced_at: string;
}

export const SNAPSHOT_KINDS = ["dashboard", "profile", "proposals", "invitations", "offers", "contracts"] as const;
export type SnapshotKind = (typeof SNAPSHOT_KINDS)[number];

export const ACTION_STATUSES = ["draft", "previewing", "preview_ready", "confirming", "done", "error", "cancelled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export interface UpworkAction {
  id: string; kind: "profile_update" | "message" | "invitation"; action: string; params: Record<string, unknown>;
  label: string; reason: string; current: string; preview: unknown; preview_id: string | null;
  status: ActionStatus; error: string | null; result: unknown; created_at: string; updated_at: string;
}

// The profile updates the admin can prepare, with Upwork's own limits (get_tool_help update_profile). Employment,
// education and languages need Upwork record ids and dates, so they stay manual on upwork.com for now.
export const PROFILE_ACTIONS = {
  update_title: { label: "Upwork title", param: "title", max: 70 },
  update_overview: { label: "Upwork overview", param: "overview", max: 5000 },
  set_skills: { label: "Upwork skills", param: "skills", max: 20 },
  update_availability: { label: "Availability", param: "capacity", max: 0 },
} as const;
export type ProfileAction = keyof typeof PROFILE_ACTIONS;
export const AVAILABILITY = ["fullTime", "partTime", "lessThen", "notSure", "none"] as const;
export const MESSAGE_MAX = 10_240; // send_message limit

export const isProfileAction = (v: unknown): v is ProfileAction => typeof v === "string" && v in PROFILE_ACTIONS;

// Checks one profile update's params against Upwork's limits; returns an error message or null.
export function checkProfileParams(action: ProfileAction, params: Record<string, unknown>): string | null {
  const def = PROFILE_ACTIONS[action];
  const v = params[def.param];
  if (action === "set_skills") {
    if (!Array.isArray(v) || v.some((s) => typeof s !== "string" || !s.trim())) return "Skills must be a list of names.";
    return v.length > def.max ? `Upwork allows at most ${def.max} skills.` : null;
  }
  if (action === "update_availability") return (AVAILABILITY as readonly unknown[]).includes(v) ? null : "Pick an availability.";
  if (typeof v !== "string" || !v.trim()) return `${def.label} is empty.`;
  return v.length > def.max ? `${def.label} is too long (${def.max} characters max).` : null;
}

// Rooms not seen in a sync for this long are deleted (messages are private; only recent ones are kept).
export const ROOM_RETENTION_DAYS = 30;
