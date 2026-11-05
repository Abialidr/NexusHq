-- Add Upwork commands to commands_kind_check constraint
alter table public.commands drop constraint if exists commands_kind_check;

alter table public.commands add constraint commands_kind_check
  check (kind in (
    'test_agent', 'refresh_models', 'pull_model',
    'run_now', 'pause', 'resume', 'regenerate_draft', 'draft_job',
    'mcp_check', 'mcp_add', 'mcp_login', 'mcp_remove',
    'upwork_sync', 'profile_sync', 'upwork_preview', 'upwork_confirm'
  ));

