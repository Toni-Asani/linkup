import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] ?? char))

const cleanHeader = (value = '') => String(value ?? '').replace(/[\r\n]+/g, ' ').trim()

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

const signManualVerificationPayload = async (payload: string) => {
  const secret = Deno.env.get('MANUAL_VERIFICATION_SECRET')
  if (!secret) return null

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

const buildManualApprovalUrl = async (companyId?: string, userId?: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl || !companyId || !userId) return null

  const action = 'approve'
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  const payload = `${action}|${companyId}|${userId}|${expires}`
  const sig = await signManualVerificationPayload(payload)
  if (!sig) return null

  const url = new URL(`${supabaseUrl}/functions/v1/company-verification-action`)
  url.searchParams.set('action', action)
  url.searchParams.set('company_id', companyId)
  url.searchParams.set('user_id', userId)
  url.searchParams.set('expires', String(expires))
  url.searchParams.set('sig', sig)
  return url.toString()
}

const findRegistrationCompanyId = async (userId?: string, zefix?: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey || !userId) return null

  const cleanZefix = String(zefix || '').replace(/[^0-9]/g, '')
  const filters = [
    `user_id=eq.${encodeURIComponent(userId)}`,
    'select=id',
    'order=created_at.desc',
    'limit=1',
  ]
  if (cleanZefix) {
    filters.unshift(`zefix_uid=eq.${encodeURIComponent(cleanZefix)}`)
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/companies?${filters.join('&')}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) return null
  const rows = await response.json()
  return typeof rows?.[0]?.id === 'string' ? rows[0].id : null
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

const sendEmail = async (payload: Record<string, unknown>) => {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('Missing RESEND_API_KEY')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || 'Email sending failed')
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      email,
      company,
      zefix,
      contactName,
      contactTitle,
      address,
      city,
      canton,
      userId,
      companyId,
      zefixVerification,
    } = await req.json()

    if (!email || !company) {
      return new Response(JSON.stringify({ error: 'Missing email or company' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const safeCompany = escapeHtml(company)
    const safeEmail = escapeHtml(email)
    const safeZefix = escapeHtml(zefix || 'Non renseigné')
    const safeContactName = escapeHtml(contactName || 'Bonjour')
    const safeContactTitle = escapeHtml(contactTitle || 'Non renseigné')
    const safeAddress = escapeHtml(address || 'Non renseignée')
    const safeCity = escapeHtml(city || 'Non renseignée')
    const safeCanton = escapeHtml(canton || 'Non renseigné')
    const safeUserId = escapeHtml(userId || 'Non disponible')
    const resolvedCompanyId = companyId || await findRegistrationCompanyId(userId, zefix)
    const safeCompanyId = escapeHtml(resolvedCompanyId || 'Non disponible')
    const companyForSubject = cleanHeader(company)
    const zefixVerificationInfo = zefixVerification && typeof zefixVerification === 'object'
      ? zefixVerification as Record<string, unknown>
      : null
    const zefixCompanyInfo = zefixVerificationInfo?.company && typeof zefixVerificationInfo.company === 'object'
      ? zefixVerificationInfo.company as Record<string, unknown>
      : null
    const autoVerified = zefixVerificationInfo?.verified === true && zefixVerificationInfo?.source === 'zefix'
    const safeOfficialCompany = escapeHtml(String(zefixCompanyInfo?.name || ''))

    const userSubject = autoVerified
      ? 'Votre entreprise Hubbing a ete verifiee'
      : 'Votre inscription Hubbing a bien ete recue'
    const userVerificationHtml = autoVerified
      ? `<p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
            Bonne nouvelle : votre numéro IDE a été vérifié automatiquement via <strong>Zefix</strong>.
            Votre profil entreprise est donc validé sur Hubbing.
          </p>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:16px;margin:20px 0">
            <p style="font-size:14px;line-height:1.6;color:#166534;margin:0">
              <strong>Statut :</strong> entreprise vérifiée automatiquement.<br />
              Vous pouvez accéder à votre compte après confirmation de votre adresse email.
            </p>
          </div>`
      : `<p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
            Afin de garantir un reseau B2B serieux et reserve aux entreprises suisses, chaque inscription est verifiee manuellement.
            Votre profil est donc actuellement <strong>en cours de verification</strong>.
          </p>
          <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:16px;margin:20px 0">
            <p style="font-size:14px;line-height:1.6;color:#333;margin:0">
              <strong>Delai indicatif :</strong> 24 a 48h ouvrables.<br />
              Vous pouvez deja acceder a votre compte apres confirmation de votre adresse email. Nous vous contacterons uniquement si une information doit etre completee.
            </p>
          </div>`

    const adminIntro = autoVerified
      ? 'Une nouvelle entreprise vient de creer un compte sur Hubbing. Son numero IDE a ete verifie automatiquement via Zefix.'
      : 'Une nouvelle entreprise vient de creer un compte sur Hubbing. Verification manuelle recommandee avant validation definitive.'
    const adminStatusHtml = autoVerified
      ? `<div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;padding:16px;margin-bottom:18px">
            <p style="margin:0;font-size:14px;color:#166534;font-weight:700">Statut : verification Zefix automatique reussie</p>
          </div>`
      : `<div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:16px;margin-bottom:18px">
            <p style="margin:0;font-size:14px;color:#E24B4A;font-weight:700">Statut : verification Zefix a effectuer</p>
          </div>`
    const validationSubject = `Hubbing - validation de ${companyForSubject}`
    const validationBody = `Bonjour ${contactName || ''},

Bonne nouvelle : votre entreprise ${company} a été vérifiée avec succès à partir de son numéro IDE et des informations disponibles via Zefix.

Votre profil est désormais validé sur Hubbing. Vous pouvez compléter vos informations, découvrir des entreprises suisses, matcher avec de nouveaux partenaires B2B et échanger directement depuis la messagerie sécurisée de l'application.

Notre équipe travaille constamment à l'amélioration de Hubbing afin d'apporter une expérience plus fluide, plus fiable et plus utile aux entreprises suisses. De nouvelles fonctionnalités et optimisations seront ajoutées progressivement.

Nous vous invitons donc à rester attentif aux prochaines mises à jour disponibles sur l'App Store.

Merci de faire partie du réseau Hubbing.

Cordialement,
L'équipe Hubbing
Réseau B2B pour entreprises suisses
contact@hubbing.ch
https://www.hubbing.ch
https://app.hubbing.ch`

    const reviewSubject = `Hubbing - informations a completer pour ${companyForSubject}`
    const reviewBody = `Bonjour ${contactName || ''},

Merci pour votre inscription sur Hubbing.

Lors de notre verification, certaines informations doivent etre completees ou corrigees avant validation definitive de votre entreprise.

Merci de repondre a cet email afin que nous puissions finaliser la verification.

Cordialement,
L'équipe Hubbing
Réseau B2B pour entreprises suisses
contact@hubbing.ch
https://www.hubbing.ch
https://app.hubbing.ch`

    const validationMailto = `mailto:${email}?subject=${encodeURIComponent(validationSubject)}&body=${encodeURIComponent(validationBody)}`
    const reviewMailto = `mailto:${email}?subject=${encodeURIComponent(reviewSubject)}&body=${encodeURIComponent(reviewBody)}`
    const manualApprovalUrl = await buildManualApprovalUrl(resolvedCompanyId, userId)
    const adminActionsHtml = autoVerified
      ? `<a href="https://www.zefix.ch/fr/search/entity/welcome" style="display:inline-block;padding:11px 14px;background:#1a1a1a;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Ouvrir Zefix</a>
         <a href="https://www.uid.admin.ch" style="display:inline-block;padding:11px 14px;background:#f5f5f5;color:#1a1a1a;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Registre IDE</a>`
      : `<a href="https://www.zefix.ch/fr/search/entity/welcome" style="display:inline-block;padding:11px 14px;background:#1a1a1a;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Ouvrir Zefix</a>
         <a href="https://www.uid.admin.ch" style="display:inline-block;padding:11px 14px;background:#f5f5f5;color:#1a1a1a;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Registre IDE</a>
         <a href="${escapeHtml(manualApprovalUrl || validationMailto)}" style="display:inline-block;padding:11px 14px;background:#16a34a;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">${manualApprovalUrl ? 'Valider et prevenir l’entreprise' : 'Repondre : IDE valide'}</a>
         <a href="${escapeHtml(reviewMailto)}" style="display:inline-block;padding:11px 14px;background:#E24B4A;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Repondre : infos a completer</a>`

    await Promise.all([
      sendEmail({
        from: 'Hubbing <contact@hubbing.ch>',
        to: [email],
        reply_to: 'contact@hubbing.ch',
        subject: userSubject,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
          <img src="https://www.hubbing.ch/logo192.png" width="64" height="64" style="border-radius:16px;display:block" alt="Hubbing" />
          <h2 style="font-size:24px;line-height:1.25;margin:22px 0 12px;color:#1a1a1a">Inscription bien recue</h2>
          <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">Bonjour ${safeContactName},</p>
          <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
            Merci pour votre inscription sur <strong>Hubbing</strong>. Votre compte entreprise a bien ete cree pour <strong>${safeCompany}</strong>.
          </p>
          ${userVerificationHtml}
          <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
            <tr><td style="padding:8px 0;color:#888">Entreprise</td><td style="padding:8px 0;color:#1a1a1a;font-weight:600;text-align:right">${safeCompany}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Numero IDE</td><td style="padding:8px 0;color:#1a1a1a;text-align:right">${safeZefix}</td></tr>
            ${autoVerified && safeOfficialCompany ? `<tr><td style="padding:8px 0;color:#888">Nom Zefix</td><td style="padding:8px 0;color:#1a1a1a;text-align:right">${safeOfficialCompany}</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#888">Adresse</td><td style="padding:8px 0;color:#1a1a1a;text-align:right">${safeAddress}</td></tr>
          </table>
          <a href="https://app.hubbing.ch" style="display:inline-block;margin-top:8px;padding:13px 20px;background:#E24B4A;color:white;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700">Acceder a Hubbing</a>
          ${hubbingSignatureHtml}
        </div>`,
      }),
      sendEmail({
        from: 'Hubbing <contact@hubbing.ch>',
        to: ['contact@hubbing.ch'],
        reply_to: email,
        subject: `${autoVerified ? 'Nouvelle inscription verifiee automatiquement' : 'Nouvelle inscription a verifier'} - ${companyForSubject}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
          <h2 style="font-size:22px;margin:0 0 8px;color:#1a1a1a">Nouvelle inscription entreprise</h2>
          <p style="font-size:14px;line-height:1.6;color:#666;margin:0 0 18px">
            ${adminIntro}
          </p>
          ${adminStatusHtml}
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Entreprise</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:700">${safeCompany}</td></tr>
            ${autoVerified && safeOfficialCompany ? `<tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Nom Zefix</td><td style="padding:10px;border-bottom:1px solid #eee">${safeOfficialCompany}</td></tr>` : ''}
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Numero IDE</td><td style="padding:10px;border-bottom:1px solid #eee">${safeZefix}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Adresse</td><td style="padding:10px;border-bottom:1px solid #eee">${safeAddress}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Ville / canton</td><td style="padding:10px;border-bottom:1px solid #eee">${safeCity} - ${safeCanton}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Contact</td><td style="padding:10px;border-bottom:1px solid #eee">${safeContactName} - ${safeContactTitle}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Email</td><td style="padding:10px;border-bottom:1px solid #eee"><a href="mailto:${safeEmail}" style="color:#E24B4A">${safeEmail}</a></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">User ID</td><td style="padding:10px;border-bottom:1px solid #eee">${safeUserId}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Company ID</td><td style="padding:10px;border-bottom:1px solid #eee">${safeCompanyId}</td></tr>
          </table>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
            ${adminActionsHtml}
          </div>
          <p style="font-size:12px;line-height:1.6;color:#999;margin-top:18px">
            Conseil : copier le numero IDE puis verifier la concordance du nom, de l'adresse et du statut de l'entreprise dans Zefix ou le registre IDE.
          </p>
          ${hubbingSignatureHtml}
        </div>`,
      }),
    ])

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
