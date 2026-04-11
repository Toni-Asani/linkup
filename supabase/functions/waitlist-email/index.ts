import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Hubbing <contact@hubbing.ch>',
        to: [email],
        subject: 'Bienvenue sur la liste Hubbing !',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:white;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    
    <!-- Header rouge -->
    <div style="background:#E24B4A;padding:40px 32px;text-align:center;">
      <img src="https://www.hubbing.ch/LOGO-HUBBING-ICON.svg" width="72" height="72" style="border-radius:50%;margin-bottom:16px;" />
      <h1 style="color:white;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">hubbing</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Le réseau B2B pour les entreprises suisses</p>
    </div>

    <!-- Corps -->
    <div style="padding:36px 32px;">
      <h2 style="font-size:22px;font-weight:700;color:#1a1a1a;margin:0 0 12px;">Vous êtes sur la liste ! 🎉</h2>
      <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Bienvenue dans la communauté Hubbing ! Vous faites partie des premiers à rejoindre la plateforme qui va révolutionner le networking B2B en Suisse.
      </p>

      <!-- Compte à rebours visuel -->
      <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
        <p style="color:#E24B4A;font-weight:700;font-size:14px;margin:0 0 4px;">⏳ Lancement le</p>
        <p style="color:#1a1a1a;font-weight:800;font-size:28px;margin:0;">1er mai 2026</p>
      </div>

      <!-- Features -->
      <p style="font-weight:700;font-size:14px;color:#1a1a1a;margin:0 0 12px;">Ce qui vous attend :</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-size:14px;color:#444;">
            💼 <strong>Swipe B2B</strong> — Découvrez des partenaires en 30 secondes
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-size:14px;color:#444;">
            🗺️ <strong>Carte interactive</strong> — Trouvez des entreprises près de chez vous
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-size:14px;color:#444;">
            💬 <strong>Messagerie pro</strong> — Échangez et collaborez en toute sécurité
          </td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:14px;color:#444;">
            ⭐ <strong>Offre Fondateurs</strong> — 2 mois Premium offerts pour les 100 premiers
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:32px;">
        <a href="https://www.hubbing.ch" style="display:inline-block;background:#E24B4A;color:white;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:700;font-size:15px;">
          Découvrir Hubbing →
        </a>
      </div>

      <!-- Offre fondateur box -->
      <div style="background:#1a1a1a;border-radius:12px;padding:20px;text-align:center;margin-bottom:32px;">
        <p style="color:#E24B4A;font-weight:700;font-size:13px;margin:0 0 4px;">🎁 OFFRE FONDATEURS — 100 PLACES</p>
        <p style="color:white;font-size:14px;margin:0;line-height:1.6;">En tant que membre de la liste d'attente, vous bénéficiez de <strong style="color:#E24B4A;">2 mois Premium offerts</strong> dès le lancement.</p>
      </div>
    </div>

    <!-- Signature -->
    <div style="background:#f9f9f9;padding:24px 32px;border-top:1px solid #f0f0f0;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#1a1a1a;">L'équipe Hubbing</p>
      <a href="mailto:contact@hubbing.ch" style="color:#E24B4A;font-size:13px;text-decoration:none;">contact@hubbing.ch</a>
      <p style="margin:16px 0 0;font-size:11px;color:#bbb;">🇨🇭 Made in Switzerland · <a href="https://www.hubbing.ch" style="color:#bbb;">hubbing.ch</a></p>
    </div>

  </div>
</body>
</html>`
      })
    })

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Hubbing <contact@hubbing.ch>',
        to: ['contact@hubbing.ch'],
        subject: `🔔 Nouvel inscrit waitlist : ${email}`,
        html: `<p>Nouvel inscrit sur la waitlist Hubbing :</p><p><strong>${email}</strong></p>`
      })
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})