# NexusHQ — Architecture (v0.3 draft)

Status: starting point. Items marked **[OPEN]** are unverified or undecided.

## 1. What this is

One system with two jobs:

1. **Public portfolio** — a separate Next.js project with two presentations of the same data: an immersive **3D** experience centered on one distinctive building and a conventional **2D** version in the same visual identity.
2. **Private Upwork cockpit** — a local AI agent finds jobs, filters them hard, drafts proposals, and pushes everything to an admin panel. A human (the owner, the only admin) reviews and places every bid manually.

```
                         +------------------+
                         |    Upwork MCP     |
                         +--------^---------+
                                  | approved read calls
                                  v
+---------------------------+  +-------------------------+
| Private operations repo   |->| Supabase                |
| admin + local worker      |  | Postgres, Auth, Storage |
+---------------------------+  | and Realtime            |
                               +-------^----------^------+
                                       |          | published reads
                          private CRUD |          |
                                       |  +-------+----------------+
                                       |  | Public portfolio repo  |
                                       +--| Next.js, separate deploy|
                                          +------------------------+
```

The worker never accepts inbound connections. It pushes results to Supabase and polls for commands. Admin and worker use authenticated private access; the portfolio uses only the public read surface.

## 2. Repository layout (two repositories)

```
NexusHQ/ (private operations repository; current workspace folder)
  apps/
    admin/          Admin UI for portfolio content and private Upwork cockpit
    worker/         Local agent (Node/TypeScript)
  packages/
    shared/         Types, validation schemas, generated Supabase types
  supabase/
    migrations/     SQL migrations (source of truth for schema)
    seed/           Seed generated from the old portfolio data
  docs/
    ARCHITECTURE.md

nexushq-portfolio/ (public website project; current workspace folder)
  Next.js (App Router): portfolio experiences (2D and 3D)
  Own package.json, lockfile, build, and deployment
```

The admin and worker can share TypeScript packages and tooling inside the private operations repository. Keep that repository private because it contains operational code and private workflows. The portfolio remains an independent project with its own dependencies and deployment. The two repositories integrate through the Supabase schema and public read contract; generated database types may be copied/generated in each repo or published as a versioned package later. Avoid a cross-repository build dependency for the initial version. Use separate environment files, deployment credentials, and CI pipelines for each repository.

Supabase is a managed service, not a third repository. Keep schema migrations and any safe seed data in the private operations repository. **[OPEN]** Decide whether the portfolio repository gets a minimal schema/type snapshot or consumes a versioned shared package as the schema stabilizes. These are separate project folders now; initialize and push each as its own Git repository when remotes are ready. Keep the existing `personalproject-Abiali-Portfolio/` SvelteKit checkout as a legacy/reference project; do not nest it inside either new repo.

## 3. Portfolio (public)

### 3.1 Entry and modes
- `/` — portfolio home/entry point. **[OPEN]** Decide whether it presents a mode choice or opens directly into one mode; keep a visible route or toggle to the other mode.
- `/3d` — React Three Fiber scene.
- `/2d` — conventional site, same theme and content.
- Both modes read the same published Supabase portfolio data through the portfolio repository's own data layer. **[OPEN]** Choose direct client reads or server-side reads. If using static generation/ISR, define how publishing triggers revalidation; Supabase Realtime alone does not refresh already-rendered static pages.
- Device handling: if WebGL is missing or the device cannot run the scene smoothly, provide a clear 2D fallback. Keep important content reachable without the 3D scene.

### 3.2 3D experience
Concept: one distinctive building with a carefully designed, appealing exterior. The building is the central visual anchor; the surrounding website, navigation, transitions, and content presentation should feel like parts of one coherent world built around it. It is not specifically a gaming venue or a collection of unrelated game props. Visitors can explore the building or move through designed camera views; the interaction model and degree of free rotation remain **[OPEN]**. Building areas, architectural features, or selected objects can lead into portfolio content:

| Object | Opens |
|---|---|
| Building entrance / lobby | Introduction and navigation |
| Rooms, floors, or displays | Experience and projects |
| Wall feature / information area | Education and skills |
| Media display | Video testimonials |
| Exterior sign / contact point | Contact and resume |

- Stack: `three`, `@react-three/fiber`, `@react-three/drei`, GSAP or `@react-spring/three` for transitions.
- Asset plan: optimized GLB building and environment, baked or efficient lighting, Draco/meshopt compression, lazy-loaded behind the `/3d` route only. **[OPEN]** visual direction, asset production method, scene scope, and performance budget.
- Interaction content is rendered as DOM overlay panels (accessible, SEO-friendly) rather than in-canvas text.

### 3.3 2D experience
Same theme, same sections, rendered as normal pages: Home, Experience, Projects, Project detail, Skills, Education, Testimonials, Resume, Contact. Rendering strategy **[OPEN]**: if using static/ISR, define a secure revalidation mechanism or bounded refresh interval for admin publishes.

### 3.4 Data the public site reads
Only public-safe portfolio fields and published records, through the public read surface (see §4). Do not expose private columns on a row that is otherwise public. Images and video come from public Supabase Storage buckets; private attachments use private buckets and signed URLs.

## 4. Supabase

### 4.1 Portfolio tables
Derived from the old site's `types.ts` (Project, Experience, Education, Skill, links).

| Table | Key columns |
|---|---|
| `profile` | name, headline, bio, avatar, resume_url, socials (jsonb), hourly_rate, publication visibility |
| `skills` | slug, name, logo, color, description, category, sort, published |
| `experiences` | slug, company, role, location, contract_type, period_from, period_to, summary, description (markdown), logo, sort, published |
| `projects` | slug, name, type, summary, description (markdown), period_from, period_to, color, logo, links (jsonb), sort, published, featured |
| `educations` | slug, organization, degree, location, period_from, period_to, subjects (text[]), description, published |
| `project_skills`, `experience_skills` | join tables |
| `media` | id, owner_type, owner_id, kind (image/video), storage_path, caption, thumbnail, sort |
| `testimonials` | id, author, role, company, quote, avatar, video_media_id, published, sort |
| `site_settings` | public theme tokens and 3D content mapping; keep private/admin settings separate |

All public-facing entities and related media need a deliberate publication rule. Define whether child rows (skills, media, joins) inherit visibility from their parent or have their own `published` state. Add ordering, slug uniqueness, timestamps, and foreign-key/delete behavior in migrations. **[OPEN]** Finalize fields after mapping legacy content and deciding which profile fields are safe to publish.

### 4.2 Upwork pipeline tables (as built, migrations `20261021130000` … `20261026130000`)

| Table | Purpose |
|---|---|
| `agent_settings` | One row per agent (`search`, `filter`, `writer`; `judge` is unused): provider, model, backend, `options` jsonb (timeout, Max listings, Shortlist %, cost limit, free-check overrides, extra instructions) |
| `worker_status` | The worker's heartbeat, hardware, provider/CLI availability and MCP (Upwork) connection status per CLI |
| `commands` | Admin → worker queue (`claim_next_command()`): `run_now {focus}`, `draft_job`, `mcp_check/add/login/remove`, `refresh_models`, … |
| `job_runs` | One row per Find jobs press: focus, `status` (running → stopping → stopped / done / error), counts per stage, run log |
| `jobs` | One row per Upwork job (`upwork_id` unique): `summary` (list fields + `found_by`), `detail` (client history, rates, Connects), `stage`, `reason`, `score`, `rank`, `assessment` (fit, win chance, applicants, why, matched/missing skills), `suggested_bid`, `draft` (editable in the admin) |

| `upwork_snapshots` | Latest copy of each Upwork read (dashboard + brief, profile, proposals, invitations, offers, contracts); overwritten by each check |
| `upwork_rooms` | Upwork message rooms: recent messages, the Upwork inbox agent's summary and an editable reply draft; deleted 30 days after last seen |
| `upwork_actions` | Every Upwork write: `draft → previewing → preview_ready → confirming → done/error` (profile updates) or `confirming → done/error` (a reply you pressed Send on) |

Profile data the agents read is the published portfolio content (`profile`, `skill_groups`, `experiences`, `projects`); there is no separate agent profile. Provider keys (cloud APIs, not used in the CLI-only version) are in Supabase Vault.

**Job stage** (`job_stage` enum; one Job radar tab each)

```
found → gated_out          (free code checks: payment, budget, crowded, client hire rate, already applied)
      → filtered_out       (Filter & rank first pass or final rank; or "Not checked" after Stop / cost limit)
      → shortlisted (+ draft) → bid | skipped   (set by you)
```

### 4.3 Data retention
Upwork's retention terms aren't published, so the worker deletes jobs older than 30 days (`JOB_RETENTION_DAYS`) at the start of each run, except the ones you bid on. Runs are user-started only (Find jobs); there is no scheduled or continuous monitoring (Upwork API terms §4.1).

### 4.4 Security (RLS)
- Public (publishable/anon key): read only from dedicated public views or tightly scoped RLS that exposes public-safe columns and published records. Storage: public read only for portfolio assets.
- Admin (single user, enforced by Supabase Auth + server-side authorization and database RLS): least-privilege access to editing and private cockpit data. **[OPEN]** Prefer user-scoped RLS for admin operations; if a privileged server key is used, keep it server-only and narrowly scoped.
- Worker: use a service-role key only if required operations cannot use a dedicated database role or narrow RPCs; if used, store it only on the worker machine, never in browser code.
- Pipeline tables and private buckets have no public/anon access. Enable RLS on every exposed table and validate anonymous, admin, and worker access.
- Buckets: `portfolio-public` (images, videos, thumbnails), `private-docs` (generated resume PDFs, drafts attachments).

## 5. Admin panel (private operations repository)

Auth: Supabase Auth, single allowed user. **[OPEN]** Choose sign-in and recovery/MFA policy. Protect every admin page and mutation on the server; UI hiding or middleware alone is not authorization. Prefer user-scoped Supabase access so RLS provides defense in depth.

| Area | Pages |
|---|---|
| Content | Profile, Experience, Projects, Education, Skills, Testimonials (incl. video upload), Media library, 3D mapping/settings |
| Pipeline | **Inbox** (ranked candidates with the selected model's reasons; volume/model **[OPEN]**), **Job detail** (job text, client stats, score breakdown, draft editor, style switcher, copy/open-in-Upwork), **Runs** (live log, token/cost), **Search profiles**, **Agent profile**, **Styles**, **Commands** (run now, pause) |
| System | Settings, cost dashboard, health of the worker (last heartbeat) |

Realtime: the Inbox and Runs may subscribe to Supabase Realtime for live updates. Draft editing autosaves with visible save/error state and version/conflict handling. Realtime subscriptions must be restricted to admin access.

## 6. Local worker (`NexusHQ/apps/worker`)

### 6.1 Responsibilities
Run on the owner's machine (**[OPEN]** confirm machine and GPU/RAM). Orchestrate the funnel, talk to Upwork via MCP, call configured models, write results to Supabase, poll `commands`, and emit a heartbeat. Claim commands atomically, make handlers idempotent, record errors, and recover safely after restart or network loss.

### 6.2 The Find jobs pipeline (`pipeline.ts`, as built)

One user-started run (Job radar → Find jobs). Each agent is a local CLI on the owner's subscription login, chosen per card in AI agents (defaults: Search = Antigravity `agy`, Filter & rank = Claude Code on Sonnet, Writer = Codex).

| Step | Agent | What happens |
|---|---|---|
| 1 Plan | Search (no tools) | Plans 1–10 keyword queries from the profile (one per ~30 listings), each with a reason |
| 2 Search | Search + Upwork read tools | Upwork's recommendations, then each query, until **Max listings** (10–300); each job records `found_by` |
| 3 Free checks | code | Payment not verified, hourly/fixed budget below the minimum, 50+ proposals (off by default), editable on the Filter & rank card |
| 4 First pass | Filter & rank | Only when there are more than 2× the shortlist: fit score on list data; the rest are filtered out with a reason |
| 5 Details | Search + Upwork read tools | Client spend, hire rate, rating, Connects, bid stats (Freelancer Plus); second free check (already applied, client rarely hires) |
| 6 Rank | Filter & rank | Fit 0–100, applicants, win chance, why, matched/missing skills, suggested bid; keeps the best **Shortlist %** |
| 7 Draft | Writer | Cover letter, resume highlights, questions for each shortlisted job; editable in the Job radar |
| 8 Bid | Owner | Manual on upwork.com; Bid / Skip only records it |

Run controls: **Stop** (admin sets `job_runs.status = 'stopping'`; the worker polls every 5 s, kills the running CLI and marks unchecked jobs), **cost limit** (sums the cost Claude Code reports; remaining AI steps are skipped, partial ranking kept), a **stuck agent** is killed at its timeout and retried once (logged), and per-agent **Extra instructions** are appended to that agent's prompts.

### 6.2b Upwork inbox, profile sync and resumes (`upwork.ts`, roadmap H/I/J)

| Button (admin) | Agent | What happens |
|---|---|---|
| Check Upwork (Upwork inbox) | Upwork inbox, read-only tools | Dashboard + brief, proposals, invites, offers, contracts; message rooms with a summary and a reply draft when the client waits on you |
| Check my profile | Profile sync, read-only tools | Reads your Upwork profile, compares with the admin profile, stores proposed title/overview/skills/availability updates |
| Preview on Upwork | Upwork inbox + `update_profile` only | Upwork stores a preview (nothing changes); the agent must echo your exact params or the preview is discarded |
| Confirm | Upwork inbox + `confirm_preview` only | Upwork applies exactly the stored preview |
| Send on Upwork (two clicks) | Upwork inbox + `send_message` only | Sends your text, then reads back your newest message and compares it |

Write calls run only through Claude Code (per-call `--allowedTools`); agy's allow rules persist in its settings file, so it never gets a write tool. The Writer also returns `draft.resume`, shown at Resume → `?job=<id>`; the base resume is built from published admin data.

### 6.3 Worker modules (as built)

```
apps/worker/src/
  main.ts        login, command loop, heartbeat (also during long commands)
  commands.ts    handlers for admin commands (run_now, draft_job, mcp_*, …)
  pipeline.ts    Find jobs pipeline, prompts, schemas, free checks, draftOne
  agents.ts      agent_settings → AgentConfig; runAgent (retry once, Stop, fallback)
  adapters/      cli.ts (claude, codex, agy), local.ts (Ollama/OpenAI-compatible), cloud.ts (APIs, off in this version)
  mcp.ts         per-CLI MCP status / add / sign-in window / remove
  proc.ts        safe spawning: no shell, temp cwd, timeout + Stop kill the whole process tree
  status.ts  supabase.ts  secrets.ts  hardware.ts  json.ts
```

### 6.4 Upwork access
- Official Upwork MCP (`https://mcp.upwork.com/mcp`, OAuth 2.1; 34 tools, see `docs/spike/upwork-tools.json`). Added and signed in per CLI from the admin (AI agents → Connections); tokens stay in each CLI's own store on the worker machine.
- **Read-only allowlist** (`UPWORK_READ_TOOLS`): list_accounts, get_tool_help, find_jobs, get_profile, list_freelancer_proposals. Write tools (`UPWORK_WRITE_TOOLS`) are explicitly denied. Claude: `--allowedTools` / `--disallowedTools` + `--permission-mode dontAsk`; agy: allow rules in `~/.gemini/antigravity-cli/settings.json` (headless agy denies everything else); Codex never gets MCP (`--ignore-user-config`), so it can't be the Search agent.
- Upwork text is treated as untrusted in every prompt. No scraping, no account automation; any future write (messages, profile sync) needs a preview and the owner's Confirm.

### 6.5 Model runners (swappable)
- One `Adapter` interface per provider (`complete(prompt, schema, cfg, {signal})`), picked per agent in the admin. This version enables the subscription CLIs only (Claude Code, Codex, Antigravity); local models and cloud APIs are built but switched off.
- Structured output with strict schemas everywhere (every field required, `""` / `-1` for unknown), validated before use.
- Claude Code defaults to Sonnet: its unpinned default is Opus (about $0.30 per small call).

### 6.6 Cost tracking
Claude Code reports a cost per call (the API-price equivalent on a subscription); the run log shows the total and the Filter & rank **cost limit** stops a run's AI steps when it's reached. Antigravity and Codex on subscription logins report no cost.

## 7. Auth, secrets, safety
- Env secrets: worker local environment (credentials it needs), admin server environment (credentials it needs), portfolio environment (Supabase URL and publishable/anon key). Nothing secret in either repository. Never expose a service-role key to browser code.
- Human in the loop for every bid. No code path submits a proposal automatically.
- Hard daily caps in config: max jobs judged, max drafts, max tokens/cost per day; the worker stops and flags the run when exceeded.
- Admin routes require server-side session validation and authorization on every read/write, backed by RLS. Middleware helps navigation but is not the security boundary. Define recovery settings and protect mutations against cross-site requests.

## 8. Hosting
- Portfolio: Vercel is a candidate host; connect deployment only to the portfolio repository. **[OPEN]** Confirm host and preview-data policy.
- Admin: private deployment or local-only access **[OPEN]**. If hosted, protect preview and production environments; keep credentials server-side.
- Supabase: managed project.
- Worker: owner's GPU machine; run as a background service (e.g. pm2 or Windows service). Heartbeat shown in admin.

## 9. Migration from the old portfolio
The old SvelteKit site is expected to store content in `src/lib/*.params.ts` (projects, experiences, educations, skills) and logos in `static/logos`; verify the current source before writing the migration.
1. Script converts those files into a seed (`supabase/seed/`).
2. Upload logos/screenshots to Storage; map paths and verify publication visibility and asset rights.
3. Validate imported records and media, then launch with approved data; newer content is managed through admin.
4. Old contact form used Firebase — decide whether to keep it or replace with a server-mediated endpoint and `messages` table + admin inbox. **[OPEN]** Define spam/rate limiting and notifications; do not expose an unrestricted anonymous insert policy.

## 10. Suggested build phases (sequence may change after validation)

| Phase | Deliverable |
|---|---|
| 0 | Private operations repository scaffold, portfolio repository scaffold, Supabase project, migrations, auth, RLS |
| 1 | Data migration + admin CRUD for content + 2D portfolio live from published Supabase data |
| 2 | Upwork MCP spike: confirm tool outputs, rate limits, token refresh |
| 3 | Worker: harvest → gates → judge, Inbox in admin |
| 4 | Drafting (Codex/OpenAI), styles, resume PDF, command queue |
| 5 | 3D scene and interactions |
| 6 | Cost dashboard, hardening, retention purge, polish |

Phases 1 and 2 can run in parallel. Validate the 3D concept and a small performance prototype before committing to full asset production; delay detailed modeling until content routes and fallback behavior are clear.

## 11. Open questions
1. Upwork MCP: official tools/fields, terms, rate limits, retention, and scheduled-use permission?
2. Model providers/runners per stage, current pricing, data handling, regions, and measured quality/cost.
3. Data retention rules for job data under the MCP terms.
4. 3D direction: building style, exterior/environment scope, navigation approach, asset production, and performance budget.
5. Contact form backend, spam controls, and notifications.
6. Worker machine and local model runtime.
7. Admin hosting: local-only or hosted private app; define preview and production access.
8. Public read contract: views/RLS, publication rules for related content/media, and portfolio cache revalidation.
9. Recovery: database backups/restore checks, command retries, monitoring/alerts, and secret rotation.
