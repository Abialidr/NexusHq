// The three pipeline agents and every provider that can run them (docs/UPWORK_AGENT_PLAN.md §5.5–5.9).
// The admin renders its settings cards and setup checklists from PROVIDERS; the worker picks an adapter by id.
// Adding a provider = one entry here + one adapter in apps/worker/src/adapters.

// "judge" is kept only because it's in the database enum; its job moved into "filter" (rank + bid). Not shown.
export type AgentId = "search" | "filter" | "writer" | "inbox" | "profile" | "judge";
export type Mode = "local" | "cli" | "cloud";
export type ProviderId =
  | "ollama" | "openai_compat"
  | "claude_cli" | "codex_cli" | "agy_cli"
  | "anthropic" | "bedrock" | "vertex" | "openai" | "gemini";
export type Backend = "login" | "api_key" | "bedrock" | "vertex";

export interface AgentOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max"; // Claude Code / Codex CLI only: thinking effort passed to the CLI
  dailyCap?: number;
  maxListings?: number;      // Search agent: listings to collect per Find jobs run (LISTINGS_LIMITS)
  shortlistPercent?: number; // Filter & rank agent: % of collected listings to shortlist and draft (SHORTLIST_LIMITS)
  instructions?: string;     // any agent: your own rules, added to the end of its prompt (INSTRUCTIONS_MAX chars)
  maxCostUsd?: number;       // Filter & rank agent: stop AI calls in a run once reported cost passes this (COST_LIMITS)
  // Filter & rank agent: the free checks run before any AI sees a job (defaults in GATES, jobs.ts)
  gateMinHourly?: number;
  gateMinFixed?: number;
  gateSkipCrowded?: boolean;     // drop jobs with 50+ proposals instead of letting the ranking weigh competition
  gateRequireVerified?: boolean; // drop clients whose payment isn't verified
}

export const LISTINGS_LIMITS = { min: 10, max: 300, default: 40 };
export const SHORTLIST_LIMITS = { min: 1, max: 25, default: 10 };
export const COST_LIMITS = { min: 0.1, max: 50 };
export const INSTRUCTIONS_MAX = 2000;

export interface ProviderChoice {
  provider: ProviderId;
  model: string;          // "" = the provider's own default
  backend?: Backend | null;
  base_url?: string | null;
}

export interface AgentConfig extends ProviderChoice {
  agent: AgentId;
  options: AgentOptions;
  fallback?: ProviderChoice | null;
  // Set by the pipeline, never by the admin: lets this one call use an MCP server's listed tools ("agent mode").
  // Without it a CLI call runs with no MCP tools at all.
  // `extra` adds more servers whose listed tools are allowed too (the scout uses Upwork plus NexusHQ's own server).
  mcp?: { server: string; allow: readonly string[]; deny: readonly string[]; extra?: { server: string; allow: readonly string[] }[] } | null;
  // Built-in CLI tools allowed for this call (Claude Code only, e.g. WebSearch for client checks).
  builtinTools?: readonly string[];
}

export interface ModelInfo {
  id: string;
  label?: string;
  sizeGb?: number;
  installed?: boolean;
}

export interface ProviderStatus {
  available: boolean;
  detail: string;
  keySet?: boolean;
  models: ModelInfo[];
  checkedAt: string;
}

export interface AgentTest {
  ok: boolean;
  detail: string;
  latencyMs?: number;
  provider: ProviderId;
  model: string;
  at: string;
}

// The Find jobs pipeline (roadmap "agreed base flow"): Search → code gates → Filter & rank → Writer.
export const AGENTS: { id: AgentId; label: string; job: string; usesUpwork?: boolean }[] = [
  { id: "search", label: "Search", usesUpwork: true, job: "Searches Upwork for jobs that fit your profile (read-only Upwork tools only) and fetches details for the ones that pass the basic checks." },
  { id: "filter", label: "Filter & rank", job: "Scores the remaining jobs against your profile, keeps the best 5–10% ranked best to worst, and suggests a bid for each." },
  { id: "writer", label: "Writer", job: "Writes a cover letter and a tailored resume for each shortlisted job. No Upwork access." },
  // Upwork inbox (roadmap I1/J1/J2): "Check Upwork" reads messages, proposals, invites, offers and contracts, briefs
  // you and drafts replies. It also carries out the writes you confirm (profile preview/confirm, sending a reply).
  { id: "inbox", label: "Upwork inbox", usesUpwork: true, job: "Reads your Upwork messages, proposals, invites, offers and contracts, gives you a short brief and drafts replies. Sends or changes nothing unless you press Confirm." },
  // Profile sync (roadmap I2/I3/J3): compares your admin profile with your Upwork profile and proposes updates.
  { id: "profile", label: "Profile sync", usesUpwork: true, job: "Compares your admin profile with your Upwork profile and proposes updates (title, overview, skills). Each one is previewed on Upwork and only applied when you press Confirm." },
];

export const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "local", label: "Local model", blurb: "Runs on this PC through Ollama or any OpenAI-compatible server. Free and private." },
  { id: "cli", label: "Local CLI", blurb: "Runs Claude Code, Codex or Antigravity CLI on the worker machine using your existing subscription login. No API key needed; the model itself runs in the provider's cloud." },
  { id: "cloud", label: "Cloud API", blurb: "Calls a provider API directly with a key or cloud credentials stored on the worker." },
];

export interface ProviderDef {
  id: ProviderId;
  mode: Mode;
  label: string;
  // Name of the key this provider needs (set in the admin under AI agents → API keys), if any.
  secret?: string;
  backends?: Backend[];
  defaultBaseUrl?: string;
  // Shown when the worker can't list models live. Claude IDs follow the platform's own format.
  curatedModels: string[];
  setup: string[];
  note?: string;
}

const CLAUDE = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  ollama: {
    id: "ollama", mode: "local", label: "Ollama", defaultBaseUrl: "http://localhost:11434",
    curatedModels: ["qwen3:4b", "qwen3:8b", "qwen3:14b", "qwen3:1.7b"],
    setup: [
      "Install Ollama from ollama.com (Windows installer). It runs in the background on http://localhost:11434.",
      "Pull a model: `ollama pull qwen3:4b`, or press Pull on a recommended model here.",
      "Press Test connection.",
    ],
  },
  openai_compat: {
    id: "openai_compat", mode: "local", label: "LM Studio / OpenAI-compatible", defaultBaseUrl: "http://localhost:1234/v1",
    curatedModels: [],
    setup: [
      "Install LM Studio (or any server with an OpenAI-compatible /v1 API) and download a model.",
      "Start its local server (LM Studio: Developer → Start server, default http://localhost:1234/v1).",
      "Paste the base URL here, press Refresh models, then Test connection.",
    ],
  },
  claude_cli: {
    id: "claude_cli", mode: "cli", label: "Claude Code CLI", backends: ["login", "api_key", "bedrock", "vertex"],
    curatedModels: [...CLAUDE, "opus", "sonnet", "haiku"],
    setup: [
      "Install: `npm i -g @anthropic-ai/claude-code` (or the native installer), then run `claude` once.",
      "Login backend: sign in with your Claude subscription in that first run.",
      "API key backend: set the Anthropic API key below under API keys.",
      "Bedrock backend: set the AWS region (and access keys or a Bedrock API key) under API keys, or leave the keys empty to use an `aws configure` / SSO profile on the worker machine.",
      "Vertex backend: run `gcloud auth application-default login` on the worker machine, then set the GCP project and region under API keys.",
      "Check by hand: `echo reply ok | claude -p --output-format json`.",
    ],
    note: "Always pick a model on Bedrock/Vertex: the unpinned default there is Opus, billed at the Opus rate.",
  },
  codex_cli: {
    id: "codex_cli", mode: "cli", label: "Codex CLI", backends: ["login", "api_key"],
    curatedModels: [],
    setup: [
      "Install: `npm i -g @openai/codex`.",
      "Login backend: run `codex login` and sign in with ChatGPT.",
      "API key backend: set the Codex API key under API keys (passed to the CLI as CODEX_API_KEY).",
      "Check by hand: `echo reply ok | codex exec - --skip-git-repo-check`.",
    ],
    note: "Leave the model empty to use Codex's own default. The model flag is still marked [TEST] in the plan.",
  },
  // Google Antigravity CLI (`agy`), the successor to Gemini CLI. Runs on the Google account login; its model
  // list also includes Claude and GPT-OSS models served through that same Google subscription.
  agy_cli: {
    id: "agy_cli", mode: "cli", label: "Antigravity CLI (Google)", backends: ["login"],
    curatedModels: ["gemini-3.8-flash-medium", "gemini-3.8-flash-high", "gemini-3.8-flash-low", "claude-sonnet-4-6", "claude-opus-4-6-thinking", "gpt-oss-120b-medium"],
    setup: [
      "Install (PowerShell): `irm https://antigravity.google/cli/install.ps1 | iex` (macOS/Linux: `curl -fsSL https://antigravity.google/cli/install.sh | bash`).",
      "Run `agy` once and sign in with your Google account in the browser. No API key needed.",
      "Check by hand: `agy -p \"reply ok\" --output-format json`, and `agy models` to see the models your account has.",
    ],
    note: "Slower to start than the other CLIs (about a minute per call in testing), so it suits the writer or judge better than the filter.",
  },
  anthropic: {
    id: "anthropic", mode: "cloud", label: "Anthropic API", secret: "anthropic",
    curatedModels: CLAUDE,
    setup: [
      "Create an API key at console.anthropic.com.",
      "Paste it under API keys → Anthropic API key and save.",
      "Press Refresh models, pick one, Test connection.",
    ],
  },
  bedrock: {
    id: "bedrock", mode: "cloud", label: "AWS Bedrock (Claude)",
    curatedModels: CLAUDE.map((m) => `us.anthropic.${m}`),
    setup: [
      "Bedrock console → Model catalog → pick an Anthropic model → submit the use-case form (once per account).",
      "IAM: bedrock:InvokeModel, InvokeModelWithResponseStream, ListInferenceProfiles, GetInferenceProfile.",
      "Credentials: an AWS profile / SSO on the worker machine (preferred), or an access key ID + secret under API keys → AWS Bedrock.",
      "Set the AWS region under API keys (e.g. us-east-1). Use inference-profile IDs such as us.anthropic.claude-sonnet-5-5.",
    ],
    note: "v1 runs Claude models only on Bedrock. Other Bedrock models (Converse API) come later.",
  },
  vertex: {
    id: "vertex", mode: "cloud", label: "Google Cloud Agent Platform / Vertex (Claude)",
    curatedModels: CLAUDE,
    setup: [
      "`gcloud services enable aiplatform.googleapis.com` on your GCP project.",
      "Model Garden → request the Claude models (approval can take 24–48 h). Grant roles/aiplatform.user.",
      "On the worker: `gcloud auth application-default login`.",
      "Set the GCP project ID and region (global, us, eu or e.g. us-east5) under API keys → Google Vertex.",
    ],
    note: "v1 runs Claude models only on Vertex. Gemini on Vertex comes later; use the Gemini API provider meanwhile.",
  },
  openai: {
    id: "openai", mode: "cloud", label: "OpenAI API", secret: "openai",
    curatedModels: [],
    setup: [
      "Create an API key at platform.openai.com.",
      "Paste it under API keys → OpenAI API key and save.",
      "Press Refresh models, pick one, Test connection.",
    ],
  },
  gemini: {
    id: "gemini", mode: "cloud", label: "Google Gemini API", secret: "gemini",
    curatedModels: [],
    setup: [
      "Create an API key in Google AI Studio.",
      "Paste it under API keys → Gemini API key and save.",
      "Press Refresh models, pick one, Test connection.",
    ],
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

// This version ships the subscription CLIs only (Claude Code, Codex, Antigravity CLI): no API keys needed.
// Local models and cloud APIs are built but switched off until they're tested; add a mode here to enable it.
// The admin greys out everything else and the save action rejects it.
export const ENABLED_MODES: Mode[] = ["cli"];
export const COMING_LATER = "Not available yet: this version runs on the CLI tools (Claude Code, Codex, Antigravity) only. Coming later.";

export function isModeEnabled(mode: Mode): boolean {
  return ENABLED_MODES.includes(mode);
}

// CLI providers are enabled on their subscription login only; API-key / Bedrock / Vertex billing comes later.
export function isProviderEnabled(id: ProviderId): boolean {
  return isModeEnabled(PROVIDERS[id].mode);
}

export function providersFor(mode: Mode): ProviderDef[] {
  return PROVIDER_IDS.map((id) => PROVIDERS[id]).filter((p) => p.mode === mode);
}

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === "string" && v in PROVIDERS;
}

export function isBackend(provider: ProviderId, v: unknown): v is Backend {
  return typeof v === "string" && (PROVIDERS[provider].backends ?? []).includes(v as Backend);
}

// Tiny schema every Test connection call asks for. Strict (all properties required, no extras) so it is accepted
// by the strictest structured-output implementations (Codex --output-schema, OpenAI json_schema strict).
export const TEST_SCHEMA = {
  type: "object",
  properties: { ok: { type: "boolean" }, note: { type: "string" } },
  required: ["ok", "note"],
  additionalProperties: false,
} as const;
export const TEST_PROMPT = 'Connection test. Reply with JSON only: {"ok": true, "note": "<the model name you are, in a few words>"}';
