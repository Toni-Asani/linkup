import { supabase, SUPABASE_URL } from './supabaseClient'
import { moderateImageFile } from './moderation'

export const GENERAL_NEED_KEY = 'general'

const IMAGE_MAX_BYTES = 10 * 1024 * 1024
const PDF_MAX_BYTES = 50 * 1024 * 1024

const fallbackNeedAttachmentText = {
  uploadError: "Erreur lors de l'envoi du fichier.",
  limitReached: max => `Limite atteinte : ${max} fichier(s) par besoin.`,
  invalidType: 'Type de fichier non autorise.',
  pdfPremiumOnly: 'Les PDF sont reserves au plan Premium.',
  imageTooLarge: 'Image trop lourde. Taille maximum : 10 MB.',
  pdfTooLarge: 'PDF trop lourd. Taille maximum : 50 MB.',
  moderationBlocked: 'Cette image ne respecte pas les regles de Hubbing.',
  reportError: 'Signalement impossible.',
}

const getText = ui => ui?.needAttachments || fallbackNeedAttachmentText

const normalizePlan = plan => {
  const value = String(plan || 'Starter').toLowerCase()
  if (value.includes('premium')) return 'Premium'
  if (value.includes('basic')) return 'Basic'
  return 'Starter'
}

export const getNeedAttachmentPolicy = plan => {
  const normalized = normalizePlan(plan)
  if (normalized === 'Premium') {
    return { plan: normalized, maxFiles: 15, accept: 'image/*,application/pdf', allowPdf: true }
  }
  if (normalized === 'Basic') {
    return { plan: normalized, maxFiles: 5, accept: 'image/*', allowPdf: false }
  }
  return { plan: 'Starter', maxFiles: 1, accept: 'image/*', allowPdf: false }
}

export const makeSlug = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || GENERAL_NEED_KEY

export const needKeyForTag = tag => {
  const label = typeof tag === 'string' ? tag : tag?.label
  return makeSlug(label || GENERAL_NEED_KEY)
}

export const groupNeedAttachments = (attachments = []) => attachments.reduce((groups, attachment) => {
  const key = attachment.need_key || GENERAL_NEED_KEY
  if (!groups[key]) groups[key] = []
  groups[key].push(attachment)
  return groups
}, {})

export const formatFileSize = (bytes = 0) => {
  const value = Number(bytes || 0)
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} Mo`
  }
  if (value >= 1024) return `${Math.round(value / 1024)} Ko`
  return `${value} o`
}

const detectFileType = file => {
  if (file.type?.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  return 'other'
}

const safeFileName = name => String(name || 'fichier')
  .replace(/[^\w.\- ]+/g, '')
  .trim()
  .slice(0, 120) || 'fichier'

export const validateNeedAttachmentFile = ({ file, plan, currentCount = 0, ui }) => {
  const text = getText(ui)
  const policy = getNeedAttachmentPolicy(plan)
  if (currentCount >= policy.maxFiles) throw new Error(text.limitReached(policy.maxFiles))

  const fileType = detectFileType(file)
  if (fileType === 'other') throw new Error(text.invalidType)
  if (fileType === 'pdf' && !policy.allowPdf) throw new Error(text.pdfPremiumOnly)
  if (fileType === 'image' && file.size > IMAGE_MAX_BYTES) throw new Error(text.imageTooLarge)
  if (fileType === 'pdf' && file.size > PDF_MAX_BYTES) throw new Error(text.pdfTooLarge)

  return { fileType, policy }
}

export const fetchNeedAttachments = async companyId => {
  if (!companyId) return []
  const { data, error } = await supabase
    .from('need_attachments')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .eq('moderation_status', 'approved')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export const createNeedAttachmentSignedUrl = async (storagePath, expiresIn = 3600) => {
  if (!storagePath) return null
  const { data, error } = await supabase.storage
    .from('need-attachments')
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data?.signedUrl || data?.signedURL || null
}

export const uploadNeedAttachment = async ({
  file,
  company,
  plan,
  needKey = GENERAL_NEED_KEY,
  needLabel = '',
  currentCount = 0,
  ui,
}) => {
  const text = getText(ui)
  const { fileType } = validateNeedAttachmentFile({ file, plan, currentCount, ui })

  if (fileType === 'image') {
    const moderation = await moderateImageFile(file, 'need_attachment')
    if (!moderation.allowed) throw new Error(text.moderationBlocked)
  }

  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user
  if (!user?.id || !company?.id) throw new Error(text.uploadError)

  const ext = safeFileName(file.name).split('.').pop() || (fileType === 'pdf' ? 'pdf' : 'jpg')
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const storagePath = `${company.id}/${makeSlug(needKey)}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('need-attachments')
    .upload(storagePath, file, { upsert: false, contentType: file.type || undefined })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('need_attachments')
    .insert({
      company_id: company.id,
      uploader_user_id: user.id,
      need_key: makeSlug(needKey),
      need_label: needLabel || null,
      file_name: safeFileName(file.name),
      file_type: fileType,
      mime_type: file.type || null,
      file_size: file.size || 0,
      storage_path: storagePath,
      visibility: 'need',
      status: 'active',
      moderation_status: 'approved',
    })
    .select('*')
    .single()

  if (error) {
    await supabase.storage.from('need-attachments').remove([storagePath]).catch(() => null)
    throw error
  }

  return data
}

export const deleteNeedAttachment = async attachment => {
  if (!attachment?.id) return
  const { error } = await supabase
    .from('need_attachments')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', attachment.id)
  if (error) throw error

  if (attachment.storage_path) {
    await supabase.storage.from('need-attachments').remove([attachment.storage_path]).catch(() => null)
  }
}

export const reportNeedAttachment = async ({ attachmentId, reason, comment = '', lang = 'fr' }) => {
  const text = fallbackNeedAttachmentText
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token || !SUPABASE_URL) throw new Error(text.reportError)

  const response = await fetch(`${SUPABASE_URL}/functions/v1/report-need-attachment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ attachmentId, reason, comment, lang }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body?.error || text.reportError)
  }

  return response.json()
}
