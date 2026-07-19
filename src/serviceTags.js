export const MAX_SERVICE_TAGS = 10
export const MAX_SERVICE_TAG_LENGTH = 40

export const normalizeServiceTag = value => String(value || '')
  .replace(/^#+/, '')
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, MAX_SERVICE_TAG_LENGTH)

export const serviceTagKey = value => normalizeServiceTag(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const parseServiceTags = value => {
  let source = value
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value)
    } catch {
      source = value.split(',')
    }
  }
  if (!Array.isArray(source)) return []

  const seen = new Set()
  const tags = []
  source.forEach(item => {
    const tag = normalizeServiceTag(typeof item === 'string' ? item : item?.label)
    const key = serviceTagKey(tag)
    if (!tag || !key || seen.has(key) || tags.length >= MAX_SERVICE_TAGS) return
    seen.add(key)
    tags.push(tag)
  })
  return tags
}

export const addServiceTag = (tags, value) => {
  const current = parseServiceTags(tags)
  const tag = normalizeServiceTag(value)
  const key = serviceTagKey(tag)
  if (!tag || !key || current.length >= MAX_SERVICE_TAGS) return current
  if (current.some(item => serviceTagKey(item) === key)) return current
  return [...current, tag]
}

export const formatServiceTag = value => {
  const tag = normalizeServiceTag(value)
  return tag ? `#${tag}` : ''
}

export const getServiceTagsText = value => parseServiceTags(value).join(' ')

