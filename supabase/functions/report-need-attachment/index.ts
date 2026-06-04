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

const env = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase environment')
  }
  return { supabaseUrl, anonKey, serviceRoleKey }
}

const serviceHeaders = () => {
  const { serviceRoleKey } = env()
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

const getCurrentUser = async (authorization: string) => {
  const { supabaseUrl, anonKey } = env()
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: authorization,
    },
  })

  if (!response.ok) return null
  return await response.json()
}

const restUrl = (table: string, params: Record<string, string>) => {
  const { supabaseUrl } = env()
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

const readRows = async <T>(table: string, params: Record<string, string>) => {
  const response = await fetch(restUrl(table, params), {
    headers: serviceHeaders(),
  })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T[]
}

const insertRow = async (table: string, payload: Record<string, unknown>) => {
  const response = await fetch(restUrl(table, {}), {
    method: 'POST',
    headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await response.text())
}

const createSignedUrl = async (bucket: string, objectPath: string) => {
  if (!objectPath) return ''
  const { supabaseUrl } = env()
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ expiresIn: 3600 }),
  })
  if (!response.ok) return ''

  const data = await response.json().catch(() => ({}))
  const signedPath = data?.signedURL || data?.signedUrl || ''
  if (!signedPath) return ''
  if (signedPath.startsWith('http')) return signedPath
  return `${supabaseUrl}/storage/v1${signedPath}`
}

const sendEmail = async (payload: Record<string, unknown>) => {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return false

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  return response.ok
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
    const attachmentId = String(body?.attachmentId || '').trim()
    const reason = String(body?.reason || '').trim()
    const comment = String(body?.comment || '').trim().slice(0, 1500)

    if (!attachmentId || !reason) {
      return jsonResponse({ error: 'Missing required fields' }, 400)
    }

    const reporterCompanies = await readRows<{ id: string; name?: string }>('companies', {
      select: 'id,name',
      user_id: `eq.${user.id}`,
      limit: '1',
    })
    const reporterCompany = reporterCompanies[0]
    if (!reporterCompany?.id) {
      return jsonResponse({ error: 'Reporter company not found' }, 404)
    }

    const attachments = await readRows<{
      id: string
      company_id: string
      need_label?: string | null
      file_name: string
      file_type: string
      mime_type?: string | null
      file_size?: number
      storage_path: string
      status: string
      moderation_status: string
    }>('need_attachments', {
      select: 'id,company_id,need_label,file_name,file_type,mime_type,file_size,storage_path,status,moderation_status',
      id: `eq.${attachmentId}`,
      limit: '1',
    })
    const attachment = attachments[0]
    if (!attachment?.id || attachment.status !== 'active') {
      return jsonResponse({ error: 'Attachment not found' }, 404)
    }

    const reportedCompanies = await readRows<{ id: string; name?: string }>('companies', {
      select: 'id,name',
      id: `eq.${attachment.company_id}`,
      limit: '1',
    })
    const reportedCompany = reportedCompanies[0]

    await insertRow('need_attachment_reports', {
      attachment_id: attachment.id,
      reporter_company_id: reporterCompany.id,
      reported_company_id: attachment.company_id,
      reason,
      comment: comment || null,
    })

    const signedUrl = await createSignedUrl('need-attachments', attachment.storage_path)
    const reportEmail = Deno.env.get('HUBBING_REPORT_EMAIL') || 'contact@hubbing.ch'
    const emailSent = await sendEmail({
      from: 'Hubbing <contact@hubbing.ch>',
      to: [reportEmail],
      reply_to: user.email,
      subject: '[Hubbing] Signalement piece jointe',
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
        <img src="https://www.hubbing.ch/logo192.png" width="64" height="64" style="border-radius:16px;display:block" alt="Hubbing" />
        <h2 style="font-size:23px;line-height:1.25;margin:22px 0 12px;color:#1a1a1a">Signalement de piece jointe</h2>
        <p><strong>Motif :</strong> ${escapeHtml(reason)}</p>
        <p><strong>Commentaire :</strong> ${escapeHtml(comment || '-')}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <p><strong>Fichier :</strong> ${escapeHtml(attachment.file_name)} (${escapeHtml(attachment.file_type)})</p>
        <p><strong>Besoin :</strong> ${escapeHtml(attachment.need_label || 'Besoin principal')}</p>
        <p><strong>Entreprise signalee :</strong> ${escapeHtml(reportedCompany?.name || attachment.company_id)}</p>
        <p><strong>Signale par :</strong> ${escapeHtml(reporterCompany.name || reporterCompany.id)} (${escapeHtml(user.email)})</p>
        ${signedUrl ? `<p><a href="${escapeHtml(signedUrl)}">Ouvrir le fichier signale</a> (lien valable 1h)</p>` : ''}
      </div>`,
    })

    return jsonResponse({ ok: true, emailSent })
  } catch (error) {
    return jsonResponse({ error: error.message }, 500)
  }
})
