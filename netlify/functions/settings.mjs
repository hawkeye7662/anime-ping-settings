import {
  getSupabaseConfig,
  isAuthenticated,
  unauthorizedResponse,
} from './_auth.mjs'

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
  if (!row.malUsername || !row.discordId || !row.displayName) {
    throw new Error('Each user needs a MAL username, Discord ID, and display name.')
  }

  return {
    mal_username: row.malUsername,
    discord_id: row.discordId,
    display_name: row.displayName,
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

function mapSettingsRows(rows) {
  return rows.map((row) => ({
    malUsername: row.mal_username ?? row.username,
    discordId: row.discord_id,
    displayName: row.display_name ?? row.mal_username ?? row.username,
    pingSummary: row.ping_summary,
    pingRelease: row.ping_release,
    maxSummaryPingBehindEpisodes: row.max_summary_ping_behind_episodes,
    maxReleasePingBehindEpisodes: row.max_release_ping_behind_episodes,
  }))
}

export default async (request) => {
  if (!isAuthenticated(request)) {
    return unauthorizedResponse()
  }

  if (request.method === 'GET') {
    const rows =
      (await supabaseRequest(
        `/rest/v1/${SETTINGS_TABLE}?select=mal_username,username,discord_id,display_name,ping_summary,ping_release,max_summary_ping_behind_episodes,max_release_ping_behind_episodes&order=mal_username.asc.nullslast,username.asc.nullslast`,
      )) ?? []

    return Response.json({ users: mapSettingsRows(rows) })
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
      const existingRows =
        (await supabaseRequest(
          `/rest/v1/${SETTINGS_TABLE}?select=discord_id`,
        )) ?? []
      await supabaseRequest(`/rest/v1/${SETTINGS_TABLE}`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      })

      const retainedDiscordIds = new Set(payload.map((row) => row.discord_id))
      const removedDiscordIds = existingRows
        .map((row) => row.discord_id)
        .filter((discordId) => !retainedDiscordIds.has(discordId))

      if (removedDiscordIds.length) {
        const clauses = removedDiscordIds
          .map((discordId) => `discord_id.eq.${encodeURIComponent(discordId)}`)
          .join(',')

        await supabaseRequest(`/rest/v1/${SETTINGS_TABLE}?or=(${clauses})`, {
          method: 'DELETE',
        })
      }
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
