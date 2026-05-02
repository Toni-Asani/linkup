import { supabase } from './supabaseClient'

export const forbiddenWords = [
  'sexe', 'sex', 'porn', 'porno', 'nue', 'nud', 'bite', 'queue', 'chatte', 'vagin', 'penis', 'seins', 'cul',
  'baise', 'baiser', 'niquer', 'coucher', 'erotique', 'erotic', 'xxx', 'escort', 'prostituee',
  'negre', 'youpin', 'bougnoule', 'bamboula', 'bicot', 'raton', 'sale arabe', 'sale noir',
  'sale juif', 'hitler', 'nazi', 'heil', 'ku klux', 'kkk', 'raciste', 'antisemite',
  'connard', 'encule', 'fdp', 'ntm', 'pute', 'salope', 'batard',
]

export const normalizeForModeration = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const containsForbiddenContent = (text = '') => {
  const normalized = normalizeForModeration(text)
  return forbiddenWords.some(word => normalized.includes(word))
}

const emailPattern = /[a-z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\sat\s)\s*[a-z0-9.-]+\s*(?:\.|\sdot\s|\[dot\]|\(dot\))\s*[a-z]{2,}/i
const urlPattern = /\b(?:https?:\/\/|www\.|[a-z0-9-]+\s*(?:\.|\sdot\s|\[dot\]|\(dot\))\s*(?:ch|com|net|org|io|co|fr|de|it|li|me|app|dev|biz|info)\b)/i
const phoneCandidatePattern = /(?:\+|00|0)\d[\d\s()./-]{6,}\d/g

export const detectDirectContactInfo = (text = '') => {
  const value = normalizeForModeration(text)
  if (emailPattern.test(value)) return { type: 'email' }
  if (urlPattern.test(value)) return { type: 'external_link' }

  const candidates = value.match(phoneCandidatePattern) || []
  const hasPhoneNumber = candidates.some(candidate => {
    const digits = candidate.replace(/\D/g, '')
    return digits.length >= 9 && digits.length <= 15
  })
  if (hasPhoneNumber) return { type: 'phone_number' }

  return null
}

export const containsDirectContactInfo = (text = '') => Boolean(detectDirectContactInfo(text))

const invokeModeration = async (payload) => {
  const { data, error } = await supabase.functions.invoke('moderate-content', {
    body: payload,
  })
  if (error) throw error
  return data
}

export const moderateTextContent = async (text, context = 'message') => {
  if (!String(text || '').trim()) {
    return { allowed: true }
  }

  if (containsForbiddenContent(text)) {
    return { allowed: false, reason: 'local_forbidden_word' }
  }

  if (context === 'message') {
    const directContact = detectDirectContactInfo(text)
    if (directContact) {
      return {
        allowed: false,
        reason: 'direct_contact_info',
        categories: [directContact.type],
      }
    }
  }

  try {
    const result = await invokeModeration({ type: 'text', text, context })
    return result || { allowed: true }
  } catch (error) {
    console.warn('Remote text moderation unavailable:', error)
    return { allowed: true, skipped: true, reason: 'remote_unavailable' }
  }
}

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

export const imageFileToModerationDataUrl = async (file) => {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    const loaded = new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
    })
    image.src = sourceUrl
    await loaded

    const maxSide = 960
    const ratio = Math.min(1, maxSide / Math.max(image.width, image.height))
    const width = Math.max(1, Math.round(image.width * ratio))
    const height = Math.max(1, Math.round(image.height * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0, width, height)

    return canvas.toDataURL('image/jpeg', 0.82)
  } catch (error) {
    if (file.size <= 4 * 1024 * 1024) return readFileAsDataUrl(file)
    throw error
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

export const moderateImageFile = async (file, context = 'image') => {
  if (!file?.type?.startsWith('image/')) {
    return { allowed: true }
  }

  try {
    const image = await imageFileToModerationDataUrl(file)
    const result = await invokeModeration({
      type: 'image',
      image,
      context,
      fileName: file.name,
      mimeType: file.type,
    })
    return result || { allowed: true }
  } catch (error) {
    console.warn('Remote image moderation unavailable:', error)
    return { allowed: true, skipped: true, reason: 'remote_unavailable' }
  }
}
