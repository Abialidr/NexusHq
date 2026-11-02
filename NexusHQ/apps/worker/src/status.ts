// The worker_status row: everything the admin knows about this machine. Kept in memory and written back whole,
// since this worker is the row's only writer.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isProviderEnabled, MCP_CLIS, MCP_SERVER_IDS, PROVIDER_IDS, type AgentConfig, type AgentId, type AgentTest, type Hardware, type McpCli,
  type McpServerId, type McpStatusMap, type ProviderChoice, type ProviderId, type ProviderStatus,
} from "@nexushq/shared";
import { adapterFor } from "./adapters/index.ts";
import { mcpStatus } from "./mcp.ts";

export interface StatusRow {
  worker_name: string;
  version: string;
  hardware: Hardware | Record<string, never>;
  providers: Partial<Record<ProviderId, ProviderStatus>>;
  tests: Partial<Record<AgentId, AgentTest>>;
  mcp: McpStatusMap;
  started_at: string;
  last_seen_at: string;
}

export class Status {
  row: StatusRow;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient, name: string, version: string) {
    this.supabase = supabase;
    const now = new Date().toISOString();
    this.row = { worker_name: name, version, hardware: {}, providers: {}, tests: {}, mcp: {}, started_at: now, last_seen_at: now };
  }

  // Until migration 20261023120000 is applied there is no worker_status.mcp column; keep working without it.
  private hasMcpColumn = true;

  async load() {
    let { data, error } = await this.supabase.from("worker_status").select("providers, tests, mcp").eq("id", 1).maybeSingle();
    if (error && /mcp/.test(error.message)) {
      this.hasMcpColumn = false;
      ({ data } = await this.supabase.from("worker_status").select("providers, tests").eq("id", 1).maybeSingle());
    }
    if (data) Object.assign(this.row, { providers: data.providers ?? {}, tests: data.tests ?? {}, mcp: (data as { mcp?: McpStatusMap }).mcp ?? {} });
  }

  async save() {
    this.row.last_seen_at = new Date().toISOString();
    const { mcp, ...rest } = this.row;
    let { error } = await this.supabase.from("worker_status").upsert({ id: 1, ...rest, ...(this.hasMcpColumn ? { mcp } : {}) });
    if (error && this.hasMcpColumn && /mcp/.test(error.message)) {
      this.hasMcpColumn = false;
      ({ error } = await this.supabase.from("worker_status").upsert({ id: 1, ...rest }));
    }
    if (error) throw new Error(`Saving worker_status failed: ${error.message}`);
  }

  get mcpReady() {
    return this.hasMcpColumn;
  }

  // Re-checks MCP servers in the CLIs (all, or one CLI/server) and records the result.
  async refreshMcp(cli?: McpCli, server?: McpServerId) {
    const clis = cli ? [cli] : MCP_CLIS.filter(isProviderEnabled);
    const servers = server ? [server] : [...MCP_SERVER_IDS];
    await Promise.all(clis.flatMap((c) => servers.map(async (s) => {
      (this.row.mcp[c] ??= {})[s] = await mcpStatus(c, s);
    })));
    return this.row.mcp;
  }

  // Re-checks one provider (reachable? key set? which models?) and records it. `cfg` supplies base_url/backend
  // when an agent uses this provider, so e.g. a custom Ollama URL is the one that gets checked.
  async refreshProvider(id: ProviderId, cfg?: ProviderChoice) {
    const adapter = adapterFor(id);
    const choice: ProviderChoice = cfg ?? { provider: id, model: "" };
    const check = await adapter.check(choice).catch((e: Error) => ({ ok: false, detail: e.message }));
    let models = this.row.providers[id]?.models ?? [];
    let detail = check.detail;
    if (check.ok) {
      try {
        models = await adapter.listModels(choice);
      } catch (e) {
        detail = `${detail}; listing models failed: ${(e as Error).message}`;
      }
    }
    this.row.providers[id] = { available: check.ok, detail, keySet: adapter.keySet?.(choice), models, checkedAt: new Date().toISOString() };
    return this.row.providers[id]!;
  }

  async refreshAll(configs: AgentConfig[]) {
    // Only providers this version enables (the CLIs); the rest are switched off in the admin.
    const ids = PROVIDER_IDS.filter(isProviderEnabled);
    await Promise.all(ids.map((id) => this.refreshProvider(id, configs.find((c) => c.provider === id))));
  }

  setTest(agent: AgentId, test: AgentTest) {
    this.row.tests[agent] = test;
  }
}
