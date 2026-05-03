import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedOrigins = [
  'https://app.hubbing.ch',
  'https://www.hubbing.ch',
  'https://hubbing.ch',
  'http://localhost:3000',
  'http://localhost:5173',
]

const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] ?? char))

const cleanLine = (value = '') => escapeHtml(String(value ?? '').replace(/[\r\n]+/g, ' ').trim()).slice(0, 300)

const truncateId = (value = '') => {
  const text = String(value || '')
  if (text.length <= 12) return text
  return `${text.slice(0, 6)}...${text.slice(-4)}`
}

const formatSwissTime = () =>
  new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

const makeMessage = (payload: Record<string, unknown>) => {
  const type = String(payload.type || 'visit')
  const details = (payload.details || {}) as Record<string, unknown>
  const hostname = cleanLine(String(payload.hostname || 'hubbing.ch'))
  const path = cleanLine(String(payload.path || '/'))
  const language = cleanLine(String(payload.language || ''))
  const visitorId = cleanLine(truncateId(String(payload.visitorId || 'unknown')))
  const time = formatSwissTime()

  if (type === 'login') {
    const company = cleanLine(String(details.company || 'Entreprise non renseignee'))
    const plan = cleanLine(String(details.plan || 'Starter'))
    const city = cleanLine(String(details.city || 'Non renseignee'))
    const email = cleanLine(String(details.email || 'Non renseigne'))

    return [
      '✅ <b>Connexion entreprise Hubbing</b>',
      '',
      `<b>Entreprise :</b> ${company}`,
      `<b>Plan :</b> ${plan}`,
      `<b>Ville :</b> ${city}`,
      `<b>Email :</b> ${email}`,
      `<b>Heure :</b> ${time}`,
    ].join('\n')
  }

  return [
    '👀 <b>Nouvelle visite Hubbing</b>',
    '',
    `<b>Site :</b> ${hostname}`,
    `<b>Page :</b> ${path}`,
    `<b>Langue :</b> ${language || 'Non renseignee'}`,
    `<b>Visiteur :</b> ${visitorId}`,
    `<b>Heure :</b> ${time}`,
  ].join('\n')
}

const sendTelegramMessage = async (text: string) => {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!token || !chatId) throw new Error('Missing Telegram configuration')

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || 'Telegram sending failed')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const origin = req.headers.get('origin') || ''
    if (origin && !allowedOrigins.includes(origin)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'origin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (Deno.env.get('TELEGRAM_ALERTS_ENABLED') === 'false') {
      return new Response(JSON.stringify({ ok: true, skipped: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    await sendTelegramMessage(makeMessage(payload))

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Telegram alert error:', error)
    return new Response(JSON.stringify({
      error: 'Unable to send alert',
      details: cleanLine(error instanceof Error ? error.message : String(error)),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
