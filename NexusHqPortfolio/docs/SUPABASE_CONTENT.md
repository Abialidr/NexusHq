# Supabase content for the 2D portfolio

The 2D site reads the existing admin database through `src/lib/content/read-supabase-content.ts`. `get-portfolio-content.ts` caches the mapped result with a 30-second stale/revalidation window and five-minute expiry. Profile and all content lists use the configured public API key; no service-role key or browser session is used.

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Missing configuration and API failures are errors rather than a return to sample data.

Projects, experience, education, skills, open-source entries, articles, hobbies and photos require `status = published`. Testimonial quotes additionally require approval and consent. Existing database row-level security remains in force. The public profile singleton does not have a draft status.

The imported projects, experience, education and skills remain drafts pending the owner's publish-versus-preview decision. This integration does not publish them automatically. Once published in the admin they become visible after cache refresh, without rebuilding the site. Project and article detail routes load on demand behind loading boundaries, including slugs created after deployment.

Storage object paths are resolved into public URLs for the portrait, resume, project covers and ordered image/video galleries. Videos use native controls and `preload=none`. Empty optional profile/case-study sections are hidden. Undefined statistics and results are not replaced with sample claims.

Checks: `node --env-file=.env.local scripts/check-content.mjs` exercises the live public reader; `npm run build` checks production rendering; `node node_modules/typescript/bin/tsc --noEmit` checks types. The local server at http://localhost:3000 was restarted and About, Experience, Projects and Skills returned 200 with the real profile; portrait and resume links were verified in their respective pages. Contact form behavior remains the existing mailto flow, with admin-managed visibility and contact copy.
