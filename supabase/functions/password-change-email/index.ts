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

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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

  if (!response.ok) {
    const details = await response.text()
    throw new Error(details || 'Email sending failed')
  }
}

const messagesByLang: Record<string, {
  subject: string
  title: string
  greeting: string
  changed: (companyName: string) => string
  origin: string
  notOrigin: string
  footer: string
}> = {
  fr: {
    subject: 'Votre mot de passe Hubbing a ete modifie',
    title: 'Mot de passe modifie',
    greeting: 'Bonjour,',
    changed: (companyName) => `Le mot de passe du compte Hubbing lie a ${companyName} vient d'etre modifie.`,
    origin: "Si vous etes a l'origine de ce changement, aucune action n'est necessaire et vous n'avez pas besoin de repondre a ce courrier.",
    notOrigin: "Si vous n'etes pas a l'origine de ce changement, contactez immediatement Hubbing a contact@hubbing.ch.",
    footer: "L'equipe Hubbing",
  },
  de: {
    subject: 'Ihr Hubbing-Passwort wurde geaendert',
    title: 'Passwort geaendert',
    greeting: 'Guten Tag,',
    changed: (companyName) => `Das Passwort des Hubbing-Kontos fuer ${companyName} wurde gerade geaendert.`,
    origin: 'Wenn Sie diese Aenderung vorgenommen haben, ist keine Aktion erforderlich und Sie muessen nicht auf diese E-Mail antworten.',
    notOrigin: 'Wenn Sie diese Aenderung nicht vorgenommen haben, kontaktieren Sie Hubbing bitte sofort unter contact@hubbing.ch.',
    footer: 'Ihr Hubbing-Team',
  },
  it: {
    subject: 'La password Hubbing e stata modificata',
    title: 'Password modificata',
    greeting: 'Buongiorno,',
    changed: (companyName) => `La password dell'account Hubbing collegato a ${companyName} e appena stata modificata.`,
    origin: 'Se hai effettuato tu questa modifica, non e necessaria alcuna azione e non devi rispondere a questa email.',
    notOrigin: 'Se non hai effettuato tu questa modifica, contatta subito Hubbing a contact@hubbing.ch.',
    footer: 'Il team Hubbing',
  },
  en: {
    subject: 'Your Hubbing password was changed',
    title: 'Password changed',
    greeting: 'Hello,',
    changed: (companyName) => `The password for the Hubbing account linked to ${companyName} was just changed.`,
    origin: 'If you made this change, no action is required and you do not need to reply to this email.',
    notOrigin: 'If you did not make this change, contact Hubbing immediately at contact@hubbing.ch.',
    footer: 'The Hubbing team',
  },
}

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

const getCompanyName = async (userId: string, authorization: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey) throw new Error('Missing Supabase environment')

  const url = new URL(`${supabaseUrl}/rest/v1/companies`)
  url.searchParams.set('select', 'name')
  url.searchParams.set('user_id', `eq.${userId}`)
  url.searchParams.set('limit', '1')

  const apiKey = serviceRoleKey || anonKey
  const response = await fetch(url.toString(), {
    headers: {
      apikey: apiKey,
      Authorization: serviceRoleKey ? `Bearer ${serviceRoleKey}` : authorization,
    },
  })

  if (!response.ok) return 'votre entreprise'
  const data = await response.json()
  return data?.[0]?.name || 'votre entreprise'
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
    if (!user?.id || !user?.email) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const body = await req.json().catch(() => ({}))
    const lang = ['fr', 'de', 'it', 'en'].includes(body?.lang) ? body.lang : 'fr'
    const text = messagesByLang[lang]
    const companyName = await getCompanyName(user.id, authorization)

    await sendEmail({
      from: 'Hubbing <contact@hubbing.ch>',
      to: [user.email],
      reply_to: 'contact@hubbing.ch',
      subject: text.subject,
      text: [
        text.greeting,
        '',
        text.changed(companyName),
        '',
        text.origin,
        text.notOrigin,
        '',
        text.footer,
      ].join('\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
        <img src="https://www.hubbing.ch/logo192.png" width="64" height="64" style="border-radius:16px;display:block" alt="Hubbing" />
        <h2 style="font-size:24px;line-height:1.25;margin:22px 0 12px;color:#1a1a1a">${escapeHtml(text.title)}</h2>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">${escapeHtml(text.greeting)}</p>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">${escapeHtml(text.changed(companyName))}</p>
        <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:16px;margin:20px 0">
          <p style="font-size:14px;line-height:1.6;color:#333;margin:0">${escapeHtml(text.origin)}</p>
        </div>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">${escapeHtml(text.notOrigin)}</p>
        <p style="font-size:14px;line-height:1.6;color:#777;margin:22px 0 0">${escapeHtml(text.footer)}</p>
        <p style="font-size:12px;color:#bbb;margin-top:28px">Hubbing - Reseau B2B suisse - <a href="mailto:contact@hubbing.ch" style="color:#999">contact@hubbing.ch</a></p>
      </div>`,
    })

    return jsonResponse({ ok: true })
  } catch (error) {
    return jsonResponse({ error: error.message }, 500)
  }
})
