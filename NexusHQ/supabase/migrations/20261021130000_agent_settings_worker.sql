-- Phase 2 v1: configurable AI agents + the admin <-> local worker link (docs/UPWORK_AGENT_PLAN.md §5.5–5.9).
--
-- Access model
--   admin  : app_metadata.role = 'admin'. Edits agent_settings, reads worker_status, queues commands.
--   worker : app_metadata.role = 'worker' (a dedicated Supabase user the local worker signs in as). Reads
--            agent_settings, writes its own status row, claims and finishes commands. Never sees anything else.
--   anon   : no access to anything here.
-- Secrets (API keys, cloud credentials) are NOT stored here. They stay on the worker machine; worker_status only
-- says whether each one is set.

create or replace function public.is_worker()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'worker', false);
$$;

create type public.agent_id as enum ('filter', 'judge', 'writer');
create type public.command_status as enum ('queued', 'running', 'done', 'error');

-- One row per agent: which provider/model runs it. Values are checked again in the admin action against the
-- shared provider catalog (packages/shared/src/agents.ts).
create table public.agent_settings (
  agent      public.agent_id primary key,
  provider   text not null,
  model      text not null default '',
  backend    text,                                   -- CLI providers only: login | api_key | bedrock | vertex
  base_url   text,                                   -- local providers only
  options    jsonb not null default '{}'::jsonb,     -- temperature, maxTokens, timeoutMs, dailyCap
  fallback   jsonb,                                  -- { provider, model, backend?, base_url? } or null
  updated_at timestamptz not null default now()
);
create trigger agent_settings_touch before update on public.agent_settings
  for each row execute function private.touch_updated_at();

insert into public.agent_settings (agent, provider, model, backend, base_url, options) values
  ('filter', 'ollama',     'qwen3:4b', null,    'http://localhost:11434', '{"temperature":0,"timeoutMs":120000}'),
  ('judge',  'claude_cli', '',         'login', null,                     '{"timeoutMs":180000}'),
  ('writer', 'codex_cli',  '',         'login', null,                     '{"timeoutMs":240000}');

-- Single row the worker keeps current: heartbeat, hardware, what each provider can do, last test per agent.
create table public.worker_status (
  id           smallint primary key default 1 check (id = 1),
  worker_name  text not null default '',
  version      text not null default '',
  hardware     jsonb not null default '{}'::jsonb,   -- { ramGb, freeRamGb, cpu, cores, gpus: [{ vendor, model, vramGb }] }
  providers    jsonb not null default '{}'::jsonb,   -- { [provider]: { available, detail, keySet, models[], checkedAt } }
  tests        jsonb not null default '{}'::jsonb,   -- { [agent]: { ok, detail, latencyMs, provider, model, at } }
  started_at   timestamptz,
  last_seen_at timestamptz
);

-- Admin -> worker queue (ARCHITECTURE §4). The worker never accepts inbound connections, so every admin action
-- that needs the worker (test a connection, list models, pull a local model, run now, pause) is a row here.
create table public.commands (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('test_agent', 'refresh_models', 'pull_model', 'run_now', 'pause', 'resume',
                                            'regenerate_draft', 'draft_job')),
  payload     jsonb not null default '{}'::jsonb,
  status      public.command_status not null default 'queued',
  result      jsonb,
  error       text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  finished_at timestamptz
);
create index commands_queued_idx on public.commands (created_at) where status = 'queued';
create index commands_recent_idx on public.commands (created_at desc);

-- Atomically hand the oldest queued command to the caller. SECURITY INVOKER, so RLS still decides: only the
-- worker can see and update queued rows through it. SKIP LOCKED keeps two worker processes from taking the same row.
create or replace function public.claim_next_command()
returns setof public.commands
language sql
set search_path = ''
as $$
  update public.commands c
     set status = 'running', claimed_at = now()
   where c.id = (select q.id from public.commands q
                  where q.status = 'queued'
                  order by q.created_at
                  for update skip locked
                  limit 1)
  returning c.*;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- grants + RLS
-- ---------------------------------------------------------------------------------------------------------
alter table public.agent_settings enable row level security;
alter table public.worker_status  enable row level security;
alter table public.commands       enable row level security;

grant select, insert, update on public.agent_settings to authenticated;
grant select, insert, update on public.worker_status  to authenticated;
grant select, insert, update, delete on public.commands to authenticated;
revoke execute on function public.claim_next_command() from public, anon;
grant execute on function public.claim_next_command() to authenticated;
grant execute on function public.is_worker() to authenticated;

create policy "admin manages" on public.agent_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker reads" on public.agent_settings for select to authenticated
  using ((select public.is_worker()));

create policy "admin reads" on public.worker_status for select to authenticated
  using ((select public.is_admin()));
create policy "worker reads" on public.worker_status for select to authenticated
  using ((select public.is_worker()));
create policy "worker inserts" on public.worker_status for insert to authenticated
  with check ((select public.is_worker()));
create policy "worker updates" on public.worker_status for update to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));

create policy "admin manages" on public.commands for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker reads" on public.commands for select to authenticated
  using ((select public.is_worker()));
create policy "worker updates" on public.commands for update to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));
