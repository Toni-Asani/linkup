import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { VerifiedBadge, attachCompanySubscriptions, getCompanyBadgeVariant } from './VerifiedBadge'
import { HubbingIcon } from './icons'
import LoadingIndicator from './LoadingIndicator'
import { getCompanyCoordinates } from './geo'

const sectorColors = {
  'Fiduciaire & Comptabilité': '#2F7D32',
  'Fiduciaire': '#2F7D32',
  'Design & Créatif': '#7E3BB0',
  'Design & Communication': '#7E3BB0',
  'Informatique & Tech': '#1976D2',
  'Informatique': '#1976D2',
  'BTP & Construction': '#D32F2F',
  'Construction': '#D32F2F',
  'Marketing & Publicité': '#E91E63',
  'Marketing Digital': '#E91E63',
  'Ressources Humaines': '#0097A7',
  'Transport & Logistique': '#795548',
  'Commerce & Retail': '#FF8F00',
  'Immobilier': '#5D4037',
  'Finance & Assurance': '#388E3C',
  'Santé & Bien-être': '#00897B',
  'Éducation & Formation': '#5E35B1',
  'Juridique': '#455A64',
  'Industrie & Production': '#6D4C41',
  'Tourisme & Hôtellerie': '#039BE5',
  'Restauration': '#F4511E',
  'Nettoyage & Facility': '#00ACC1',
  'Sécurité': '#263238',
  'Événementiel': '#EC407A',
  'Consulting': '#3949AB',
  'Services': '#607D8B',
}

const sectors = Object.keys(sectorColors)
const swissCantons = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH']
const opportunityFiltersInitial = { query: '', radius: 300, sector: '', canton: '' }
const opportunityLimits = { starter: 3, basic: 30, premium: Infinity }
const planPriority = { premium: 0, basic: 1, starter: 2 }
const stopWords = new Set([
  'avec', 'dans', 'pour', 'des', 'les', 'une', 'sur', 'nous', 'vous', 'notre', 'votre', 'besoin',
  'besoins', 'entreprise', 'entreprises', 'service', 'services', 'projet', 'projets', 'recherche',
  'partenaire', 'partenaires', 'suisse', 'local', 'locaux', 'faire', 'plus', 'aux', 'par',
])

const normalizePlan = (value) => {
  const normalized = String(value || 'starter').toLowerCase()
  if (normalized.includes('premium')) return 'premium'
  if (normalized.includes('basic')) return 'basic'
  return 'starter'
}

const getOpportunityLimit = (plan) => opportunityLimits[normalizePlan(plan)] || opportunityLimits.starter

const getActiveTags = (needsTags) => {
  try {
    const tags = needsTags ? JSON.parse(needsTags) : []
    if (!Array.isArray(tags)) return []
    return tags.filter(tag => !tag?.expires || new Date(tag.expires) > new Date())
  } catch {
    return []
  }
}

const normalizeSearchText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()

const tokenize = (value = '') => normalizeSearchText(value)
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(token => token.length >= 4 && !stopWords.has(token))

const unique = (items = []) => Array.from(new Set(items.filter(Boolean)))

const getCompanyNeedsText = (company) => [
  company?.needs_description,
  ...getActiveTags(company?.needs_tags).map(tag => tag.label),
].filter(Boolean).join(' ')

const getCompanyProfileText = (company) => [
  company?.name,
  company?.sector,
  company?.description,
  company?.services,
  company?.city,
  company?.canton,
  company?.needs_description,
  ...getActiveTags(company?.needs_tags).map(tag => tag.label),
].filter(Boolean).join(' ')

const hasCompanyNeeds = (company) => normalizeSearchText(getCompanyNeedsText(company)).trim().length > 0

const getNeedSummary = (company) => {
  const description = String(company?.needs_description || '').trim()
  if (description) {
    const firstSentence = description.split(/[.!?\n]/).find(part => part.trim()) || description
    return firstSentence.trim().length > 110 ? `${firstSentence.trim().slice(0, 107)}...` : firstSentence.trim()
  }
  const tag = getActiveTags(company?.needs_tags)[0]?.label
  return tag || ''
}

const haversine = (lat1, lon1, lat2, lon2) => {
  const toRad = (degrees) => degrees * Math.PI / 180
  const radius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const getDistanceKm = (companyA, companyB) => {
  const a = getCompanyCoordinates(companyA)
  const b = getCompanyCoordinates(companyB)
  if (!a || !b) return null
  return haversine(a.lat, a.lng, b.lat, b.lng)
}

const getKeywordMatches = (currentCompany, opportunityCompany) => {
  const currentTokens = new Set(tokenize(getCompanyProfileText(currentCompany)))
  const needTokens = tokenize(getCompanyNeedsText(opportunityCompany))
  return unique(needTokens.filter(token => currentTokens.has(token))).slice(0, 4)
}

const getFreshnessScore = (company) => {
  const value = company?.needs_updated_at || company?.updated_at || company?.created_at
  const timestamp = value ? new Date(value).getTime() : 0
  return Number.isFinite(timestamp) ? timestamp : 0
}

const buildOpportunity = (company, currentCompany, attachmentCount = 0) => {
  const activeTags = getActiveTags(company?.needs_tags)
  const keywordMatches = getKeywordMatches(currentCompany, company)
  const distanceKm = getDistanceKm(currentCompany, company)
  const matchReasons = []
  let score = 0

  if (company?.sector && company.sector === currentCompany?.sector) {
    score += 8
    matchReasons.push(company.sector)
  }
  if (company?.canton && company.canton === currentCompany?.canton) {
    score += 4
    matchReasons.push(company.canton)
  }
  keywordMatches.forEach(token => {
    score += 3
    matchReasons.push(token)
  })
  if (typeof distanceKm === 'number') {
    if (distanceKm <= 25) score += 3
    else if (distanceKm <= 50) score += 2
    else if (distanceKm <= 100) score += 1
  }
  if (getFreshnessScore(company) > Date.now() - 1000 * 60 * 60 * 24 * 30) score += 1

  return {
    id: company.id,
    company,
    title: getNeedSummary(company),
    activeTags,
    keywordMatches,
    matchReasons: unique(matchReasons).slice(0, 4),
    distanceKm,
    attachmentCount,
    score,
    freshness: getFreshnessScore(company),
    planRank: planPriority[normalizePlan(company.subscription_plan || company.plan)] ?? 3,
  }
}

const matchesOpportunityFilters = (opportunity, filters) => {
  const company = opportunity.company || {}
  if (filters.sector && company.sector !== filters.sector) return false
  if (filters.canton && company.canton !== filters.canton) return false
  if (filters.query) {
    const haystack = normalizeSearchText([
      company.name,
      company.sector,
      company.city,
      company.canton,
      getCompanyNeedsText(company),
      opportunity.matchReasons?.join(' '),
    ].filter(Boolean).join(' '))
    if (!haystack.includes(normalizeSearchText(filters.query).trim())) return false
  }
  if (Number(filters.radius) < 300 && typeof opportunity.distanceKm === 'number' && opportunity.distanceKm > Number(filters.radius)) {
    return false
  }
  return true
}

export default function HomeScreen({ user, setActiveTab, setSelectedCompanyId, plan = 'Starter', lang = 'fr' }) {
  const ui = getUiText(lang)
  const [company, setCompany] = useState(null)
  const [stats, setStats] = useState({ matches: 0, messages: 0, followers: 0, totalCompanies: 0 })
  const [matchedCompanies, setMatchedCompanies] = useState([])
  const [followerCompanies, setFollowerCompanies] = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [opportunityFilters, setOpportunityFilters] = useState(opportunityFiltersInitial)
  const [showOpportunityFilters, setShowOpportunityFilters] = useState(false)
  const [showFollowers, setShowFollowers] = useState(false)
  const [showFollowing, setShowFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const { data: comp, error: companyError } = await supabase
        .from('companies').select('*').eq('user_id', user.id).maybeSingle()
      if (companyError) throw companyError

      if (!comp) {
        setCompany(null)
        setMatchedCompanies([])
        setFollowerCompanies([])
        setOpportunities([])
        setStats({ matches: 0, messages: 0, followers: 0, totalCompanies: 0 })
        setLoadError(ui.common.companyNotFound)
        return
      }

      const compWithSubscription = await attachCompanySubscriptions(supabase, comp)
      setCompany(compWithSubscription)

      // Matchs que j'ai initiés
      const { data: myMatches, error: myMatchesError } = await supabase
        .from('matches')
        .select('id, company_a, company_b, status, created_at, company_b_profile:company_b(*)')
        .eq('company_a', comp.id)
        .eq('status', 'pending')
      if (myMatchesError) console.warn('Unable to load following matches:', myMatchesError)

      const followingMatchesRaw = (myMatchesError ? [] : myMatches || []).filter(match => match.company_b && match.company_b !== comp.id)
      const missingFollowingIds = followingMatchesRaw.filter(m => !m.company_b_profile).map(m => m.company_b).filter(Boolean)
      let followingCompaniesById = {}
      if (missingFollowingIds.length > 0) {
        const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*').in('id', missingFollowingIds)
        if (companiesError) {
          console.warn('Unable to load followed companies:', companiesError)
        } else {
          followingCompaniesById = Object.fromEntries((companiesData || []).map(c => [c.id, c]))
        }
      }
      const followingMatches = followingMatchesRaw.map(m => ({
        ...m,
        company_b: m.company_b_profile || followingCompaniesById[m.company_b]
      })).filter(m => m.company_b)
      const followingCompaniesWithSubscriptions = await attachCompanySubscriptions(
        supabase,
        followingMatches.map(m => m.company_b)
      )
      const followingSubscriptionsById = Object.fromEntries((followingCompaniesWithSubscriptions || []).map(c => [c.id, c]))
      const enrichedFollowingMatches = followingMatches.map(m => ({
        ...m,
        company_b: followingSubscriptionsById[m.company_b.id] || m.company_b
      }))
      setMatchedCompanies(enrichedFollowingMatches)

      // Entreprises qui me suivent
      const { data: followersData, count: followers, error: followersError } = await supabase
        .from('matches')
        .select('id, company_a, company_b, status, created_at, company_a_profile:company_a(*)', { count: 'exact' })
        .eq('company_b', comp.id)
        .eq('status', 'pending')
      if (followersError) console.warn('Unable to load follower matches:', followersError)

      const followerMatchesRaw = (followersError ? [] : followersData || []).filter(match => match.company_a && match.company_a !== comp.id)
      const missingFollowerIds = followerMatchesRaw.filter(m => !m.company_a_profile).map(m => m.company_a).filter(Boolean)
      let followerCompaniesById = {}
      if (missingFollowerIds.length > 0) {
        const { data: companiesData, error: companiesError } = await supabase.from('companies').select('*').in('id', missingFollowerIds)
        if (companiesError) {
          console.warn('Unable to load follower companies:', companiesError)
        } else {
          followerCompaniesById = Object.fromEntries((companiesData || []).map(c => [c.id, c]))
        }
      }
      const followerMatches = followerMatchesRaw.map(m => ({
        ...m,
        company_a: m.company_a_profile || followerCompaniesById[m.company_a]
      })).filter(m => m.company_a)
      const followerCompaniesWithSubscriptions = await attachCompanySubscriptions(
        supabase,
        followerMatches.map(m => m.company_a)
      )
      const followerSubscriptionsById = Object.fromEntries((followerCompaniesWithSubscriptions || []).map(c => [c.id, c]))
      const enrichedFollowerMatches = followerMatches.map(m => ({
        ...m,
        company_a: followerSubscriptionsById[m.company_a.id] || m.company_a
      }))
      setFollowerCompanies(enrichedFollowerMatches)

      // Messages envoyés
      const { count: msgCount, error: messagesError } = await supabase
        .from('messages').select('*', { count: 'exact', head: true })
        .eq('sender_id', comp.id)
      if (messagesError) console.warn('Unable to load sent message count:', messagesError)

      // Total entreprises sur Hubbing
      const { count: totalCompanies, error: totalCompaniesError } = await supabase
        .from('companies').select('*', { count: 'exact', head: true })
      if (totalCompaniesError) console.warn('Unable to load company count:', totalCompaniesError)

      // Opportunités B2B: besoins actifs des autres entreprises, triés par pertinence locale/métier.
      const { data: opportunityRows, error: opportunitiesError } = await supabase
        .from('companies')
        .select('*')
        .eq('is_suspended', false)
        .limit(240)
      if (opportunitiesError) console.warn('Unable to load B2B opportunities:', opportunitiesError)

      const opportunityCompanies = (opportunitiesError ? [] : opportunityRows || [])
        .filter(item => item.id !== comp.id && hasCompanyNeeds(item))
      const opportunityCompaniesWithSubscriptions = opportunityCompanies.length > 0
        ? await attachCompanySubscriptions(supabase, opportunityCompanies)
        : []
      const opportunityIds = opportunityCompaniesWithSubscriptions.map(item => item.id).filter(Boolean)
      let attachmentCountsByCompany = {}
      if (opportunityIds.length > 0) {
        const { data: attachmentRows, error: attachmentError } = await supabase
          .from('need_attachments')
          .select('company_id, id')
          .in('company_id', opportunityIds)
          .eq('status', 'active')
          .eq('moderation_status', 'approved')
        if (attachmentError) {
          console.warn('Unable to load opportunity attachment counts:', attachmentError)
        } else {
          attachmentCountsByCompany = (attachmentRows || []).reduce((acc, row) => {
            acc[row.company_id] = (acc[row.company_id] || 0) + 1
            return acc
          }, {})
        }
      }

      const builtOpportunities = opportunityCompaniesWithSubscriptions
        .map(item => buildOpportunity(item, compWithSubscription, attachmentCountsByCompany[item.id] || 0))
        .sort((a, b) => (
          b.score - a.score
          || a.planRank - b.planRank
          || b.freshness - a.freshness
          || String(a.company?.name || '').localeCompare(String(b.company?.name || ''))
        ))
      setOpportunities(builtOpportunities)

      setStats({
        matches: enrichedFollowingMatches.length,
        messages: msgCount || 0,
        followers: enrichedFollowerMatches.length || followers || 0,
        totalCompanies: totalCompanies || 0
      })
    } catch (error) {
      console.warn('Unable to load home screen:', error)
      setOpportunities([])
      setLoadError(error?.message || "Impossible de charger l'accueil.")
    } finally {
      setLoading(false)
    }
  }, [user.id, ui.common.companyNotFound])

  useEffect(() => { loadData() }, [loadData])

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return ui.home.morning
    if (h < 18) return ui.home.afternoon
    return ui.home.evening
  }

  const color = company ? (sectorColors[company.sector] || '#E24B4A') : '#E24B4A'
  const companyBadgeVariant = getCompanyBadgeVariant(company, plan)
  const normalizedPlan = normalizePlan(plan)
  const planDisplayName = { starter: 'Starter', basic: 'Basic', premium: 'Premium' }[normalizedPlan] || 'Starter'
  const needsTags = (() => {
    try { return company?.needs_tags ? JSON.parse(company.needs_tags) : [] } catch { return [] }
  })()
  const onboardingSteps = [
    {
      key: 'profile',
      label: ui.home.onboardingProfile,
      done: Boolean(company?.sector && company?.description && company?.city),
      action: () => setActiveTab('profile'),
    },
    {
      key: 'visuals',
      label: ui.home.onboardingVisuals,
      done: Boolean(company?.logo_url || company?.contact_photo_url || company?.background_url),
      action: () => setActiveTab('profile'),
    },
    {
      key: 'needs',
      label: ui.home.onboardingNeeds,
      done: Boolean(company?.needs_description || needsTags.length > 0),
      action: () => setActiveTab('profile'),
    },
    {
      key: 'plan',
      label: ui.home.onboardingPlan,
      done: normalizedPlan !== 'starter',
      action: () => setActiveTab('pricing'),
    },
  ]
  const onboardingDone = onboardingSteps.filter(step => step.done).length
  const showOnboarding = onboardingDone < onboardingSteps.length
  const opportunityLimit = getOpportunityLimit(normalizedPlan)
  const filteredOpportunities = useMemo(
    () => opportunities.filter(item => matchesOpportunityFilters(item, opportunityFilters)),
    [opportunities, opportunityFilters]
  )
  const visibleOpportunities = useMemo(
    () => Number.isFinite(opportunityLimit) ? filteredOpportunities.slice(0, opportunityLimit) : filteredOpportunities,
    [filteredOpportunities, opportunityLimit]
  )
  const activeOpportunityFilterCount = [
    opportunityFilters.query,
    opportunityFilters.sector,
    opportunityFilters.canton,
    Number(opportunityFilters.radius) < 300 ? opportunityFilters.radius : '',
  ].filter(Boolean).length
  const resetOpportunityFilters = () => setOpportunityFilters(opportunityFiltersInitial)

  if (loading) return (
    <LoadingIndicator fill />
  )

  if (loadError) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:420,padding:'2rem'}}>
      <div style={{width:'100%',maxWidth:360,textAlign:'center',background:'#FFF7F7',border:'1px solid #FECACA',borderRadius:14,padding:'1.25rem'}}>
        <p style={{fontSize:16,fontWeight:700,color:'#991B1B',margin:'0 0 0.5rem'}}>
          Impossible de charger l'accueil
        </p>
        <p style={{fontSize:13,lineHeight:1.5,color:'#7F1D1D',margin:'0 0 1rem'}}>
          {loadError}
        </p>
        <div style={{display:'flex',gap:10}}>
          <button type="button" onClick={loadData} style={{flex:1,padding:'10px 12px',border:'none',borderRadius:10,background:'#E24B4A',color:'white',fontWeight:700,cursor:'pointer'}}>
            Réessayer
          </button>
          <button type="button" onClick={() => setActiveTab('profile')} style={{flex:1,padding:'10px 12px',border:'1px solid #FECACA',borderRadius:10,background:'white',color:'#E24B4A',fontWeight:700,cursor:'pointer'}}>
            Profil
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
    {(showFollowers || showFollowing) && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:10000,paddingBottom:'calc(76px + env(safe-area-inset-bottom))'}}>
          <div style={{background:'white',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:430,maxHeight:'70vh',overflowY:'auto',padding:'1.5rem',paddingBottom:'calc(1.5rem + env(safe-area-inset-bottom))'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <h3 style={{fontSize:18,fontWeight:700,margin:0}}>{showFollowers ? ui.home.followersTitle : ui.home.followingTitle}</h3>
              <button onClick={() => { setShowFollowers(false); setShowFollowing(false) }} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:'#999'}}>✕</button>
            </div>
            {(showFollowers ? followerCompanies : matchedCompanies).length === 0 ? (
              <p style={{color:'#999',textAlign:'center',padding:'2rem'}}>{showFollowers ? ui.home.noFollowers : ui.home.noFollowing}</p>
            ) : (
              (showFollowers ? followerCompanies : matchedCompanies).map(match => {
                const other = showFollowers ? match.company_a : match.company_b
                if (!other) return null
                const c = sectorColors[other.sector] || '#E24B4A'
                const otherBadgeVariant = getCompanyBadgeVariant(other)
                return (
                  <div key={match.id} onClick={() => { setShowFollowers(false); setShowFollowing(false); setSelectedCompanyId && setSelectedCompanyId(other.id); setActiveTab('map') }} style={{padding:'0.75rem 0',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid #f5f5f5',cursor:'pointer'}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:c,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{color:'white',fontWeight:700,fontSize:14}}>{other.name?.substring(0,2).toUpperCase()}</span>
                    </div>
                    <div style={{flex:1}}>
                      <p style={{fontWeight:600,fontSize:14,margin:0,display:'flex',alignItems:'center',gap:5}}>
                        <span>{other.name}</span>
                        {otherBadgeVariant && <VerifiedBadge size={14} variant={otherBadgeVariant} />}
                      </p>
                      <p style={{fontSize:12,color:'#999',margin:0}}>{other.sector} · {other.city}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    {showOpportunityFilters && (
      <OpportunityFiltersModal
        ui={ui}
        filters={opportunityFilters}
        setFilters={setOpportunityFilters}
        activeFilterCount={activeOpportunityFilterCount}
        resultCount={filteredOpportunities.length}
        onReset={resetOpportunityFilters}
        onClose={() => setShowOpportunityFilters(false)}
      />
    )}
    <div style={{flex:1,overflowY:'auto',paddingBottom:'calc(18px + env(safe-area-inset-bottom))'}}>

{/* Header coloré */}
      <div style={{
        background: company?.background_url ? `url(${company.background_url}) center/cover no-repeat` : color,
        padding:'1.5rem',
        paddingBottom:'2.5rem',
        position:'relative'
      }}>
        {company?.background_url && (
          <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.35)',borderRadius:0}} />
        )}
        <div style={{position:'relative',zIndex:1}}>
        <p style={{color:'rgba(255,255,255,0.8)',fontSize:14,marginBottom:4}}>{getGreeting()}</p>
        <h2 style={{color:'white',fontSize:22,fontWeight:700,lineHeight:1.2,display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
          <span>{company?.name || user.email}</span>
          {companyBadgeVariant && <VerifiedBadge size={22} variant={companyBadgeVariant} />}
        </h2>
        {company?.sector && (
          <p style={{color:'rgba(255,255,255,0.75)',fontSize:13,marginTop:4}}>
            {company.sector} · {company.city}, {company.canton}
          </p>
        )}
        <div style={{marginTop:12,background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'6px 12px',display:'inline-block'}}>
          <span style={{color:'white',fontSize:12,fontWeight:600}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:6}}>
              <HubbingIcon name="building" size={14} color="white" />
              {ui.home.companiesOnHubbing(stats.totalCompanies)}
            </span>
          </span>
        </div>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{display:'flex',gap:10,padding:'0 1rem',marginTop:'-1.25rem',position:'relative',zIndex:1}}>
        <div onClick={() => setShowFollowing(true)} style={{flex:1,background:'white',borderRadius:12,padding:'0.875rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',cursor:'pointer'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#E24B4A',margin:0}}>{stats.matches}</p>
          <p style={{fontSize:11,color:'#999',marginTop:3}}>{ui.home.followingLabel}</p>
        </div>
        <div onClick={() => setShowFollowers(true)} style={{flex:1,background:'white',borderRadius:12,padding:'0.875rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',cursor:'pointer'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#E24B4A',margin:0}}>{stats.followers}</p>
          <p style={{fontSize:11,color:'#999',marginTop:3}}>{ui.home.followersLabel}</p>
        </div>
      </div>

      {showOnboarding && (
        <div style={{padding:'1rem 1rem 0'}}>
          <div style={{background:'white',border:'1px solid #F1D1D1',borderRadius:12,padding:'1rem',boxShadow:'0 4px 16px rgba(226,75,74,0.06)'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:10}}>
              <div>
                <p style={{fontWeight:800,fontSize:14,margin:0,color:'#1f2937'}}>{ui.home.onboardingTitle}</p>
                <p style={{fontSize:12,color:'#888',margin:'3px 0 0',lineHeight:1.35}}>{ui.home.onboardingDesc}</p>
              </div>
              <span style={{fontSize:11,fontWeight:800,color:'#E24B4A',background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:999,padding:'5px 8px',whiteSpace:'nowrap'}}>
                {ui.home.onboardingProgress(onboardingDone, onboardingSteps.length)}
              </span>
            </div>
            <div style={{height:5,background:'#F5F5F5',borderRadius:999,overflow:'hidden',marginBottom:10}}>
              <div style={{width:`${(onboardingDone / onboardingSteps.length) * 100}%`,height:'100%',background:'#E24B4A',borderRadius:999}} />
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {onboardingSteps.map(step => (
                <button key={step.key} onClick={step.action}
                  style={{border:'1px solid #eee',background:step.done ? '#F0FDF4' : '#FAFAFA',borderRadius:10,padding:'9px 8px',display:'flex',alignItems:'center',gap:7,cursor:'pointer',textAlign:'left'}}>
                  <span style={{width:18,height:18,borderRadius:'50%',background:step.done ? '#22c55e' : 'white',border:`1px solid ${step.done ? '#22c55e' : '#ddd'}`,color:step.done ? 'white' : '#aaa',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,flexShrink:0}}>
                    {step.done ? '✓' : '•'}
                  </span>
                  <span style={{fontSize:11,fontWeight:700,color:step.done ? '#166534' : '#4b5563',lineHeight:1.25}}>{step.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{padding:'1.25rem 1rem 0.75rem',display:'flex',flexDirection:'column',gap:'1rem'}}>

        {/* Opportunités B2B */}
        <section style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div>
              <h3 style={{fontSize:20,fontWeight:800,letterSpacing:0,margin:0,color:'#111827',lineHeight:1.15}}>
                {ui.home.opportunitiesTitle}
              </h3>
              <p style={{fontSize:11,color:'#9CA3AF',margin:'4px 0 0',fontWeight:600}}>
                {ui.home.opportunitiesAllowance(
                  Number.isFinite(opportunityLimit) ? opportunityLimit : null,
                  planDisplayName
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOpportunityFilters(true)}
              aria-label={ui.home.opportunitiesFilter}
              style={{
                minWidth:44,
                height:38,
                borderRadius:12,
                border:'1px solid #F1D1D1',
                background:activeOpportunityFilterCount ? '#FFF5F5' : 'white',
                color:'#E24B4A',
                display:'inline-flex',
                alignItems:'center',
                justifyContent:'center',
                gap:6,
                fontWeight:800,
                fontSize:12,
                cursor:'pointer',
                flexShrink:0,
                boxShadow:'0 4px 12px rgba(226,75,74,0.08)',
              }}
            >
              <HubbingIcon name="filters" size={18} color="#E24B4A" />
              {activeOpportunityFilterCount > 0 && (
                <span style={{minWidth:18,height:18,borderRadius:999,background:'#E24B4A',color:'white',fontSize:11,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>
                  {activeOpportunityFilterCount}
                </span>
              )}
            </button>
          </div>

          <div style={{
            background:'white',
            border:'1px solid #E5E7EB',
            borderRadius:12,
            boxShadow:'0 10px 24px rgba(17,24,39,0.08)',
            padding:10,
            maxHeight:330,
            overflowY:'auto',
            WebkitOverflowScrolling:'touch',
          }}>
            {visibleOpportunities.length === 0 ? (
              <div style={{minHeight:128,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'1.25rem'}}>
                <div style={{width:42,height:42,borderRadius:'50%',background:'#FFF5F5',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
                  <HubbingIcon name="briefcase" size={21} color="#E24B4A" />
                </div>
                <p style={{fontSize:14,fontWeight:800,color:'#1F2937',margin:'0 0 4px'}}>
                  {ui.home.opportunitiesEmpty}
                </p>
                <p style={{fontSize:12,color:'#9CA3AF',margin:0,lineHeight:1.35}}>
                  {ui.home.opportunitiesEmptyDesc}
                </p>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {visibleOpportunities.map(opportunity => (
                  <OpportunityCard
                    key={opportunity.id}
                    opportunity={opportunity}
                    ui={ui}
                    onOpen={(companyId) => {
                      setSelectedCompanyId && setSelectedCompanyId(companyId)
                      setActiveTab('map')
                    }}
                  />
                ))}
                {filteredOpportunities.length > visibleOpportunities.length && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('pricing')}
                    style={{
                      border:'1px solid #F1D1D1',
                      background:'#FFF7F7',
                      color:'#E24B4A',
                      borderRadius:12,
                      padding:'10px 12px',
                      fontSize:12,
                      fontWeight:800,
                      cursor:'pointer',
                    }}
                  >
                    {ui.home.opportunitiesUpgradeHint(filteredOpportunities.length - visibleOpportunities.length)}
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Entreprises que je suis */}
        <div style={{background:'white',border:'1px solid #f0f0f0',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'0.875rem 1rem',borderBottom:'1px solid #f5f5f5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{fontWeight:700,fontSize:14,margin:0}}>{ui.home.followingTitle}</p>
            <span onClick={() => setShowFollowing(true)}
              style={{fontSize:12,color:'#E24B4A',cursor:'pointer',fontWeight:600}}>{ui.home.viewAll}</span>
          </div>
          {matchedCompanies.length === 0 ? (
            <div style={{padding:'1.5rem',textAlign:'center'}}>
              <p style={{color:'#999',fontSize:13}}>{ui.home.noConnections}</p>
              <button onClick={() => setActiveTab('swipe')}
                style={{marginTop:8,padding:'8px 16px',background:'#E24B4A',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                {ui.home.discoverCompanies}
              </button>
            </div>
          ) : (
            <div>
              {matchedCompanies.slice(0, 4).map(match => {
                const other = match.company_b
                if (!other) return null
                const c = sectorColors[other.sector] || '#E24B4A'
                const otherBadgeVariant = getCompanyBadgeVariant(other)
                return (
                  <div key={match.id} onClick={() => { setSelectedCompanyId && setSelectedCompanyId(other.id); setActiveTab('map') }}
                    style={{padding:'0.75rem 1rem',display:'flex',alignItems:'center',gap:12,cursor:'pointer',borderBottom:'1px solid #f9f9f9'}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:c,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{color:'white',fontWeight:700,fontSize:13}}>
                        {other.name?.substring(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div style={{flex:1}}>
                      <p style={{fontWeight:600,fontSize:14,margin:0,display:'flex',alignItems:'center',gap:5}}>
                        <span>{other.name}</span>
                        {otherBadgeVariant && <VerifiedBadge size={14} variant={otherBadgeVariant} />}
                      </p>
                      <p style={{fontSize:12,color:'#999',margin:0}}>{other.sector} · {other.city}</p>
                    </div>
                    <span style={{color:'#ddd',fontSize:16}}>›</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Compléter profil si incomplet */}
        {(!company?.description || !company?.sector) && (
          <div onClick={() => setActiveTab('profile')}
            style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:12,padding:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
            <HubbingIcon name="pencil" size={28} color="#E24B4A" />
            <div style={{flex:1}}>
              <p style={{fontWeight:700,fontSize:14,margin:0}}>{ui.home.completeProfile}</p>
              <p style={{fontSize:12,color:'#999',marginTop:2}}>{ui.home.completeProfileDesc}</p>
            </div>
            <span style={{color:'#ccc',fontSize:18}}>›</span>
          </div>
        )}

        {/* Raccourci swipe */}
        <div onClick={() => setActiveTab('swipe')}
          style={{background:color,borderRadius:12,padding:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{color:'white',fontWeight:700,fontSize:15,margin:0}}>{ui.home.discoverTitle}</p>
            <p style={{color:'rgba(255,255,255,0.75)',fontSize:12,marginTop:3}}>{ui.home.discoverDesc}</p>
          </div>
          <HubbingIcon name="briefcase" size={28} color="white" />
        </div>

      </div>
    </div>
    </>
  )
}

function OpportunityCard({ opportunity, ui, onOpen }) {
  const company = opportunity.company || {}
  const color = sectorColors[company.sector] || '#E24B4A'
  const badgeVariant = getCompanyBadgeVariant(company)
  const distanceLabel = typeof opportunity.distanceKm === 'number'
    ? ui.home.opportunityDistance(Math.max(1, Math.round(opportunity.distanceKm)))
    : ''
  const tags = opportunity.activeTags.slice(0, 2)
  const matchReasons = opportunity.matchReasons.slice(0, 3)

  return (
    <button
      type="button"
      onClick={() => onOpen(company.id)}
      style={{
        width:'100%',
        border:'1px solid #E5E7EB',
        background:'white',
        borderRadius:12,
        padding:12,
        display:'flex',
        alignItems:'flex-start',
        gap:10,
        textAlign:'left',
        cursor:'pointer',
      }}
    >
      <div style={{
        width:42,
        height:42,
        borderRadius:'50%',
        background:color,
        flexShrink:0,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        overflow:'hidden',
      }}>
        {company.logo_url ? (
          <img src={company.logo_url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
        ) : (
          <span style={{fontSize:13,fontWeight:800,color:'white'}}>
            {company.name?.substring(0, 2).toUpperCase() || 'HB'}
          </span>
        )}
      </div>

      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
          <p style={{fontSize:14,fontWeight:800,color:'#111827',margin:0,display:'flex',alignItems:'center',gap:5,minWidth:0}}>
            <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{company.name}</span>
            {badgeVariant && <VerifiedBadge size={14} variant={badgeVariant} />}
          </p>
          <span style={{fontSize:11,fontWeight:800,color:'#E24B4A',whiteSpace:'nowrap'}}>
            {distanceLabel}
          </span>
        </div>
        <p style={{fontSize:11,color:'#9CA3AF',margin:'2px 0 7px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {[company.sector, company.city || company.canton].filter(Boolean).join(' · ')}
        </p>
        <p style={{
          fontSize:13,
          lineHeight:1.35,
          color:'#374151',
          margin:0,
          display:'-webkit-box',
          WebkitLineClamp:2,
          WebkitBoxOrient:'vertical',
          overflow:'hidden',
        }}>
          <strong style={{color:'#111827'}}>{ui.home.opportunityNeed}</strong>
          {' · '}
          {opportunity.title}
        </p>
        {(tags.length > 0 || matchReasons.length > 0 || opportunity.attachmentCount > 0) && (
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:9}}>
            {matchReasons.map(reason => (
              <span key={`match-${reason}`} style={{fontSize:10,fontWeight:800,color:'#0F6E56',background:'#ECFDF5',border:'1px solid #A7F3D0',borderRadius:999,padding:'4px 7px'}}>
                {reason}
              </span>
            ))}
            {tags.map(tag => (
              <span key={tag.id || tag.label} style={{fontSize:10,fontWeight:800,color:'#9A3412',background:'#FFF7ED',border:'1px solid #FED7AA',borderRadius:999,padding:'4px 7px'}}>
                {tag.label}
              </span>
            ))}
            {opportunity.attachmentCount > 0 && (
              <span style={{fontSize:10,fontWeight:800,color:'#4B5563',background:'#F3F4F6',border:'1px solid #E5E7EB',borderRadius:999,padding:'4px 7px',display:'inline-flex',alignItems:'center',gap:4}}>
                <HubbingIcon name="paperclip" size={11} color="#4B5563" />
                {ui.home.opportunityAttachments(opportunity.attachmentCount)}
              </span>
            )}
          </div>
        )}
      </div>
      <span style={{fontSize:20,lineHeight:1,color:'#D1D5DB',paddingTop:8}}>›</span>
    </button>
  )
}

function OpportunityFiltersModal({ ui, filters, setFilters, activeFilterCount, resultCount, onReset, onClose }) {
  const setFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }))

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(17,24,39,0.45)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:10000,paddingBottom:'calc(76px + env(safe-area-inset-bottom))'}}>
      <div style={{background:'white',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:430,maxHeight:'76vh',overflowY:'auto',padding:'1.25rem',paddingBottom:'calc(1.25rem + env(safe-area-inset-bottom))',boxShadow:'0 -12px 40px rgba(0,0,0,0.18)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <div>
            <h3 style={{fontSize:18,fontWeight:800,margin:0,color:'#111827'}}>{ui.home.opportunitiesFilterTitle}</h3>
            <p style={{fontSize:12,color:'#9CA3AF',margin:'3px 0 0'}}>
              {ui.home.opportunitiesFilterCount(resultCount)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label={ui.common?.cancel || 'Fermer'} style={{width:34,height:34,borderRadius:'50%',border:'1px solid #E5E7EB',background:'#F9FAFB',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <HubbingIcon name="x" size={18} color="#4B5563" />
          </button>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <label style={{display:'flex',flexDirection:'column',gap:6}}>
            <span style={{fontSize:12,fontWeight:800,color:'#374151'}}>{ui.home.opportunitiesKeyword}</span>
            <input
              value={filters.query}
              onChange={(event) => setFilter('query', event.target.value)}
              placeholder={ui.home.opportunitiesKeywordPlaceholder}
              style={{width:'100%',boxSizing:'border-box',border:'1px solid #E5E7EB',borderRadius:12,padding:'12px 13px',fontSize:16,outline:'none'}}
            />
          </label>

          <label style={{display:'flex',flexDirection:'column',gap:8}}>
            <span style={{fontSize:12,fontWeight:800,color:'#374151'}}>
              {ui.home.opportunitiesRadius(Number(filters.radius))}
            </span>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={filters.radius}
              onChange={(event) => setFilter('radius', Number(event.target.value))}
              style={{accentColor:'#E24B4A'}}
            />
          </label>

          <label style={{display:'flex',flexDirection:'column',gap:6}}>
            <span style={{fontSize:12,fontWeight:800,color:'#374151'}}>{ui.home.opportunitiesSector}</span>
            <select
              value={filters.sector}
              onChange={(event) => setFilter('sector', event.target.value)}
              style={{width:'100%',border:'1px solid #E5E7EB',borderRadius:12,padding:'12px 13px',fontSize:16,background:'white'}}
            >
              <option value="">{ui.home.opportunitiesAllSectors}</option>
              {sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </label>

          <label style={{display:'flex',flexDirection:'column',gap:6}}>
            <span style={{fontSize:12,fontWeight:800,color:'#374151'}}>{ui.home.opportunitiesCanton}</span>
            <select
              value={filters.canton}
              onChange={(event) => setFilter('canton', event.target.value)}
              style={{width:'100%',border:'1px solid #E5E7EB',borderRadius:12,padding:'12px 13px',fontSize:16,background:'white'}}
            >
              <option value="">{ui.home.opportunitiesAllCantons}</option>
              {swissCantons.map(canton => <option key={canton} value={canton}>{canton}</option>)}
            </select>
          </label>
        </div>

        <div style={{display:'flex',gap:10,marginTop:18}}>
          <button type="button" onClick={onReset} disabled={activeFilterCount === 0} style={{flex:1,border:'1px solid #E5E7EB',background:'white',color:activeFilterCount ? '#4B5563' : '#CBD5E1',borderRadius:12,padding:'12px',fontSize:14,fontWeight:800,cursor:activeFilterCount ? 'pointer' : 'default'}}>
            {ui.home.opportunitiesReset}
          </button>
          <button type="button" onClick={onClose} style={{flex:1,border:'none',background:'#E24B4A',color:'white',borderRadius:12,padding:'12px',fontSize:14,fontWeight:800,cursor:'pointer'}}>
            {ui.home.opportunitiesShowResults(resultCount)}
          </button>
        </div>
      </div>
    </div>
  )
}
