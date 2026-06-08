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

const deleteRows = async (table: string, params: Record<string, string>) => {
  const response = await fetch(restUrl(table, params), {
    method: 'DELETE',
    headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
  })
  if (!response.ok) throw new Error(await response.text())
}

const deleteUser = async (userId: string) => {
  const { supabaseUrl } = env()
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  })
  if (!response.ok) throw new Error(await response.text())
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

const deleteStorageObject = async (bucket: string, objectPath: string) => {
  if (!objectPath) return
  const { supabaseUrl } = env()
  await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  }).catch(() => null)
}

const objectPathFromPublicUrl = (bucket: string, publicUrl?: string | null) => {
  if (!publicUrl) return null
  try {
    const url = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucket}/`
    const index = url.pathname.indexOf(marker)
    if (index === -1) return null
    return decodeURIComponent(url.pathname.slice(index + marker.length))
  } catch {
    return null
  }
}

const inFilter = (ids: string[]) => `in.(${ids.join(',')})`

const messagesByLang: Record<string, {
  subject: string
  title: string
  greeting: string
  body: (companyName: string) => string
  apple: string
  footer: string
}> = {
  fr: {
    subject: 'Votre compte Hubbing a ete supprime',
    title: 'Compte supprime',
    greeting: 'Bonjour,',
    body: (companyName) => `Le compte Hubbing lie a ${companyName} a ete supprime definitivement.`,
    apple: "Si vous aviez un abonnement App Store actif, verifiez son annulation depuis la gestion des abonnements Apple.",
    footer: "L'equipe Hubbing",
  },
  de: {
    subject: 'Ihr Hubbing-Konto wurde geloescht',
    title: 'Konto geloescht',
    greeting: 'Guten Tag,',
    body: (companyName) => `Das Hubbing-Konto fuer ${companyName} wurde endgueltig geloescht.`,
    apple: 'Wenn Sie ein aktives App-Store-Abonnement hatten, pruefen Sie die Kuendigung in der Apple-Abonnementverwaltung.',
    footer: 'Ihr Hubbing-Team',
  },
  it: {
    subject: 'Il tuo account Hubbing e stato eliminato',
    title: 'Account eliminato',
    greeting: 'Buongiorno,',
    body: (companyName) => `L'account Hubbing collegato a ${companyName} e stato eliminato definitivamente.`,
    apple: 'Se avevi un abbonamento App Store attivo, verifica l annullamento nella gestione abbonamenti Apple.',
    footer: 'Il team Hubbing',
  },
  en: {
    subject: 'Your Hubbing account was deleted',
    title: 'Account deleted',
    greeting: 'Hello,',
    body: (companyName) => `The Hubbing account linked to ${companyName} has been permanently deleted.`,
    apple: 'If you had an active App Store subscription, check that it has been cancelled in Apple subscription management.',
    footer: 'The Hubbing team',
  },
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

    const companies = await readRows<{
      id: string
      name?: string
      logo_url?: string | null
      background_url?: string | null
      contact_photo_url?: string | null
    }>('companies', {
      select: 'id,name,logo_url,background_url,contact_photo_url',
      user_id: `eq.${user.id}`,
      limit: '1',
    })
    const company = companies[0]
    const companyName = company?.name || 'votre entreprise'
    const companyId = company?.id

    let matchIds: string[] = []
    if (companyId) {
      const matches = await readRows<{ id: string }>('matches', {
        select: 'id',
        or: `(company_a.eq.${companyId},company_b.eq.${companyId})`,
      })
      matchIds = matches.map(match => match.id)
    }

    let attachmentUrls: string[] = []
    let needAttachmentStoragePaths: string[] = []
    let needCompletionStoragePaths: string[] = []
    let companyRealizationStoragePaths: string[] = []
    let needCompletionIds: string[] = []
    if (companyId) {
      const messageFilter = matchIds.length
        ? `(sender_id.eq.${companyId},match_id.${inFilter(matchIds)})`
        : `(sender_id.eq.${companyId})`
      const messages = await readRows<{ attachment_url?: string | null }>('messages', {
        select: 'attachment_url',
        or: messageFilter,
      })
      attachmentUrls = messages.map(message => message.attachment_url).filter(Boolean) as string[]

      const needAttachments = await readRows<{ storage_path?: string | null }>('need_attachments', {
        select: 'storage_path',
        company_id: `eq.${companyId}`,
      })
      needAttachmentStoragePaths = needAttachments
        .map(attachment => attachment.storage_path)
        .filter(Boolean) as string[]

      const needCompletions = await readRows<{ id: string }>('need_completions', {
        select: 'id',
        or: `(client_company_id.eq.${companyId},provider_company_id.eq.${companyId})`,
      })
      needCompletionIds = needCompletions.map(completion => completion.id)
      if (needCompletionIds.length) {
        const completionPhotos = await readRows<{ storage_path?: string | null }>('need_completion_photos', {
          select: 'storage_path',
          completion_id: inFilter(needCompletionIds),
        })
        needCompletionStoragePaths = completionPhotos
          .map(photo => photo.storage_path)
          .filter(Boolean) as string[]
      }

      const companyRealizations = await readRows<{ storage_path?: string | null }>('company_realizations', {
        select: 'storage_path',
        company_id: `eq.${companyId}`,
      })
      companyRealizationStoragePaths = companyRealizations
        .map(realization => realization.storage_path)
        .filter(Boolean) as string[]
    }

    const emailSent = await sendEmail({
      from: 'Hubbing <contact@hubbing.ch>',
      to: [user.email],
      reply_to: 'contact@hubbing.ch',
      subject: text.subject,
      text: [
        text.greeting,
        '',
        text.body(companyName),
        '',
        text.apple,
        '',
        text.footer,
      ].join('\n'),
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px;background:#ffffff;color:#1a1a1a">
        <img src="https://www.hubbing.ch/logo192.png" width="64" height="64" style="border-radius:16px;display:block" alt="Hubbing" />
        <h2 style="font-size:24px;line-height:1.25;margin:22px 0 12px;color:#1a1a1a">${escapeHtml(text.title)}</h2>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">${escapeHtml(text.greeting)}</p>
        <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px">${escapeHtml(text.body(companyName))}</p>
        <div style="background:#FFF5F5;border:1px solid #FECACA;border-radius:14px;padding:16px;margin:20px 0">
          <p style="font-size:14px;line-height:1.6;color:#333;margin:0">${escapeHtml(text.apple)}</p>
        </div>
        <p style="font-size:14px;line-height:1.6;color:#777;margin:22px 0 0">${escapeHtml(text.footer)}</p>
        <p style="font-size:12px;color:#bbb;margin-top:28px">Hubbing - Reseau B2B suisse - <a href="mailto:contact@hubbing.ch" style="color:#999">contact@hubbing.ch</a></p>
      </div>`,
    })

    if (companyId) {
      if (matchIds.length) {
        await deleteRows('notifications', { match_id: inFilter(matchIds) })
        await deleteRows('reviews', { match_id: inFilter(matchIds) })
        await deleteRows('messages', { match_id: inFilter(matchIds) })
      }
      if (needCompletionIds.length) {
        await deleteRows('notifications', { need_completion_id: inFilter(needCompletionIds) })
        await deleteRows('need_completion_photos', { completion_id: inFilter(needCompletionIds) })
        await deleteRows('need_completions', { id: inFilter(needCompletionIds) })
      }
      await deleteRows('notifications', { user_id: `eq.${user.id}` })
      await deleteRows('messages', { sender_id: `eq.${companyId}` })
      await deleteRows('reviews', { reviewer_company_id: `eq.${companyId}` })
      await deleteRows('reviews', { reviewed_company_id: `eq.${companyId}` })
      await deleteRows('reports', { reporter_company_id: `eq.${companyId}` })
      await deleteRows('reports', { reported_company_id: `eq.${companyId}` })
      await deleteRows('need_attachment_reports', { or: `(reporter_company_id.eq.${companyId},reported_company_id.eq.${companyId})` })
      await deleteRows('need_attachments', { company_id: `eq.${companyId}` })
      await deleteRows('company_realizations', { company_id: `eq.${companyId}` })
      await deleteRows('swipe_history', { user_id: `eq.${user.id}` })
      await deleteRows('swipe_history', { company_id: `eq.${companyId}` })
      await deleteRows('matches', { company_a: `eq.${companyId}` })
      await deleteRows('matches', { company_b: `eq.${companyId}` })
      await deleteRows('companies', { id: `eq.${companyId}` })
    } else {
      await deleteRows('notifications', { user_id: `eq.${user.id}` })
      await deleteRows('swipe_history', { user_id: `eq.${user.id}` })
    }

    await deleteRows('subscriptions', { user_id: `eq.${user.id}` })
    await deleteRows('test_subscription_users', { user_id: `eq.${user.id}` })

    const logoPaths = [
      objectPathFromPublicUrl('logos', company?.logo_url),
      objectPathFromPublicUrl('logos', company?.background_url),
      objectPathFromPublicUrl('logos', company?.contact_photo_url),
    ].filter(Boolean) as string[]
    await Promise.all(logoPaths.map(path => deleteStorageObject('logos', path)))
    await Promise.all(
      attachmentUrls
        .map(url => objectPathFromPublicUrl('attachments', url))
        .filter(Boolean)
        .map(path => deleteStorageObject('attachments', path as string))
    )
    await Promise.all(needAttachmentStoragePaths.map(path => deleteStorageObject('need-attachments', path)))
    await Promise.all(needCompletionStoragePaths.map(path => deleteStorageObject('need-completion-photos', path)))
    await Promise.all(companyRealizationStoragePaths.map(path => deleteStorageObject('company-realizations', path)))

    await deleteUser(user.id)

    return jsonResponse({ ok: true, emailSent })
  } catch (error) {
    return jsonResponse({ error: error.message }, 500)
  }
})
