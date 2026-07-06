create table if not exists public.discord_notification_settings (
  discord_id text primary key,
  username text not null,
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
