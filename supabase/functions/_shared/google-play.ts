const PACKAGE_NAME = 'ch.hubbing.app'
const ANDROID_PUBLISHER_SCOPE = 'https://www.googleapis.com/auth/androidpublisher'

const PRODUCT_PLANS: Record<string, 'basic' | 'premium'> = {
  hubbing_basic_monthly: 'basic',
  hubbing_premium_monthly: 'premium',
}

const encoder = new TextEncoder()

let cachedAccessToken = ''
let cachedAccessTokenExpiresAt = 0

const base64Url = (value: string | ArrayBuffer | Uint8Array) => {
  const bytes = typeof value === 'string'
    ? encoder.encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const decodeServiceAccount = () => {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') || ''
  if (!raw) throw new Error('Missing GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')

  const decoded = raw.trim().startsWith('{')
    ? raw
    : atob(raw.replace(/\s+/g, ''))
  const credentials = JSON.parse(decoded)
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Invalid Google Play service account credentials')
  }
  return credentials
}

const pemToPkcs8 = (pem: string) => {
  const clean = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

const getGoogleAccessToken = async () => {
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) {
    return cachedAccessToken
  }

  const credentials = decodeServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token'
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: ANDROID_PUBLISHER_SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }))
  const signingInput = `${header}.${claims}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(credentials.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(signingInput),
  )
  const assertion = `${signingInput}.${base64Url(signature)}`

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const payload = await response.json()
  if (!response.ok || !payload.access_token) {
    throw new Error(`Google authentication failed: ${JSON.stringify(payload)}`)
  }

  cachedAccessToken = payload.access_token
  cachedAccessTokenExpiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000
  return cachedAccessToken
}

const serviceHeaders = () => {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

const restUrl = (path: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL')
  return `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`
}

const restGet = async (path: string) => {
  const response = await fetch(restUrl(path), { headers: serviceHeaders() })
  if (!response.ok) throw new Error(await response.text())
  return await response.json()
}

const restPost = async (path: string, body: Record<string, unknown>, prefer = 'return=minimal') => {
  const response = await fetch(restUrl(path), {
    method: 'POST',
    headers: { ...serviceHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

const restPatch = async (path: string, body: Record<string, unknown>) => {
  const response = await fetch(restUrl(path), {
    method: 'PATCH',
    headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

const isUuid = (value: unknown) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))

export const getGooglePlaySubscription = async (purchaseToken: string) => {
  const accessToken = await getGoogleAccessToken()
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(`Google Play verification failed (${response.status}): ${JSON.stringify(payload)}`)
  }
  return payload
}

const normalizePurchase = (purchase: any, expectedProductId?: string) => {
  const lineItems = Array.isArray(purchase?.lineItems) ? purchase.lineItems : []
  const lineItem = expectedProductId
    ? lineItems.find((item: any) => item?.productId === expectedProductId)
    : lineItems.find((item: any) => PRODUCT_PLANS[item?.productId])
  if (!lineItem || !PRODUCT_PLANS[lineItem.productId]) {
    throw new Error('The Google Play purchase does not contain a Hubbing subscription')
  }

  const state = String(purchase.subscriptionState || 'SUBSCRIPTION_STATE_UNSPECIFIED')
  const expiryTime = lineItem.expiryTime || null
  const expiryMillis = expiryTime ? Date.parse(expiryTime) : 0
  const notExpired = !expiryMillis || expiryMillis > Date.now()
  const entitled = (
    state === 'SUBSCRIPTION_STATE_ACTIVE'
    || state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'
    || (state === 'SUBSCRIPTION_STATE_CANCELED' && notExpired)
  )

  let status = 'inactive'
  if (state === 'SUBSCRIPTION_STATE_ACTIVE') status = 'active'
  else if (state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') status = 'active'
  else if (state === 'SUBSCRIPTION_STATE_CANCELED' && notExpired) status = 'active'
  else if (state === 'SUBSCRIPTION_STATE_ON_HOLD') status = 'past_due'
  else if (state === 'SUBSCRIPTION_STATE_PAUSED') status = 'paused'
  else if (state === 'SUBSCRIPTION_STATE_EXPIRED') status = 'canceled'
  else if (state === 'SUBSCRIPTION_STATE_CANCELED') status = 'canceled'
  else if (state === 'SUBSCRIPTION_STATE_PENDING') status = 'pending'

  return {
    productId: lineItem.productId as string,
    plan: PRODUCT_PLANS[lineItem.productId],
    state,
    status,
    entitled,
    expiryTime,
    autoRenewing: Boolean(lineItem?.autoRenewingPlan?.autoRenewEnabled),
    latestOrderId: lineItem?.latestSuccessfulOrderId || null,
    linkedPurchaseToken: purchase.linkedPurchaseToken || null,
    obfuscatedAccountId:
      purchase?.externalAccountIdentifiers?.obfuscatedExternalAccountId
      || purchase?.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers?.obfuscatedExternalAccountId
      || null,
    isTestPurchase: Boolean(purchase.testPurchase),
  }
}

const findPurchaseOwner = async (purchaseToken: string, linkedPurchaseToken?: string | null) => {
  const direct = await restGet(
    `google_play_subscriptions?purchase_token=eq.${encodeURIComponent(purchaseToken)}&select=user_id&limit=1`,
  )
  if (direct?.[0]?.user_id) return direct[0].user_id as string

  if (linkedPurchaseToken) {
    const linked = await restGet(
      `google_play_subscriptions?purchase_token=eq.${encodeURIComponent(linkedPurchaseToken)}&select=user_id&limit=1`,
    )
    if (linked?.[0]?.user_id) return linked[0].user_id as string
  }
  return null
}

const findFallbackEntitlement = async (userId: string, excludedPurchaseToken: string) => {
  const now = encodeURIComponent(new Date().toISOString())
  const purchases = await restGet(
    `google_play_subscriptions?user_id=eq.${encodeURIComponent(userId)}`
      + `&purchase_token=neq.${encodeURIComponent(excludedPurchaseToken)}`
      + '&status=eq.active'
      + `&or=(expiry_time.is.null,expiry_time.gt.${now})`
      + '&select=plan,product_id,expiry_time'
      + '&order=plan.desc,expiry_time.desc'
      + '&limit=1',
  )
  return purchases?.[0] || null
}

export const syncGooglePlaySubscription = async ({
  purchaseToken,
  userId,
  expectedProductId,
  notificationType,
  eventTime,
}: {
  purchaseToken: string
  userId?: string | null
  expectedProductId?: string
  notificationType?: number | null
  eventTime?: string | null
}) => {
  if (!purchaseToken) throw new Error('Missing Google Play purchase token')
  if (expectedProductId && !PRODUCT_PLANS[expectedProductId]) {
    throw new Error('Unknown Google Play product')
  }

  const purchase = await getGooglePlaySubscription(purchaseToken)
  const normalized = normalizePurchase(purchase, expectedProductId)
  const existingOwner = await findPurchaseOwner(purchaseToken, normalized.linkedPurchaseToken)
  const externalOwner = isUuid(normalized.obfuscatedAccountId)
    ? normalized.obfuscatedAccountId
    : null
  const resolvedUserId = userId || externalOwner || existingOwner

  if (!resolvedUserId) throw new Error('Unable to associate this Google Play purchase with a Hubbing account')
  if (userId && existingOwner && userId !== existingOwner) {
    throw new Error('This Google Play purchase belongs to another Hubbing account')
  }
  if (userId && externalOwner && userId !== externalOwner) {
    throw new Error('Google Play account identifier mismatch')
  }
  if (existingOwner && externalOwner && existingOwner !== externalOwner) {
    throw new Error('Google Play purchase ownership mismatch')
  }

  const now = new Date().toISOString()
  await restPost(
    'google_play_subscriptions?on_conflict=purchase_token',
    {
      purchase_token: purchaseToken,
      user_id: resolvedUserId,
      product_id: normalized.productId,
      plan: normalized.plan,
      subscription_state: normalized.state,
      status: normalized.status,
      expiry_time: normalized.expiryTime,
      auto_renewing: normalized.autoRenewing,
      linked_purchase_token: normalized.linkedPurchaseToken,
      obfuscated_account_id: normalized.obfuscatedAccountId,
      latest_order_id: normalized.latestOrderId,
      is_test_purchase: normalized.isTestPurchase,
      last_notification_type: notificationType ?? null,
      last_event_time: eventTime || null,
      last_verified_at: now,
      updated_at: now,
    },
    'resolution=merge-duplicates,return=minimal',
  )

  if (normalized.linkedPurchaseToken) {
    await restPatch(
      `google_play_subscriptions?purchase_token=eq.${encodeURIComponent(normalized.linkedPurchaseToken)}&purchase_token=neq.${encodeURIComponent(purchaseToken)}`,
      {
        subscription_state: 'SUBSCRIPTION_STATE_REPLACED',
        status: 'replaced',
        auto_renewing: false,
        last_verified_at: now,
        updated_at: now,
      },
    )
  }

  const fallback = normalized.entitled
    ? null
    : await findFallbackEntitlement(resolvedUserId, purchaseToken)
  const publicPlan = normalized.entitled
    ? normalized.plan
    : fallback?.plan || 'starter'
  const publicStatus = normalized.entitled || fallback ? 'active' : normalized.status
  const publicProductId = normalized.entitled
    ? normalized.productId
    : fallback?.product_id || normalized.productId
  const publicExpiryTime = normalized.entitled
    ? normalized.expiryTime
    : fallback?.expiry_time || normalized.expiryTime
  await restPost(
    'subscriptions?on_conflict=user_id',
    {
      user_id: resolvedUserId,
      plan: publicPlan,
      status: publicStatus,
      is_founder: false,
      current_period_ends_at: publicExpiryTime,
      provider: 'google_play',
      provider_product_id: publicProductId,
      provider_verified_at: now,
    },
    'resolution=merge-duplicates,return=minimal',
  )

  return {
    userId: resolvedUserId,
    productId: normalized.productId,
    plan: publicPlan,
    purchasedPlan: normalized.plan,
    status: publicStatus,
    subscriptionState: normalized.state,
    currentPeriodEndsAt: publicExpiryTime,
    autoRenewing: normalized.autoRenewing,
    entitled: normalized.entitled,
    testPurchase: normalized.isTestPurchase,
  }
}

export const recordRtdnEvent = async ({
  messageId,
  notificationType,
  purchaseToken,
  eventTime,
}: {
  messageId: string
  notificationType?: number | null
  purchaseToken?: string | null
  eventTime?: string | null
}) => {
  if (!messageId) return
  await restPost(
    'google_play_rtdn_events?on_conflict=message_id',
    {
      message_id: messageId,
      notification_type: notificationType ?? null,
      purchase_token: purchaseToken || null,
      event_time: eventTime || null,
    },
    'resolution=ignore-duplicates,return=minimal',
  )
}
