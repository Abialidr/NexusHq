-- Portfolio content managed by the NexusHQ admin panel and read by the public portfolio (2D + 3D café).
--
-- Access model
--   anon / signed-out visitors : read published rows only; may submit a contact message or a pending testimonial.
--   admin                      : a signed-in user whose app_metadata.role = 'admin' (set server-side only, never
--                                user_metadata, which users can edit). Full read/write on everything here.
-- Every table has RLS enabled. Grants are explicit because new tables are not always exposed to the Data API.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create type public.publish_status as enum ('published', 'draft', 'hidden');
create type public.testimonial_kind as enum ('text', 'video', 'audio');
create type public.testimonial_state as enum ('pending', 'approved', 'rejected', 'archived');
create type public.testimonial_source as enum ('request', 'open', 'manual');
create type public.request_status as enum ('sent', 'opened', 'submitted', 'expired');

-- True when the caller's JWT carries app_metadata.role = 'admin'. SECURITY INVOKER: it only reads the JWT.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- singletons: profile (hero, about, contact copy, socials) and site settings (café signs, collection link)
-- ---------------------------------------------------------------------------------------------------------
create table public.profile (
  id               boolean primary key default true check (id),
  name             text not null default '',
  role             text not null default '',
  headline         text not null default '',
  intro            text not null default '',
  avatar_path      text,
  story            text[] not null default '{}',
  principles       jsonb not null default '[]',   -- [{ title, body }]
  location         text not null default '',
  work_mode        text not null default 'Remote',
  availability     text not null default 'Open to work',
  currently        text not null default '',
  email            text not null default '',
  resume_path      text,
  stats            jsonb not null default '[]',   -- [{ value, prefix?, suffix?, label }]
  stack            text[] not null default '{}',  -- Home tech strip
  contact_headline text not null default '',
  contact_lead     text not null default '',
  contact_reply    text not null default '',
  contact_form_enabled boolean not null default true,
  socials          jsonb not null default '[]',   -- [{ label, url }]
  updated_at       timestamptz not null default now()
);

create table public.site_settings (
  id                      boolean primary key default true check (id),
  cafe_neon               text not null default 'coffee & code',
  cafe_neon_sub           text not null default '',
  cafe_window_neon        text not null default 'records · coffee',
  cafe_door_neon          text not null default 'open',
  cafe_what_i_do          text not null default '',
  open_collection_enabled boolean not null default true,
  updated_at              timestamptz not null default now()
);

insert into public.profile default values;
insert into public.site_settings default values;

-- ---------------------------------------------------------------------------------------------------------
-- list sections (all share: status, sort_order, timestamps)
-- ---------------------------------------------------------------------------------------------------------
create table public.experiences (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  role            text not null,
  company         text not null default '',
  place           text not null default '',
  employment_type text not null default 'Full-time',
  start_label     text not null default '',
  end_label       text not null default '',   -- empty = Present
  summary         text not null default '',
  highlights      text[] not null default '{}',
  skills          text[] not null default '{}',
  status          public.publish_status not null default 'draft',
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.education (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  org              text not null default '',
  when_label       text not null default '',
  subjects         text[] not null default '{}',
  certificate_path text,
  status           public.publish_status not null default 'draft',
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.skill_groups (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  skills     text[] not null default '{}',
  status     public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.open_source (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  relation   text not null default 'Contributor',
  url        text not null default '',
  badge      text not null default '',
  summary    text not null default '',
  status     public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  summary      text not null default '',
  cover_path   text,
  body_md      text not null default '',
  published_on date,
  read_minutes integer not null default 1 check (read_minutes > 0),
  status       public.publish_status not null default 'draft',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.gallery_photos (
  id         uuid primary key default gen_random_uuid(),
  path       text not null,
  caption    text not null default '',
  alt        text not null default '',
  placement  text not null default 'About gallery',
  status     public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hobbies (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null default '',
  photo_path text,
  status     public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  kind       text not null default '',
  category   text not null default 'web' check (category in ('web', 'ai', 'platform')),
  year       text not null default '',
  summary    text not null default '',
  featured   boolean not null default false,
  cover_path text,
  skills     text[] not null default '{}',
  links      jsonb not null default '[]',   -- [{ label, url }]
  role       text not null default '',
  timeline   text not null default '',
  team       text not null default '',
  problem    text not null default '',
  built      text not null default '',
  decisions  text[] not null default '{}',
  results    text not null default '',
  quote_testimonial_id uuid,                -- fk added after testimonials
  status     public.publish_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- testimonials: requests (personal links), submissions, placement
-- ---------------------------------------------------------------------------------------------------------
create table public.testimonial_requests (
  id            uuid primary key default gen_random_uuid(),  -- doubles as the unguessable link token
  client_name   text not null,
  email         extensions.citext not null,
  project_id    uuid references public.projects (id) on delete set null,
  allowed_kinds public.testimonial_kind[] not null default '{text,video,audio}',
  note          text not null default '',
  status        public.request_status not null default 'sent',
  expires_at    timestamptz not null default now() + interval '30 days',
  opened_at     timestamptz,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index testimonial_requests_project_id_idx on public.testimonial_requests (project_id);

create table public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 120),
  role         text not null default '' check (char_length(role) <= 160),
  kind         public.testimonial_kind not null default 'text',
  quote        text not null default '' check (char_length(quote) <= 4000),  -- text body, or edited transcript
  pull_quote   text not null default '',
  transcript   text not null default '',
  media_path   text,           -- testimonial-uploads/… while pending; portfolio/testimonials/… once approved
  poster_path  text,
  avatar_path  text,
  duration_s   integer check (duration_s between 0 and 600),
  trim_start_s integer not null default 0,
  trim_end_s   integer,
  rating       smallint check (rating between 1 and 5),
  consent      boolean not null default false,
  state        public.testimonial_state not null default 'pending',
  source       public.testimonial_source not null default 'open',
  placements   text[] not null default '{}',   -- 'home' | 'about' | 'projects' | 'project:<slug>' | 'cafe'
  project_id   uuid references public.projects (id) on delete set null,
  request_id   uuid references public.testimonial_requests (id) on delete set null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index testimonials_state_idx on public.testimonials (state);
create index testimonials_project_id_idx on public.testimonials (project_id);
create index testimonials_request_id_idx on public.testimonials (request_id);

alter table public.projects
  add constraint projects_quote_testimonial_id_fkey
  foreign key (quote_testimonial_id) references public.testimonials (id) on delete set null;
create index projects_quote_testimonial_id_idx on public.projects (quote_testimonial_id);

-- ---------------------------------------------------------------------------------------------------------
-- 3D café: per-object panel copy and model credits
-- ---------------------------------------------------------------------------------------------------------
create table public.cafe_panels (
  zone        text primary key,          -- about | skills | projects | experience | articles | hobbies | opensource | gallery | contact | credits
  object_name text not null,
  kicker      text not null default '',
  title       text not null default '',
  body        text not null default '',
  menu_label  text not null default '',
  sort_order  integer not null default 0,
  updated_at  timestamptz not null default now()
);

insert into public.cafe_panels (zone, object_name, kicker, title, menu_label, sort_order) values
  ('about', 'Barista (owner)', 'The barista', '', 'About', 0),
  ('skills', 'Menu board', 'The menu board', 'What I brew', 'Skills', 1),
  ('projects', 'Bookshelf', 'The bookshelf', 'Things I have built', 'Projects', 2),
  ('experience', 'Framed photos', 'The framed photos', 'Where I have worked', 'Experience', 3),
  ('articles', 'Newspaper', 'The newspaper', 'The Daily Read', 'Articles', 4),
  ('hobbies', 'DJ booth', 'The DJ booth', 'Off the clock', 'Hobbies', 5),
  ('opensource', 'Cookie jar', 'The free cookie jar', 'Open source', 'Open source', 6),
  ('gallery', 'Photo wall', 'The photo wall', 'Snapshots', 'Gallery', 7),
  ('contact', 'Business cards', 'The business cards', 'Take a card', 'Contact', 8),
  ('credits', 'Notice board', 'The notice board', 'Thank you', 'Credits', 9);

create table public.model_credits (
  id         uuid primary key default gen_random_uuid(),
  model      text not null,
  artist     text not null,
  license    text not null default 'CC BY 4.0',
  source_url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- contact messages (public insert, admin read)
-- ---------------------------------------------------------------------------------------------------------
create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  email      extensions.citext not null check (char_length(email) <= 254),
  message    text not null check (char_length(message) between 1 and 5000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profile', 'site_settings', 'experiences', 'education', 'skill_groups', 'open_source',
                           'articles', 'gallery_photos', 'hobbies', 'projects', 'testimonials', 'cafe_panels']
  loop
    execute format('create trigger touch_updated_at before update on public.%I
                    for each row execute function private.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------------------
-- testimonial submission helpers (SECURITY DEFINER, deliberately narrow, kept in the unexposed private schema
-- except for the one RPC a visitor must call)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.request_accepts(p_request uuid, p_kind public.testimonial_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.testimonial_requests r
    where r.id = p_request and r.status <> 'submitted' and r.expires_at > now() and p_kind = any (r.allowed_kinds)
  );
$$;

create or replace function private.open_collection_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select open_collection_enabled from public.site_settings), false);
$$;
revoke all on function private.request_accepts(uuid, public.testimonial_kind) from public;
revoke all on function private.open_collection_enabled() from public;
grant execute on function private.request_accepts(uuid, public.testimonial_kind) to anon, authenticated;
grant execute on function private.open_collection_enabled() to anon, authenticated;

-- Called by the public collection page with the link token. Marks the request opened and returns only what the
-- form needs to pre-fill. Returns no row for unknown, expired or already-used links.
create or replace function public.open_testimonial_request(p_token uuid)
returns table (client_name text, project_name text, allowed_kinds public.testimonial_kind[])
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.testimonial_requests r
     set status = 'opened', opened_at = coalesce(r.opened_at, now())
   where r.id = p_token and r.status = 'sent' and r.expires_at > now();

  return query
    select r.client_name, p.name, r.allowed_kinds
      from public.testimonial_requests r
      left join public.projects p on p.id = r.project_id
     where r.id = p_token and r.status <> 'submitted' and r.expires_at > now();
end;
$$;
revoke all on function public.open_testimonial_request(uuid) from public;
grant execute on function public.open_testimonial_request(uuid) to anon, authenticated;

-- After a visitor submits against a request link, mark that request as used.
create or replace function private.mark_request_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.request_id is not null then
    update public.testimonial_requests
       set status = 'submitted', submitted_at = now()
     where id = new.request_id;
  end if;
  return new;
end;
$$;
revoke all on function private.mark_request_submitted() from public;
create trigger mark_request_submitted after insert on public.testimonials
  for each row execute function private.mark_request_submitted();

-- ---------------------------------------------------------------------------------------------------------
-- grants + RLS
-- ---------------------------------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

do $$
declare t text;
begin
  -- tables the public site reads (published rows only) and the admin fully manages
  foreach t in array array['experiences', 'education', 'skill_groups', 'open_source', 'articles',
                           'gallery_photos', 'hobbies', 'projects']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "public reads published" on public.%I for select to anon, authenticated
                    using (status = ''published'')', t);
    execute format('create policy "admin manages" on public.%I for all to authenticated
                    using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;

  -- always-public rows the admin edits
  foreach t in array array['profile', 'site_settings', 'cafe_panels', 'model_credits']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "public reads" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin manages" on public.%I for all to authenticated
                    using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- testimonials: public sees approved + consented; visitors may only create pending, unplaced submissions
alter table public.testimonials enable row level security;
grant select, insert on public.testimonials to anon;
grant select, insert, update, delete on public.testimonials to authenticated;
create policy "public reads approved" on public.testimonials for select to anon, authenticated
  using (state = 'approved' and consent);
create policy "admin manages" on public.testimonials for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "visitors submit pending" on public.testimonials for insert to anon, authenticated
  with check (
    state = 'pending'
    and placements = '{}'
    and sort_order = 0
    and project_id is null
    and (
      (source = 'open' and request_id is null and (select private.open_collection_enabled()))
      or (source = 'request' and request_id is not null and private.request_accepts(request_id, kind))
    )
  );

alter table public.testimonial_requests enable row level security;
grant select, insert, update, delete on public.testimonial_requests to authenticated;
create policy "admin manages" on public.testimonial_requests for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.contact_messages enable row level security;
grant insert on public.contact_messages to anon;
grant select, insert, update, delete on public.contact_messages to authenticated;
create policy "visitors send" on public.contact_messages for insert to anon, authenticated
  with check (read_at is null);
create policy "admin manages" on public.contact_messages for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------------------------------------
-- storage
--   portfolio            public read; admin writes (covers, gallery, avatars, résumé, approved testimonial media)
--   testimonial-uploads  private; visitors may only add files under incoming/, admin reads/moves/deletes
-- ---------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('portfolio', 'portfolio', true, 52428800,
   array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'application/pdf',
         'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg']),
  ('testimonial-uploads', 'testimonial-uploads', false, 157286400,
   array['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime',
         'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav']);

create policy "admin manages portfolio files" on storage.objects for all to authenticated
  using (bucket_id = 'portfolio' and (select public.is_admin()))
  with check (bucket_id = 'portfolio' and (select public.is_admin()));

create policy "visitors upload testimonial media" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'testimonial-uploads' and (storage.foldername(name))[1] = 'incoming');

create policy "admin manages testimonial uploads" on storage.objects for all to authenticated
  using (bucket_id = 'testimonial-uploads' and (select public.is_admin()))
  with check (bucket_id = 'testimonial-uploads' and (select public.is_admin()));
