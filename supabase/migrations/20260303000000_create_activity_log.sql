-- Activity log for structured event tracking (character generation, sessions, system events)
create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  session_id   text,
  request_id   text,
  scope        text not null check (scope in ('character', 'session', 'system')),
  event        text not null,
  level        text not null default 'info' check (level in ('info', 'warn', 'error')),
  data         jsonb,
  created_at   timestamptz not null default now()
);

-- Indexes for primary lookup patterns
create index idx_activity_log_character on public.activity_log (character_id, created_at desc) where character_id is not null;
create index idx_activity_log_session   on public.activity_log (session_id, created_at desc) where session_id is not null;
create index idx_activity_log_user      on public.activity_log (user_id, created_at desc);

-- RLS: users read own logs, edge functions insert via service role
alter table public.activity_log enable row level security;
create policy "Users can read own logs" on public.activity_log for select using (auth.uid() = user_id);
