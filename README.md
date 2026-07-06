# anime-ping-settings

Discord-authenticated settings page for the `todays-anime` notifier.

## Stack

- Netlify static site
- Netlify Function for public config
- Supabase Auth with Discord OAuth
- Supabase Postgres + RLS for per-user settings

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. In **Authentication > Providers**, enable **Discord**.
4. Add your Discord OAuth client ID and secret.
5. Add your site URL to the allowed redirect URLs, for example:
   - `https://your-site.netlify.app`
   - `http://localhost:8888`

## Discord OAuth setup

In the Discord developer portal:

1. Create an application.
2. Under **OAuth2**, add redirect URLs for your Netlify site and local dev.
3. Use the Supabase callback URL documented in the Supabase Discord provider settings.

## Netlify environment variables

Set these in Netlify:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

The app uses a small Netlify Function to expose these public values to the browser.

## Local development

If you use the Netlify CLI:

```bash
netlify dev
```

The site expects:

- `/.netlify/functions/config`
- Discord OAuth configured in Supabase

## Notifier integration

The `todays-anime` script can fetch rows from `public.discord_notification_settings`
using a Supabase secret key and match them by `discord_id`.

Add these GitHub repository secrets in `todays-anime`:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

The secret key is only used in GitHub Actions to read settings for all users.
# anime-ping-settings
