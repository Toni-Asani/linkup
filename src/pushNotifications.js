import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabaseClient'
import { isNativeApp } from './platform'

const isIosNative = () => isNativeApp() && Capacitor.getPlatform() === 'ios'

export async function registerPushNotifications() {
  if (!isIosNative()) return () => {}

  const handles = []

  try {
    handles.push(await PushNotifications.addListener('registration', async (token) => {
      if (!token?.value) return
      const { error } = await supabase.functions.invoke('register-push-token', {
        body: {
          token: token.value,
          platform: Capacitor.getPlatform(),
        },
      })
      if (error) console.warn('Unable to save push token:', error)
    }))

    handles.push(await PushNotifications.addListener('registrationError', (error) => {
      console.warn('Push notification registration failed:', error)
    }))

    handles.push(await PushNotifications.addListener('pushNotificationReceived', () => {}))
    handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', () => {}))

    let permission = await PushNotifications.checkPermissions()
    if (permission.receive !== 'granted') {
      permission = await PushNotifications.requestPermissions()
    }

    if (permission.receive === 'granted') {
      await PushNotifications.register()
    }
  } catch (error) {
    console.warn('Push notifications unavailable:', error)
  }

  return () => {
    handles.forEach(handle => handle?.remove?.())
  }
}
