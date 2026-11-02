# NexusHQ admin

Next.js 16 admin for the portfolio content in Supabase (project `wcnqstqxvyualbneeopm`). The static design it was built
from is in `design/`.

```bash
cp .env.example .env.local   # fill in the publishable key
npm install
npm run dev                  # http://localhost:3100
```

## Making yourself the admin

Only users whose **app_metadata** has `role: "admin"` can use the admin. RLS checks the same claim via
`public.is_admin()`. `app_metadata` can only be set server-side, so users can't grant it to themselves.

1. Supabase dashboard → Authentication → Users → **Add user** (email + password, auto-confirm).
   Turn **off** public sign-ups (Authentication → Sign In / Providers), since nobody else needs an account.
2. SQL editor:
   ```sql
   update auth.users
      set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
    where email = 'you@example.com';
   ```
3. Sign in at `/login`. If you were already signed in, sign out and in again so the token carries the role.

## How it fits together

| Piece | Where |
|---|---|
| Schema, RLS, storage buckets | `../../supabase/migrations/20261019130000_portfolio_admin_schema.sql` |
| DB types | `src/lib/database.types.ts`. Regenerate after every migration |
| Section config (lists, columns, editor fields) | `src/lib/sections.ts` |
| All writes (admin-checked + RLS) | `src/app/actions.ts` |
| Auth guard | `src/lib/auth.ts` (`requireAdmin`), session refresh in `src/proxy.ts` |
| Public testimonial form (no sign-in) | `/kind-words` (open link) and `/kind-words/<token>` (personal request) |

Storage: `portfolio` is public-read (covers, gallery, avatars, résumé, approved testimonial media).
`testimonial-uploads` is private. Visitors can only add files under `incoming/`, and approving a testimonial copies its
media into `portfolio/testimonials/`, so pending recordings are never public.

The public portfolio reads with the publishable key and sees only `published` rows, approved+consented
testimonials, and the profile, settings, café panels and credits.
