import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { priceId, userId, planName, founder } = await req.json()
    const hasFounderTrial = planName === 'premium' && founder === true

    const sessionConfig: any = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `https://app.hubbing.ch/?payment=success&plan=${planName}`,
      cancel_url: `https://app.hubbing.ch/?payment=cancel`,
      metadata: { userId, planName, founder: String(hasFounderTrial) },
      subscription_data: {
        metadata: { userId, planName, founder: String(hasFounderTrial) },
        ...(hasFounderTrial ? { trial_period_days: 60 } : {}),
      },
    }
    if (hasFounderTrial) sessionConfig.payment_method_collection = 'always'

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
