import { Capacitor, registerPlugin } from '@capacitor/core'

export const HubbingBadge = registerPlugin('HubbingBadge')

const canUseNativeBadge = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

export async function syncUnreadAppBadge(count) {
  if (!canUseNativeBadge()) return

  const badgeCount = Math.max(0, Number(count) || 0)
  try {
    await HubbingBadge.setBadgeCount({ count: badgeCount })
  } catch (error) {
    console.warn('Unable to update iOS app badge:', error)
  }
}

export async function clearAppBadge() {
  if (!canUseNativeBadge()) return

  try {
    await HubbingBadge.clearBadge()
  } catch (error) {
    console.warn('Unable to clear iOS app badge:', error)
  }
}

export async function showNativeNotification({ title, body, count, id } = {}) {
  if (!canUseNativeBadge()) return

  try {
    await HubbingBadge.showNotification({
      title: title || 'Hubbing',
      body: body || '',
      count: Math.max(0, Number(count) || 0),
      id: id || `hubbing-${Date.now()}`,
    })
  } catch (error) {
    console.warn('Unable to show iOS notification:', error)
  }
}
