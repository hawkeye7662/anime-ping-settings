import {
  getSupabaseConfig,
  isAuthenticated,
  unauthorizedResponse,
} from './_auth.mjs'
import { KNOWN_USERS } from './_known-users.mjs'

const SETTINGS_TABLE = 'discord_notification_settings'

function normalizeThreshold(value) {
  if (value == null || value === '') {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Thresholds must be null or a non-negative integer.')
  }

  return parsed
}

function normalizeSettingRow(row) {
  return {
    username: row.username,
    discord_id: row.discordId,
    ping_summary: Boolean(row.pingSummary),
    ping_release: Boolean(row.pingRelease),
    max_summary_ping_behind_episodes: normalizeThreshold(
      row.maxSummaryPingBehindEpisodes,
    ),
    max_release_ping_behind_episodes: normalizeThreshold(
      row.maxReleasePingBehindEpisodes,
    ),
    updated_at: new Date().toISOString(),
  }
}

async function supabaseRequest(path, init = {}) {
  const { url, secretKey } = getSupabaseConfig()

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(
      `Supabase request failed: ${response.status} ${response.statusText}`,
    )
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

function mergeSettingsRows(rows) {
  const rowsByDiscordId = new Map(rows.map((row) => [row.discord_id, row]))

  return KNOWN_USERS.map((user) => {
    const row = rowsByDiscordId.get(user.discordId)

    return {
      username: user.username,
      discordId: user.discordId,
      pingSummary: row?.ping_summary ?? user.defaults.pingSummary,
      pingRelease: row?.ping_release ?? user.defaults.pingRelease,
      maxSummaryPingBehindEpisodes:
        row?.max_summary_ping_behind_episodes ??
        user.defaults.maxSummaryPingBehindEpisodes,
      maxReleasePingBehindEpisodes:
        row?.max_release_ping_behind_episodes ??
        user.defaults.maxReleasePingBehindEpisodes,
    }
  })
}

export default async (request) => {
  if (!isAuthenticated(request)) {
    return unauthorizedResponse()
  }

  if (request.method === 'GET') {
    const rows =
      (await supabaseRequest(
        `/rest/v1/${SETTINGS_TABLE}?select=discord_id,ping_summary,ping_release,max_summary_ping_behind_episodes,max_release_ping_behind_episodes`,
      )) ?? []

    return Response.json({ users: mergeSettingsRows(rows) })
  }

  if (request.method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!Array.isArray(body.users)) {
      return Response.json({ error: 'Expected a users array.' }, { status: 400 })
    }

    try {
      const payload = body.users.map(normalizeSettingRow)
      await supabaseRequest(`/rest/v1/${SETTINGS_TABLE}`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      return Response.json(
        { error: error.message || 'Failed to save settings.' },
        { status: 400 },
      )
    }

    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 })
}
