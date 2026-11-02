// Reading agent_settings and running one agent call with the retry/fallback rules from plan §5.3:
// validate output, retry once, then try the configured fallback, then give up with every error attached.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isBackend, isProviderId, type AgentConfig, type AgentId, type ProviderChoice } from "@nexushq/shared";
import { adapterFor, type CallResult } from "./adapters/index.ts";
import type { Schema } from "./json.ts";
import { StoppedError } from "./proc.ts";

type SettingsRow = {
  agent: AgentId; provider: string; model: string; backend: string | null; base_url: string | null;
  options: AgentConfig["options"] | null; fallback: ProviderChoice | null;
};

function toConfig(r: SettingsRow): AgentConfig {
  if (!isProviderId(r.provider)) throw new Error(`agent_settings.${r.agent}: unknown provider "${r.provider}"`);
  const fb = r.fallback && isProviderId(r.fallback.provider) ? r.fallback : null;
  return {
    agent: r.agent,
    provider: r.provider,
    model: r.model ?? "",
    backend: isBackend(r.provider, r.backend) ? r.backend : null,
    base_url: r.base_url,
    options: r.options ?? {},
    fallback: fb,
  };
}

export async function loadAgentConfigs(supabase: SupabaseClient): Promise<AgentConfig[]> {
  const { data, error } = await supabase.from("agent_settings").select("*");
  if (error) throw new Error(`Reading agent_settings failed: ${error.message}`);
  return (data as SettingsRow[]).map(toConfig);
}

export interface AgentRun<T> extends CallResult<T> {
  provider: string;
  model: string;
  attempts: string[]; // one line per failed attempt, for the runs log
}

// A stuck call (killed at its timeout) or a bad answer is retried once; `onRetry` lets the pipeline log it.
// Stop (signal) is never retried.
export async function runAgent<T>(
  cfg: AgentConfig, prompt: string, schema: Schema,
  opts: { signal?: AbortSignal; onRetry?: (why: string) => void | Promise<void> } = {},
): Promise<AgentRun<T>> {
  const chain: AgentConfig[] = [cfg, ...(cfg.fallback ? [{ ...cfg, ...cfg.fallback, fallback: null }] : [])];
  const attempts: string[] = [];
  for (const c of chain) {
    for (let i = 0; i < 2; i++) {
      try {
        const r = await adapterFor(c.provider).complete<T>(prompt, schema, c, { signal: opts.signal });
        return { ...r, provider: c.provider, model: c.model, attempts };
      } catch (e) {
        if (e instanceof StoppedError) throw e;
        const msg = `${c.provider}${c.model ? `/${c.model}` : ""}: ${(e as Error).message}`;
        attempts.push(msg);
        if (i === 0) await opts.onRetry?.(msg);
      }
    }
  }
  throw new Error(`All attempts failed:\n${attempts.join("\n")}`);
}
