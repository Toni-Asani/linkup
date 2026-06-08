import { supabase } from './supabaseClient'
import { moderateImageFile } from './moderation'
import { createNotificationAndPush } from './pushDelivery'
import { makeSlug } from './needAttachments'

export const NEED_COMPLETION_NOTIFICATION_TYPE = 'need_completion_confirmation'
export const NEED_COMPLETION_BUCKET = 'need-completion-photos'
const NEED_ATTACHMENT_BUCKET = 'need-attachments'

const IMAGE_MAX_BYTES = 10 * 1024 * 1024

const safeFileName = name => String(name || 'photo')
  .replace(/[^\w.\- ]+/g, '')
  .trim()
  .slice(0, 120) || 'photo'

const uniqueCompanyIds = rows => {
  const ids = new Set()
  ;(rows || []).forEach(row => {
    if (row.client_company_id) ids.add(row.client_company_id)
    if (row.provider_company_id) ids.add(row.provider_company_id)
    if (row.uploader_company_id) ids.add(row.uploader_company_id)
  })
  return [...ids]
}

export const validateCompletionPhoto = async (file, ui = {}) => {
  const text = ui.needCompletions || {}
  if (!file?.type?.startsWith('image/')) {
    throw new Error(text.photoTypeError || 'Ajoutez uniquement des photos.')
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(text.photoSizeError || 'Photo trop lourde. Taille maximum : 10 MB.')
  }
  const moderation = await moderateImageFile(file, 'need_completion_photo')
  if (!moderation.allowed) {
    throw new Error(text.photoBlocked || 'Cette photo ne respecte pas les règles de Hubbing.')
  }
}

export const searchCompletionProviderCompanies = async ({ query, excludeCompanyId, limit = 8 }) => {
  const term = String(query || '').replace(/[%_]/g, '').trim()
  if (term.length < 2) return []

  const { data, error } = await supabase
    .from('companies')
    .select('id,user_id,name,sector,city,canton,logo_url')
    .neq('id', excludeCompanyId || '00000000-0000-0000-0000-000000000000')
    .or(`name.ilike.%${term}%,sector.ilike.%${term}%,city.ilike.%${term}%`)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data || []
}

const completionNeedKey = (companyId, needKey) => `${companyId || ''}::${makeSlug(needKey || 'general')}`

const createStorageSignedUrls = async (bucket, items) => {
  const signed = await Promise.all((items || []).map(async item => {
    if (!item.storage_path) return item
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(item.storage_path, 3600)
    if (error) return item
    return {
      ...item,
      signedUrl: data?.signedUrl || data?.signedURL || null,
    }
  }))
  return signed
}

const createCompletionPhotoSignedUrls = photos => createStorageSignedUrls(NEED_COMPLETION_BUCKET, photos)
const createNeedAttachmentSignedUrls = attachments => createStorageSignedUrls(NEED_ATTACHMENT_BUCKET, attachments)

const fetchBeforeNeedAttachmentIds = async ({ clientCompanyId, needKey }) => {
  if (!clientCompanyId) return []
  const { data, error } = await supabase
    .from('need_attachments')
    .select('id')
    .eq('company_id', clientCompanyId)
    .eq('need_key', makeSlug(needKey || 'general'))
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .eq('file_type', 'image')
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('Unable to snapshot before attachments:', error.message)
    return []
  }
  return (data || []).map(attachment => attachment.id).filter(Boolean)
}

export const fetchNeedCompletionsForCompany = async companyId => {
  if (!companyId) return []

  const { data: rows, error } = await supabase
    .from('need_completions')
    .select('*')
    .or(`client_company_id.eq.${companyId},provider_company_id.eq.${companyId}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!rows?.length) return []

  const { data: photos, error: photoError } = await supabase
    .from('need_completion_photos')
    .select('*')
    .in('completion_id', rows.map(row => row.id))
    .order('created_at', { ascending: true })
  if (photoError) throw photoError

  const snapshotAttachmentIds = [...new Set(rows.flatMap(row => (
    Array.isArray(row.before_attachment_ids) ? row.before_attachment_ids : []
  )).filter(Boolean))]
  let signedSnapshotBeforeAttachments = []
  if (snapshotAttachmentIds.length > 0) {
    const { data: beforeAttachments, error: beforeAttachmentError } = await supabase
      .from('need_attachments')
      .select('*')
      .in('id', snapshotAttachmentIds)
      .eq('status', 'active')
      .eq('moderation_status', 'approved')
      .eq('file_type', 'image')
    if (beforeAttachmentError) throw beforeAttachmentError
    signedSnapshotBeforeAttachments = await createNeedAttachmentSignedUrls(beforeAttachments || [])
  }

  const rowsWithoutSnapshot = rows.filter(row => !Array.isArray(row.before_attachment_ids) || row.before_attachment_ids.length === 0)
  const clientCompanyIds = [...new Set(rowsWithoutSnapshot.map(row => row.client_company_id).filter(Boolean))]
  const needKeys = [...new Set(rowsWithoutSnapshot.map(row => makeSlug(row.need_key || 'general')).filter(Boolean))]
  let signedFallbackBeforeAttachments = []
  if (clientCompanyIds.length > 0 && needKeys.length > 0) {
    const { data: beforeAttachments, error: beforeAttachmentError } = await supabase
      .from('need_attachments')
      .select('*')
      .in('company_id', clientCompanyIds)
      .in('need_key', needKeys)
      .eq('status', 'active')
      .eq('moderation_status', 'approved')
      .eq('file_type', 'image')
      .order('created_at', { ascending: true })
    if (beforeAttachmentError) throw beforeAttachmentError
    signedFallbackBeforeAttachments = await createNeedAttachmentSignedUrls(beforeAttachments || [])
  }

  const companyIds = uniqueCompanyIds(rows)
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id,user_id,name,sector,city,canton,logo_url')
    .in('id', companyIds)
  if (companyError) throw companyError

  const companiesById = new Map((companies || []).map(company => [company.id, company]))
  const signedPhotos = await createCompletionPhotoSignedUrls(photos || [])
  const photosByCompletion = signedPhotos.reduce((groups, photo) => {
    if (!groups[photo.completion_id]) groups[photo.completion_id] = []
    groups[photo.completion_id].push(photo)
    return groups
  }, {})
  const beforeAttachmentsById = new Map(signedSnapshotBeforeAttachments.map(attachment => [attachment.id, attachment]))
  const fallbackBeforeAttachmentsByNeed = signedFallbackBeforeAttachments.reduce((groups, attachment) => {
    const key = completionNeedKey(attachment.company_id, attachment.need_key)
    if (!groups[key]) groups[key] = []
    groups[key].push(attachment)
    return groups
  }, {})

  return rows.map(row => ({
    ...row,
    clientCompany: companiesById.get(row.client_company_id) || null,
    providerCompany: row.provider_company_id ? companiesById.get(row.provider_company_id) || null : null,
    beforeAttachments: Array.isArray(row.before_attachment_ids) && row.before_attachment_ids.length > 0
      ? row.before_attachment_ids.map(id => beforeAttachmentsById.get(id)).filter(Boolean)
      : fallbackBeforeAttachmentsByNeed[completionNeedKey(row.client_company_id, row.need_key)] || [],
    photos: photosByCompletion[row.id] || [],
  }))
}

export const fetchPendingNeedCompletionCount = async providerCompanyId => {
  if (!providerCompanyId) return 0
  const { count, error } = await supabase
    .from('need_completions')
    .select('*', { count: 'exact', head: true })
    .eq('provider_company_id', providerCompanyId)
    .eq('status', 'pending')
  if (error) {
    console.warn('Unable to load pending completion count:', error.message)
    return 0
  }
  return count || 0
}

export const uploadNeedCompletionPhoto = async ({ completion, company, file }) => {
  const ext = safeFileName(file.name).split('.').pop() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storagePath = `${company.id}/${completion.id}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(NEED_COMPLETION_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('need_completion_photos')
    .insert({
      completion_id: completion.id,
      uploader_company_id: company.id,
      storage_path: storagePath,
      file_name: safeFileName(file.name),
      mime_type: file.type || null,
      file_size: file.size || 0,
    })
    .select('*')
    .single()

  if (error) {
    await supabase.storage.from(NEED_COMPLETION_BUCKET).remove([storagePath]).catch(() => null)
    throw error
  }

  return data
}

export const createNeedCompletion = async ({
  clientCompany,
  needKey = 'general',
  needLabel = '',
  needTitle = '',
  clientNote = '',
  providerCompany = null,
  externalProviderName = '',
  externalProviderCity = '',
  photos = [],
  ui,
}) => {
  const text = ui?.needCompletions || {}
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user?.id || !clientCompany?.id) throw new Error(text.createError || 'Clôture impossible.')

  const providerExternal = !providerCompany?.id
  const title = String(needTitle || needLabel || text.defaultNeedTitle || 'Besoin clôturé').trim()
  const providerName = providerExternal ? String(externalProviderName || '').trim() : null
  if (providerExternal && !providerName) throw new Error(text.providerRequired || 'Indiquez le prestataire.')
  const beforeAttachmentIds = await fetchBeforeNeedAttachmentIds({
    clientCompanyId: clientCompany.id,
    needKey,
  })

  const { data: completion, error } = await supabase
    .from('need_completions')
    .insert({
      client_company_id: clientCompany.id,
      provider_company_id: providerExternal ? null : providerCompany.id,
      provider_external: providerExternal,
      provider_name: providerName,
      provider_city: providerExternal ? String(externalProviderCity || '').trim() || null : null,
      need_key: makeSlug(needKey),
      need_label: needLabel || null,
      need_title: title,
      client_note: clientNote || null,
      before_attachment_ids: beforeAttachmentIds,
      status: providerExternal ? 'external_declared' : 'pending',
      show_on_provider_profile: false,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) throw error

  for (const file of photos || []) {
    await uploadNeedCompletionPhoto({ completion, company: clientCompany, file })
  }

  if (!providerExternal && providerCompany?.user_id) {
    await createNotificationAndPush({
      user_id: providerCompany.user_id,
      type: NEED_COMPLETION_NOTIFICATION_TYPE,
      need_completion_id: completion.id,
      read: false,
    })
  }

  return completion
}

export const confirmNeedCompletion = async ({ completionId, showOnProviderProfile = false }) => {
  const { error } = await supabase
    .from('need_completions')
    .update({
      status: 'confirmed',
      show_on_provider_profile: Boolean(showOnProviderProfile),
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', completionId)

  if (error) throw error
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('need_completion_id', completionId)
      .eq('type', NEED_COMPLETION_NOTIFICATION_TYPE)
      .eq('read', false)
  } catch {
    // The confirmation itself succeeded; notification cleanup can be retried later.
  }
}

export const declineNeedCompletion = async completionId => {
  const { error } = await supabase
    .from('need_completions')
    .update({
      status: 'declined',
      declined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', completionId)

  if (error) throw error
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('need_completion_id', completionId)
      .eq('type', NEED_COMPLETION_NOTIFICATION_TYPE)
      .eq('read', false)
  } catch {
    // The decline itself succeeded; notification cleanup can be retried later.
  }
}
