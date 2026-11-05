-- Invitations: draft a reply (cover letter, bid, screening answers), then accept or decline from the admin.
-- Same flow as profile updates: draft -> preview on Upwork -> you press Confirm -> done.
alter table public.upwork_actions drop constraint if exists upwork_actions_kind_check;
alter table public.upwork_actions add constraint upwork_actions_kind_check
  check (kind in ('profile_update', 'message', 'invitation'));

alter table public.commands drop constraint if exists commands_kind_check;
alter table public.commands add constraint commands_kind_check
  check (kind in (
    'test_agent', 'refresh_models', 'pull_model',
    'run_now', 'pause', 'resume', 'regenerate_draft', 'draft_job',
    'mcp_check', 'mcp_add', 'mcp_login', 'mcp_remove',
    'upwork_sync', 'profile_sync', 'upwork_preview', 'upwork_confirm', 'invitation_draft'
  ));
