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

const getWaitlistEmails = async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase service configuration')

  const response = await fetch(`${supabaseUrl}/rest/v1/waitlist?select=email`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || 'Unable to load waitlist')
  }

  const rows = await response.json()
  return [...new Set(
    rows
      .map((row: { email?: string }) => String(row.email || '').trim().toLowerCase())
      .filter((email: string) => email.includes('@'))
  )]
}

const emailShell = (content: string) => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#E24B4A;padding:34px 28px;text-align:center;">
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
      <p style="margin:14px 0 0;font-size:11px;color:#aaa;">Made in Switzerland - <a href="${siteUrl}" style="color:#aaa;">hubbing.ch</a></p>
    </div>
  </div>
</body>
</html>`

const launchEmailHtml = emailShell(`
  <h2 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#1a1a1a">Hubbing est en ligne</h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 16px">
    Merci d'avoir rejoint la liste d'information Hubbing. L'application est maintenant ouverte aux entreprises suisses.
  </p>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 20px">
    Vous pouvez creer votre compte, decouvrir les entreprises presentes sur la carte, swiper des profils B2B et commencer a construire votre reseau professionnel.
  </p>
  <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:18px;margin:22px 0">
    <p style="color:#E24B4A;font-weight:800;font-size:14px;margin:0 0 6px;">Offre Fondateurs</p>
    <p style="font-size:14px;line-height:1.6;color:#333;margin:0">
      Les 100 premiers abonnes Premium beneficient de <strong>2 mois Premium offerts</strong>.
    </p>
  </div>
  <div style="text-align:center;margin:26px 0 8px">
    <a href="${appUrl}?screen=register&offer=founder" style="display:inline-block;background:#E24B4A;color:white;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;">
      Creer mon compte Hubbing
    </a>
  </div>
  <p style="font-size:12px;line-height:1.6;color:#888;text-align:center;margin:16px 0 0">
    Si vous preferez tester avant de vous inscrire, ouvrez simplement ${appUrl}.
  </p>
`)

const signupEmailHtml = emailShell(`
  <h2 style="font-size:24px;line-height:1.25;margin:0 0 12px;color:#1a1a1a">Votre acces Hubbing est pret</h2>
  <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 18px">
    Merci pour votre interet. Hubbing est maintenant disponible pour les entreprises suisses.
  </p>
  <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:18px;margin:22px 0">
    <p style="color:#E24B4A;font-weight:800;font-size:14px;margin:0 0 6px;">Offre Fondateurs</p>
    <p style="font-size:14px;line-height:1.6;color:#333;margin:0">
      Les 100 premiers abonnes Premium beneficient de <strong>2 mois Premium offerts</strong>.
    </p>
  </div>
  <div style="text-align:center;margin:26px 0 8px">
    <a href="${appUrl}?screen=register&offer=founder" style="display:inline-block;background:#E24B4A;color:white;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;">
      Creer mon compte
    </a>
  </div>
`)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const mode = body.mode || 'signup'

    if (mode === 'launch') {
      const launchSecret = Deno.env.get('LAUNCH_EMAIL_SECRET')
      if (!launchSecret || body.adminSecret !== launchSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const emails = await getWaitlistEmails()
      if (body.dryRun) {
        return new Response(JSON.stringify({ ok: true, dryRun: true, count: emails.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const failed: string[] = []
      for (const recipient of emails) {
        try {
          await sendEmail({
            from: 'Hubbing <contact@hubbing.ch>',
            to: [recipient],
            reply_to: 'contact@hubbing.ch',
            subject: 'Hubbing est en ligne - votre acces est pret',
            html: launchEmailHtml,
          })
        } catch (_) {
          failed.push(recipient)
        }
      }

      await sendEmail({
        from: 'Hubbing <contact@hubbing.ch>',
        to: ['contact@hubbing.ch'],
        subject: `Envoi lancement Hubbing - ${emails.length - failed.length}/${emails.length}`,
        html: `<p>Email de lancement envoye.</p><p>Envoyes : <strong>${emails.length - failed.length}</strong></p><p>Echecs : <strong>${failed.length}</strong></p>`,
      })

      return new Response(JSON.stringify({ ok: true, count: emails.length, sent: emails.length - failed.length, failed: failed.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const email = String(body.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await Promise.all([
      sendEmail({
        from: 'Hubbing <contact@hubbing.ch>',
        to: [email],
        reply_to: 'contact@hubbing.ch',
        subject: "Bienvenue sur Hubbing - l'application est en ligne",
        html: signupEmailHtml,
      }),
      sendEmail({
        from: 'Hubbing <contact@hubbing.ch>',
        to: ['contact@hubbing.ch'],
        reply_to: email,
        subject: `Nouvelle adresse interessee par Hubbing - ${escapeHtml(email)}`,
        html: `<p>Nouvelle adresse interessee par Hubbing :</p><p><strong>${escapeHtml(email)}</strong></p>`,
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
