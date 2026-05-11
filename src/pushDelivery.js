import { supabase } from './supabaseClient'

export async function sendPushForNotification(notificationId) {
  if (!notificationId) return

  try {
    const { error } = await supabase.functions.invoke('send-push-notification', {
      body: { notificationId },
    })
    if (error) throw error
  } catch (error) {
    console.warn('Unable to send push notification:', error)
  }
}

export async function createNotificationAndPush(notification) {
  const { data, error } = await supabase
    .from('notifications')
    .insert(notification)
    .select('id')
    .single()

  if (error) {
    console.warn('Unable to create notification:', error)
    return { data: null, error }
  }

  await sendPushForNotification(data?.id)
  return { data, error: null }
}
