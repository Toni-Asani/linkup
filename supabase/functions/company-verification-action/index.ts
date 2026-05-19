import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const enc = new TextEncoder()

const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] ?? char))

const cleanHeader = (value = '') => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()

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

const signPayload = async (payload: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return base64Url(signature)
}

const safeCompare = (a: string | null, b: string | null) => {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const getSupabaseConfig = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const manualSecret = Deno.env.get('MANUAL_VERIFICATION_SECRET')
  if (!supabaseUrl || !serviceRoleKey || !manualSecret) {
    throw new Error('Missing verification configuration')
  }
  return { supabaseUrl, serviceRoleKey, manualSecret }
}

const restGet = async (path: string) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })
  if (!response.ok) throw new Error(await response.text())
  return await response.json()
}

const restPatch = async (path: string, body: Record<string, unknown>) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
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

const getUserEmail = async (userId: string) => {
  const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })
  if (!response.ok) return null
  const user = await response.json()
  return typeof user?.email === 'string' ? user.email : null
}

const hubbingSignatureHtml = `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:28px;background:#E24B4A;border-radius:16px;overflow:hidden">
  <tr>
    <td style="width:72px;padding:16px 0 16px 18px;vertical-align:middle">
      <span style="display:block;width:52px;height:52px;background:#ffffff;border-radius:14px;text-align:center">
        <img src="https://www.hubbing.ch/logo192.png" width="52" height="52" style="display:block;border-radius:14px" alt="Hubbing" />
      </span>
    </td>
    <td style="padding:16px 18px 16px 12px;vertical-align:middle;color:#ffffff">
      <p style="margin:0 0 3px;font-size:15px;font-weight:700;line-height:1.35;color:#ffffff">L'équipe Hubbing</p>
      <p style="margin:0 0 6px;font-size:13px;line-height:1.35;color:#ffffff">Réseau B2B pour entreprises suisses</p>
      <p style="margin:0;font-size:12px;line-height:1.45;color:#ffffff">
        <a href="mailto:contact@hubbing.ch" style="color:#ffffff;text-decoration:none">contact@hubbing.ch</a>
        <span style="opacity:0.75"> · </span>
        <a href="https://www.hubbing.ch" style="color:#ffffff;text-decoration:none">hubbing.ch</a>
      </p>
    </td>
  </tr>
</table>`

const sendApprovalEmail = async (email: string, companyName: string) => {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { sent: false, skipped: 'missing_resend_key' }

  const safeCompany = escapeHtml(companyName)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'Hubbing <contact@hubbing.ch>',
      to: [email],
      reply_to: 'contact@hubbing.ch',
      subject: `Hubbing - votre entreprise ${cleanHeader(companyName)} est validee`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
        <img src="https://www.hubbing.ch/logo192.png" width="64" height="64" style="border-radius:16px;display:block" alt="Hubbing" />
        <h2 style="font-size:24px;line-height:1.25;margin:22px 0 12px;color:#1a1a1a">Votre entreprise est validée</h2>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">Bonjour,</p>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
          Bonne nouvelle : votre entreprise <strong>${safeCompany}</strong> a été vérifiée avec succès à partir de son numéro IDE et des informations disponibles via Zefix.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
          Votre profil est désormais validé sur Hubbing. Vous pouvez compléter vos informations, découvrir des entreprises suisses, matcher avec de nouveaux partenaires B2B et échanger directement depuis la messagerie sécurisée de l'application.
        </p>
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:16px;margin:20px 0">
          <p style="font-size:14px;line-height:1.6;color:#166534;margin:0">
            <strong>Statut :</strong> entreprise vérifiée.<br />
            Le badge de votre abonnement est maintenant visible sur votre profil.
          </p>
        </div>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
          Notre équipe travaille constamment à l'amélioration de Hubbing afin d'apporter une expérience plus fluide, plus fiable et plus utile aux entreprises suisses. De nouvelles fonctionnalités et optimisations seront ajoutées progressivement.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 18px">
          Nous vous invitons donc à rester attentif aux prochaines mises à jour disponibles sur l'App Store.
        </p>
        <a href="https://app.hubbing.ch" style="display:inline-block;margin-top:8px;padding:13px 20px;background:#E24B4A;color:white;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700">Accéder à Hubbing</a>
        ${hubbingSignatureHtml}
      </div>`,
    }),
  })

  if (!response.ok) return { sent: false, error: await response.text() }
  return { sent: true }
}

const htmlPage = (title: string, message: string, status = 200, tone: 'success' | 'error' = 'success') => {
  const resultUrl = new URL('https://app.hubbing.ch/')
  resultUrl.searchParams.set('screen', 'verification-result')
  resultUrl.searchParams.set('tone', tone)
  resultUrl.searchParams.set('status', String(status))
  resultUrl.searchParams.set('title', title)
  resultUrl.searchParams.set('message', message)
  return Response.redirect(resultUrl.toString(), 303)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return htmlPage('Action non autorisée', 'Cette action doit être ouverte depuis le lien sécurisé reçu par email.', 405, 'error')

  try {
    const { manualSecret } = getSupabaseConfig()
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || ''
    const companyId = url.searchParams.get('company_id') || ''
    const userId = url.searchParams.get('user_id') || ''
    const expires = Number(url.searchParams.get('expires') || 0)
    const sig = url.searchParams.get('sig')

    if (!action || !companyId || !userId || !expires || !sig) {
      return htmlPage('Lien incomplet', 'Le lien de vérification est incomplet. Utilisez le dernier email de validation reçu.', 400, 'error')
    }
    if (action !== 'approve') {
      return htmlPage('Action inconnue', 'Cette action de vérification n’est pas reconnue.', 400, 'error')
    }
    if (expires < Math.floor(Date.now() / 1000)) {
      return htmlPage('Lien expiré', 'Ce lien de validation a expiré. Demandez une nouvelle validation depuis Hubbing.', 410, 'error')
    }

    const payload = `${action}|${companyId}|${userId}|${expires}`
    const expectedSig = await signPayload(payload, manualSecret)
    if (!safeCompare(sig, expectedSig)) {
      return htmlPage('Lien invalide', 'La signature du lien ne correspond pas. La validation a été bloquée par sécurité.', 403, 'error')
    }

    const companies = await restGet(`companies?id=eq.${encodeURIComponent(companyId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,name,zefix_uid,zefix_verification_status&limit=1`)
    const company = companies?.[0]
    if (!company?.id) {
      return htmlPage('Entreprise introuvable', 'Aucune entreprise ne correspond à ce lien de validation.', 404, 'error')
    }

    const alreadyApproved = ['verified', 'manual_approved'].includes(String(company.zefix_verification_status || ''))
    if (!alreadyApproved) {
      await restPatch(`companies?id=eq.${encodeURIComponent(companyId)}&user_id=eq.${encodeURIComponent(userId)}`, {
        zefix_verification_status: 'manual_approved',
        zefix_verified_at: new Date().toISOString(),
        zefix_verified_name: company.name || null,
        zefix_verified_source: 'manual_email_link',
      })
    }

    const email = await getUserEmail(userId)
    const emailResult = !alreadyApproved && email
      ? await sendApprovalEmail(email, String(company.name || 'votre entreprise'))
      : { sent: false, skipped: alreadyApproved ? 'already_approved' : 'missing_email' }

    const details = alreadyApproved
      ? `${company.name} était déjà validée. Le badge est déjà activé dans Hubbing.`
      : emailResult.sent
        ? `${company.name} est maintenant validée. Le mail de confirmation a été envoyé automatiquement.`
        : `${company.name} est maintenant validée. Attention : le mail automatique n’a pas pu être envoyé, mais le badge est activé.`

    return htmlPage('Entreprise validée', details)
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return htmlPage('Validation impossible', message, 500, 'error')
  }
})
