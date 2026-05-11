import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function getUser(authHeader: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey || !authHeader) return null

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authHeader,
    },
  })
  if (!response.ok) return null
  return await response.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const user = await getUser(authHeader)
    if (!user?.id) return json({ error: 'Unauthorized' }, 401)

    const { token, platform = 'ios' } = await req.json()
    const cleanToken = String(token || '').trim()
    if (!cleanToken) return json({ error: 'Missing token' }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service configuration')

    const now = new Date().toISOString()
    const response = await fetch(`${supabaseUrl}/rest/v1/push_device_tokens?on_conflict=token`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: user.id,
        token: cleanToken,
        platform: String(platform || 'ios'),
        enabled: true,
        last_seen_at: now,
        updated_at: now,
      }),
    })

    if (!response.ok) {
      const details = await response.text()
      throw new Error(details || 'Unable to register push token')
    }

    return json({ ok: true })
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500)
  }
})
