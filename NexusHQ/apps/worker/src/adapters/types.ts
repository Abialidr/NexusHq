// One adapter per provider, all with the same shape (plan §5.7). The worker never branches on provider anywhere
// else: it looks the adapter up by id and calls these three methods.
import type { AgentConfig, ModelInfo, ProviderChoice, ProviderId } from "@nexushq/shared";
import type { Schema } from "../json.ts";

export interface Usage {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;     // provider-reported or client-side estimate; subscription logins have no real per-call price
  ms: number;
}

export interface CallResult<T> {
  data: T;
  usage: Usage;
}

export interface Adapter {
  id: ProviderId;
  // Cheap reachability check: binary on PATH, server answering, credentials present. No model call.
  check(cfg: ProviderChoice): Promise<{ ok: boolean; detail: string }>;
  listModels(cfg: ProviderChoice): Promise<ModelInfo[]>;
  // One structured call. Must return data that already passed `schema`, or throw.
  // `signal` = the run's Stop button; CLI adapters kill the process when it fires.
  complete<T>(prompt: string, schema: Schema, cfg: AgentConfig, opts?: { signal?: AbortSignal }): Promise<CallResult<T>>;
  // Whether the secret this provider (or the chosen backend) needs is stored. undefined = needs none.
  keySet?(cfg: ProviderChoice): boolean | undefined;
}

export const DEFAULT_TIMEOUT_MS = 120_000;

export function timeoutOf(cfg: AgentConfig) {
  return cfg.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

export async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 15_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}
