import { clearSessionCookie } from './_auth.mjs'

export default async () =>
  Response.json(
    { ok: true },
    {
      headers: {
        'Set-Cookie': clearSessionCookie(),
      },
    },
  )
