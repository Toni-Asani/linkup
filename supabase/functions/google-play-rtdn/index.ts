import {
  recordRtdnEvent,
  syncGooglePlaySubscription,
} from '../_shared/google-play.ts'

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const decodeBase64Json = (data: string) => {
  const binary = atob(data)
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

Deno.serve(async req => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const url = new URL(req.url)
    const expectedSecret = Deno.env.get('GOOGLE_PLAY_RTDN_WEBHOOK_SECRET') || ''
    const providedSecret = url.searchParams.get('secret') || ''
    if (!expectedSecret || providedSecret !== expectedSecret) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const envelope = await req.json()
    const messageId = String(envelope?.message?.messageId || '')
    const encodedData = String(envelope?.message?.data || '')
    if (!encodedData) return json({ error: 'Missing Pub/Sub message data' }, 400)

    const notification = decodeBase64Json(encodedData)
    if (notification.packageName && notification.packageName !== 'ch.hubbing.app') {
      return json({ error: 'Unexpected package name' }, 400)
    }

    if (notification.testNotification) {
      await recordRtdnEvent({ messageId })
      return json({ ok: true, testNotification: true })
    }

    const subscriptionNotification = notification.subscriptionNotification
    if (!subscriptionNotification?.purchaseToken) {
      await recordRtdnEvent({ messageId })
      return json({ ok: true, skipped: 'not_a_subscription_notification' })
    }

    const eventTime = notification.eventTimeMillis
      ? new Date(Number(notification.eventTimeMillis)).toISOString()
      : null
    const notificationType = Number(subscriptionNotification.notificationType || 0)
    const purchaseToken = String(subscriptionNotification.purchaseToken)

    const subscription = await syncGooglePlaySubscription({
      purchaseToken,
      notificationType,
      eventTime,
    })
    await recordRtdnEvent({
      messageId,
      notificationType,
      purchaseToken,
      eventTime,
    })

    return json({ ok: true, subscription })
  } catch (error) {
    console.error('Google Play RTDN processing failed', error)
    return json({ error: error instanceof Error ? error.message : 'RTDN processing failed' }, 500)
  }
})
