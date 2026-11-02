// Cloud APIs called directly: Anthropic, Claude on Bedrock, Claude on Vertex / Agent Platform, OpenAI, Gemini.
// Claude calls force a single tool call whose input_schema is our schema — that works the same on all three
// Claude platforms. Credentials come from the worker's secrets, else the SDK's standard chain (AWS profile, gcloud ADC).
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { PROVIDERS, type AgentConfig } from "@nexushq/shared";
import { parseAndValidate, type Schema } from "../json.ts";
import { getSecret } from "../secrets.ts";
import { openaiChat, openaiModels } from "./local.ts";
import { fetchJson, timeoutOf, type Adapter, type CallResult } from "./types.ts";

type ClaudeClient = Pick<Anthropic, "messages">;

async function claudeCall<T>(client: ClaudeClient, prompt: string, schema: Schema, cfg: AgentConfig): Promise<CallResult<T>> {
  if (!cfg.model) throw new Error("Pick a model");
  const started = Date.now();
  const msg = await client.messages.create({
    model: cfg.model,
    max_tokens: cfg.options.maxTokens ?? 1024,
    ...(cfg.options.temperature != null ? { temperature: cfg.options.temperature } : {}),
    messages: [{ role: "user", content: prompt }],
    tools: [{ name: "respond", description: "Return the answer.", input_schema: schema as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: "respond" },
  }, { timeout: timeoutOf(cfg) });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error(`No tool call in response (stop_reason: ${msg.stop_reason})`);
  return {
    data: parseAndValidate<T>(schema, block.input),
    usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens, ms: Date.now() - started },
  };
}

const curated = (id: keyof typeof PROVIDERS) => async () => PROVIDERS[id].curatedModels.map((m) => ({ id: m }));

// --- Anthropic API ----------------------------------------------------------------------------------------

function anthropicClient() {
  const apiKey = getSecret("anthropic");
  if (!apiKey) throw new Error("No Anthropic key. Set it in the admin (AI agents → API keys): anthropic");
  return new Anthropic({ apiKey });
}

export const anthropic: Adapter = {
  id: "anthropic",
  keySet: () => !!getSecret("anthropic"),
  async check() {
    if (!getSecret("anthropic")) return { ok: false, detail: "No key stored (admin → AI agents → API keys: anthropic)" };
    return { ok: true, detail: "Key stored" };
  },
  async listModels() {
    const page = await anthropicClient().models.list({ limit: 100 });
    return page.data.map((m) => ({ id: m.id, label: m.display_name }));
  },
  complete: (prompt, schema, cfg) => claudeCall(anthropicClient(), prompt, schema, cfg),
};

// --- Bedrock ----------------------------------------------------------------------------------------------

const awsRegion = () => getSecret("aws_region") ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;

export const bedrock: Adapter = {
  id: "bedrock",
  keySet: () => !!awsRegion(),
  async check() {
    const region = awsRegion();
    if (!region) return { ok: false, detail: "No AWS region (admin → AI agents → API keys: aws_region)" };
    const src = getSecret("aws_access_key_id") ? "stored access key" : "AWS default credential chain (profile/SSO)";
    return { ok: true, detail: `Region ${region}, credentials from ${src}. Test connection proves access.` };
  },
  listModels: curated("bedrock"),
  complete(prompt, schema, cfg) {
    const accessKey = getSecret("aws_access_key_id"), secretKey = getSecret("aws_secret_access_key");
    // Stored keys only when both halves exist; otherwise the SDK resolves the default AWS credential chain.
    const client = accessKey && secretKey
      ? new AnthropicBedrock({ awsRegion: awsRegion(), awsAccessKey: accessKey, awsSecretKey: secretKey, awsSessionToken: getSecret("aws_session_token") ?? null })
      : new AnthropicBedrock({ awsRegion: awsRegion() });
    return claudeCall(client as unknown as ClaudeClient, prompt, schema, cfg);
  },
};

// --- Vertex / Google Cloud Agent Platform ----------------------------------------------------------------

const vertexProject = () => getSecret("vertex_project") ?? process.env.ANTHROPIC_VERTEX_PROJECT_ID;
const vertexRegion = () => getSecret("vertex_region") ?? process.env.CLOUD_ML_REGION ?? "global";

export const vertex: Adapter = {
  id: "vertex",
  keySet: () => !!vertexProject(),
  async check() {
    if (!vertexProject()) return { ok: false, detail: "No GCP project (admin → AI agents → API keys: vertex_project)" };
    return { ok: true, detail: `Project ${vertexProject()}, region ${vertexRegion()}, gcloud application-default credentials. Test connection proves access.` };
  },
  listModels: curated("vertex"),
  complete(prompt, schema, cfg) {
    const client = new AnthropicVertex({ projectId: vertexProject(), region: vertexRegion() });
    return claudeCall(client as unknown as ClaudeClient, prompt, schema, cfg);
  },
};

// --- OpenAI -----------------------------------------------------------------------------------------------

const OPENAI = "https://api.openai.com/v1";

export const openai: Adapter = {
  id: "openai",
  keySet: () => !!getSecret("openai"),
  async check() {
    return getSecret("openai") ? { ok: true, detail: "Key stored" } : { ok: false, detail: "No key stored (admin → AI agents → API keys: openai)" };
  },
  async listModels() {
    const all = await openaiModels(OPENAI, getSecret("openai"));
    return all.filter((m) => /^(gpt-|o\d|chatgpt-)/.test(m.id) && !/audio|realtime|transcribe|tts|image|search/.test(m.id));
  },
  complete(prompt, schema, cfg) {
    const key = getSecret("openai");
    if (!key) throw new Error("No OpenAI key. Set it in the admin (AI agents → API keys): openai");
    return openaiChat(OPENAI, key, prompt, schema, cfg);
  },
};

// --- Gemini API -------------------------------------------------------------------------------------------

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";

function geminiKey() {
  const key = getSecret("gemini");
  if (!key) throw new Error("No Gemini key. Set it in the admin (AI agents → API keys): gemini");
  return key;
}

export const gemini: Adapter = {
  id: "gemini",
  keySet: () => !!getSecret("gemini"),
  async check() {
    return getSecret("gemini") ? { ok: true, detail: "Key stored" } : { ok: false, detail: "No key stored (admin → AI agents → API keys: gemini)" };
  },
  async listModels() {
    const r = await fetchJson<{ models: { name: string; displayName: string; supportedGenerationMethods: string[] }[] }>(
      `${GEMINI}/models?pageSize=200`, { headers: { "x-goog-api-key": geminiKey() } },
    );
    return r.models
      .filter((m) => m.supportedGenerationMethods.includes("generateContent") && /gemini/.test(m.name))
      .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName }));
  },
  async complete<T>(prompt: string, schema: Schema, cfg: AgentConfig): Promise<CallResult<T>> {
    if (!cfg.model) throw new Error("Pick a model");
    const started = Date.now();
    const r = await fetchJson<{
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    }>(`${GEMINI}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
      method: "POST", timeoutMs: timeoutOf(cfg),
      headers: { "content-type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          ...(cfg.options.temperature != null ? { temperature: cfg.options.temperature } : {}),
          ...(cfg.options.maxTokens ? { maxOutputTokens: cfg.options.maxTokens } : {}),
        },
      }),
    });
    const text = r.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error(`Empty response (finishReason: ${r.candidates?.[0]?.finishReason ?? "none"})`);
    return {
      data: parseAndValidate<T>(schema, text),
      usage: { inputTokens: r.usageMetadata?.promptTokenCount, outputTokens: r.usageMetadata?.candidatesTokenCount, ms: Date.now() - started },
    };
  },
};
