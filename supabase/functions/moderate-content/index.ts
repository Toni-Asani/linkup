import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const forbiddenWords = [
  'sexe', 'sex', 'porn', 'porno', 'nue', 'nud', 'bite', 'queue', 'chatte', 'vagin', 'penis', 'seins', 'cul',
  'baise', 'baiser', 'niquer', 'coucher', 'erotique', 'erotic', 'xxx', 'escort', 'prostituee',
  'negre', 'youpin', 'bougnoule', 'bamboula', 'bicot', 'raton', 'sale arabe', 'sale noir',
  'sale juif', 'hitler', 'nazi', 'heil', 'ku klux', 'kkk', 'raciste', 'antisemite',
  'connard', 'encule', 'fdp', 'ntm', 'pute', 'salope', 'batard',
]

const imageBlockedCategories = [
  'sexual',
  'sexual/minors',
  'violence/graphic',
  'self-harm/intent',
  'self-harm/instructions',
]

const textBlockedCategories = [
  'sexual',
  'sexual/minors',
  'harassment',
  'harassment/threatening',
  'hate',
  'hate/threatening',
  'violence/graphic',
  'self-harm/intent',
  'self-harm/instructions',
  'illicit/violent',
]

const scoreLimits: Record<string, number> = {
  sexual: 0.45,
  'sexual/minors': 0.01,
  hate: 0.55,
  'hate/threatening': 0.35,
  harassment: 0.75,
  'harassment/threatening': 0.45,
  'violence/graphic': 0.35,
  'self-harm/intent': 0.35,
  'self-harm/instructions': 0.25,
  'illicit/violent': 0.45,
}

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const hasLocalForbiddenContent = (text = '') => {
  const normalized = normalizeText(text)
  return forbiddenWords.some((word) => normalized.includes(word))
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const createModeration = async (openaiApiKey: string, input: unknown) => {
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input,
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return await response.json()
}

const parseJsonObject = (value = '') => {
  try {
    return JSON.parse(value)
  } catch {
    const first = value.indexOf('{')
    const last = value.lastIndexOf('}')
    if (first >= 0 && last > first) {
      return JSON.parse(value.slice(first, last + 1))
    }
    throw new Error('Invalid JSON response')
  }
}

const reviewImageWithVision = async (openaiApiKey: string, image: string, context = 'image') => {
  const model = Deno.env.get('OPENAI_IMAGE_REVIEW_MODEL') || 'gpt-4o-mini'
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content:
            'You are a safety classifier for Hubbing, a Swiss B2B networking app. Allow ordinary professional images: landscapes, city views, office photos, buildings, products, company logos, abstract brand visuals, and normal professional headshots. Block only clear sexual/nude/pornographic content, racist or extremist symbols, hateful or discriminatory text visible in the image, graphic violence, gore, or threatening weapon content. If uncertain, allow. Return JSON only.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Classify this ${context} image. Return exactly: {"allowed":true|false,"categories":["..."],"reason":"short reason","confidence":0-1}.`,
            },
            {
              type: 'image_url',
              image_url: { url: image, detail: 'low' },
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content || '{}'
  return parseJsonObject(content)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return jsonResponse({ allowed: true, skipped: true, reason: 'openai_key_missing' })
    }

    const payload = await req.json()
    const type = payload?.type
    const context = payload?.context || type

    if (type === 'text') {
      const text = String(payload?.text || '')
      if (!text.trim()) {
        return jsonResponse({ allowed: true, flagged: false, reason: 'empty_text' })
      }

      if (hasLocalForbiddenContent(text)) {
        return jsonResponse({
          allowed: false,
          flagged: true,
          reason: 'local_forbidden_word',
          categories: ['local_forbidden_word'],
        })
      }

      const moderation = await createModeration(openaiApiKey, text)
      const result = moderation?.results?.[0] || {}
      const categories = result.categories || {}
      const scores = result.category_scores || {}
      const blockedCategories = textBlockedCategories.filter((category) => categories[category] === true)
      const blockedByScore = Object.entries(scoreLimits)
        .filter(([category, limit]) => Number(scores[category] || 0) >= limit)
        .map(([category]) => category)
      const blocked = result.flagged === true || blockedCategories.length > 0 || blockedByScore.length > 0

      return jsonResponse({
        allowed: !blocked,
        flagged: blocked,
        reason: blocked ? 'text_policy_violation' : 'ok',
        categories: Array.from(new Set([...blockedCategories, ...blockedByScore])),
      })
    }

    if (type === 'image') {
      const image = String(payload?.image || '')
      if (!image.startsWith('data:image/') && !image.startsWith('https://')) {
        return jsonResponse({ allowed: false, flagged: true, reason: 'invalid_image' }, 400)
      }

      const moderation = await createModeration(openaiApiKey, [
        { type: 'image_url', image_url: { url: image } },
      ])
      const result = moderation?.results?.[0] || {}
      const categories = result.categories || {}
      const scores = result.category_scores || {}
      const blockedCategories = imageBlockedCategories.filter((category) => categories[category] === true)
      const blockedByScore = Object.entries(scoreLimits)
        .filter(([category, limit]) => Number(scores[category] || 0) >= limit)
        .map(([category]) => category)

      if (result.flagged === true || blockedCategories.length > 0 || blockedByScore.length > 0) {
        return jsonResponse({
          allowed: false,
          flagged: true,
          reason: 'image_policy_violation',
          categories: Array.from(new Set([...blockedCategories, ...blockedByScore])),
        })
      }

      try {
        const visionReview = await reviewImageWithVision(openaiApiKey, image, context)
        const visionBlocked = visionReview?.allowed === false && Number(visionReview?.confidence || 0) >= 0.6
        if (visionBlocked) {
          return jsonResponse({
            allowed: false,
            flagged: true,
            reason: visionReview.reason || 'image_visual_policy_violation',
            categories: Array.isArray(visionReview.categories) ? visionReview.categories : ['visual_policy_violation'],
          })
        }
      } catch (visionError) {
        console.error('Vision review skipped:', visionError)
      }

      return jsonResponse({ allowed: true, flagged: false, reason: 'ok', categories: [] })
    }

    return jsonResponse({ allowed: false, flagged: true, reason: 'unsupported_type' }, 400)
  } catch (error) {
    console.error(error)
    return jsonResponse({ allowed: false, flagged: true, reason: 'moderation_error' }, 500)
  }
})
