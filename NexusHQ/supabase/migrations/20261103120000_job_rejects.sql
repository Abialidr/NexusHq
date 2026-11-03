-- Search agent v2 (the scout): it reads the portfolio piece by piece, keeps a daily scratchpad, vets clients, and saves
-- only the listings it can justify. Rejected listings never become jobs; they are remembered here so later runs skip
-- them, and their reasons teach the next day's searches.

-- Listings the scout (or the free code gates) rejected. Never shown as jobs.
create table public.job_rejects (
  upwork_id   text primary key,
  search_id   uuid references public.job_searches (id) on delete set null,
  run_id      uuid references public.job_runs (id) on delete set null,
  title       text not null default '',
  client_key  text,
  rejected_by text not null check (rejected_by in ('gates', 'search')),
  reason      text not null default '',
  created_at  timestamptz not null default now()
);
create index job_rejects_search_idx on public.job_rejects (search_id);
create index job_rejects_created_idx on public.job_rejects (created_at);

-- The scout's working memory, one row per day and section (fit_card, searches, notes, lessons). A second run on the
-- same day continues from it; earlier days' lessons feed the next day.
create table public.search_scratchpad (
  day         date not null default current_date,
  section     text not null check (section in ('fit_card', 'searches', 'notes', 'lessons')),
  body        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (day, section)
);

-- One dossier per Upwork client, reused across jobs and runs. The scout fills the Upwork facts; Claude adds the
-- trust verdict (and web research for named companies) during the final ranking.
create table public.clients (
  client_key    text primary key,            -- Upwork client id, else "name|country"
  name          text not null default '',
  company       text not null default '',
  website       text not null default '',
  facts         jsonb not null default '{}'::jsonb,   -- payment_verified, total_spent, hire_rate, jobs_posted, rating, member_since, country, reviews
  red_flags     text[] not null default '{}',
  trust_score   smallint,                    -- 0-100, set by Claude
  trust_reason  text not null default '',
  researched_by text not null default '',    -- "search", "claude"
  updated_at    timestamptz not null default now()
);

alter table public.jobs add column if not exists client_key text references public.clients (client_key) on delete set null;
alter table public.jobs add column if not exists proof jsonb;   -- the scout's reason + the projects that prove the fit
create index if not exists jobs_client_idx on public.jobs (client_key);

do $$
declare t text;
begin
  foreach t in array array['job_rejects', 'search_scratchpad', 'clients'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "admin manages" on public.%I for all to authenticated
      using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "worker writes" on public.%I for all to authenticated
      using ((select public.is_worker())) with check ((select public.is_worker()))', t);
  end loop;
end $$;
