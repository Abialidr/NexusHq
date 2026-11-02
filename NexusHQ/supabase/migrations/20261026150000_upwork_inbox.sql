-- Roadmap I + J: your Upwork activity in the admin (read-only sync) and Upwork writes that only run after your click.
--   upwork_snapshots  latest copy of each read (profile, proposals, invitations, offers, contracts, dashboard) + a brief
--   upwork_rooms      message rooms: last messages, the Inbox agent's summary and a reply draft you can edit
--   upwork_actions    every Upwork write: draft -> preview on Upwork -> you press Confirm -> done. Nothing else writes.
-- Only the latest copy is kept (each sync overwrites it); rooms not seen for 30 days are deleted by the worker.

-- Two more agents: Upwork inbox (reads activity, briefs you, drafts replies) and Profile sync (compares the admin
-- profile with Upwork and proposes updates).
alter type public.agent_id add value if not exists 'inbox';
alter type public.agent_id add value if not exists 'profile';

create table public.upwork_snapshots (
  kind       text primary key check (kind in ('dashboard', 'profile', 'proposals', 'invitations', 'offers', 'contracts')),
  data       jsonb not null default '{}'::jsonb,
  brief      text not null default '',
  fetched_at timestamptz not null default now()
);

create table public.upwork_rooms (
  room_id             text primary key,
  title               text not null default '',
  other_party         text not null default '',
  context             text not null default '',   -- e.g. "Proposal: <job title>" or "Contract: …"
  last_message_at     timestamptz,
  awaiting_reply_from text not null default '',   -- 'you' | 'them' | ''
  unread              boolean not null default false,
  messages            jsonb not null default '[]'::jsonb,  -- newest last: [{ from, from_self, at, text }]
  summary             text not null default '',
  reply_draft         text not null default '',
  synced_at           timestamptz not null default now()
);
create index upwork_rooms_last_idx on public.upwork_rooms (last_message_at desc nulls last);

create table public.upwork_actions (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('profile_update', 'message')),
  action      text not null,                     -- update_profile action (update_title, …) or 'send'
  params      jsonb not null default '{}'::jsonb, -- exactly what is sent to Upwork
  label       text not null default '',          -- one line for the admin, e.g. "Upwork title"
  reason      text not null default '',          -- why the Profile sync agent proposed it
  current     text not null default '',          -- what Upwork has now (for the side-by-side view)
  preview     jsonb,                             -- what Upwork's preview returned
  preview_id  text,
  status      text not null default 'draft'
              check (status in ('draft', 'previewing', 'preview_ready', 'confirming', 'done', 'error', 'cancelled')),
  error       text,
  result      jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index upwork_actions_status_idx on public.upwork_actions (status, created_at desc);
create trigger upwork_actions_touch before update on public.upwork_actions for each row execute function private.touch_updated_at();

alter table public.upwork_snapshots enable row level security;
alter table public.upwork_rooms enable row level security;
alter table public.upwork_actions enable row level security;
grant select, insert, update, delete on public.upwork_snapshots, public.upwork_rooms, public.upwork_actions to authenticated;

create policy "admin manages" on public.upwork_snapshots for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker writes" on public.upwork_snapshots for all to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));
create policy "admin manages" on public.upwork_rooms for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker writes" on public.upwork_rooms for all to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));
create policy "admin manages" on public.upwork_actions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "worker writes" on public.upwork_actions for all to authenticated
  using ((select public.is_worker())) with check ((select public.is_worker()));
