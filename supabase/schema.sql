create table if not exists public.discord_notification_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  discord_username text not null,
  ping_summary boolean not null default true,
  ping_release boolean not null default true,
  max_summary_ping_behind_episodes integer,
  max_release_ping_behind_episodes integer,
  updated_at timestamptz not null default now(),
  constraint max_summary_ping_behind_episodes_nonnegative
    check (
      max_summary_ping_behind_episodes is null
      or max_summary_ping_behind_episodes >= 0
    ),
  constraint max_release_ping_behind_episodes_nonnegative
    check (
      max_release_ping_behind_episodes is null
      or max_release_ping_behind_episodes >= 0
    )
);

alter table public.discord_notification_settings enable row level security;

create policy "Users can view their own notification settings"
  on public.discord_notification_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own notification settings"
  on public.discord_notification_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own notification settings"
  on public.discord_notification_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
