const elements = {
  authStatus: document.querySelector('#auth-status'),
  loginForm: document.querySelector('#login-form'),
  username: document.querySelector('#username'),
  password: document.querySelector('#password'),
  loginButton: document.querySelector('#login-button'),
  logoutButton: document.querySelector('#logout-button'),
  settingsCard: document.querySelector('#settings-card'),
  settingsForm: document.querySelector('#settings-form'),
  userSettingsList: document.querySelector('#user-settings-list'),
  saveButton: document.querySelector('#save-button'),
  saveStatus: document.querySelector('#save-status'),
}

let currentUsers = []

function setAuthStatus(message) {
  elements.authStatus.textContent = message
}

function setSaveStatus(message, isError = false) {
  elements.saveStatus.textContent = message
  elements.saveStatus.style.color = isError ? '#fca5a5' : '#cbd5e1'
}

function normalizeThresholdInput(value) {
  if (value === '') {
    return null
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function setControlsEnabled(enabled) {
  for (const element of [
    elements.username,
    elements.password,
    elements.loginButton,
    elements.logoutButton,
    elements.saveButton,
  ]) {
    element.disabled = !enabled
  }

  for (const input of elements.userSettingsList.querySelectorAll('input')) {
    input.disabled = !enabled
  }
}

function renderUsers(users) {
  currentUsers = users
  elements.userSettingsList.innerHTML = users
    .map(
      (user, index) => `
        <section class="user-card">
          <h3>${user.username}</h3>
          <p class="user-meta">Discord ID: ${user.discordId}</p>

          <div class="setting-block">
            <div class="setting-header">
              <h3>Today’s Anime</h3>
              <label class="toggle">
                <input data-index="${index}" data-field="pingSummary" type="checkbox" ${user.pingSummary ? 'checked' : ''} />
                <span>Ping for morning summary</span>
              </label>
            </div>
            <label class="field">
              <span>Maximum episodes behind for summary pings</span>
              <input
                data-index="${index}"
                data-field="maxSummaryPingBehindEpisodes"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                placeholder="Always ping"
                value="${user.maxSummaryPingBehindEpisodes ?? ''}"
              />
            </label>
          </div>

          <div class="setting-block">
            <div class="setting-header">
              <h3>Episode Out Now</h3>
              <label class="toggle">
                <input data-index="${index}" data-field="pingRelease" type="checkbox" ${user.pingRelease ? 'checked' : ''} />
                <span>Ping for release alerts</span>
              </label>
            </div>
            <label class="field">
              <span>Maximum episodes behind for release pings</span>
              <input
                data-index="${index}"
                data-field="maxReleasePingBehindEpisodes"
                type="number"
                min="0"
                step="1"
                inputmode="numeric"
                placeholder="Always ping"
                value="${user.maxReleasePingBehindEpisodes ?? ''}"
              />
            </label>
          </div>
        </section>
      `,
    )
    .join('')
}

function collectUsersFromForm() {
  const users = structuredClone(currentUsers)

  for (const input of elements.userSettingsList.querySelectorAll('input')) {
    const index = Number.parseInt(input.dataset.index, 10)
    const field = input.dataset.field

    if (input.type === 'checkbox') {
      users[index][field] = input.checked
    } else {
      users[index][field] = normalizeThresholdInput(input.value)
    }
  }

  return users
}

async function fetchJson(path, init = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    ...init,
  })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.')
  }

  return data
}

async function saveSettings(event) {
  event.preventDefault()

  elements.saveButton.disabled = true
  setSaveStatus('Saving…')

  try {
    const users = collectUsersFromForm()
    await fetchJson('/.netlify/functions/settings', {
      method: 'POST',
      body: JSON.stringify({ users }),
    })
    currentUsers = users
    setSaveStatus('Saved.')
  } catch (error) {
    setSaveStatus(error.message || 'Failed to save settings.', true)
  } finally {
    elements.saveButton.disabled = false
  }
}

async function signIn(event) {
  event.preventDefault()
  elements.loginButton.disabled = true
  setAuthStatus('Signing in…')

  try {
    await fetchJson('/.netlify/functions/login', {
      method: 'POST',
      body: JSON.stringify({
        username: elements.username.value,
        password: elements.password.value,
      }),
    })
    elements.password.value = ''
    await refreshSession()
  } catch (error) {
    setAuthStatus(error.message || 'Failed to sign in.')
    elements.loginButton.disabled = false
  }
}

async function signOut() {
  await fetchJson('/.netlify/functions/logout', { method: 'POST' })
  elements.settingsCard.hidden = true
  elements.logoutButton.hidden = true
  elements.loginButton.disabled = false
  setAuthStatus('Signed out.')
}

async function refreshSession() {
  const session = await fetchJson('/.netlify/functions/session')

  if (!session.authenticated) {
    elements.settingsCard.hidden = true
    elements.logoutButton.hidden = true
    setAuthStatus('Not signed in.')
    return
  }

  const settings = await fetchJson('/.netlify/functions/settings')

  elements.logoutButton.hidden = false
  elements.settingsCard.hidden = false
  setControlsEnabled(true)
  renderUsers(settings.users)
  setAuthStatus('Signed in as admin.')
  setSaveStatus('')
}

async function init() {
  elements.loginForm.addEventListener('submit', signIn)
  elements.logoutButton.addEventListener('click', signOut)
  elements.settingsForm.addEventListener('submit', saveSettings)

  await refreshSession()
}

init().catch((error) => {
  setAuthStatus(error.message || 'Failed to load app.')
  setSaveStatus('Check your Netlify admin env vars and Supabase setup.', true)
  setControlsEnabled(false)
})
