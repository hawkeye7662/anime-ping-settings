import { isAuthenticated } from './_auth.mjs'

export default async (request) =>
  Response.json({
    authenticated: isAuthenticated(request),
  })
