import { registerPlugin } from '@capacitor/core'

export const APPLE_PRODUCT_IDS = {
  basic: process.env.REACT_APP_APPLE_IAP_BASIC || 'ch.hubbing.app.basic.monthly',
  premium: process.env.REACT_APP_APPLE_IAP_PREMIUM || 'ch.hubbing.app.premium.monthly',
}

export const HubbingPurchases = registerPlugin('HubbingPurchases')
