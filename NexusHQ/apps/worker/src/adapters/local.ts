// Local model servers: Ollama (native API, schema-constrained `format`) and anything OpenAI-compatible
// (LM Studio, llama.cpp server, vLLM). The OpenAI chat helper is reused by the cloud OpenAI adapter.
import { PROVIDERS, type AgentConfig, type ModelInfo, type ProviderChoice } from "@nexushq/shared";
import { parseAndValidate, type Schema } from "../json.ts";
import { fetchJson, timeoutOf, type Adapter, type CallResult } from "./types.ts";

const trimSlash = (s: string) => s.replace(/\/+$/, "");
const ollamaBase = (cfg: ProviderChoice) => trimSlash(cfg.base_url || PROVIDERS.ollama.defaultBaseUrl!);

export const ollama: Adapter = {
  id: "ollama",
  async check(cfg) {
    try {
      const v = await fetchJson<{ version: string }>(`${ollamaBase(cfg)}/api/version`, { timeoutMs: 5_000 });
      return { ok: true, detail: `Ollama ${v.version} at ${ollamaBase(cfg)}` };
    } catch (e) {
      return { ok: false, detail: `Ollama not reachable at ${ollamaBase(cfg)} (${(e as Error).message}). Is it installed and running?` };
    }
  },
  async listModels(cfg) {
    const r = await fetchJson<{ models: { name: string; size: number }[] }>(`${ollamaBase(cfg)}/api/tags`, { timeoutMs: 5_000 });
    return r.models.map((m) => ({ id: m.name, sizeGb: Math.round((m.size / 1024 ** 3) * 10) / 10, installed: true }));
  },
  async complete<T>(prompt: string, schema: Schema, cfg: AgentConfig): Promise<CallResult<T>> {
    const started = Date.now();
    const r = await fetchJson<{ message: { content: string }; prompt_eval_count?: number; eval_count?: number }>(
      `${ollamaBase(cfg)}/api/chat`,
      {
        method: "POST", timeoutMs: timeoutOf(cfg), headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: cfg.model || "qwen3:4b",
          messages: [{ role: "user", content: prompt }],
          format: schema,
          stream: false,
          think: false, // Qwen3 is a thinking model; the filter wants a fast direct answer
          options: { temperature: cfg.options.temperature ?? 0, ...(cfg.options.maxTokens ? { num_predict: cfg.options.maxTokens } : {}) },
        }),
      },
    );
    return {
      data: parseAndValidate<T>(schema, r.message.content),
      usage: { inputTokens: r.prompt_eval_count, outputTokens: r.eval_count, costUsd: 0, ms: Date.now() - started },
    };
  },
};

// Downloads a model into Ollama. Large models take minutes, hence the long timeout.
export async function ollamaPull(model: string, baseUrl?: string | null) {
  const base = trimSlash(baseUrl || PROVIDERS.ollama.defaultBaseUrl!);
  return fetchJson<{ status: string }>(`${base}/api/pull`, {
    method: "POST", timeoutMs: 60 * 60_000, headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, stream: false }),
  });
}

// --- OpenAI-compatible chat completions -------------------------------------------------------------------

export async function openaiModels(base: string, key?: string): Promise<ModelInfo[]> {
  const r = await fetchJson<{ data: { id: string }[] }>(`${trimSlash(base)}/models`, {
    timeoutMs: 10_000, headers: key ? { authorization: `Bearer ${key}` } : {},
  });
  return r.data.map((m) => ({ id: m.id })).sort((a, b) => a.id.localeCompare(b.id));
}

export async function openaiChat<T>(base: string, key: string | undefined, prompt: string, schema: Schema, cfg: AgentConfig): Promise<CallResult<T>> {
  const started = Date.now();
  const r = await fetchJson<{
    choices: { message: { content: string | null; refusal?: string | null } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  }>(`${trimSlash(base)}/chat/completions`, {
    method: "POST", timeoutMs: timeoutOf(cfg),
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: "user", content: prompt }],
      ...(cfg.options.temperature != null ? { temperature: cfg.options.temperature } : {}),
      ...(cfg.options.maxTokens ? { max_completion_tokens: cfg.options.maxTokens } : {}),
      response_format: { type: "json_schema", json_schema: { name: "output", schema, strict: true } },
    }),
  });
  const msg = r.choices[0]?.message;
  if (!msg?.content) throw new Error(msg?.refusal ? `Model refused: ${msg.refusal}` : "Empty response");
  return {
    data: parseAndValidate<T>(schema, msg.content),
    usage: { inputTokens: r.usage?.prompt_tokens, outputTokens: r.usage?.completion_tokens, ms: Date.now() - started },
  };
}

const compatBase = (cfg: ProviderChoice) => cfg.base_url || PROVIDERS.openai_compat.defaultBaseUrl!;

export const openaiCompat: Adapter = {
  id: "openai_compat",
  async check(cfg) {
    try {
      const models = await openaiModels(compatBase(cfg));
      return { ok: true, detail: `${models.length} model(s) at ${compatBase(cfg)}` };
    } catch (e) {
      return { ok: false, detail: `No OpenAI-compatible server at ${compatBase(cfg)} (${(e as Error).message})` };
    }
  },
  listModels: (cfg) => openaiModels(compatBase(cfg)),
  complete: (prompt, schema, cfg) => openaiChat(compatBase(cfg), undefined, prompt, schema, cfg),
};
