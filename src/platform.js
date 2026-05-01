import { Capacitor } from '@capacitor/core'

export const getPlatform = () => {
  try {
    return Capacitor.getPlatform()
  } catch {
    return 'web'
  }
}

export const isNativeApp = () => getPlatform() !== 'web'

export const isNativeIOS = () => getPlatform() === 'ios'
