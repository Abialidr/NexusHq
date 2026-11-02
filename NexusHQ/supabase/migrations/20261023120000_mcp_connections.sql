-- MCP connections managed from the admin (Upwork cockpit → AI agents → Connections).
-- The admin can't reach the worker, so adding an MCP server to a CLI, running its OAuth login and checking it are
-- commands the worker runs on its machine; what it finds is reported in worker_status.mcp.

alter table public.worker_status
  add column if not exists mcp jsonb not null default '{}'::jsonb;
  -- { [cli]: { [server]: { added, auth: connected|needs_auth|failed|not_added|unknown, detail, checkedAt } } }

alter table public.commands drop constraint if exists commands_kind_check;
alter table public.commands add constraint commands_kind_check
  check (kind in ('test_agent', 'refresh_models', 'pull_model', 'run_now', 'pause', 'resume', 'regenerate_draft',
                  'draft_job', 'mcp_check', 'mcp_add', 'mcp_login', 'mcp_remove'));
