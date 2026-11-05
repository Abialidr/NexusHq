// Admin -> worker commands (public.commands). The admin inserts a row; the worker claims it with
// claim_next_command(), runs it and writes result/error back.
import type { AgentId, ProviderId } from "./agents.ts";
import type { McpCli, McpServerId } from "./mcp.ts";

export type CommandKind =
  | "test_agent" | "refresh_models" | "pull_model"
  | "mcp_check" | "mcp_add" | "mcp_login" | "mcp_remove"
  | "run_now" | "pause" | "resume" | "regenerate_draft" | "draft_job"
  | "upwork_sync" | "profile_sync" | "upwork_preview" | "upwork_confirm" | "invitation_draft";

export interface CommandPayloads {
  test_agent: { agent: AgentId };
  refresh_models: { provider?: ProviderId };
  pull_model: { model: string; base_url?: string };
  mcp_check: { cli?: McpCli; server?: McpServerId }; // omitted = every CLI × server
  mcp_add: { cli: McpCli; server: McpServerId };
  mcp_login: { cli: McpCli; server: McpServerId };  // opens the browser on the worker's machine
  mcp_remove: { cli: McpCli; server: McpServerId };
  run_now: { focus?: string }; // "Find jobs": one user-started pipeline run, optional focus text
  pause: Record<string, never>;
  resume: Record<string, never>;
  regenerate_draft: { job_id: string };
  draft_job: { job_id: string };
  upwork_sync: Record<string, never>;    // "Check Upwork": read activity, brief it, draft replies (read-only)
  profile_sync: Record<string, never>;   // compare admin profile with Upwork, propose updates as draft actions
  upwork_preview: { action_id: string }; // ask Upwork for a preview of one profile update (changes nothing)
  upwork_confirm: { action_id: string }; // you pressed Confirm: run the previewed update / send the reply
  invitation_draft: { invitation_id: string }; // write a cover letter / bid / answers for one invitation (read-only)
}

// Kinds the v1 worker actually handles. The rest exist in the schema for the job pipeline and fail with a clear
// "not in v1" error until it's built.
export const V1_COMMANDS: CommandKind[] = [
  "test_agent", "refresh_models", "pull_model", "mcp_check", "mcp_add", "mcp_login", "mcp_remove", "run_now", "draft_job",
  "upwork_sync", "profile_sync", "upwork_preview", "upwork_confirm", "invitation_draft",
];

// An OAuth login waits for you to finish signing in in the browser.
export const MCP_LOGIN_TIMEOUT_MS = 5 * 60_000;

// A worker is shown as online when its heartbeat is newer than this.
export const WORKER_ONLINE_MS = 90_000;
