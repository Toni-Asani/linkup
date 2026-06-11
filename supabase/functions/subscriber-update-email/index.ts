import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const appUrl = 'https://app.hubbing.ch'
const siteUrl = 'https://www.hubbing.ch'

const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] ?? char))

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const env = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase environment')
  return { supabaseUrl, serviceRoleKey }
}

const serviceHeaders = () => {
  const { serviceRoleKey } = env()
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

const restUrl = (table: string, params: Record<string, string>) => {
  const { supabaseUrl } = env()
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

const readRows = async <T>(table: string, params: Record<string, string>) => {
  const response = await fetch(restUrl(table, params), { headers: serviceHeaders() })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T[]
}

const listAuthUsers = async () => {
  const { supabaseUrl, serviceRoleKey } = env()
  const users: Array<{ id?: string; email?: string }> = []
  let page = 1

  while (page <= 20) {
    const url = new URL(`${supabaseUrl}/auth/v1/admin/users`)
    url.searchParams.set('page', String(page))
    url.searchParams.set('per_page', '1000')
    const response = await fetch(url.toString(), {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    })
    if (!response.ok) throw new Error(await response.text())

    const payload = await response.json()
    const batch = Array.isArray(payload?.users) ? payload.users : []
    users.push(...batch)
    if (batch.length < 1000) break
    page += 1
  }

  return users
}

const sendEmail = async (payload: Record<string, unknown>) => {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('Missing RESEND_API_KEY')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(await response.text())
}

const emailShell = (content: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:580px;margin:32px auto;background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#E24B4A;padding:32px 28px;text-align:center;">
      <img src="${siteUrl}/LOGO-HUBBING-ICON.svg" width="72" height="72" style="border-radius:50%;margin-bottom:14px;" alt="Hubbing" />
      <h1 style="color:white;margin:0;font-size:28px;font-weight:800;">hubbing</h1>
      <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Le reseau B2B pour les entreprises suisses</p>
    </div>
    <div style="padding:34px 28px;">
      ${content}
    </div>
    <div style="background:#f9f9f9;padding:22px 28px;border-top:1px solid #f0f0f0;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">L'equipe Hubbing</p>
      <a href="mailto:contact@hubbing.ch" style="color:#E24B4A;font-size:13px;text-decoration:none;">contact@hubbing.ch</a>
      <p style="margin:14px 0 0;font-size:11px;color:#aaa;">Vous recevez ce message car les notifications email sont activees sur votre compte Hubbing.</p>
    </div>
  </div>
</body>
</html>`

const defaultBullets = [
  'Nouvelles notifications d’opportunités quand une entreprise publie un besoin compatible avec vos services.',
  'Affichage des besoins clôturés, photos avant/après et collaborations réussies sur les profils.',
  'Améliorations des réalisations, du cloud privé et des notifications.',
]

const buildEmailHtml = (body: Record<string, unknown>) => {
  const title = String(body.title || 'Nouvelle version Hubbing disponible')
  const intro = String(body.intro || 'Une nouvelle mise a jour Hubbing est disponible avec des ameliorations pour mieux trouver des opportunites B2B, presenter vos realisations et suivre vos collaborations.')
  const bullets = Array.isArray(body.bullets) && body.bullets.length
    ? body.bullets.map(item => String(item))
    : defaultBullets
  const ctaLabel = String(body.ctaLabel || 'Ouvrir Hubbing')
  const ctaUrl = String(body.ctaUrl || appUrl)

  return emailShell(`
    <h2 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#1a1a1a">${escapeHtml(title)}</h2>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 18px">${escapeHtml(intro)}</p>
    <ul style="padding-left:20px;margin:0 0 22px;color:#444;font-size:15px;line-height:1.7">
      ${bullets.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
    <p style="font-size:14px;line-height:1.65;color:#666;margin:0 0 20px">
      Pour profiter des dernieres nouveautes sur mobile, verifiez que vous avez installe la derniere version depuis l'App Store ou Google Play.
    </p>
    <div style="text-align:center;margin:26px 0 8px">
      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#E24B4A;color:white;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;">
        ${escapeHtml(ctaLabel)}
      </a>
    </div>
  `)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const adminSecret = Deno.env.get('SUBSCRIBER_UPDATE_EMAIL_SECRET') || Deno.env.get('LAUNCH_EMAIL_SECRET')
    if (!adminSecret || body.adminSecret !== adminSecret) return json({ error: 'Unauthorized' }, 401)

    const dryRun = body.dryRun !== false
    const subject = String(body.subject || 'Nouvelle version Hubbing disponible')
    const audience = String(body.audience || 'all')

    const companies = await readRows<Record<string, unknown>>('companies', {
      select: 'id,user_id,name,notif_email,is_suspended',
      user_id: 'not.is.null',
      is_suspended: 'eq.false',
      limit: '5000',
    })
    const emailEnabledCompanies = companies.filter(company => company.notif_email !== false)
    const userIds = [...new Set(emailEnabledCompanies.map(company => String(company.user_id || '')).filter(Boolean))]

    let filteredUserIds = userIds
    if (audience === 'paid') {
      const subscriptions = userIds.length > 0
        ? await readRows<Record<string, unknown>>('subscriptions', {
          select: 'user_id,plan,status',
          user_id: `in.(${userIds.join(',')})`,
        })
        : []
      const paidUsers = new Set(subscriptions
        .filter(subscription => ['basic', 'premium'].includes(String(subscription.plan || '').toLowerCase()))
        .filter(subscription => ['active', 'trialing'].includes(String(subscription.status || 'active').toLowerCase()))
        .map(subscription => String(subscription.user_id || '')))
      filteredUserIds = userIds.filter(userId => paidUsers.has(userId))
    }

    const users = await listAuthUsers()
    const emailsByUserId = new Map(users.map(user => [String(user.id || ''), String(user.email || '').trim().toLowerCase()]))
    const recipients = [...new Set(filteredUserIds
      .map(userId => emailsByUserId.get(userId))
      .filter((email): email is string => Boolean(email && email.includes('@'))))]

    if (dryRun) return json({ ok: true, dryRun: true, audience, count: recipients.length })

    const html = buildEmailHtml(body)
    const failed: string[] = []

    for (const recipient of recipients) {
      try {
        await sendEmail({
          from: 'Hubbing <contact@hubbing.ch>',
          to: [recipient],
          reply_to: 'contact@hubbing.ch',
          subject,
          html,
        })
      } catch (_) {
        failed.push(recipient)
      }
    }

    await sendEmail({
      from: 'Hubbing <contact@hubbing.ch>',
      to: ['contact@hubbing.ch'],
      subject: `Envoi mise a jour Hubbing - ${recipients.length - failed.length}/${recipients.length}`,
      html: `<p>Email de mise a jour envoye.</p><p>Audience : <strong>${escapeHtml(audience)}</strong></p><p>Envoyes : <strong>${recipients.length - failed.length}</strong></p><p>Echecs : <strong>${failed.length}</strong></p>`,
    })

    return json({ ok: true, audience, count: recipients.length, sent: recipients.length - failed.length, failed: failed.length })
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500)
  }
})
