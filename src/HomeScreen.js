import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { isNativeApp } from './platform'
import { VerifiedBadge, attachCompanySubscriptions, isPremiumCompany } from './VerifiedBadge'

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
  const [founderSlots, setFounderSlots] = useState({ used: 0, max: 100 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: comp } = await supabase
      .from('companies').select('*').eq('user_id', user.id).single()

    if (comp) {
      const compWithSubscription = await attachCompanySubscriptions(supabase, comp)
      setCompany(compWithSubscription)

      // Matchs que j'ai initiés
      const { data: myMatches } = await supabase
        .from('matches')
        .select('id, company_a, company_b, status, created_at, company_b_profile:company_b(*)')
        .eq('company_a', comp.id)
        .eq('status', 'pending')
      const followingMatchesRaw = myMatches || []
      const missingFollowingIds = followingMatchesRaw.filter(m => !m.company_b_profile).map(m => m.company_b).filter(Boolean)
      let followingCompaniesById = {}
      if (missingFollowingIds.length > 0) {
        const { data: companiesData } = await supabase.from('companies').select('*').in('id', missingFollowingIds)
        followingCompaniesById = Object.fromEntries((companiesData || []).map(c => [c.id, c]))
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
      const { data: followersData, count: followers } = await supabase
        .from('matches')
        .select('id, company_a, company_b, status, created_at, company_a_profile:company_a(*)', { count: 'exact' })
        .eq('company_b', comp.id)
        .eq('status', 'pending')
      const followerMatchesRaw = followersData || []
      const missingFollowerIds = followerMatchesRaw.filter(m => !m.company_a_profile).map(m => m.company_a).filter(Boolean)
      let followerCompaniesById = {}
      if (missingFollowerIds.length > 0) {
        const { data: companiesData } = await supabase.from('companies').select('*').in('id', missingFollowerIds)
        followerCompaniesById = Object.fromEntries((companiesData || []).map(c => [c.id, c]))
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
      const { count: msgCount } = await supabase
        .from('messages').select('*', { count: 'exact', head: true })
        .eq('sender_id', comp.id)

      // Total entreprises sur Hubbing
      const { count: totalCompanies } = await supabase
        .from('companies').select('*', { count: 'exact', head: true })

      setStats({
        matches: enrichedFollowingMatches.length,
        messages: msgCount || 0,
        followers: enrichedFollowerMatches.length || followers || 0,
        totalCompanies: totalCompanies || 0
      })
    }

    const { data: slots } = await supabase
      .from('founder_slots').select('*').eq('id', 1).single()
    if (slots) setFounderSlots({ used: slots.used, max: slots.max_slots })
    setLoading(false)
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return ui.home.morning
    if (h < 18) return ui.home.afternoon
    return ui.home.evening
  }

  const color = company ? (sectorColors[company.sector] || '#E24B4A') : '#E24B4A'
  const remaining = founderSlots.max - founderSlots.used
  const companyIsPremium = plan === 'Premium' || isPremiumCompany(company)

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:400}}>
      <p style={{color:'#999'}}>{ui.common.loading}</p>
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
                return (
                  <div key={match.id} onClick={() => { setShowFollowers(false); setShowFollowing(false); setSelectedCompanyId && setSelectedCompanyId(other.id); setActiveTab('map') }} style={{padding:'0.75rem 0',display:'flex',alignItems:'center',gap:12,borderBottom:'1px solid #f5f5f5',cursor:'pointer'}}>
                    <div style={{width:44,height:44,borderRadius:'50%',background:c,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{color:'white',fontWeight:700,fontSize:14}}>{other.name?.substring(0,2).toUpperCase()}</span>
                    </div>
                    <div style={{flex:1}}>
                      <p style={{fontWeight:600,fontSize:14,margin:0,display:'flex',alignItems:'center',gap:5}}>
                        <span>{other.name}</span>
                        {isPremiumCompany(other) && <VerifiedBadge size={14} />}
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
    <div style={{flex:1,overflowY:'auto',paddingBottom:'calc(90px + env(safe-area-inset-bottom))'}}>

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
        <p style={{color:'rgba(255,255,255,0.8)',fontSize:14,marginBottom:4}}>{getGreeting()} 👋</p>
        <h2 style={{color:'white',fontSize:22,fontWeight:700,lineHeight:1.2,display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
          <span>{company?.name || user.email}</span>
          {companyIsPremium && <VerifiedBadge size={22} />}
        </h2>
        {company?.sector && (
          <p style={{color:'rgba(255,255,255,0.75)',fontSize:13,marginTop:4}}>
            {company.sector} · {company.city}, {company.canton}
          </p>
        )}
        <div style={{marginTop:12,background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'6px 12px',display:'inline-block'}}>
          <span style={{color:'white',fontSize:12,fontWeight:600}}>
            🏢 {ui.home.companiesOnHubbing(stats.totalCompanies)}
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
        {!isNativeApp() && (
          <div style={{flex:1,background:'white',borderRadius:12,padding:'0.875rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
            <p style={{fontSize:24,fontWeight:700,color:'#3B6D11',margin:0}}>{remaining}</p>
            <p style={{fontSize:11,color:'#999',marginTop:3}}>{ui.home.founderPlaces}</p>
          </div>
        )}
      </div>

      <div style={{padding:'1.25rem 1rem',display:'flex',flexDirection:'column',gap:'1rem'}}>

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
                        {isPremiumCompany(other) && <VerifiedBadge size={14} />}
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

        {!isNativeApp() && (
          <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <p style={{fontSize:14,color:'#E24B4A',fontWeight:700,margin:0}}>{ui.home.founderOffer}</p>
              <span style={{fontSize:12,color:'#E24B4A',fontWeight:600}}>{ui.home.remaining(remaining)}</span>
            </div>
            <div style={{background:'#fee2e2',borderRadius:8,overflow:'hidden',height:6,marginBottom:8}}>
              <div style={{height:'100%',background:'#E24B4A',width:`${(founderSlots.used/founderSlots.max)*100}%`,borderRadius:8}} />
            </div>
            <p style={{fontSize:12,color:'#666',lineHeight:1.5,margin:0}}>
              {ui.home.founderDesc(remaining)}
            </p>
            <button onClick={() => setActiveTab('pricing')}
              style={{marginTop:'0.75rem',width:'100%',padding:'10px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
              {ui.home.activateFounder}
            </button>
          </div>
        )}

        {/* Compléter profil si incomplet */}
        {(!company?.description || !company?.sector) && (
          <div onClick={() => setActiveTab('profile')}
            style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:12,padding:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:28}}>✏️</span>
            <div style={{flex:1}}>
              <p style={{fontWeight:700,fontSize:14,margin:0}}>{ui.home.completeProfile}</p>
              <p style={{fontSize:12,color:'#999',marginTop:2}}>{ui.home.completeProfileDesc}</p>
            </div>
            <span style={{color:'#ccc',fontSize:18}}>›</span>
          </div>
        )}

        {!isNativeApp() && (
          <div style={{background:'#1a1a1a',borderRadius:12,padding:'1rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <div>
              <p style={{color:'white',fontWeight:700,fontSize:14,margin:0}}>{ui.home.mobileApp}</p>
              <p style={{color:'rgba(255,255,255,0.6)',fontSize:12,marginTop:3}}>{ui.home.soonAvailable}</p>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <div style={{background:'rgba(255,255,255,0.1)',borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',gap:5}}>
                  <span style={{fontSize:16}}></span>
                  <span style={{color:'white',fontSize:11,fontWeight:600}}>App Store</span>
                </div>
              </div>
            </div>
            <div style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'8px',textAlign:'center',flexShrink:0}}>
              <span style={{fontSize:32}}>📲</span>
            </div>
          </div>
        )}

        {/* Raccourci swipe */}
        <div onClick={() => setActiveTab('swipe')}
          style={{background:color,borderRadius:12,padding:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{color:'white',fontWeight:700,fontSize:15,margin:0}}>{ui.home.discoverTitle}</p>
            <p style={{color:'rgba(255,255,255,0.75)',fontSize:12,marginTop:3}}>{ui.home.discoverDesc}</p>
          </div>
          <span style={{fontSize:28}}>💼</span>
        </div>

      </div>
    </div>
    </>
  )
}
