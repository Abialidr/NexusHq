-- AI provider keys and cloud credentials managed from the admin (Upwork cockpit → AI agents), stored encrypted in
-- Supabase Vault. Replaces worker-local key entry: the admin is the one place they are set.
--
--   admin  : set_agent_secret() to set/replace/clear one, agent_secret_status() to see which are set. Write-only:
--            no function ever returns a value to the admin.
--   worker : get_agent_secrets() returns the decrypted values. Only the worker role can call it successfully.
--   anon   : nothing.
-- The worker's own Supabase sign-in stays on the worker machine (it is needed before it can reach Supabase).
-- Vault rows are named 'nexushq_agent:<name>' so they never collide with other secrets in the project.

create or replace function private.agent_secret_names()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['anthropic', 'openai', 'gemini', 'codex',
               'aws_access_key_id', 'aws_secret_access_key', 'aws_session_token', 'aws_region', 'aws_bearer_token_bedrock',
               'vertex_project', 'vertex_region'];
$$;

-- Set, replace or (with null/empty value) delete one secret.
create or replace function public.set_agent_secret(p_name text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := 'nexushq_agent:' || p_name;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if not (p_name = any (private.agent_secret_names())) then
    raise exception 'unknown secret %', p_name using errcode = '22023';
  end if;
  select id into v_id from vault.secrets where name = v_name;
  if coalesce(btrim(p_value), '') = '' then
    delete from vault.secrets where id = v_id;
  elsif v_id is null then
    perform vault.create_secret(btrim(p_value), v_name, 'NexusHQ AI agent credential');
  else
    perform vault.update_secret(v_id, btrim(p_value));
  end if;
end;
$$;

-- Which secrets are set (never their values). Admin and worker.
create or replace function public.agent_secret_status()
returns table (name text, is_set boolean, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select n, s.id is not null, s.updated_at
    from unnest(private.agent_secret_names()) as n
    left join vault.secrets s on s.name = 'nexushq_agent:' || n
   where public.is_admin() or public.is_worker();
$$;

-- Decrypted values as { name: value }. Worker only.
create or replace function public.get_agent_secrets()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_worker() then
    raise exception 'worker only' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_object_agg(substr(d.name, length('nexushq_agent:') + 1), d.decrypted_secret)
      from vault.decrypted_secrets d
     where d.name like 'nexushq\_agent:%'
  ), '{}'::jsonb);
end;
$$;

revoke execute on function public.set_agent_secret(text, text) from public, anon;
revoke execute on function public.agent_secret_status() from public, anon;
revoke execute on function public.get_agent_secrets() from public, anon;
grant execute on function public.set_agent_secret(text, text) to authenticated;
grant execute on function public.agent_secret_status() to authenticated;
grant execute on function public.get_agent_secrets() to authenticated;
