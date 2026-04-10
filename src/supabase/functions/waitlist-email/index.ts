import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { email } = await req.json()
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

  // Email à la personne
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'Hubbing <contact@hubbing.ch>',
      to: email,
      subject: '🎉 Vous êtes sur la liste Hubbing !',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2>Vous êtes sur la liste ! 🎉</h2>
        <p style="color:#666;line-height:1.6">Merci pour votre inscription. Vous serez parmi les premiers à accéder à <strong>Hubbing</strong> dès le <strong>1er mai 2026</strong>.</p>
        <p style="color:#666;line-height:1.6">En tant que membre de la liste d'attente, vous bénéficierez de l'<strong>offre Fondateurs — 2 mois Premium offerts</strong>.</p>
        <a href="https://www.hubbing.ch" style="display:inline-block;margin-top:1rem;padding:12px 24px;background:#E24B4A;color:white;text-decoration:none;border-radius:10px;font-weight:600">Découvrir Hubbing →</a>
        <p style="color:#bbb;font-size:12px;margin-top:2rem">🇨🇭 Made in Switzerland · contact@hubbing.ch</p>
      </div>`
    })
  })

  // Email de notification à toi
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'Hubbing <contact@hubbing.ch>',
      to: 'contact@hubbing.ch',
      subject: `🔔 Nouvel inscrit waitlist : ${email}`,
      html: `<p>Nouvel inscrit : <strong>${email}</strong></p>`
    })
  })

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})