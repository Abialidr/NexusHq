# Private NexusHQ Operations

This is the private operations project: admin panel, backend/server functions, local worker, Supabase schema and migrations, and private documentation. The public Next.js portfolio is a separate project in `../nexushq-portfolio` and reads only the published portfolio data contract.

## Running it

It's an npm workspaces monorepo. Everything is installed and started from this folder (Node 24+):

```bash
npm install      # installs every workspace (one root lockfile)
npm run dev      # admin on http://localhost:3100 + api on http://localhost:3200, in one terminal
```

On a new install, open http://localhost:3100/setup (every page redirects there until it's done). The wizard connects
your Supabase project, installs the migrations, creates the admin and worker accounts and writes
`nexushq.config.json`, which the admin, api and worker read at runtime. See `apps/worker/README.md` for details.

`npm run dev:admin` / `npm run dev:api` start just one, `npm run build` builds all, and `npm run typecheck` checks all.
Add a dependency to one app with `npm i <pkg> -w nexushq-admin` (or `-w nexushq-api`).

## Structure

- `apps/admin/` — authenticated content and pipeline admin (Next.js)
- `apps/api/` — backend: plain Node 24 TypeScript HTTP server (`/health` for now), for work that can't be done safely with Supabase RLS, database functions or the worker
- `apps/worker/` — local outbound-only job research and drafting worker (not built yet)
- `packages/shared/` — schemas and shared operations types (not built yet)
- `supabase/migrations/` — schema, RLS, storage, and database functions
- `supabase/seed/` — sanitized portfolio seed data
- `docs/` — architecture and operational guidance

When the worker gets a `package.json`, add `apps/worker` to `workspaces` and to the root `dev` script. Keep this repository private. Never put service-role keys, Upwork credentials, or private job data in the public portfolio repository.
