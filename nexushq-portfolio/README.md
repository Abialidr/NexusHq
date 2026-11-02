# NexusHQ Portfolio

The independent public portfolio website for NexusHQ. This repository owns its Next.js app, Node dependencies, build, and deployment. It reads only published portfolio data from the Supabase project managed in the private `NexusHQ` operations repository.

## Local development

- Node.js 20.9 or newer
- `npm install`
- `npm run dev`

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only after the private repo defines its published read contract. These browser-visible credentials must never grant access to private tables.

## Structure

- `src/app/` — routes (`/`, `/2d`, `/3d`, and project details)
- `src/components/layout/` — shared site chrome
- `src/components/portfolio/` — content-driven portfolio components
- `src/components/three/` — lazy-loaded 3D experience
- `src/lib/content/` — portfolio read interface and data mapping
- `src/lib/supabase/` — public Supabase client, once schema and RLS are ready
- `src/types/` — public portfolio domain types
- `public/models/` — optimized 3D assets
- `public/images/` — local/static visual assets

The private admin, worker, migrations, and Upwork data do not belong in this repository. Avoid importing code from the private repo; agree on the public schema contract and keep a local generated type snapshot or publish a versioned package later.
