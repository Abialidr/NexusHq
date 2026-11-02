-- Ordered project screenshots and video demonstrations; visibility follows the parent project's existing RLS.
alter table public.projects
  add column media jsonb not null default '[]'::jsonb
  constraint projects_media_array check (jsonb_typeof(media) = 'array');
