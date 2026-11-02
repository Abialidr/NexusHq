# NexusHQ local worker (v1)

Runs on your own machine and does the AI work for the Upwork cockpit. v1 powers **Upwork cockpit → AI agents** in
the admin. It reports this PC's hardware, checks every provider and runs the admin's commands: test a connection,
refresh model lists, pull an Ollama model. The job pipeline (Upwork MCP → filter → judge → writer) comes next. See
`docs/UPWORK_AGENT_PLAN.md`.

The worker is outbound-only. It never accepts inbound connections: it signs in to Supabase as its own user and polls
the `commands` table.

**The admin is the one place to configure everything.** Provider API keys and cloud credentials are entered under
AI agents → API keys and stored encrypted in Supabase Vault. The worker fetches them with `get_agent_secrets()` (worker
role only) and re-syncs on every command and heartbeat. The only thing this machine holds is the worker's own
Supabase sign-in, because it needs that before it can reach Supabase at all.

## One-time setup

1. **Start everything:** `yarn dev` from the repo root (admin + api + worker). Until setup is done the worker just
   logs `waiting for setup …` and checks again every 5 s.
2. **Run the setup wizard** at http://localhost:3100/setup. Before the first setup every admin page redirects there;
   afterwards it is admin-only and can be re-run. It asks for the project URL, publishable key and secret key, plus a
   Supabase personal access token only if the database still needs migrations. It then:
   - installs any pending `supabase/migrations/*.sql` through the Management API, recorded in
     `supabase_migrations.schema_migrations` like the Supabase CLI does;
   - creates your admin user if none exists yet;
   - creates or updates the worker user (`worker@nexushq.local` by default) with `app_metadata.role = 'worker'` and a
     new random password, which it stores in `apps/worker/.secrets` for you;
   - writes `nexushq.config.json` at the repo root (URL, publishable key, worker email; gitignored).

   The secret key and access token are used for that one request and never saved. RLS lets the worker role read
   `agent_settings`, write `worker_status`, and claim and finish `commands`. It can do nothing else.
3. The worker signs in by itself within a few seconds; the admin shows **Worker online** under Upwork cockpit → AI
   agents. No restart is needed.
4. **Keys:** in the admin, open Upwork cockpit → AI agents → **API keys & credentials** and paste the keys you need.

`.env.local` still works as a fallback when there is no `nexushq.config.json` (`SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `WORKER_EMAIL`, `WORKER_NAME`), and `npm run worker -- keys set worker_password` still
sets the password by hand.

## Secrets

| Where | What |
|---|---|
| Admin → AI agents → API keys (Supabase Vault) | Anthropic, OpenAI, Codex and Gemini keys; AWS region and access keys or Bedrock API key; Vertex project and region |
| This machine (`apps/worker/.secrets`, gitignored, DPAPI-encrypted on Windows) | `worker_password` only: written by the setup wizard, or by hand with `npm run worker -- keys set worker_password` |
| This machine, managed by each tool | CLI subscription logins (`claude`, `codex login`, `gemini`), an AWS profile/SSO, `gcloud auth application-default login` |

The admin's view of the keys is write-only: it can set, replace or clear a key and see whether it's set, but no
function returns a value to it. Only the worker role can read values, through `get_agent_secrets()`.

## Providers

The setup steps for each provider are shown in the admin under each agent card ("How to set up …"). They come from
`packages/shared/src/agents.ts`.

| Mode | Provider | How the worker calls it |
|---|---|---|
| Local model | Ollama | `POST /api/chat` with a JSON-schema `format` |
| Local model | LM Studio / OpenAI-compatible | `POST /v1/chat/completions` with `json_schema` |
| Local CLI | Claude Code | `claude -p --output-format json --json-schema … --permission-mode dontAsk --strict-mcp-config` (+ `--bare` off the login backend) |
| Local CLI | Codex | `codex exec - --json --output-schema … -o … --sandbox read-only --skip-git-repo-check --ephemeral` |
| Local CLI | Antigravity CLI (`agy`) | `agy -p <prompt> --output-format json --json-schema … --disable-slash-commands --sandbox`, Google login |
| Cloud API | Anthropic / Bedrock / Vertex | Claude Messages API with one forced tool call carrying the schema |
| Cloud API | OpenAI | Chat Completions with `json_schema` |
| Cloud API | Gemini | `generateContent` with `responseJsonSchema` |

How CLIs are run: no shell, prompt on stdin, an empty temp working directory for each call (so no project
`.mcp.json`, hooks or `CLAUDE.md` load), a hard timeout, and the whole process tree is killed on timeout. On Windows,
npm `.cmd` shims are resolved to their JS entry and run with this Node binary. Every output is checked against the
schema before it is used.

Claude Code, Codex and Antigravity CLI were each tested end to end on the subscription login (2026-10-21).
Still marked **[TEST]**: the Codex `-m` model flag (the tests used the default model). If one fails,
the error appears in the admin's test result. Adjust it in `src/adapters/cli.ts`.

## Code map

| File | What |
|---|---|
| `src/main.ts` | Entry point: `keys` CLI, or sign in, report status, then the command loop + heartbeat |
| `src/commands.ts` | `test_agent`, `refresh_models`, `pull_model` |
| `src/agents.ts` | Reads `agent_settings`; `runAgent()` with validate → retry once → fallback (used by the pipeline next) |
| `src/status.ts` | The `worker_status` row |
| `src/adapters/` | One adapter per provider (`check`, `listModels`, `complete`) |
| `src/proc.ts` | Safe CLI spawning |
| `src/secrets.ts` | Provider keys synced from Vault; DPAPI-backed local store for the worker password |
| `src/hardware.ts` | RAM/CPU/GPU detection for the "recommended for this PC" list |
