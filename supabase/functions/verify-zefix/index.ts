import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type ZefixCompany = {
  name?: string
  uid?: string
  chid?: string
  status?: string
  legalSeat?: string
  legalForm?: { name?: Record<string, string> | string }
  address?: {
    organisation?: string
    street?: string
    houseNumber?: string
    swissZipCode?: string
    town?: string
    canton?: string
  }
}

const normalizeUidDigits = (value = '') => String(value).replace(/[^0-9]/g, '').trim()

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' et ')
  .replace(/\b(sa|sarl|sagl|gmbh|ag|s a r l|s a)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const simpleSimilarity = (left = '', right = '') => {
  const a = normalizeText(left)
  const b = normalizeText(right)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.82

  const aWords = new Set(a.split(' ').filter(Boolean))
  const bWords = new Set(b.split(' ').filter(Boolean))
  const shared = [...aWords].filter((word) => bWords.has(word)).length
  const total = new Set([...aWords, ...bWords]).size
  return total ? shared / total : 0
}

const responseJson = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const zefixAuthHeader = () => {
  const username = Deno.env.get('ZEFIX_USERNAME') || Deno.env.get('ZEFIX_USER')
  const password = Deno.env.get('ZEFIX_PASSWORD')
  if (!username || !password) return null
  return `Basic ${btoa(`${username}:${password}`)}`
}

const cleanBaseUrl = (value?: string | null) => (value || 'https://www.zefix.admin.ch/ZefixPublicREST').replace(/\/+$/, '')

const extractCompany = (payload: unknown): ZefixCompany | null => {
  if (!payload) return null
  if (Array.isArray(payload)) return (payload[0] ?? null) as ZefixCompany | null
  if (typeof payload !== 'object') return null
  const candidate = payload as Record<string, unknown>
  if (Array.isArray(candidate.companies)) return (candidate.companies[0] ?? null) as ZefixCompany | null
  if (candidate.company && typeof candidate.company === 'object') return candidate.company as ZefixCompany
  return payload as ZefixCompany
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return responseJson({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const {
      zefix,
      company,
      address,
      npa,
      city,
      canton,
    } = await req.json()

    const uidDigits = normalizeUidDigits(zefix)
    if (uidDigits.length !== 9) {
      return responseJson({ ok: false, verified: false, reason: 'invalid_uid_format' }, 400)
    }

    const authHeader = zefixAuthHeader()
    if (!authHeader) {
      return responseJson({
        ok: false,
        verified: false,
        configured: false,
        fallbackToManual: true,
        reason: 'zefix_credentials_missing',
      }, 503)
    }

    const baseUrl = cleanBaseUrl(Deno.env.get('ZEFIX_BASE_URL'))
    const uid = `CHE${uidDigits}`
    const response = await fetch(`${baseUrl}/api/v1/company/uid/${uid}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
    })

    if (response.status === 404) {
      return responseJson({ ok: true, verified: false, reason: 'not_found', uid }, 404)
    }

    if (response.status === 401 || response.status === 403) {
      return responseJson({
        ok: false,
        verified: false,
        configured: true,
        fallbackToManual: true,
        reason: 'zefix_auth_failed',
      }, 502)
    }

    if (!response.ok) {
      const details = await response.text()
      return responseJson({
        ok: false,
        verified: false,
        fallbackToManual: true,
        reason: 'zefix_unavailable',
        status: response.status,
        details: details.slice(0, 250),
      }, 502)
    }

    const payload = await response.json()
    const zefixCompany = extractCompany(payload)
    if (!zefixCompany?.name) {
      return responseJson({ ok: true, verified: false, reason: 'not_found', uid }, 404)
    }

    const status = String(zefixCompany.status || '').toUpperCase()
    const active = !status || status === 'ACTIVE' || status === 'EXISTING'
    if (!active) {
      return responseJson({
        ok: true,
        verified: false,
        reason: 'inactive_company',
        uid,
        status,
        company: zefixCompany,
      }, 422)
    }

    const nameSimilarity = simpleSimilarity(company, zefixCompany.name)
    const suppliedLocation = normalizeText([npa, city, canton].filter(Boolean).join(' '))
    const officialLocation = normalizeText([
      zefixCompany.address?.swissZipCode,
      zefixCompany.address?.town,
      zefixCompany.address?.canton,
      zefixCompany.legalSeat,
    ].filter(Boolean).join(' '))
    const locationMatches = suppliedLocation && officialLocation
      ? officialLocation.includes(suppliedLocation) || suppliedLocation.includes(officialLocation)
      : null

    return responseJson({
      ok: true,
      verified: true,
      source: 'zefix',
      uid,
      match: {
        nameSimilarity,
        nameLooksRelated: nameSimilarity >= 0.35,
        locationMatches,
      },
      supplied: {
        company,
        address,
        npa,
        city,
        canton,
      },
      company: {
        name: zefixCompany.name,
        uid: zefixCompany.uid || uid,
        chid: zefixCompany.chid,
        status: status || 'ACTIVE',
        legalSeat: zefixCompany.legalSeat,
        legalForm: zefixCompany.legalForm,
        address: zefixCompany.address,
      },
    })
  } catch (error) {
    return responseJson({
      ok: false,
      verified: false,
      fallbackToManual: true,
      reason: 'unexpected_error',
      error: error instanceof Error ? error.message : String(error),
    }, 500)
  }
})
