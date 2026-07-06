# anime-ping-settings

Admin-only settings page for the `todays-anime` notifier.

## Stack

- Netlify static site
- Netlify Functions for admin auth and settings API
- Supabase Postgres for the user registry and persisted settings

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.

## Netlify environment variables

Set these in Netlify:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

`ADMIN_SESSION_SECRET` should be a long random string.

## Local development

If you use the Netlify CLI:

```bash
netlify dev
```

The site expects the Netlify Functions to be available locally.

## Notifier integration

The `todays-anime` script fetches rows from `public.discord_notification_settings`
using a Supabase secret key and uses the database as the source of truth for:

- MAL username
- Discord ID
- display name
- ping preferences
- behind thresholds

Add these GitHub repository secrets in `todays-anime`:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

The secret key is only used in GitHub Actions to read settings for all users.

## Privacy model

- Friends do not log in.
- Friends do not authenticate with Discord, email, or Supabase.
- Only the admin uses this site.
- The site stores only the user registry and notification settings you enter manually.
