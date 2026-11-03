-- Search learning: one row per search the Search agent ran (a planned query, or Upwork's recommendations), each job
-- linked to the search that found it, and how that search's jobs ended up. Rows outlive the jobs (30-day retention),
-- so the next run's query planning can see which searches bring shortlisted / bid jobs and which only waste time.
create table public.job_searches (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid references public.job_runs (id) on delete set null,
  query       text,                                 -- null = Upwork's recommended jobs (smart_search)
  why         text not null default '',             -- the Search agent's reason for this query
  found       int not null default 0,               -- listings this search added to the run
  new         int not null default 0,               -- of those, not seen in an earlier run
  stages      jsonb not null default '{}'::jsonb,   -- { gated_out, filtered_out, shortlisted, bid, skipped }: kept by trigger
  created_at  timestamptz not null default now()
);
create index job_searches_query_idx on public.job_searches (lower(query), created_at desc);

alter table public.jobs add column if not exists search_id uuid references public.job_searches (id) on delete set null;
create index if not exists jobs_search_idx on public.jobs (search_id);

alter table public.job_searches enable row level security;
grant select, insert, update, delete on public.job_searches to authenticated;
create policy "admin manages" on public.job_searches for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker writes searches" on public.job_searches for all to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));

-- Moves a job's count from its old stage to its new one on its search. Deleting a job (retention) leaves the counts.
create or replace function private.count_job_search_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.search_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.stage is not distinct from new.stage and old.search_id is not distinct from new.search_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.search_id is not null and old.stage <> 'found' then
    update public.job_searches
      set stages = jsonb_set(stages, array[old.stage::text], to_jsonb(greatest(coalesce((stages ->> old.stage::text)::int, 0) - 1, 0)))
      where id = old.search_id;
  end if;
  if new.stage <> 'found' then
    update public.job_searches
      set stages = jsonb_set(stages, array[new.stage::text], to_jsonb(coalesce((stages ->> new.stage::text)::int, 0) + 1))
      where id = new.search_id;
  end if;
  return new;
end;
$$;

create trigger jobs_count_search_stage after insert or update of stage, search_id on public.jobs
  for each row execute function private.count_job_search_stage();
