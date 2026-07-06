export default async () => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabasePublishableKey) {
    return Response.json(
      { error: 'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY' },
      { status: 500 },
    )
  }

  return Response.json({
    supabaseUrl,
    supabasePublishableKey,
  })
}
