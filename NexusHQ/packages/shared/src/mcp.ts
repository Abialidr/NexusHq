// MCP servers the agents can use, and what each local CLI can do with them. The admin's Connections card shows
// one row per CLI × server; every action (add, OAuth login, check, remove) is a command the worker runs with the
// CLI's own `mcp` subcommands, so the login lives inside each CLI exactly as if you'd run it in a terminal.
// Verified with claude 2.1.308, codex 0.163.0 and agy 1.4.4 (`<cli> mcp --help`).
import type { ProviderId } from "./agents.ts";

export const MCP_SERVER_IDS = ["upwork"] as const;
export type McpServerId = (typeof MCP_SERVER_IDS)[number];

export interface McpServerDef {
  id: McpServerId;
  label: string;
  short: string; // for buttons: "Sign in to Upwork"
  url: string;
  description: string;
  warning?: string;
}

export const MCP_SERVERS: Record<McpServerId, McpServerDef> = {
  upwork: {
    id: "upwork",
    label: "Upwork (official)",
    short: "Upwork",
    url: "https://mcp.upwork.com/mcp",
    description: "Job search and job details for the Fetch agent. OAuth sign-in with your Upwork account; revoke any time in Upwork → Settings → Connected Apps.",
    warning:
      "Upwork grants full account scope (messages, proposals, contracts). NexusHQ only lets agents call read-only tools, " +
      "but an interactive session of this CLI could use all of them. Upwork's terms allow user-directed searches, not continuous monitoring.",
  },
};

// Upwork tools agents may call (read-only), and the writes that are always blocked on top of that, so a mistake in
// one list can't open a write. Names as the server defines them; each CLI adds its own prefix. See docs/spike.
export const UPWORK_READ_TOOLS = ["list_accounts", "get_tool_help", "find_jobs", "get_profile", "list_freelancer_proposals"] as const;
// The Upwork inbox and Profile sync agents also read messages, the dashboard, offers and contracts. Still read-only.
export const UPWORK_ACTIVITY_TOOLS = [
  "list_accounts", "get_tool_help", "get_profile", "list_freelancer_proposals", "get_messages", "get_freelancer_dashboard",
  "list_offers", "list_contracts",
] as const;
// The only write tools the worker ever allows, each alone in a call that runs after you press Confirm in the admin:
// update_profile only creates a preview; confirm_preview runs exactly that stored preview; send_message sends your text.
export const UPWORK_CONFIRMED_TOOLS = ["update_profile", "confirm_preview", "send_message"] as const;
export const UPWORK_WRITE_TOOLS = [
  "confirm_preview", "confirm_draft", "manage_proposals", "send_message", "respond_to_offer", "set_tool_permission",
  "set_tool_mode", "update_profile", "boost_profile", "save_job", "manage_meetings", "submit_milestones",
  "submit_feedback", "start_attachment_upload", "confirm_attachment_upload",
] as const;

export const MCP_CLIS = ["claude_cli", "codex_cli", "agy_cli"] as const satisfies readonly ProviderId[];
export type McpCli = (typeof MCP_CLIS)[number];

export interface McpCliCaps {
  label: string;
  canLogin: boolean;      // has a scriptable OAuth login (`<cli> mcp login <name>`)
  reportsAuth: boolean;   // its status output says whether the login is done
  loginHint: string;      // shown when canLogin is false
}

export const MCP_CLI_CAPS: Record<McpCli, McpCliCaps> = {
  claude_cli: { label: "Claude Code", canLogin: true, reportsAuth: true, loginHint: "" },
  codex_cli: { label: "Codex", canLogin: true, reportsAuth: true, loginHint: "" },
  agy_cli: {
    label: "Antigravity",
    canLogin: false,
    reportsAuth: true, // read from agy's token file, see worker mcp.ts agySignedIn
    loginHint: "Not signed in yet: agy has no login command, so open agy in a terminal, type /mcp and sign in to upwork.",
  },
};

export type McpAuth = "connected" | "needs_auth" | "failed" | "not_added" | "unknown";

export interface McpEntryStatus {
  added: boolean;
  auth: McpAuth;
  detail: string;
  checkedAt: string;
}

export type McpStatusMap = Partial<Record<McpCli, Partial<Record<McpServerId, McpEntryStatus>>>>;

export const isMcpCli = (v: unknown): v is McpCli => (MCP_CLIS as readonly unknown[]).includes(v);
export const isMcpServerId = (v: unknown): v is McpServerId => (MCP_SERVER_IDS as readonly unknown[]).includes(v);
