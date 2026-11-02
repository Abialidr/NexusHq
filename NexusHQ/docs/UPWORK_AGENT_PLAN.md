# Phase 2 — Upwork MCP + Local Agent Plan (v0.2)

v0.2 (2026-10-21): added configurable agents (§5.5–5.9); re-verified CLI flags, Bedrock and Vertex setup against vendor docs; see §11 for what changed and what's still open.

> **As built (2026-10-26) — read this first; where the plan below differs, this wins.** The spike passed and the
> worker exists (see [ARCHITECTURE.md](ARCHITECTURE.md) §4.2 and §6 for the current design).
> - **CLI-only for now.** Only the subscription CLIs are enabled: Claude Code, Codex and **Antigravity CLI (`agy`)**,
>   which replaced Gemini CLI (§5.5 `gemini_cli` rows are obsolete). Local models and cloud APIs are built but off.
> - **Provider keys are in Supabase Vault** (`set_agent_secret`, written from the admin, read only by the worker via
>   `get_agent_secrets()`), not in the worker's `.secrets` file as §5.8 says. The DPAPI-encrypted `apps/worker/.secrets`
>   holds only the worker's own Supabase password. No keys are used in the CLI-only version.
> - **Upwork MCP** is added and signed in per CLI from the admin; agents get read-only tools only (allowlist + explicit
>   write denylist). Runs are user-started (Find jobs), never scheduled.
> - **Agents:** Search (agy, Upwork tools) → free code checks → Filter & rank (Claude Code, Sonnet) → Writer (Codex).
>   The separate Judge agent was merged into Filter & rank.

Status (original, v0.2): plan before the spike. Each claim is tagged:
**[CONFIRMED]** (from Upwork/vendor docs), **[REPORTED]** (third-party articles, needs checking), **[TEST]** (the spike must prove it).
Parent doc: [ARCHITECTURE.md](ARCHITECTURE.md) §6.

## 1. Goal of Phase 2

Answer one question with evidence: **can a local worker read Upwork jobs through the official MCP, score them with local + cloud models, and push drafts to Supabase, within Upwork's terms?** Output: a findings section in this doc + a throwaway spike script. No production worker code until the go/no-go in §9.

## 2. How MCP works (short version)

MCP (Model Context Protocol) is a standard way for an AI client to call tools on a server.

```
MCP client (Claude Code, Codex, or our own Node code)
   │  1. connect over HTTP (Streamable HTTP transport)
   │  2. OAuth login → access token
   │  3. tools/list  → names + JSON input schemas
   │  4. tools/call  → { name, arguments } → JSON/text result
   ▼
MCP server (Upwork, hosted at https://mcp.upwork.com/mcp)
   └─ talks to Upwork's internal APIs with your account's permissions
```

- A **tool** is a function with a name, description and input schema. The server decides what tools exist; the client just lists and calls them.
- The model never holds credentials. The client holds the token and decides which tool calls are allowed. **That is where our allowlist lives.**
- Any MCP client can call a tool directly without an LLM. So the worker can call `search jobs` as plain code, then hand the results to a model.

## 3. The official Upwork MCP

| Item | What we know | Tag |
|---|---|---|
| Endpoint | `https://mcp.upwork.com/mcp`, run by Upwork, launched Aug 2026 | REPORTED |
| Auth | OAuth 2.1 login in the browser; no API keys; revoke in Upwork **Settings → Connected Apps** | REPORTED |
| Scopes | Connecting currently grants the **full** scope set (no read-only option) | REPORTED |
| Freelancer tools | Search jobs (skill, category, budget, type), profile-based matches, proposal drafting | REPORTED |
| Client tools | Talent search, job post prep, invites, offers, messages, contracts, milestones, timesheets, transactions | REPORTED |
| Write safety | Writes are drafted and need confirmation; binding actions finish on upwork.com; Connects spent only on confirm | REPORTED |
| Cost | Free with an Upwork account; normal fees/Connects apply | REPORTED |
| Rate limits, retention, automation terms | **Not published in anything found** | TEST |
| Fields returned (client spend, hire rate, proposals count, posted time) | Unknown | TEST |
| Can a custom (non-Claude/ChatGPT) client do OAuth? | Unknown (needs dynamic client registration or a registered app) | TEST |

Avoid: community Upwork MCP servers that scrape or reuse session cookies. They risk an account ban. The Upwork GraphQL API (needs an approved API key) is the fallback if the MCP cannot be used from our code.

**Risk to flag now:** the scope is full account access, including messages and contracts. Our protection is a **client-side tool allowlist**, not Upwork scopes. That is a hard requirement (§6).

## 4. Three ways the worker can reach Upwork

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. Own MCP client** (preferred) | Node worker uses `@modelcontextprotocol/sdk` client + OAuth; calls search/detail tools directly as code | Full control, allowlist in code, no LLM needed to fetch, cheapest | Must handle OAuth + token refresh ourselves; works only if Upwork allows custom clients |
| **B. Claude Code as the bridge** | `claude mcp add --transport http upwork https://mcp.upwork.com/mcp`, log in once with `/mcp`; worker runs `claude -p` with only read tools allowed via `--allowedTools` | Claude Code already handles OAuth; fastest to try | Every fetch costs tokens; harder to make deterministic; allowlist relies on CLI flags |
| **C. Upwork GraphQL API** | Apply for an API key, call GraphQL directly | Documented fields and limits | Approval process; separate terms; more work |

**Spike plan:** try **B first** (one hour, proves tools and fields), then **A** (proves we can own it). Fall back to C only if both fail.

## 5. Model plan

### 5.1 This machine
Checked 2026-10-20: **Intel Iris Xe (no NVIDIA GPU), 24 GB RAM**. Local models run **on the CPU only**: usable for small models, slow for anything at 14B+.
**[OPEN]** Is the worker going to run here, or on another machine with a GPU? This decides the local model.

### 5.2 Which local model (Stage 1: cheap filter)
Job: read title + description + basic fields → `{ relevant: bool, category, reason }`. A small model is enough.

| Hardware | Model (Ollama) | Approx. size | Notes |
|---|---|---|---|
| This laptop (CPU, 24 GB) | `qwen3:4b` (start) or `qwen3:8b` | ~3–5 GB | Few tokens/sec; fine for dozens of jobs per cycle, not hundreds |
| GPU 8–12 GB | `qwen3:8b` | ~5 GB | Fast enough for batch filtering |
| GPU 16 GB | `qwen3:14b` | ~9 GB, ~60 tok/s on an RTX 4080 | Original doc's pick |

Runtime: **Ollama** (Windows installer; serves an OpenAI-compatible API at `http://localhost:11434/v1`; supports `format: <JSON schema>` for structured output). LM Studio is a GUI alternative with the same API.
Pick by test, not by leaderboard: label ~50 real jobs by hand and measure agreement and speed (§8 step 4).

### 5.3 Cloud/CLI runners (Stage 2 judge, Stage 3 write)
Use the CLIs you already pay for, run headless from the worker:

| Runner | Command | Structured output |
|---|---|---|
| Claude Code | `claude -p "<prompt>" --output-format json --json-schema '<schema>'` | Validated JSON in `.structured_output`; cost and session in metadata. Needs a recent CLI (older ones ignore bad schemas) |
| Codex CLI | `codex exec --json --output-schema schema.json -o out.json "<prompt>"` | JSONL events (`turn.completed` includes token usage); final JSON written to file |
| Ollama | HTTP `POST /api/chat` with `format` schema | JSON in the message content |

Split chosen after the spike: **Search** = Antigravity (`agy`, with Upwork read tools), **Filter & rank** = Claude Code
(Sonnet), **Writer** = Codex. The originally suggested local-Qwen filter and separate Claude judge were dropped.

Rules for all runners:
- Run CLIs with **no tools and no MCP** (judge/draft are text-in, JSON-out). Only the fetch step talks to Upwork.
- Always validate output with the shared Zod schema; retry once, then mark the job `error`.
- Log model, tokens, cost and duration per call into `runs`.
- **[OPEN]** Check whether your Claude/ChatGPT plan terms allow scripted headless use at this volume, or whether API billing is needed.

### 5.4 One interface
```ts
interface Runner {
  name: string;
  complete<T>(prompt: string, schema: ZodSchema<T>, opts?): Promise<{ data: T; usage: Usage }>;
}
// ollamaRunner, claudeCliRunner, codexCliRunner — chosen per stage in config
```
§5.5 expands this into a configurable runner per agent.

### 5.5 Agent settings (configurable per agent)

Nothing about which model runs a stage is hard-coded. Each of the **three agents** has its own settings card in the admin (**Settings → Agents**):

| Agent | Job | Default |
|---|---|---|
| **Search** | plans queries, searches Upwork and fetches job details (read-only Upwork tools) | Local CLI → Antigravity |
| **Filter & rank** | first pass + final rank: fit, applicants, win chance, why, suggested bid, shortlist | Local CLI → Claude Code (Sonnet) |
| **Writer** | cover letter, resume highlights, questions | Local CLI → Codex |

(As built. The original plan had Filter on local Qwen and a separate Judge; Judge was merged into Filter & rank.)

Each card makes the same two choices plus options:

1. **Mode → Provider**
2. **Model** (the list depends on the provider)
3. Options: temperature, max tokens, timeout, daily call/cost cap, and a **fallback** (another provider/model to try if this one fails or hits its cap)

| Mode | Providers | Auth | Where the model list comes from |
|---|---|---|---|
| **Local model** | Ollama, LM Studio (any OpenAI-compatible URL) | none (base URL) | Installed models from `GET /api/tags` (Ollama) or `GET /v1/models`, plus **recommended for this PC** (§5.6) with a "Pull" button |
| **Local CLI** (uses your existing subscription login) | Claude Code (`claude`), Codex CLI (`codex`), Antigravity CLI (`agy`, replaced Gemini CLI) | the CLI's own login | Curated list per CLI (+ "default" = whatever the CLI is set to) |
| **Cloud API** | Anthropic API, Google Cloud Agent Platform (formerly Vertex AI; Claude or Gemini), AWS Bedrock (Claude; other models via the Converse API), OpenAI, Google Gemini API | API key / cloud credentials | Live from the provider's list-models endpoint (Bedrock: `ListInferenceProfiles`), filtered to chat models; curated fallback list if the call fails |

Claude IDs for the curated lists: `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`. On Bedrock they are inference-profile IDs with a region prefix (e.g. `us.anthropic.claude-opus-5-5`). Other providers' IDs come from their live lists so they don't go stale.

**The Claude Code CLI can run on a cloud backend too.** The child process gets `CLAUDE_CODE_USE_BEDROCK=1` (+ `AWS_REGION`) or `CLAUDE_CODE_USE_VERTEX=1` (+ `CLOUD_ML_REGION`, `ANTHROPIC_VERTEX_PROJECT_ID`) in its env. So the Claude Code card has a sub-option **Backend: subscription login | Anthropic API key | Bedrock | Vertex**. **Always pass `--model` explicitly**: on Bedrock/Vertex the unpinned default is Opus, billed at the Opus rate.
Codex CLI has two backends: ChatGPT login or an API key (`CODEX_API_KEY` in the child env). Antigravity CLI: Google account login only (any Gemini/Google API key is removed from its env so it can't switch off the login). In this version only the login backends are enabled.

**Cost tracking per backend:** subscription logins have no per-call price, so log tokens + an estimate only. `claude --output-format json` reports `total_cost_usd`, but that's a client-side estimate. API/cloud backends compute cost from the provider's reported usage.

**[OPEN]** Who checks the plan terms for subscription CLIs (§5.3)? The UI shows a warning on Local CLI mode until it's answered.

### 5.6 Recommended local models for this PC

The worker detects hardware on start (`systeminformation` package: total RAM, GPU vendor + VRAM, CPU cores) and reports it in its heartbeat. The admin then ranks local models by tier:

| Detected | Recommended | Allowed (shown with a "slow" warning) |
|---|---|---|
| No dedicated GPU, 16–32 GB RAM (**this PC: Iris Xe, 24 GB**) | `qwen3:4b` ★, `qwen3:8b` | up to 14B |
| GPU 8–12 GB VRAM | `qwen3:8b` ★ | `qwen3:14b` |
| GPU 16 GB+ VRAM | `qwen3:14b` ★ | larger |
| < 16 GB RAM, no GPU | `qwen3:1.7b` | `qwen3:4b` |

Rule of thumb: model file size ≤ ~60% of VRAM (GPU) or ≤ ~40% of free RAM (CPU). The table lives in `packages/shared` as data, so you can edit it without code changes. After the §8 step-4 test, the measured speed/accuracy per model is shown next to each option.

### 5.7 Adapters (one per provider, same interface)

```ts
type AgentId = 'search' | 'filter' | 'writer';   // as built; 'judge' merged into 'filter'
type ProviderId =
  | 'ollama' | 'openai_compat'                 // Local model
  | 'claude_cli' | 'codex_cli' | 'agy_cli'     // Local CLI (agy replaced gemini_cli)
  | 'anthropic' | 'vertex' | 'bedrock' | 'openai' | 'gemini'; // Cloud API

interface AgentConfig {
  agent: AgentId;
  provider: ProviderId;
  model: string;               // '' = provider default
  backend?: 'login' | 'api_key' | 'bedrock' | 'vertex'; // CLI providers only
  options: { temperature?: number; maxTokens?: number; timeoutMs: number; dailyCap?: number };
  fallback?: Omit<AgentConfig, 'agent' | 'fallback'>;
}

interface Adapter {
  id: ProviderId;
  check(): Promise<{ ok: boolean; detail: string }>; // "Test connection" button
  listModels(): Promise<ModelInfo[]>;
  complete<T>(prompt: string, schema: ZodSchema<T>, cfg: AgentConfig): Promise<{ data: T; usage: Usage }>;
}
```

| Adapter | How it calls | Structured output |
|---|---|---|
| `ollama` | `POST {baseUrl}/api/chat` | `format: <JSON schema>` |
| `openai_compat` | `POST {baseUrl}/v1/chat/completions` | `response_format: json_schema` |
| `claude_cli` | stdin → `claude -p --output-format json --json-schema <schema> --model <m> --permission-mode dontAsk --strict-mcp-config`; add `--bare` for API-key/Bedrock/Vertex backends | `.structured_output`. It's **absent** if the run failed or refused; treat that as an error |
| `codex_cli` | stdin → `codex exec - --json --output-schema <file> -o <out> --sandbox read-only --skip-git-repo-check --ephemeral` + model flag **[TEST]** | `-o` file |
| `agy_cli` | `agy -p <prompt> --output-format json --json-schema <schema> --disable-slash-commands --sandbox [--model <m>]` (no stdin mode; prompt ≤ 24k chars) | `.structured_output`, `status: "SUCCESS"` |

Agent mode (Search steps only): Claude gets `--allowedTools` for the read-only Upwork tools and `--disallowedTools` for the write tools instead of `--strict-mcp-config`; agy gets `mcp(upwork/upwork__<tool>)` allow rules in `~/.gemini/antigravity-cli/settings.json` (headless agy denies everything else); Codex always runs with `--ignore-user-config` (no MCP), so it can't be the Search agent.
| `anthropic` | `@anthropic-ai/sdk` | JSON schema output |
| `bedrock` | `@anthropic-ai/bedrock-sdk` for Claude; `@aws-sdk/client-bedrock-runtime` Converse for others | JSON schema / tool-use |
| `vertex` | `@anthropic-ai/vertex-sdk` for Claude; `@google/genai` (`vertexai: true`) for Gemini | JSON schema / `responseSchema` |
| `openai` | `openai` SDK | `response_format: json_schema` |
| `gemini` | `@google/genai` | `responseSchema` |

CLI adapter rules:
- Spawn with `shell: false` and pass the prompt on stdin. This avoids Windows quoting and length limits. Claude caps stdin at 10 MB, far above our size.
- Run each call from an **empty temp working directory**, so no project `.mcp.json`, hooks or `CLAUDE.md` load. `--bare` gives the same guarantee, but it ignores the subscription login, so it can't be used on the login backend.
- Set a timeout; on timeout send SIGINT, then kill the process tree (`taskkill /T /F` on Windows).
- Every adapter output still goes through Zod validation and is logged per §5.3.

Flags above were verified on the installed versions (Claude Code, Codex, agy 1.4.x). The Codex model flag is still unverified, so the Codex model is normally left on its default.

### 5.8 Where settings and keys live

- **Non-secret config** (`AgentConfig` × 3) → Supabase table `agent_settings`, edited in the admin. RLS: admin read/write, worker read. The worker reads it each cycle, so changes apply without a restart.
- **Worker-reported state** → a separate `worker_status` row the worker writes: the hardware report, available models per provider, key status per provider, and the last test result + latency. The admin can't reach the worker (it never accepts inbound connections, ARCHITECTURE §1), so every model list and test result has to come through Supabase.
- **Admin actions are commands.** Add `test_agent`, `refresh_models` and `pull_model` to the `commands` queue (ARCHITECTURE §4). "Test connection", "Refresh" and "Pull" each enqueue one; the worker runs it and writes the result to `worker_status`.
- **Provider keys are in Supabase Vault** (as built; replaces the original "keys only on the worker" plan). The admin writes them write-only under AI agents → API keys (`set_agent_secret`); nothing reads a value back into the admin; the worker fetches them with `get_agent_secrets()`. Key entry is off in the CLI-only version because no keys are needed.
- The DPAPI-encrypted `apps/worker/.secrets` file (git-ignored) holds only the worker's own Supabase password, written by the setup wizard.
- Cloud SDK credentials can also come from their standard chains instead (`~/.aws` profile / SSO, `gcloud auth application-default login`), so no key needs to be stored at all.
- CLI logins and Upwork MCP sign-ins stay inside each CLI (`~/.claude`, `~/.codex`, `~/.gemini/antigravity-cli`); the worker only checks whether they exist.

### 5.9 Setup steps per provider (shown in-app as a checklist on each card)

**Ollama (Local model)**
1. Install from ollama.com (Windows installer); it runs in the background on `http://localhost:11434`.
2. `ollama pull qwen3:4b`, or use the card's Pull button, which enqueues `pull_model` and makes the worker call `POST /api/pull`.
3. Card → Test connection → it should list the model.

**LM Studio / other OpenAI-compatible server**
1. Install, download a model, start the local server (default `http://localhost:1234/v1`).
2. Paste the base URL into the card → Test.

**Claude Code CLI**
1. `npm i -g @anthropic-ai/claude-code`, then run `claude` once and log in (or set a backend below).
2. Check: `echo "reply ok" | claude -p --output-format json`.
3. Backend:
   - *login*: nothing more to do.
   - *API key*: `ANTHROPIC_API_KEY` in worker secrets.
   - *Bedrock*: `CLAUDE_CODE_USE_BEDROCK=1` + `AWS_REGION` + AWS credentials. Use a profile, SSO or `AWS_BEARER_TOKEN_BEDROCK`.
   - *Vertex*: `CLAUDE_CODE_USE_VERTEX=1` + `CLOUD_ML_REGION` + `ANTHROPIC_VERTEX_PROJECT_ID` + `gcloud auth application-default login`.

   An interactive alternative: run `claude`, choose **3rd-party platform**, then `/setup-bedrock` or `/setup-vertex`. That writes the env into `~/.claude/settings.json`.

**Codex CLI**
1. `npm i -g @openai/codex`, then `codex login` (ChatGPT sign-in), or put `CODEX_API_KEY` in worker secrets.
2. Check: `echo "reply ok" | codex exec - --skip-git-repo-check`.

**Antigravity CLI (`agy`)**
1. PowerShell: `irm https://antigravity.google/cli/install.ps1 | iex`, then run `agy` once and sign in with Google.
2. Check: `agy -p "reply ok" --output-format json`; `agy models` lists the models your account has.

Cloud APIs (off in this version): create the key with the provider (console.anthropic.com, platform.openai.com, Google AI Studio) and paste it in the admin under AI agents → API keys.
**AWS Bedrock**
1. Open the Bedrock console → Model catalog → choose an Anthropic model → submit the **use-case form**. You do this once per account, and access is granted immediately.
2. Create an IAM identity with these permissions:
   - `bedrock:InvokeModel`
   - `bedrock:InvokeModelWithResponseStream`
   - `bedrock:ListInferenceProfiles`
   - `bedrock:GetInferenceProfile`
   - `bedrock:ListFoundationModels` (for the model list)
   - The `aws-marketplace:ViewSubscriptions` / `Subscribe` permissions that Claude Code's doc lists.
3. Credentials: an AWS profile/SSO (preferred over IAM user keys), `keys set bedrock`, or a Bedrock API key (`AWS_BEARER_TOKEN_BEDROCK`).
4. Set the region on the card and use inference-profile model IDs (`us.anthropic.…`).

**Google Cloud Agent Platform (formerly Vertex AI)**
1. `gcloud services enable aiplatform.googleapis.com` on a GCP project.
2. Request the Claude models in Model Garden. Approval **can take 24–48 h**, so start this early. Gemini needs no request.
3. Grant `roles/aiplatform.user`.
4. On the worker, run `gcloud auth application-default login`, or use a service-account JSON via `keys set vertex`.
5. Set the project + region on the card (`global`, `us`, `eu` or a specific region). Not every model is offered on every endpoint.

As built, the cards are select-only (no Test button or fallback): each shows a green/red sign from the worker's provider check in `worker_status`, and connecting CLIs and Upwork happens in the Connections section. The `test_agent` command still exists in the worker.

## 6. Integration flow

As built (the original plan's timer loop was dropped: Upwork terms §4.1 allow user-directed search only):

```
 you press Find jobs (Job radar) → `commands` run_now
 ┌─────────────── worker (local Node) ─────────────────────────┐
 │ 1 Search agent plans queries from your profile                │
 │ 2 Search agent + Upwork read tools → listings (`jobs`, found) │
 │ 3 free code checks              → gated_out                   │
 │ 4 Filter & rank first pass      → filtered_out (if many)      │
 │ 5 Search agent: job details → second free check → gated_out   │
 │ 6 Filter & rank final rank      → shortlisted | filtered_out  │
 │ 7 Writer agent                  → draft on each shortlisted   │
 │ progress + counts in `job_runs`; Stop / cost limit end early  │
 └───────────────────────────────────────────────────────────────┘
            ▼ Supabase ▼
 Job radar → you read, edit the draft, open on Upwork, bid by hand
```

Each agent uses whatever provider its `agent_settings` row names (§5.5). Full detail: ARCHITECTURE.md §6.2.

**Allowlist (hard rule, as built):** there is no separate MCP wrapper; each CLI is told exactly which Upwork tools it may call (`UPWORK_READ_TOOLS`: list_accounts, get_tool_help, find_jobs, get_profile, list_freelancer_proposals) and the write tools are denied explicitly (see §5.7). No proposal, message, offer, contract or payment tool can be called, even if a model asks.

## 7. Secrets and safety
- Upwork OAuth tokens: kept by each CLI in its own store on the worker machine, never in Supabase or git.
- Supabase: worker uses a narrow role/RPCs if possible; service key only on the worker if unavoidable.
- Daily caps in config: jobs fetched, jobs judged, drafts, cost. Stop and flag when hit.
- Kill switch: `pause` command from admin + revoke in Upwork Connected Apps.

## 8. Spike steps (in order)

| # | Step | Proves | Time |
|---|---|---|---|
| 1 | Read Upwork MCP terms, help center and API ToS; write down limits, retention, automation rules | We are allowed to do this | 1–2 h |
| 2 | Option B: connect Claude Code to Upwork MCP, run `/mcp`, list tools, save the full tool list + schemas to `docs/spike/upwork-tools.json` | Real tool names and inputs | 1 h |
| 3 | Call job search + job detail by hand on 3 searches; save raw responses | Which fields exist → which gates are possible | 1 h |
| 4 | Install Ollama, pull `qwen3:4b` and `qwen3:8b`; run the filter prompt on ~50 saved jobs you labeled | Local accuracy + speed on this machine | 2–3 h |
| 5 | Run the judge prompt through `claude -p` and the draft prompt through `codex exec` on 5 jobs; also try `gemini -p` and one Cloud API provider through the same adapter interface (§5.7) | JSON reliability, quality, cost per job per provider | 2–3 h |
| 6 | Option A: minimal Node MCP client with OAuth, list tools, one search call | We can own the connection without Claude Code | 3–4 h |
| 7 | Fill in §10 findings, decide go/no-go | — | 1 h |

Spike code lives in `NexusHQ/apps/worker/spike/` and is thrown away. Saved raw job data is deleted after the spike unless the terms allow keeping it.

## 9. Go / no-go criteria
- **Go** if: terms allow read-only automated use; search returns enough fields to filter; one of Option A/B works without manual login each cycle; the local filter agrees with your labels ≥80%; judge+draft cost per shortlisted job is acceptable to you.
- **Pivot** if the MCP can't be used from code: use Option C (GraphQL API) or a manual "paste job" flow in the admin.
- **Stop** if the terms forbid automated job reading.

## 10. Findings (fill in during the spike)
- Tools list: …
- Fields per job: …
- Limits / terms / retention: …
- Local model results: …
- Runner cost and quality: …
- Decision: …

## 11. v0.2 re-verification (2026-10-21)

Checked against the vendor docs (Claude Code headless/Bedrock/Vertex pages, Codex non-interactive page) and against ARCHITECTURE.md:

| # | Issue found in v0.1 of §5.5–5.9 | Fix |
|---|---|---|
| 1 | Claude CLI run with "no tools, no MCP" but no flags given; a `-p` run loads the project's `.mcp.json` and hooks in an untrusted folder | Empty temp cwd + `--strict-mcp-config` + `--permission-mode dontAsk`; `--bare` on API/cloud backends only (it ignores the subscription login) |
| 2 | Missing `structured_output` wasn't handled | Treated as an error → retry/fallback |
| 3 | Unpinned Claude on Bedrock/Vertex defaults to Opus (costly) | `--model` always set |
| 4 | Codex: claimed a cloud backend; missing stdin/sandbox flags | ChatGPT login or `CODEX_API_KEY`; `exec -` + `--sandbox read-only --skip-git-repo-check --ephemeral`; model flag [TEST] |
| 5 | Gemini CLI `-p` may be deprecated | Prompt on stdin; flags [TEST] |
| 6 | Bedrock: "enable model access" step is outdated; IAM list incomplete | Use-case form; full IAM list; inference-profile IDs |
| 7 | Vertex renamed; Claude access approval delay not mentioned | Agent Platform naming; 24–48 h warning; `roles/aiplatform.user` |
| 8 | Vertex/Bedrock adapters assumed one SDK | Per-model SDK split (Anthropic vs Google/Converse) |
| 9 | Admin "Test"/"Pull"/model lists implied the admin can call the worker; a local key web page broke the "no inbound connections" rule | New commands + `worker_status` row via Supabase; key entry by CLI only |
| 10 | DPAPI stated as if built into Node | Library choice [TEST]; secrets file in `.gitignore` |
| 11 | §6 flow hard-coded Qwen/Claude | Generic agents |

**Status of the open items (2026-10-26):**
- **[OPEN]** Subscription CLI terms for scripted use (§5.3)
- **[OPEN]** Worker machine (§5.1): this PC for now
- Upwork MCP items (§3): tested; see `docs/spike/upwork-findings.md`
- CLI flags: verified for Claude Code and agy; Codex model flag still unverified
- Secret storage: Supabase Vault for provider keys; Windows DPAPI (built in via PowerShell) for the worker password

**Doc follow-ups:** done. ARCHITECTURE.md §4.2 and §6 now describe the tables, folder (`NexusHQ/apps/worker`) and adapter files as built.
- Add `apps/worker` to the root `package.json` workspaces once it exists.

## Sources
- [Upwork MCP page](https://www.upwork.com/ai/mcp) (blocked our fetch; open in the browser)
- [Upwork MCP guide (Claude Code setup command)](https://mcstarters.com/blog/upwork-mcp-server-guide/)
- [Upwork MCP for freelancers (up-bro)](https://up-bro.com/blog/upwork-mcp-server)
- [Claude Code headless docs](https://code.claude.com/docs/en/headless.md)
- [Codex non-interactive docs](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Claude Code on Amazon Bedrock](https://code.claude.com/docs/en/amazon-bedrock.md)
- [Claude Code on Google Cloud Agent Platform](https://code.claude.com/docs/en/google-vertex-ai.md)
- [Gemini CLI headless mode (mirror)](https://www.mintlify.com/google-gemini/gemini-cli/advanced/headless)
- [Ollama on 16 GB GPUs benchmark](https://www.glukhov.org/post/2026/01/choosing-best-llm-for-ollama-on-16gb-vram-gpu/)
