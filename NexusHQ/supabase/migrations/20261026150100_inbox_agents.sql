-- Settings rows for the two new agents (enum values added in 20261026150000; Postgres needs them committed first).
-- Both use Upwork tools, so they default to Claude Code on Sonnet (Codex can't use Upwork tools).
insert into public.agent_settings (agent, provider, model, backend, base_url, options)
values ('inbox', 'claude_cli', 'sonnet', 'login', null, '{"timeoutMs":600000}'),
       ('profile', 'claude_cli', 'sonnet', 'login', null, '{"timeoutMs":600000}')
on conflict (agent) do nothing;
