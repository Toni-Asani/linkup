import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { VerifiedBadge, attachCompanySubscriptions, getCompanyBadgeVariant } from './VerifiedBadge'
import { HubbingIcon } from './icons'
import LoadingIndicator from './LoadingIndicator'

const sectorColors = {
  'Fiduciaire': '#3B6D11', 'Design & Communication': '#533AB7',
  'Informatique': '#185FA5', 'Construction': '#854F0B',
  'Marketing Digital': '#993556', 'Ressources Humaines': '#0F6E56',
  'Transport & Logistique': '#444441', 'Services': '#993C1D',
}

export default function HomeScreen({ user, setActiveTab, setSelectedCompanyId, plan = 'Starter', lang = 'fr' }) {
  const ui = getUiText(lang)
  const [company, setCompany] = useState(null)
  const [stats, setStats] = useState({ matches: 0, messages: 0, followers: 0, totalCompanies: 0 })
  const [matchedCompanies, setMatchedCompanies] = useState([])
  const [followerCompanies, setFollowerCompanies] = useState([])
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

      setStats({
        matches: enrichedFollowingMatches.length,
        messages: msgCount || 0,
        followers: enrichedFollowerMatches.length || followers || 0,
        totalCompanies: totalCompanies || 0
      })
    } catch (error) {
      console.warn('Unable to load home screen:', error)
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
  const normalizedPlan = String(plan || 'Starter').toLowerCase()
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

  if (loading) return (
    <LoadingIndicator label={ui.common.loading} height={400} />
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
