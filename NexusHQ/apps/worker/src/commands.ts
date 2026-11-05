// Handlers for admin commands (public.commands). Each returns a JSON result or throws; the loop in main.ts
// writes either back to the row and saves worker_status.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMcpCli, isMcpServerId, isProviderEnabled, isProviderId, PROVIDER_IDS, TEST_PROMPT, TEST_SCHEMA, V1_COMMANDS, type AgentId,
  type CommandKind, type McpCli, type McpServerId,
} from "@nexushq/shared";
import { adapterFor } from "./adapters/index.ts";
import { ollamaPull } from "./adapters/local.ts";
import { loadAgentConfigs } from "./agents.ts";
import { mcpAdd, mcpLogin, mcpRemove } from "./mcp.ts";
import { draftOne, runFindJobs } from "./pipeline.ts";
import type { Status } from "./status.ts";
import { confirmAction, draftInvitation, previewAction, profileSync, syncUpwork } from "./upwork.ts";

export interface CommandRow {
  id: string;
  kind: CommandKind;
  payload: Record<string, unknown>;
}

type Ctx = { supabase: SupabaseClient; status: Status };

const handlers: Partial<Record<CommandKind, (p: Record<string, unknown>, ctx: Ctx) => Promise<unknown>>> = {
  // One real, tiny, schema-validated call through the agent's configured provider. No retry or fallback here:
  // the point is to see whether *this* configuration works.
  async test_agent(p, { supabase, status }) {
    const agent = p.agent as AgentId;
    const cfg = (await loadAgentConfigs(supabase)).find((c) => c.agent === agent);
    if (!cfg) throw new Error(`No settings for agent "${agent}"`);
    const adapter = adapterFor(cfg.provider);
    const started = Date.now();
    const base = { provider: cfg.provider, model: cfg.model, at: new Date().toISOString() };
    const check = await adapter.check(cfg);
    if (!check.ok) {
      status.setTest(agent, { ok: false, detail: check.detail, ...base });
      throw new Error(check.detail);
    }
    try {
      const r = await adapter.complete<{ ok: boolean; note: string }>(TEST_PROMPT, TEST_SCHEMA, { ...cfg, options: { ...cfg.options, maxTokens: 200 } });
      const detail = `${check.detail} · replied "${r.data.note}"${r.usage.inputTokens != null ? ` · ${r.usage.inputTokens}/${r.usage.outputTokens} tokens` : ""}`;
      status.setTest(agent, { ok: true, detail, latencyMs: Date.now() - started, ...base });
      return { ok: true, detail, usage: r.usage };
    } catch (e) {
      status.setTest(agent, { ok: false, detail: (e as Error).message, latencyMs: Date.now() - started, ...base });
      throw e;
    }
  },

  async refresh_models(p, { supabase, status }) {
    const configs = await loadAgentConfigs(supabase);
    const ids = isProviderId(p.provider) ? [p.provider] : PROVIDER_IDS.filter(isProviderEnabled);
    const out: Record<string, { available: boolean; models: number; detail: string }> = {};
    for (const id of ids) {
      const s = await status.refreshProvider(id, configs.find((c) => c.provider === id));
      out[id] = { available: s.available, models: s.models.length, detail: s.detail };
    }
    return out;
  },

  async pull_model(p, { supabase, status }) {
    const model = String(p.model ?? "").trim();
    if (!/^[\w.:/-]+$/.test(model)) throw new Error(`Invalid model name "${model}"`);
    const baseUrl = typeof p.base_url === "string" ? p.base_url : (await loadAgentConfigs(supabase)).find((c) => c.provider === "ollama")?.base_url;
    const r = await ollamaPull(model, baseUrl);
    await status.refreshProvider("ollama", { provider: "ollama", model, base_url: baseUrl });
    return { pulled: model, status: r.status };
  },

  // MCP connections (admin → Connections). Each action ends by re-checking that CLI × server, so the admin always
  // shows what the CLI itself reports.
  async mcp_check(p, { status }) {
    return status.refreshMcp(isMcpCli(p.cli) ? p.cli : undefined, isMcpServerId(p.server) ? p.server : undefined);
  },

  async mcp_add(p, { status }) {
    const { cli, server } = mcpTarget(p);
    await mcpAdd(cli, server);
    return (await status.refreshMcp(cli, server))[cli]?.[server];
  },

  async mcp_login(p, { status }) {
    const { cli, server } = mcpTarget(p);
    try {
      await mcpLogin(cli, server);
    } finally {
      await status.refreshMcp(cli, server);
    }
    return status.row.mcp[cli]?.[server];
  },

  async mcp_remove(p, { status }) {
    const { cli, server } = mcpTarget(p);
    await mcpRemove(cli, server);
    return (await status.refreshMcp(cli, server))[cli]?.[server];
  },

  // "Find jobs": one full pipeline run (search → gates → rank → drafts). Takes minutes; progress is in job_runs.
  async run_now(p, { supabase }) {
    return runFindJobs(supabase, typeof p.focus === "string" ? p.focus.trim().slice(0, 200) : "");
  },

  // "Draft this anyway" on a job the pipeline didn't shortlist (or a re-draft).
  async draft_job(p, { supabase }) {
    if (typeof p.job_id !== "string" || !p.job_id) throw new Error("Missing job_id");
    const draft = await draftOne(supabase, null, null, p.job_id);
    return { drafted: true, chars: draft.cover_letter.length };
  },

  // Upwork inbox / Profile sync (roadmap I + J). The two writes only run on a row you moved to "confirming".
  async upwork_sync(_p, { supabase }) {
    return syncUpwork(supabase);
  },
  async profile_sync(_p, { supabase }) {
    return profileSync(supabase);
  },
  async invitation_draft(p, { supabase }) {
    if (typeof p.invitation_id !== "string" || !p.invitation_id) throw new Error("Missing invitation_id");
    return draftInvitation(supabase, p.invitation_id);
  },
  async upwork_preview(p, { supabase }) {
    if (typeof p.action_id !== "string" || !p.action_id) throw new Error("Missing action_id");
    return previewAction(supabase, p.action_id);
  },
  async upwork_confirm(p, { supabase }) {
    if (typeof p.action_id !== "string" || !p.action_id) throw new Error("Missing action_id");
    return confirmAction(supabase, p.action_id);
  },
};

function mcpTarget(p: Record<string, unknown>): { cli: McpCli; server: McpServerId } {
  if (!isMcpCli(p.cli)) throw new Error(`Unknown CLI "${String(p.cli)}"`);
  if (!isMcpServerId(p.server)) throw new Error(`Unknown MCP server "${String(p.server)}"`);
  return { cli: p.cli, server: p.server };
}

export async function handleCommand(cmd: CommandRow, ctx: Ctx): Promise<unknown> {
  const handler = handlers[cmd.kind];
  if (!handler || !V1_COMMANDS.includes(cmd.kind)) throw new Error(`"${cmd.kind}" is not handled by worker v1 yet`);
  return handler(cmd.payload ?? {}, ctx);
}
