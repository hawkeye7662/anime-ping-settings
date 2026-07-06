import { createHmac, timingSafeEqual } from 'node:crypto'

const SESSION_COOKIE_NAME = 'anime_ping_admin_session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function getRequiredEnv(name) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function signValue(value, secret) {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {}
  }

  return Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const [name, ...rest] = part.trim().split('=')
      return [name, decodeURIComponent(rest.join('='))]
    }),
  )
}

function getSessionCookieValue(username, expiresAt, secret) {
  const payload = `${username}.${expiresAt}`
  return `${payload}.${signValue(payload, secret)}`
}

export function createSessionCookie() {
  const username = getRequiredEnv('ADMIN_USERNAME')
  const secret = getRequiredEnv('ADMIN_SESSION_SECRET')
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  const value = getSessionCookieValue(username, expiresAt, secret)

  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export function isAuthenticated(request) {
  try {
    const cookies = parseCookies(request.headers.get('cookie'))
    const cookie = cookies[SESSION_COOKIE_NAME]
    if (!cookie) {
      return false
    }

    const [username, expiresAt, signature] = cookie.split('.')
    if (!username || !expiresAt || !signature) {
      return false
    }

    if (username !== getRequiredEnv('ADMIN_USERNAME')) {
      return false
    }

    if (Number.parseInt(expiresAt, 10) < Math.floor(Date.now() / 1000)) {
      return false
    }

    const expectedSignature = signValue(
      `${username}.${expiresAt}`,
      getRequiredEnv('ADMIN_SESSION_SECRET'),
    )

    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    )
  } catch {
    return false
  }
}

export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export function compareCredentials(username, password) {
  const expectedUsername = getRequiredEnv('ADMIN_USERNAME')
  const expectedPassword = getRequiredEnv('ADMIN_PASSWORD')

  return username === expectedUsername && password === expectedPassword
}

export function getSupabaseConfig() {
  return {
    url: getRequiredEnv('SUPABASE_URL'),
    secretKey: getRequiredEnv('SUPABASE_SECRET_KEY'),
  }
}
