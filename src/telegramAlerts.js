import { supabase } from './supabaseClient'

const VISITOR_ID_KEY = 'hubbing_visitor_id'
const ALERT_COOLDOWN_PREFIX = 'hubbing_alert_sent_at_'

const getVisitorId = () => {
  try {
    const existing = window.localStorage.getItem(VISITOR_ID_KEY)
    if (existing) return existing
    const generated = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    window.localStorage.setItem(VISITOR_ID_KEY, generated)
    return generated
  } catch {
    return 'unknown'
  }
}

const shouldSendAlert = (key, cooldownMinutes) => {
  if (!cooldownMinutes) return true
  try {
    const storageKey = `${ALERT_COOLDOWN_PREFIX}${key}`
    const previous = Number(window.localStorage.getItem(storageKey) || 0)
    const now = Date.now()
    if (previous && now - previous < cooldownMinutes * 60 * 1000) return false
    window.localStorage.setItem(storageKey, String(now))
    return true
  } catch {
    return true
  }
}

export const notifyTelegramActivity = async (type, details = {}, options = {}) => {
  const cooldownMinutes = options.cooldownMinutes ?? 15
  const cooldownKey = options.cooldownKey || type

  if (!shouldSendAlert(cooldownKey, cooldownMinutes)) return

  try {
    await supabase.functions.invoke('telegram-alert', {
      body: {
        type,
        visitorId: getVisitorId(),
        url: window.location.href,
        path: window.location.pathname,
        hostname: window.location.hostname,
        userAgent: window.navigator.userAgent,
        language: window.navigator.language,
        details,
      },
    })
  } catch (error) {
    console.warn('Telegram alert unavailable:', error)
  }
}
