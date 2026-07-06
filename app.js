import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SETTINGS_TABLE = 'discord_notification_settings'
const DEFAULT_SETTINGS = {
  pingSummary: true,
  pingRelease: true,
  maxSummaryPingBehindEpisodes: null,
  maxReleasePingBehindEpisodes: null,
}

const elements = {
  authStatus: document.querySelector('#auth-status'),
  loginButton: document.querySelector('#login-button'),
  logoutButton: document.querySelector('#logout-button'),
  settingsCard: document.querySelector('#settings-card'),
  settingsForm: document.querySelector('#settings-form'),
  pingSummary: document.querySelector('#ping-summary'),
  pingRelease: document.querySelector('#ping-release'),
  maxSummaryThreshold: document.querySelector('#max-summary-threshold'),
  maxReleaseThreshold: document.querySelector('#max-release-threshold'),
  saveButton: document.querySelector('#save-button'),
  saveStatus: document.querySelector('#save-status'),
}

let supabase
let currentUser

function setAuthStatus(message) {
  elements.authStatus.textContent = message
}

function setSaveStatus(message, isError = false) {
  elements.saveStatus.textContent = message
  elements.saveStatus.style.color = isError ? '#fca5a5' : '#cbd5e1'
}

function getStoredDiscordToken() {
  return window.localStorage.getItem('discord_provider_token')
}

function storeDiscordToken(session) {
  if (session?.provider_token) {
    window.localStorage.setItem('discord_provider_token', session.provider_token)
  }
}

function clearStoredDiscordToken() {
  window.localStorage.removeItem('discord_provider_token')
}

function normalizeThresholdInput(value) {
  if (value === '') {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function setFormEnabled(enabled) {
  for (const element of [
    elements.pingSummary,
    elements.pingRelease,
    elements.maxSummaryThreshold,
    elements.maxReleaseThreshold,
    elements.saveButton,
  ]) {
    element.disabled = !enabled
  }
}

function renderSettings(settings) {
  elements.pingSummary.checked = settings.pingSummary
  elements.pingRelease.checked = settings.pingRelease
  elements.maxSummaryThreshold.value =
    settings.maxSummaryPingBehindEpisodes ?? ''
  elements.maxReleaseThreshold.value =
    settings.maxReleasePingBehindEpisodes ?? ''
}

async function fetchDiscordProfile(session, user) {
  const token = session?.provider_token ?? getStoredDiscordToken()
  if (token) {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
      const profile = await response.json()
      return {
        discordId: profile.id,
        discordUsername: profile.global_name || profile.username,
      }
    }
  }

  const identity = user.identities?.find((entry) => entry.provider === 'discord')
  const metadata = identity?.identity_data ?? user.user_metadata ?? {}

  return {
    discordId: metadata.provider_id ?? metadata.user_id ?? metadata.sub ?? null,
    discordUsername:
      metadata.full_name ??
      metadata.custom_claims?.global_name ??
      metadata.preferred_username ??
      metadata.user_name ??
      'Discord user',
  }
}

async function loadSettings(user) {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select(
      'ping_summary,ping_release,max_summary_ping_behind_episodes,max_release_ping_behind_episodes',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return { ...DEFAULT_SETTINGS }
  }

  return {
    pingSummary: data.ping_summary,
    pingRelease: data.ping_release,
    maxSummaryPingBehindEpisodes: data.max_summary_ping_behind_episodes,
    maxReleasePingBehindEpisodes: data.max_release_ping_behind_episodes,
  }
}

async function saveSettings(event) {
  event.preventDefault()

  if (!currentUser) {
    return
  }

  elements.saveButton.disabled = true
  setSaveStatus('Saving…')

  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const profile = await fetchDiscordProfile(sessionData.session, currentUser)

    if (!profile.discordId) {
      throw new Error(
        'Could not determine your Discord ID from the current session.',
      )
    }

    const payload = {
      user_id: currentUser.id,
      discord_id: profile.discordId,
      discord_username: profile.discordUsername,
      ping_summary: elements.pingSummary.checked,
      ping_release: elements.pingRelease.checked,
      max_summary_ping_behind_episodes: normalizeThresholdInput(
        elements.maxSummaryThreshold.value,
      ),
      max_release_ping_behind_episodes: normalizeThresholdInput(
        elements.maxReleaseThreshold.value,
      ),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from(SETTINGS_TABLE)
      .upsert(payload, { onConflict: 'user_id' })

    if (error) {
      throw error
    }

    setSaveStatus('Saved.')
  } catch (error) {
    setSaveStatus(error.message || 'Failed to save settings.', true)
  } finally {
    elements.saveButton.disabled = false
  }
}

async function signIn() {
  elements.loginButton.disabled = true
  setAuthStatus('Redirecting to Discord…')

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin,
        scopes: 'identify',
      },
    })

    if (error) {
      throw error
    }
  } catch (error) {
    setAuthStatus(error.message || 'Failed to start Discord sign-in.')
    elements.loginButton.disabled = false
  }
}

async function signOut() {
  await supabase.auth.signOut()
  clearStoredDiscordToken()
  currentUser = null
  elements.settingsCard.hidden = true
  elements.logoutButton.hidden = true
  elements.loginButton.hidden = false
  setAuthStatus('Signed out.')
}

async function refreshSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  currentUser = session?.user ?? null
  storeDiscordToken(session)

  if (!currentUser) {
    elements.settingsCard.hidden = true
    elements.logoutButton.hidden = true
    elements.loginButton.hidden = false
    setAuthStatus('Not signed in.')
    return
  }

  const profile = await fetchDiscordProfile(session, currentUser)
  const settings = await loadSettings(currentUser)

  elements.loginButton.hidden = true
  elements.logoutButton.hidden = false
  elements.settingsCard.hidden = false
  setFormEnabled(true)
  renderSettings(settings)
  setAuthStatus(
    `Signed in as ${profile.discordUsername}${profile.discordId ? ` (${profile.discordId})` : ''}`,
  )
  setSaveStatus('')
}

async function init() {
  const response = await fetch('/.netlify/functions/config')
  const config = await response.json()

  if (!response.ok) {
    throw new Error(config.error || 'Failed to load app config.')
  }

  supabase = createClient(config.supabaseUrl, config.supabasePublishableKey)

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      clearStoredDiscordToken()
    }

    storeDiscordToken(session)
  })

  elements.loginButton.addEventListener('click', signIn)
  elements.logoutButton.addEventListener('click', signOut)
  elements.settingsForm.addEventListener('submit', saveSettings)

  await refreshSession()
}

init().catch((error) => {
  setAuthStatus(error.message || 'Failed to load app.')
  setSaveStatus('Check your Netlify and Supabase configuration.', true)
  setFormEnabled(false)
})
