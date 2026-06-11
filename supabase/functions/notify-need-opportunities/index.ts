import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GENERAL_NEED_KEY = 'general'
const MAX_RECIPIENTS_PER_NEED = 30
const MIN_RELEVANCE_SCORE = 3

const stopWords = new Set([
  'avec', 'dans', 'pour', 'des', 'les', 'une', 'sur', 'nous', 'vous', 'notre', 'votre', 'besoin',
  'besoins', 'entreprise', 'entreprises', 'service', 'services', 'projet', 'projets', 'recherche',
  'cherchons', 'cherche', 'besoin', 'partenaire', 'partenaires', 'suisse', 'local', 'locaux', 'faire',
  'plus', 'aux', 'par', 'qui', 'que', 'chez', 'mon', 'ma', 'mes', 'nos', 'vos', 'leur', 'leurs',
])

const sectorServiceKeywords: Record<string, string[]> = {
  'Marketing & Publicité': [
    'marketing', 'publicité', 'communication', 'campagne', 'réseaux sociaux', 'branding',
    'identité visuelle', 'logo', 'graphisme', 'design', 'print', 'impression', 'flyer',
    'affiche', 'signalétique', 'enseigne', 'site web', 'digital', 'publicitaire',
  ],
  'Marketing Digital': ['marketing', 'digital', 'réseaux sociaux', 'site web', 'campagne', 'seo', 'publicité', 'communication'],
  'Design & Créatif': ['design', 'graphisme', 'logo', 'branding', 'identité visuelle', 'illustration', 'création', 'visuel'],
  'Design & Communication': ['design', 'communication', 'graphisme', 'logo', 'branding', 'identité visuelle', 'supports', 'visuel'],
  'Informatique & Tech': ['informatique', 'logiciel', 'application', 'site web', 'développement', 'tech', 'maintenance', 'automatisation'],
  Informatique: ['informatique', 'logiciel', 'application', 'site web', 'développement', 'maintenance', 'support'],
  'Fiduciaire & Comptabilité': ['fiduciaire', 'comptabilité', 'fiscalité', 'déclaration', 'salaires', 'bouclement', 'audit'],
  Fiduciaire: ['fiduciaire', 'comptabilité', 'fiscalité', 'déclaration', 'salaires', 'bouclement'],
  'BTP & Construction': ['chantier', 'construction', 'rénovation', 'maçonnerie', 'peinture', 'plomberie', 'électricité', 'architecture'],
  Construction: ['chantier', 'construction', 'rénovation', 'maçonnerie', 'peinture', 'plomberie', 'électricité'],
  'Ressources Humaines': ['recrutement', 'rh', 'formation', 'coaching', 'emploi', 'talent', 'salaire'],
  'Transport & Logistique': ['transport', 'livraison', 'logistique', 'stockage', 'déménagement', 'expédition'],
  'Commerce & Retail': ['commerce', 'vente', 'boutique', 'retail', 'distribution', 'fournisseur'],
  Immobilier: ['immobilier', 'location', 'vente', 'gestion', 'courtage', 'estimation'],
  'Finance & Assurance': ['finance', 'assurance', 'crédit', 'hypothèque', 'placement', 'prévoyance'],
  'Santé & Bien-être': ['santé', 'bien-être', 'soins', 'thérapie', 'coaching', 'médical'],
  'Éducation & Formation': ['formation', 'cours', 'éducation', 'atelier', 'apprentissage', 'coaching'],
  Juridique: ['juridique', 'avocat', 'contrat', 'droit', 'conseil', 'litige'],
  'Industrie & Production': ['industrie', 'production', 'usinage', 'fabrication', 'maintenance', 'atelier'],
  'Tourisme & Hôtellerie': ['tourisme', 'hôtel', 'hébergement', 'voyage', 'accueil', 'événement'],
  Restauration: ['restaurant', 'traiteur', 'cuisine', 'repas', 'événement', 'alimentation'],
  'Nettoyage & Facility': ['nettoyage', 'facility', 'entretien', 'maintenance', 'désinfection', 'jardin', 'jardinier', 'paysagiste', 'espaces verts', 'conciergerie'],
  Sécurité: ['sécurité', 'surveillance', 'alarme', 'contrôle', 'protection'],
  Événementiel: ['événement', 'animation', 'organisation', 'stand', 'sonorisation', 'location'],
  Consulting: ['conseil', 'stratégie', 'organisation', 'audit', 'accompagnement', 'optimisation'],
  Services: ['service', 'entretien', 'maintenance', 'jardin', 'jardinier', 'paysagiste', 'conciergerie'],
}

const enc = new TextEncoder()

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const env = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Missing Supabase environment')
  }
  return { supabaseUrl, anonKey, serviceRoleKey }
}

const serviceHeaders = (extra: Record<string, string> = {}) => {
  const { serviceRoleKey } = env()
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

const restUrl = (table: string, params: Record<string, string> = {}) => {
  const { supabaseUrl } = env()
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

const getCurrentUser = async (authorization: string) => {
  const { supabaseUrl, anonKey } = env()
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  })
  if (!response.ok) return null
  return await response.json()
}

const readRows = async <T>(table: string, params: Record<string, string>) => {
  const response = await fetch(restUrl(table, params), { headers: serviceHeaders() })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T[]
}

const insertRow = async <T>(table: string, payload: Record<string, unknown>, select = 'id') => {
  const response = await fetch(restUrl(table, { select }), {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(payload),
  })

  if (response.status === 409) return { duplicate: true, data: null as T | null }
  if (!response.ok) throw new Error(await response.text())

  const rows = await response.json() as T[]
  return { duplicate: false, data: rows?.[0] || null }
}

const updateRows = async (table: string, params: Record<string, string>, payload: Record<string, unknown>) => {
  const response = await fetch(restUrl(table, params), {
    method: 'PATCH',
    headers: serviceHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(await response.text())
}

const normalizeSearchText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const tokenize = (value = '') => normalizeSearchText(value)
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(token => token.length >= 4 && !stopWords.has(token))

const unique = (items: string[] = []) => Array.from(new Set(items.filter(Boolean)))

const getTokenRoots = (token = '') => unique([
  token,
  token.length >= 6 ? token.slice(0, 6) : '',
  token.length >= 7 ? token.slice(0, 7) : '',
].filter(part => part.length >= 4))

const getSectorServiceText = (sector = '') => {
  const normalizedSector = normalizeSearchText(sector)
  const matchingKey = Object.keys(sectorServiceKeywords).find(key => normalizeSearchText(key) === normalizedSector)
  return matchingKey ? sectorServiceKeywords[matchingKey].join(' ') : ''
}

const makeSlug = (value = '') => normalizeSearchText(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || GENERAL_NEED_KEY

const parseActiveTags = (needsTags: unknown) => {
  try {
    const tags = typeof needsTags === 'string' ? JSON.parse(needsTags) : needsTags
    if (!Array.isArray(tags)) return []
    return tags.filter(tag => {
      const expires = typeof tag === 'string' ? null : tag?.expires
      return !expires || new Date(expires) > new Date()
    })
  } catch {
    return []
  }
}

const getActiveNeeds = (company: Record<string, unknown>) => {
  const needs = []
  const description = String(company.needs_description || '').trim()
  if (description) {
    needs.push({
      key: GENERAL_NEED_KEY,
      title: description.length > 160 ? `${description.slice(0, 157)}...` : description,
      text: description,
    })
  }

  parseActiveTags(company.needs_tags).forEach(tag => {
    const label = typeof tag === 'string' ? tag : String(tag?.label || '').trim()
    if (!label) return
    needs.push({
      key: makeSlug(label),
      title: label.length > 160 ? `${label.slice(0, 157)}...` : label,
      text: label,
    })
  })

  return needs
}

const getCompanyOfferText = (company: Record<string, unknown>) => [
  company.sector,
  company.description,
  company.services,
  getSectorServiceText(String(company.sector || '')),
].filter(Boolean).join(' ')

const scoreCompanyForNeed = (needText: string, company: Record<string, unknown>) => {
  const needTokens = tokenize(needText)
  const offerTokens = tokenize(getCompanyOfferText(company))
  const offerRoots = new Set(offerTokens.flatMap(getTokenRoots))
  const keywordMatches = unique(needTokens.filter(token => getTokenRoots(token).some(root => offerRoots.has(root))))
  if (!keywordMatches.length) return null

  let score = keywordMatches.length * 3
  if (company.canton) score += 1
  if (company.description) score += 1

  return {
    company,
    score,
    relevanceScore: keywordMatches.length * 3,
    keywordMatches: keywordMatches.slice(0, 4),
  }
}

const fingerprintNeed = async (needText: string) => {
  const normalized = normalizeSearchText(needText).replace(/\s+/g, ' ').trim()
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(normalized))
  const bytes = Array.from(new Uint8Array(digest))
  return bytes.map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 40)
}

const sendPushForNotification = async (notificationId: string, authorization: string) => {
  const { supabaseUrl, anonKey } = env()
  const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notificationId }),
  })
  if (!response.ok) throw new Error(await response.text())
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authorization = req.headers.get('Authorization') || ''
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const user = await getCurrentUser(authorization)
    if (!user?.id) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const companyId = String(body.companyId || '').trim()
    const dryRun = body.dryRun === true
    if (!companyId) return json({ error: 'Missing companyId' }, 400)

    const sourceRows = await readRows<Record<string, unknown>>('companies', {
      select: 'id,user_id,name,sector,description,canton,needs_description,needs_tags,needs_updated_at,is_suspended',
      id: `eq.${companyId}`,
      user_id: `eq.${user.id}`,
      limit: '1',
    })
    const sourceCompany = sourceRows?.[0]
    if (!sourceCompany?.id) return json({ error: 'Company not found' }, 404)
    if (sourceCompany.is_suspended === true) return json({ ok: true, skipped: 'source_suspended' })

    const activeNeeds = getActiveNeeds(sourceCompany)
    if (!activeNeeds.length) return json({ ok: true, matched: 0, sent: 0, skipped: 'no_active_needs' })

    const candidateCompanies = await readRows<Record<string, unknown>>('companies', {
      select: 'id,user_id,name,sector,description,canton,notif_app,is_suspended',
      is_suspended: 'eq.false',
      user_id: 'not.is.null',
      limit: '500',
    })

    let matched = 0
    let created = 0
    let sent = 0
    let duplicates = 0
    const errors: string[] = []

    for (const need of activeNeeds) {
      const fingerprint = await fingerprintNeed(need.text)
      const scoredMatches: Array<{ company: Record<string, unknown>; score: number; relevanceScore: number; keywordMatches: string[] }> = []
      candidateCompanies
        .filter(company => company.id !== sourceCompany.id && company.user_id !== sourceCompany.user_id && company.notif_app !== false)
        .forEach(company => {
          const match = scoreCompanyForNeed(need.text, company)
          if (match && match.relevanceScore >= MIN_RELEVANCE_SCORE) scoredMatches.push(match)
        })
      const rankedMatches = scoredMatches
        .sort((a, b) => b.score - a.score || String(a.company.name || '').localeCompare(String(b.company.name || '')))
        .slice(0, MAX_RECIPIENTS_PER_NEED)

      matched += rankedMatches.length
      if (dryRun) continue

      for (const match of rankedMatches) {
        const recipientCompany = match.company
        const recipientUserId = String(recipientCompany.user_id || '')
        if (!recipientUserId) continue

        try {
          const dedupe = await insertRow<{ id: string }>('need_opportunity_notifications', {
            source_company_id: sourceCompany.id,
            recipient_company_id: recipientCompany.id,
            user_id: recipientUserId,
            need_key: need.key,
            need_fingerprint: fingerprint,
          })

          if (dedupe.duplicate || !dedupe.data?.id) {
            duplicates += 1
            continue
          }

          const notification = await insertRow<{ id: string }>('notifications', {
            user_id: recipientUserId,
            type: 'new_need_opportunity',
            opportunity_company_id: sourceCompany.id,
            opportunity_need_key: need.key,
            opportunity_need_title: need.title,
            read: false,
          })

          if (!notification.data?.id) continue
          created += 1

          await updateRows('need_opportunity_notifications', { id: `eq.${dedupe.data.id}` }, {
            notification_id: notification.data.id,
            updated_at: new Date().toISOString(),
          })

          await sendPushForNotification(notification.data.id, authorization)
          sent += 1
        } catch (error) {
          errors.push(error?.message || String(error))
        }
      }
    }

    return json({ ok: true, matched, created, sent, duplicates, errors: errors.slice(0, 5) })
  } catch (error) {
    return json({ error: error.message || 'Unexpected error' }, 500)
  }
})
