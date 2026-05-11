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

const enc = new TextEncoder()

const base64Url = (value: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof value === 'string'
    ? enc.encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const pemToArrayBuffer = (pem: string) => {
  const clean = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

const ecdsaSignatureToJose = (signature: ArrayBuffer) => {
  const bytes = new Uint8Array(signature)
  if (bytes.length === 64) return bytes

  if (bytes[0] !== 0x30) throw new Error('Unexpected APNs signature format')
  let offset = 2
  if (bytes[1] & 0x80) offset = 2 + (bytes[1] & 0x7f)

  if (bytes[offset] !== 0x02) throw new Error('Unexpected APNs signature format')
  const rLength = bytes[offset + 1]
  const r = bytes.slice(offset + 2, offset + 2 + rLength)
  offset += 2 + rLength

  if (bytes[offset] !== 0x02) throw new Error('Unexpected APNs signature format')
  const sLength = bytes[offset + 1]
  const s = bytes.slice(offset + 2, offset + 2 + sLength)

  const normalize = (value: Uint8Array) => {
    const out = new Uint8Array(32)
    const trimmed = value.length > 32 ? value.slice(value.length - 32) : value
    out.set(trimmed, 32 - trimmed.length)
    return out
  }

  const result = new Uint8Array(64)
  result.set(normalize(r), 0)
  result.set(normalize(s), 32)
  return result
}

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

async function restGet(path: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service configuration')

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })
  if (!response.ok) throw new Error(await response.text())
  return await response.json()
}

async function restPatch(path: string, body: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service configuration')

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

async function buildApnsJwt() {
  const teamId = Deno.env.get('APNS_TEAM_ID')
  const keyId = Deno.env.get('APNS_KEY_ID')
  const privateKey = Deno.env.get('APNS_PRIVATE_KEY')
  if (!teamId || !keyId || !privateKey) throw new Error('Missing APNs configuration')

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const header = base64Url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const claims = base64Url(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }))
  const signingInput = `${header}.${claims}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(signingInput),
  )

  return `${signingInput}.${base64Url(ecdsaSignatureToJose(signature))}`
}

async function sendApns(token: string, payload: Record<string, unknown>, jwt: string) {
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') || 'ch.hubbing.app'
  const environment = (Deno.env.get('APNS_ENVIRONMENT') || 'production').toLowerCase()
  const host = environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'

  return await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const caller = await getUser(authHeader)
    if (!caller?.id) return json({ error: 'Unauthorized' }, 401)

    const { notificationId } = await req.json()
    if (!notificationId) return json({ error: 'Missing notificationId' }, 400)

    const notifications = await restGet(`notifications?id=eq.${encodeURIComponent(notificationId)}&select=id,user_id,type,match_id`)
    const notification = notifications?.[0]
    if (!notification?.user_id || !notification?.match_id) return json({ error: 'Notification not found' }, 404)
    if (!['new_message', 'new_match'].includes(notification.type)) return json({ ok: true, skipped: 'unsupported_type' })

    const matches = await restGet(`matches?id=eq.${encodeURIComponent(notification.match_id)}&select=id,company_a,company_b`)
    const match = matches?.[0]
    if (!match?.company_a || !match?.company_b) return json({ error: 'Match not found' }, 404)

    const companies = await restGet(`companies?id=in.(${encodeURIComponent(match.company_a)},${encodeURIComponent(match.company_b)})&select=id,user_id,name,notif_app`)
    const callerCompany = companies.find((company: Record<string, unknown>) => company.user_id === caller.id)
    const recipientCompany = companies.find((company: Record<string, unknown>) => company.user_id === notification.user_id)
    if (!callerCompany || !recipientCompany) return json({ error: 'Forbidden' }, 403)
    if (recipientCompany.notif_app === false) return json({ ok: true, skipped: 'disabled_by_user' })

    const senderName = String(callerCompany.name || 'Une entreprise')
    const title = notification.type === 'new_match'
      ? 'Nouveau match Hubbing'
      : 'Nouveau message Hubbing'
    const body = notification.type === 'new_match'
      ? `${senderName} vient de matcher avec votre entreprise.`
      : `${senderName} vous a envoyé un message.`

    const unreadRows = await restGet(`notifications?user_id=eq.${encodeURIComponent(notification.user_id)}&type=in.(new_message,new_match)&read=eq.false&select=id`)
    const badge = unreadRows?.length || 1
    const tokens = await restGet(`push_device_tokens?user_id=eq.${encodeURIComponent(notification.user_id)}&enabled=eq.true&select=id,token`)
    if (!tokens?.length) return json({ ok: true, sent: 0, skipped: 'no_tokens' })

    const jwt = await buildApnsJwt()
    let sent = 0

    for (const device of tokens) {
      const response = await sendApns(String(device.token), {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge,
        },
        type: notification.type,
        matchId: notification.match_id,
      }, jwt)

      if (response.ok) {
        sent += 1
        continue
      }

      if ([400, 410].includes(response.status)) {
        await restPatch(`push_device_tokens?id=eq.${encodeURIComponent(device.id)}`, {
          enabled: false,
          updated_at: new Date().toISOString(),
        })
      }
    }

    return json({ ok: true, sent })
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500)
  }
})
