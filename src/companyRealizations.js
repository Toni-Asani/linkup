import { supabase } from './supabaseClient'
import { moderateImageFile } from './moderation'

export const COMPANY_REALIZATION_BUCKET = 'need-attachments'
export const LEGACY_COMPANY_REALIZATION_BUCKET = 'company-realizations'

const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const PLAN_LIMITS = { starter: 5, basic: 20, premium: 50 }
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'])
const MIME_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
}

const safeFileName = name => String(name || 'realisation')
  .replace(/[^\w.\- ]+/g, '')
  .trim()
  .slice(0, 120) || 'realisation'

const normalizePlan = plan => {
  const value = String(plan || 'starter').toLowerCase()
  if (value.includes('premium')) return 'premium'
  if (value.includes('basic')) return 'basic'
  return 'starter'
}

const extensionForFile = file => {
  const extension = safeFileName(file?.name || '').split('.').pop()?.toLowerCase()
  if (IMAGE_EXTENSIONS.has(extension)) return extension
  const mime = String(file?.type || '').toLowerCase()
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('heic')) return 'heic'
  if (mime.includes('heif')) return 'heif'
  return ''
}

const contentTypeForFile = file => {
  const mime = String(file?.type || '').toLowerCase()
  if (mime === 'image/jpg') return 'image/jpeg'
  if (mime.startsWith('image/')) return mime
  return MIME_BY_EXTENSION[extensionForFile(file)] || ''
}

export const getCompanyRealizationLimit = plan => PLAN_LIMITS[normalizePlan(plan)] || PLAN_LIMITS.starter

export const validateCompanyRealizationFile = async ({ file, ui = {} }) => {
  const text = ui?.realizations || {}
  if (!contentTypeForFile(file)) {
    throw new Error(text.invalidType || 'Ajoutez uniquement des images.')
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error(text.imageTooLarge || 'Image trop lourde. Taille maximum : 10 MB.')
  }
  const moderation = await moderateImageFile(file, 'company_realization')
  if (!moderation.allowed) {
    throw new Error(text.moderationBlocked || 'Cette image ne respecte pas les règles de Hubbing.')
  }
}

const createRealizationSignedUrl = async storagePath => {
  const { data, error } = await supabase.storage
    .from(COMPANY_REALIZATION_BUCKET)
    .createSignedUrl(storagePath, 3600)
  if (!error) return data?.signedUrl || data?.signedURL || null

  const legacyResult = await supabase.storage
    .from(LEGACY_COMPANY_REALIZATION_BUCKET)
    .createSignedUrl(storagePath, 3600)
  if (legacyResult.error) return null
  return legacyResult.data?.signedUrl || legacyResult.data?.signedURL || null
}

const signRealizations = async rows => Promise.all((rows || []).map(async item => {
  if (!item.storage_path) return item
  const signedUrl = await createRealizationSignedUrl(item.storage_path)
  return {
    ...item,
    signedUrl,
  }
}))

export const fetchCompanyRealizations = async companyId => {
  if (!companyId) return []
  const { data, error } = await supabase
    .from('company_realizations')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error
  return signRealizations(data || [])
}

export const fetchCompanyRealizationsForCompanies = async (companyIds = [], { limitPerCompany = 3 } = {}) => {
  const ids = [...new Set((companyIds || []).filter(Boolean))]
  if (!ids.length) return {}
  const { data, error } = await supabase
    .from('company_realizations')
    .select('*')
    .in('company_id', ids)
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })
  if (error) throw error

  const grouped = (data || []).reduce((groups, item) => {
    if (!groups[item.company_id]) groups[item.company_id] = []
    if (groups[item.company_id].length < limitPerCompany) groups[item.company_id].push(item)
    return groups
  }, {})

  const entries = await Promise.all(Object.entries(grouped).map(async ([companyId, items]) => [
    companyId,
    await signRealizations(items),
  ]))
  return Object.fromEntries(entries)
}

export const uploadCompanyRealization = async ({ company, file, position = 0, ui }) => {
  const text = ui?.realizations || {}
  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user?.id || !company?.id) throw new Error(text.uploadError || "Erreur lors de l'envoi de l'image.")

  await validateCompanyRealizationFile({ file, ui })

  const ext = extensionForFile(file) || 'jpg'
  const contentType = contentTypeForFile(file) || 'image/jpeg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storagePath = `${company.id}/realizations/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_REALIZATION_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('company_realizations')
    .insert({
      company_id: company.id,
      uploader_user_id: user.id,
      storage_path: storagePath,
      file_name: safeFileName(file.name),
      mime_type: contentType,
      file_size: file.size || 0,
      position,
      status: 'active',
      moderation_status: 'approved',
    })
    .select('*')
    .single()

  if (error) {
    await supabase.storage.from(COMPANY_REALIZATION_BUCKET).remove([storagePath]).catch(() => null)
    throw error
  }

  return data
}

export const deleteCompanyRealization = async realization => {
  if (!realization?.id) return
  const { error } = await supabase
    .from('company_realizations')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', realization.id)
  if (error) throw error

  if (realization.storage_path) {
    await supabase.storage.from(COMPANY_REALIZATION_BUCKET).remove([realization.storage_path]).catch(() => null)
    await supabase.storage.from(LEGACY_COMPANY_REALIZATION_BUCKET).remove([realization.storage_path]).catch(() => null)
  }
}
