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
    const companyForSubject = cleanHeader(company)

    const validationSubject = `Hubbing - validation de ${companyForSubject}`
    const validationBody = `Bonjour ${contactName || ''},

Bonne nouvelle, votre entreprise ${company} a ete validee sur Hubbing.

Votre profil peut maintenant etre utilise normalement sur la plateforme.

Merci de faire partie des premieres entreprises presentes sur Hubbing.

Cordialement,
L'equipe Hubbing`

    const reviewSubject = `Hubbing - informations a completer pour ${companyForSubject}`
    const reviewBody = `Bonjour ${contactName || ''},

Merci pour votre inscription sur Hubbing.

Lors de notre verification, certaines informations doivent etre completees ou corrigees avant validation definitive de votre entreprise.

Merci de repondre a cet email afin que nous puissions finaliser la verification.

Cordialement,
L'equipe Hubbing`

    const validationMailto = `mailto:${email}?subject=${encodeURIComponent(validationSubject)}&body=${encodeURIComponent(validationBody)}`
    const reviewMailto = `mailto:${email}?subject=${encodeURIComponent(reviewSubject)}&body=${encodeURIComponent(reviewBody)}`

    await Promise.all([
      sendEmail({
        from: 'Hubbing <contact@hubbing.ch>',
        to: [email],
        reply_to: 'contact@hubbing.ch',
        subject: 'Votre inscription Hubbing a bien ete recue',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
          <img src="https://www.hubbing.ch/logo192.png" width="64" height="64" style="border-radius:16px;display:block" alt="Hubbing" />
          <h2 style="font-size:24px;line-height:1.25;margin:22px 0 12px;color:#1a1a1a">Inscription bien recue</h2>
          <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">Bonjour ${safeContactName},</p>
          <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
            Merci pour votre inscription sur <strong>Hubbing</strong>. Votre compte entreprise a bien ete cree pour <strong>${safeCompany}</strong>.
          </p>
          <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">
            Afin de garantir un reseau B2B serieux et reserve aux entreprises suisses, chaque inscription est verifiee manuellement.
            Votre profil est donc actuellement <strong>en cours de verification</strong>.
          </p>
          <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:16px;margin:20px 0">
            <p style="font-size:14px;line-height:1.6;color:#333;margin:0">
              <strong>Delai indicatif :</strong> 24 a 48h ouvrables.<br />
              Vous pouvez deja acceder a votre compte apres confirmation de votre adresse email. Nous vous contacterons uniquement si une information doit etre completee.
            </p>
          </div>
          <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px">
            <tr><td style="padding:8px 0;color:#888">Entreprise</td><td style="padding:8px 0;color:#1a1a1a;font-weight:600;text-align:right">${safeCompany}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Numero IDE</td><td style="padding:8px 0;color:#1a1a1a;text-align:right">${safeZefix}</td></tr>
            <tr><td style="padding:8px 0;color:#888">Adresse</td><td style="padding:8px 0;color:#1a1a1a;text-align:right">${safeAddress}</td></tr>
          </table>
          <a href="https://app.hubbing.ch" style="display:inline-block;margin-top:8px;padding:13px 20px;background:#E24B4A;color:white;text-decoration:none;border-radius:12px;font-size:14px;font-weight:700">Acceder a Hubbing</a>
          <p style="font-size:13px;line-height:1.6;color:#777;margin:22px 0 0">
            Les 100 premiers abonnes Premium beneficient de l'offre Fondateurs : <strong>2 mois Premium offerts</strong>.
          </p>
          <p style="font-size:12px;color:#bbb;margin-top:28px">Hubbing - Reseau B2B suisse - <a href="mailto:contact@hubbing.ch" style="color:#999">contact@hubbing.ch</a></p>
        </div>`,
      }),
      sendEmail({
        from: 'Hubbing <contact@hubbing.ch>',
        to: ['contact@hubbing.ch'],
        reply_to: email,
        subject: `Nouvelle inscription a verifier - ${companyForSubject}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
          <h2 style="font-size:22px;margin:0 0 8px;color:#1a1a1a">Nouvelle inscription entreprise</h2>
          <p style="font-size:14px;line-height:1.6;color:#666;margin:0 0 18px">
            Une nouvelle entreprise vient de creer un compte sur Hubbing. Verification manuelle recommandee avant validation definitive.
          </p>
          <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:16px;margin-bottom:18px">
            <p style="margin:0;font-size:14px;color:#E24B4A;font-weight:700">Statut : verification Zefix a effectuer</p>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Entreprise</td><td style="padding:10px;border-bottom:1px solid #eee;font-weight:700">${safeCompany}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Numero IDE</td><td style="padding:10px;border-bottom:1px solid #eee">${safeZefix}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Adresse</td><td style="padding:10px;border-bottom:1px solid #eee">${safeAddress}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Ville / canton</td><td style="padding:10px;border-bottom:1px solid #eee">${safeCity} - ${safeCanton}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Contact</td><td style="padding:10px;border-bottom:1px solid #eee">${safeContactName} - ${safeContactTitle}</td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">Email</td><td style="padding:10px;border-bottom:1px solid #eee"><a href="mailto:${safeEmail}" style="color:#E24B4A">${safeEmail}</a></td></tr>
            <tr><td style="padding:10px;border-bottom:1px solid #eee;color:#777">User ID</td><td style="padding:10px;border-bottom:1px solid #eee">${safeUserId}</td></tr>
          </table>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
            <a href="https://www.zefix.ch/fr/search/entity/welcome" style="display:inline-block;padding:11px 14px;background:#1a1a1a;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Ouvrir Zefix</a>
            <a href="https://www.uid.admin.ch" style="display:inline-block;padding:11px 14px;background:#f5f5f5;color:#1a1a1a;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Registre IDE</a>
            <a href="${escapeHtml(validationMailto)}" style="display:inline-block;padding:11px 14px;background:#16a34a;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Repondre : valide</a>
            <a href="${escapeHtml(reviewMailto)}" style="display:inline-block;padding:11px 14px;background:#E24B4A;color:white;text-decoration:none;border-radius:10px;font-size:13px;font-weight:700">Repondre : infos a completer</a>
          </div>
          <p style="font-size:12px;line-height:1.6;color:#999;margin-top:18px">
            Conseil : copier le numero IDE puis verifier la concordance du nom, de l'adresse et du statut de l'entreprise dans Zefix ou le registre IDE.
          </p>
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
