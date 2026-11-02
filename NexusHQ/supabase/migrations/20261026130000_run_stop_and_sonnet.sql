-- Stop button for Find jobs runs: the admin sets a running run to 'stopping'; the worker kills the agent that's
-- running, marks unchecked jobs and sets 'stopped'.
alter table public.job_runs drop constraint if exists job_runs_status_check;
alter table public.job_runs add constraint job_runs_status_check
  check (status in ('running', 'stopping', 'stopped', 'done', 'error'));

-- Roadmap G3: Claude Code's unpinned default is Opus (about $0.30 per small call); default the Filter & rank agent
-- to Sonnet. Only rows still on the default are changed.
update public.agent_settings set model = 'sonnet' where provider = 'claude_cli' and model = '';
