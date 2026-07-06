import { compareCredentials, createSessionCookie } from './_auth.mjs'

export default async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!compareCredentials(username, password)) {
    return Response.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  return Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': createSessionCookie(),
      },
    },
  )
}
