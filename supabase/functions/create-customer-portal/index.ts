import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getCurrentUser = async (authorization: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase environment')

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  })

  if (!response.ok) return null
  return await response.json()
}

const safeReturnUrl = (value?: string) => {
  try {
    const url = new URL(value || '')
    const allowedHosts = new Set(['app.hubbing.ch', 'www.hubbing.ch', 'localhost', '127.0.0.1'])
    if (allowedHosts.has(url.hostname)) return url.toString()
  } catch {
    // fall through
  }
  return 'https://app.hubbing.ch/'
}

const customerIdFromSubscription = (subscription: any) => {
  const customer = subscription.customer
  return typeof customer === 'string' ? customer : customer?.id
}

const findCustomerByUser = async (user: { id: string; email?: string }) => {
  try {
    const results = await stripe.subscriptions.search({
      query: `metadata['userId']:'${user.id}'`,
      limit: 1,
    })
    const subscription = results.data[0]
    const customerId = subscription ? customerIdFromSubscription(subscription) : null
    if (customerId) return customerId
  } catch (error) {
    console.warn('Stripe subscription search failed:', error)
  }

  if (!user.email) return null
  const customers = await stripe.customers.list({ email: user.email, limit: 5 })
  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 5,
    })
    const hasSubscription = subscriptions.data.some(subscription =>
      ['active', 'trialing', 'past_due', 'unpaid'].includes(subscription.status)
    )
    if (hasSubscription) return customer.id
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authorization = req.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const user = await getCurrentUser(authorization)
    if (!user?.id) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const customerId = await findCustomerByUser({ id: user.id, email: user.email })
    if (!customerId) {
      return jsonResponse({ error: 'no_stripe_subscription' }, 404)
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: safeReturnUrl(body?.returnUrl),
    })

    return jsonResponse({ url: session.url })
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : String(error),
    }, 400)
  }
})
