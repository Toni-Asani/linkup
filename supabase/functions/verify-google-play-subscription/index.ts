import { syncGooglePlaySubscription } from '../_shared/google-play.ts'

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

const getCurrentUser = async (authorization: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase environment')

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  })
  if (!response.ok) return null
  return await response.json()
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authorization = req.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const user = await getCurrentUser(authorization)
    if (!user?.id) return json({ error: 'Unauthorized' }, 401)

    const payload = await req.json()
    const purchaseToken = String(payload?.purchaseToken || '').trim()
    const productId = String(payload?.productId || '').trim()
    if (!purchaseToken || !productId) {
      return json({ error: 'Missing purchaseToken or productId' }, 400)
    }

    const subscription = await syncGooglePlaySubscription({
      purchaseToken,
      userId: user.id,
      expectedProductId: productId,
    })
    if (!subscription.entitled) {
      return json({ error: 'Google Play subscription is not active', subscription }, 409)
    }

    return json({ ok: true, subscription })
  } catch (error) {
    console.error('Google Play verification failed', error)
    return json({ error: error instanceof Error ? error.message : 'Verification failed' }, 400)
  }
})
