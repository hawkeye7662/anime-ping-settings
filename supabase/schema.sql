do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discord_notification_settings'
      and column_name = 'username'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discord_notification_settings'
      and column_name = 'mal_username'
  ) then
    execute 'alter table public.discord_notification_settings rename column username to mal_username';
  end if;
end
$$;

create table if not exists public.discord_notification_settings (
  discord_id text primary key,
  mal_username text not null unique,
  display_name text not null,
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

alter table public.discord_notification_settings
  add column if not exists mal_username text;

alter table public.discord_notification_settings
  add column if not exists display_name text;

update public.discord_notification_settings
set
  mal_username = coalesce(mal_username, discord_id),
  display_name = coalesce(display_name, mal_username, discord_id)
where
  mal_username is null
  or display_name is null;

alter table public.discord_notification_settings
  alter column mal_username set not null;

alter table public.discord_notification_settings
  alter column display_name set not null;

create unique index if not exists discord_notification_settings_mal_username_key
  on public.discord_notification_settings (mal_username);
