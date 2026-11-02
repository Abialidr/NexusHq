-- Find jobs pipeline (roadmap Stages D/E). One "Find jobs" press = one job_runs row; every job it finds is kept in
-- public.jobs with the stage it reached and why, so the admin can show Found / Gated out / Filtered out / Shortlist
-- / Bid / Skipped. The worker writes, the admin reads and marks Bid/Skipped. Jobs older than 30 days are deleted by
-- the worker unless bid on (Upwork's retention terms aren't published).

-- Agent roles the user chose: Search = Antigravity, Filter & rank = Claude Code, Writer = Codex. Judge's job moved
-- into Filter & rank; its row is left in place unused (the admin no longer shows it).
insert into public.agent_settings (agent, provider, model, backend, base_url, options)
values ('search', 'agy_cli', '', 'login', null, '{"timeoutMs":900000}')
on conflict (agent) do nothing;
update public.agent_settings set provider = 'claude_cli', model = '', backend = 'login', base_url = null, fallback = null,
       options = '{"timeoutMs":600000}' where agent = 'filter';
update public.agent_settings set provider = 'codex_cli', model = '', backend = 'login', base_url = null, fallback = null,
       options = '{"timeoutMs":300000}' where agent = 'writer';

create type public.job_stage as enum ('found', 'gated_out', 'filtered_out', 'shortlisted', 'bid', 'skipped');

create table public.job_runs (
  id          uuid primary key default gen_random_uuid(),
  focus       text not null default '',
  status      text not null default 'running' check (status in ('running', 'done', 'error')),
  counts      jsonb not null default '{}'::jsonb,   -- { found, new, gated_out, filtered_out, shortlisted, drafted }
  log         text[] not null default '{}',
  error       text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  upwork_id     text not null unique,
  run_id        uuid references public.job_runs (id) on delete set null,
  title         text not null default '',
  url           text not null default '',
  summary       jsonb not null default '{}'::jsonb,  -- fields from search (shared JobSummary)
  detail        jsonb,                               -- fields from the job detail (shared JobDetail)
  stage         public.job_stage not null default 'found',
  reason        text not null default '',
  score         smallint,
  rank          smallint,
  suggested_bid jsonb,                               -- { amount, unit, reason }
  draft         jsonb,                               -- { cover_letter, resume_highlights[], questions[] }
  found_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index jobs_stage_idx on public.jobs (stage, score desc nulls last);
create index jobs_found_idx on public.jobs (found_at desc);
create trigger jobs_touch before update on public.jobs for each row execute function private.touch_updated_at();

alter table public.job_runs enable row level security;
alter table public.jobs enable row level security;
grant select, insert, update, delete on public.job_runs to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;

create policy "admin manages" on public.job_runs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker runs" on public.job_runs for all to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));
create policy "admin manages" on public.jobs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker writes jobs" on public.jobs for all to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));
