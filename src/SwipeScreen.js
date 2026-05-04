import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { getUiText } from './i18n'
import { VerifiedBadge, attachCompanySubscriptions, isPremiumCompany } from './VerifiedBadge'

const sectorColors = {
  'Fiduciaire & Comptabilité': '#3B6D11',
  'Design & Créatif': '#533AB7',
  'Informatique & Tech': '#185FA5',
  'BTP & Construction': '#854F0B',
  'Marketing & Publicité': '#993556',
  'Ressources Humaines': '#0F6E56',
  'Transport & Déménagement': '#444441',
  'Services aux entreprises': '#993C1D',
  'Architecture & Urbanisme': '#2D6A8F',
  'Assurance & Prévoyance': '#1A5276',
  'Automobile & Mobilité': '#6E2F1A',
  'Banque & Finance': '#1A3A5C',
  'Chimie & Pharmacie': '#4A235A',
  'Commerce de détail': '#784212',
  'Communication & PR': '#1D6A4A',
  'Conseil & Stratégie': '#2E4057',
  'Distribution & Logistique': '#4A4A4A',
  'Droit & Juridique': '#2C3E50',
  'E-commerce': '#1ABC9C',
  'Éducation & Formation': '#2980B9',
  'Energie & Environnement': '#27AE60',
  'Hôtellerie & Restauration': '#E67E22',
  'Immobilier': '#8E44AD',
  'Import & Export': '#16A085',
  'Imprimerie & Édition': '#D35400',
  'Industrie & Manufacturing': '#7F8C8D',
  'Luxe & Horlogerie': '#C0392B',
  'Médias & Presse': '#2C3E50',
  'Médical & Clinique': '#E74C3C',
  'Nettoyage & Facility': '#3498DB',
  'Optique & Lunetterie': '#9B59B6',
  'Santé & Bien-être': '#1ABC9C',
  'Sanitaire & Plomberie': '#2980B9',
  'Sécurité & Surveillance': '#E74C3C',
  'Sport & Loisirs': '#F39C12',
  'Telecommunications': '#2980B9',
  'Textile & Mode': '#8E44AD',
  'Tourisme & Voyages': '#16A085',
  'Agriculture & Viticulture': '#27AE60',
  'Arts & Culture': '#E91E63',
  'Autre': '#666',
}

const sectors = Object.keys(sectorColors)
const SWIPE_THRESHOLD = 85
const SWIPE_ANIMATION_MS = 420

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

const getActiveTags = (needs_tags) => {
  try {
    const tags = needs_tags ? JSON.parse(needs_tags) : []
    return tags.filter(t => !t.expires || new Date(t.expires) > new Date())
  } catch { return [] }
}

export default function SwipeScreen({ user, setScreen, plan = 'Starter', lang = 'fr' }) {
  const ui = getUiText(lang)
  const isPremium = plan === 'Premium'
  const [companies, setCompanies] = useState([])
  const [filteredCompanies, setFilteredCompanies] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [decision, setDecision] = useState(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [matchNotice, setMatchNotice] = useState('sent')
  const [allSeen, setAllSeen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterRadius, setFilterRadius] = useState(300)
  const [filterSector, setFilterSector] = useState('')
  const [myCompanyCoords, setMyCompanyCoords] = useState(null)
  const [matchedCompanyIds, setMatchedCompanyIds] = useState(new Set())
  const [ratings, setRatings] = useState({})
  const decisionRef = useRef(null)
  const currentRef = useRef(0)
  const companiesRef = useRef([])
  const dragRef = useRef({ active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, pointerId: null, source: null })

  useEffect(() => { loadCompanies() }, [])
  useEffect(() => { currentRef.current = current }, [current])
  useEffect(() => { companiesRef.current = filteredCompanies }, [filteredCompanies])
  useEffect(() => { decisionRef.current = decision }, [decision])
  useEffect(() => { applyFilters() }, [companies, filterRadius, filterSector, myCompanyCoords])

  const applyFilters = () => {
    let result = [...companies]
    if (filterSector) result = result.filter(c => c.sector === filterSector)
    if (myCompanyCoords && filterRadius < 300) {
      result = result.filter(c => {
        if (!c.lat || !c.lng) return true
        return haversine(myCompanyCoords.lat, myCompanyCoords.lng, c.lat, c.lng) <= filterRadius
      })
    }
    setFilteredCompanies(result)
    setCurrent(0)
    setAllSeen(result.length === 0 && companies.length > 0)
  }

  const loadRatings = async (companiesList) => {
    const ids = companiesList.map(c => c.id)
    if (ids.length === 0) return {}
    const { data } = await supabase.from('reviews').select('reviewed_company_id, rating').eq('status', 'approved').in('reviewed_company_id', ids)
    const ratingsMap = {}
    ;(data || []).forEach(r => {
      if (!ratingsMap[r.reviewed_company_id]) ratingsMap[r.reviewed_company_id] = []
      ratingsMap[r.reviewed_company_id].push(r.rating)
    })
    const avgMap = {}
    Object.keys(ratingsMap).forEach(id => {
      const arr = ratingsMap[id]
      avgMap[id] = (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
    })
    return avgMap
  }

  const loadCompanies = async (ignoreHistory = false) => {
    setLoading(true)
    setAllSeen(false)
    let seenIds = []
    if (user) {
      const { data: myCompany } = await supabase.from('companies').select('id, lat, lng').eq('user_id', user.id).single()
      if (myCompany) {
        if (myCompany.lat && myCompany.lng) {
          setMyCompanyCoords({ lat: myCompany.lat, lng: myCompany.lng })
        } else {
          setMyCompanyCoords(null)
        }
        seenIds.push(myCompany.id)
        if (!ignoreHistory) {
          const { data: history } = await supabase.from('swipe_history').select('company_id').eq('user_id', user.id)
          seenIds = [...new Set([...(history || []).map(h => h.company_id), myCompany.id])]
        }

        const { data: existingMatches } = await supabase
          .from('matches')
          .select('company_a, company_b')
          .or(`company_a.eq.${myCompany.id},company_b.eq.${myCompany.id}`)
        const matchedIds = new Set((existingMatches || [])
          .map(match => match.company_a === myCompany.id ? match.company_b : match.company_a)
          .filter(Boolean))
        setMatchedCompanyIds(matchedIds)
      } else {
        setMyCompanyCoords(null)
        setMatchedCompanyIds(new Set())
      }
    } else {
      setMyCompanyCoords(null)
      setMatchedCompanyIds(new Set())
    }
    let query = supabase.from('companies').select('*').eq('is_suspended', false).limit(100)
    if (seenIds.length > 0) query = query.not('id', 'in', `(${seenIds.join(',')})`)
    const { data, error } = await query
    if (error) {
      console.warn('Unable to load swipe companies:', error.message)
      setAllSeen(true)
      setCompanies([])
      setFilteredCompanies([])
      setLoading(false)
      return
    }
    const companiesWithSubscriptions = await attachCompanySubscriptions(supabase, data || [])
    if (!data || data.length === 0) {
      setAllSeen(true)
      setCompanies([])
      setFilteredCompanies([])
    } else {
      setCompanies(companiesWithSubscriptions)
      setFilteredCompanies(companiesWithSubscriptions)
      setCurrent(0)
      const avgRatings = await loadRatings(companiesWithSubscriptions)
      setRatings(avgRatings)
    }
    setLoading(false)
  }

  const saveSwipeHistory = async (companyId, direction) => {
    if (!user) return
    await supabase.from('swipe_history').upsert({ user_id: user.id, company_id: companyId, direction }, { onConflict: 'user_id,company_id' })
  }

  const animateSwipeAway = (direction) => {
    decisionRef.current = direction
    setDecision(direction)
    window.setTimeout(() => {
      setCurrent(c => c + 1)
      setOffset({ x: 0, y: 0 })
      setDecision(null)
      decisionRef.current = null
    }, SWIPE_ANIMATION_MS)
  }

  const persistSwipe = async (company, direction) => {
    try {
      if (direction === 'right') {
        const { data: myCompany } = await supabase.from('companies').select('id').eq('user_id', user.id).single()
        if (myCompany) {
          const { data: existing } = await supabase.from('matches').select('id').or(`and(company_a.eq.${myCompany.id},company_b.eq.${company.id}),and(company_a.eq.${company.id},company_b.eq.${myCompany.id})`).maybeSingle()
          if (!existing) {
            const { data: newMatch } = await supabase.from('matches').insert({ company_a: myCompany.id, company_b: company.id, status: 'pending' }).select().single()
            if (newMatch) {
              setMatchedCompanyIds(current => new Set([...current, company.id]))
              const { data: otherUser } = await supabase.from('companies').select('user_id').eq('id', company.id).single()
              if (otherUser) {
                await supabase.from('notifications').insert([
                  { user_id: user.id, type: 'new_match', match_id: newMatch.id },
                  { user_id: otherUser.user_id, type: 'new_match', match_id: newMatch.id }
                ])
              }
            }
          } else {
            setMatchedCompanyIds(current => new Set([...current, company.id]))
          }
        }
      }
      await saveSwipeHistory(company.id, direction)
    } catch (error) {
      console.warn('Swipe persistence failed:', error)
    }
  }

  const handleSwipe = (direction) => {
    if (decisionRef.current) return
    const company = companiesRef.current[currentRef.current]
    if (!company) return

    if (direction === 'right') {
      if (!user) {
        setMatchNotice('visitor')
        setShowMatchModal(true)
        setTimeout(() => setShowMatchModal(false), 3000)
        animateSwipeAway(direction)
        return
      }
      if (matchedCompanyIds.has(company.id)) {
        setMatchNotice('existing')
        setShowMatchModal(true)
        setTimeout(() => setShowMatchModal(false), 1500)
        animateSwipeAway(direction)
        saveSwipeHistory(company.id, direction).catch(error => console.warn('Swipe history failed:', error))
        return
      }
      setMatchNotice('sent')
      setShowMatchModal(true)
      setTimeout(() => setShowMatchModal(false), 1500)
    }

    animateSwipeAway(direction)
    if (user) persistSwipe(company, direction)
  }

  const handlePointerDown = (e) => {
    if (decisionRef.current) return
    if (e.pointerType === 'touch') return
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, pointerId: e.pointerId, source: 'pointer' }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e) => {
    const drag = dragRef.current
    if (!drag.active || drag.source !== 'pointer' || decisionRef.current || drag.pointerId !== e.pointerId) return
    const deltaX = e.clientX - drag.startX
    const deltaY = e.clientY - drag.startY
    dragRef.current = { ...drag, lastX: e.clientX, lastY: e.clientY }
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault()
      setOffset({ x: deltaX, y: deltaY * 0.1 })
    }
  }

  const handlePointerEnd = (e) => {
    const drag = dragRef.current
    if (!drag.active || drag.source !== 'pointer' || decisionRef.current || drag.pointerId !== e.pointerId) return
    dragRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, pointerId: null, source: null }
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const deltaX = (e.clientX || drag.lastX) - drag.startX
    if (deltaX > SWIPE_THRESHOLD) handleSwipe('right')
    else if (deltaX < -SWIPE_THRESHOLD) handleSwipe('left')
    else setOffset({ x: 0, y: 0 })
  }

  const handleTouchStart = (e) => {
    if (decisionRef.current || e.touches.length !== 1) return
    const touch = e.touches[0]
    dragRef.current = { active: true, startX: touch.clientX, startY: touch.clientY, lastX: touch.clientX, lastY: touch.clientY, pointerId: 'touch', source: 'touch' }
  }

  const handleTouchMove = (e) => {
    const drag = dragRef.current
    if (!drag.active || drag.source !== 'touch' || decisionRef.current || e.touches.length !== 1) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - drag.startX
    const deltaY = touch.clientY - drag.startY
    dragRef.current = { ...drag, lastX: touch.clientX, lastY: touch.clientY }
    if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 0.75) {
      e.preventDefault()
      setOffset({ x: deltaX, y: deltaY * 0.1 })
    }
  }

  const handleTouchEnd = () => {
    const drag = dragRef.current
    if (!drag.active || drag.source !== 'touch' || decisionRef.current) return
    dragRef.current = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0, pointerId: null, source: null }
    const deltaX = drag.lastX - drag.startX
    if (deltaX > SWIPE_THRESHOLD) handleSwipe('right')
    else if (deltaX < -SWIPE_THRESHOLD) handleSwipe('left')
    else setOffset({ x: 0, y: 0 })
  }

  const rotate = offset.x * 0.08
  const likeOpacity = Math.max(0, Math.min(offset.x / 80, 1))
  const passOpacity = Math.max(0, Math.min(-offset.x / 80, 1))

  const getCardTransform = () => {
    if (decision === 'right') return 'translateX(125%) rotate(15deg)'
    if (decision === 'left') return 'translateX(-125%) rotate(-15deg)'
    return `translateX(${offset.x}px) translateY(${offset.y}px) rotate(${rotate}deg)`
  }

  const activeFilters = (filterSector ? 1 : 0) + (filterRadius < 300 ? 1 : 0)
  const sectorCountBase = myCompanyCoords && filterRadius < 300
    ? companies.filter(c => !c.lat || !c.lng || haversine(myCompanyCoords.lat, myCompanyCoords.lng, c.lat, c.lng) <= filterRadius)
    : companies
  const sectorCounts = sectorCountBase.reduce((acc, item) => {
    if (item.sector) acc[item.sector] = (acc[item.sector] || 0) + 1
    return acc
  }, {})

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:400}}>
      <p style={{color:'#999'}}>{ui.common.loading}</p>
    </div>
  )

  if (allSeen || current >= filteredCompanies.length) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
      <div style={{fontSize:48}}>{activeFilters > 0 ? '🔍' : '🎉'}</div>
      <h3 style={{fontSize:20,fontWeight:700}}>{activeFilters > 0 ? ui.swipe.noResults : ui.swipe.allSeen}</h3>
      <p style={{color:'#999',fontSize:14}}>{activeFilters > 0 ? ui.swipe.noResultsDesc : ui.swipe.allSeenDesc}</p>
      {activeFilters > 0 && <button onClick={() => { setFilterSector(''); setFilterRadius(300) }} style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>{ui.swipe.clearFilters}</button>}
      <button onClick={() => loadCompanies(true)} style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>{ui.swipe.reviewAll}</button>
      <button onClick={() => loadCompanies(false)} style={{padding:'12px 24px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>{ui.swipe.newOnly}</button>
    </div>
  )

  const company = filteredCompanies[current]
  const nextCompany = filteredCompanies[current + 1]
  const color = sectorColors[company.sector] || '#E24B4A'
  const activeTags = getActiveTags(company.needs_tags)
  const hasNeeds = company.needs_description || activeTags.length > 0

  return (
    <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',alignItems:'center',padding:'0.5rem 1rem 1rem',gap:'0.5rem',userSelect:'none',overflow:'hidden'}}>

      {showMatchModal && (
        <div style={{position:'fixed',top:'15%',left:'50%',transform:'translateX(-50%)',background:'white',borderRadius:16,padding:'1.5rem 2rem',boxShadow:'0 8px 40px rgba(0,0,0,0.15)',zIndex:100,textAlign:'center',width:'80%',maxWidth:300}}>
          {user ? (
            <><div style={{fontSize:36}}>{matchNotice === 'existing' ? '✓' : '🎉'}</div><p style={{fontWeight:700,fontSize:16,marginTop:8}}>{matchNotice === 'existing' ? ui.swipe.matchAlreadyExists : ui.swipe.matchSent}</p></>
          ) : (
            <>
              <div style={{fontSize:36}}>🔒</div>
              <p style={{fontWeight:700,fontSize:16,marginTop:8}}>{ui.swipe.createAccountTitle}</p>
              <p style={{fontSize:13,color:'#666',marginTop:4,marginBottom:12}}>{ui.swipe.signupToSave}</p>
              <button onClick={() => setScreen && setScreen('register')} style={{width:'100%',padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:8}}>{ui.swipe.createAccount}</button>
              <button onClick={() => setScreen && setScreen('login')} style={{width:'100%',padding:'12px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:8}}>{ui.swipe.login}</button>
              <button onClick={() => setShowMatchModal(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>{ui.swipe.continueVisitor}</button>
            </>
          )}
        </div>
      )}

      {showFilters && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:40000,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 0.75rem) 0 calc(76px + env(safe-area-inset-bottom))'}} onClick={() => setShowFilters(false)}>
          <div style={{width:'100%',maxWidth:430,maxHeight:'100%',background:'white',borderRadius:'20px 20px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 -12px 40px rgba(0,0,0,0.18)'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.25rem 1.5rem 0.75rem',flexShrink:0}}>
              <h3 style={{fontSize:18,fontWeight:700,margin:0}}>{ui.swipe.filters}</h3>
              <button onClick={() => setShowFilters(false)} style={{background:'none',border:'none',fontSize:22,cursor:'pointer',color:'#999',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{flex:1,minHeight:0,overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',padding:'0.5rem 1.5rem 1rem',display:'flex',flexDirection:'column',gap:'1.25rem'}}>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:'#444',marginBottom:8,lineHeight:1.4}}>{ui.swipe.radius(filterRadius)}</p>
                <input type="range" min={10} max={300} step={10} value={filterRadius} onChange={e => setFilterRadius(Number(e.target.value))} style={{width:'100%',accentColor:'#E24B4A'}} />
                <div style={{display:'flex',justifyContent:'space-between',gap:12,fontSize:11,color:'#999',marginTop:4}}><span>10 km</span><span style={{textAlign:'right'}}>{ui.swipe.allSwitzerland}</span></div>
                {!myCompanyCoords && <p style={{fontSize:11,color:'#F39C12',marginTop:8,lineHeight:1.45,overflowWrap:'anywhere'}}>{ui.swipe.saveProfileRadius}</p>}
              </div>
              <div>
                <p style={{fontSize:13,fontWeight:600,color:'#444',marginBottom:8,lineHeight:1.4}}>{ui.swipe.sector}</p>
                <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none',background:'white',fontFamily:'Plus Jakarta Sans'}}>
                  <option value="">{ui.swipe.allSectors} ({sectorCountBase.length})</option>
                  {sectors.map(s => <option key={s} value={s}>{s} ({sectorCounts[s] || 0})</option>)}
                </select>
              </div>
            </div>
            <div style={{display:'flex',gap:10,flexShrink:0,padding:'0.75rem 1.5rem 1.25rem',borderTop:'1px solid #f2f2f2',background:'white'}}>
              <button onClick={() => { setFilterSector(''); setFilterRadius(300) }} style={{flex:1,padding:'12px',background:'#f5f5f5',color:'#444',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>{ui.swipe.clear}</button>
              <button onClick={() => setShowFilters(false)} style={{flex:2,padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>{ui.swipe.apply(filteredCompanies.length)}</button>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'0.5rem 1rem',width:'100%',textAlign:'center'}}>
          <p style={{fontSize:12,color:'#E24B4A',fontWeight:600}}>
            {ui.swipe.visitorMode}<span onClick={() => setScreen && setScreen('register')} style={{textDecoration:'underline',cursor:'pointer'}}>{ui.swipe.visitorCreate}</span>{ui.swipe.visitorSuffix}
          </p>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
        <span style={{fontSize:13,color:'#999'}}>{current + 1} / {filteredCompanies.length}</span>
        <button onClick={() => setShowFilters(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background: activeFilters > 0 ? '#E24B4A' : 'white',color: activeFilters > 0 ? 'white' : '#444',border:'1px solid #ddd',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer'}}>
          {ui.swipe.filtersButton} {activeFilters > 0 ? `(${activeFilters})` : ''}
        </button>
      </div>

      <div style={{position:'relative',width:'100%',flex:1,minHeight:0}}>
        {nextCompany && (
          <div style={{position:'absolute',top:8,left:8,right:8,bottom:0,background:'white',borderRadius:20,border:'1px solid #eee',transform:'scale(0.97)',zIndex:1}} />
        )}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          style={{
          position:'absolute',top:0,left:0,right:0,bottom:0,
          background:'white',borderRadius:20,border:'1px solid #eee',
          boxShadow:'0 8px 30px rgba(0,0,0,0.08)',
          transform: getCardTransform(),
          transition: decision ? `transform ${SWIPE_ANIMATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none',
          cursor:'grab', zIndex:2, overflow:'hidden',
          touchAction:'pan-y',
          overscrollBehavior:'contain',
          willChange:'transform',
          backfaceVisibility:'hidden',
        }}>
          <div style={{height:100,background:color,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',flexShrink:0}}>
            {company.logo_url ? (
              <img src={company.logo_url} alt="logo" style={{width:64,height:64,borderRadius:'50%',objectFit:'cover',border:'3px solid white'}} />
            ) : (
              <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{color:'white',fontWeight:700,fontSize:22}}>{company.name.substring(0,2).toUpperCase()}</span>
              </div>
            )}
            <div style={{position:'absolute',top:12,left:12,opacity:likeOpacity,transform:'rotate(-15deg)',background:'#22c55e',color:'white',padding:'4px 10px',borderRadius:8,fontWeight:700,fontSize:14,border:'2px solid white'}}>MATCH ✓</div>
            <div style={{position:'absolute',top:12,right:12,opacity:passOpacity,transform:'rotate(15deg)',background:'#E24B4A',color:'white',padding:'4px 10px',borderRadius:8,fontWeight:700,fontSize:14,border:'2px solid white'}}>PASS ✗</div>
          </div>

          <div style={{padding:'0.75rem 1rem',overflowY:'auto',height:'calc(100% - 100px)'}}>
            <h3 style={{fontSize:17,fontWeight:700,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
              <span>{company.name}</span>
              {isPremiumCompany(company) && <VerifiedBadge size={18} />}
            </h3>
            <div style={{display:'flex',gap:6,marginBottom:'0.5rem',flexWrap:'wrap'}}>
              <span style={{background:color+'15',color:color,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{company.sector}</span>
              <span style={{background:'#f5f5f5',color:'#666',padding:'2px 8px',borderRadius:20,fontSize:11}}>📍 {company.city}, {company.canton}</span>
              <span style={{background:'#f5f5f5',color: ratings[company.id] ? '#E67E22' : '#ccc',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>★ {ratings[company.id] || ui.swipe.newLabel}</span>
            </div>

            {isPremium && company.contact_name && (
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:'0.5rem',background:'#f9f9f9',borderRadius:10,padding:'6px 8px'}}>
                {company.contact_photo_url ? (
                  <img src={company.contact_photo_url} alt="contact" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',flexShrink:0}} />
                ) : (
                  <div style={{width:32,height:32,borderRadius:'50%',background:'#e0e0e0',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:14}}>👤</span>
                  </div>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{company.contact_name}</p>
                  {company.contact_title && <p style={{fontSize:10,color:'#999',margin:0}}>{company.contact_title}</p>}
                </div>
                {company.contact_linkedin && (
                  <a href={company.contact_linkedin} target="_blank" rel="noreferrer" style={{background:'#0A66C2',color:'white',borderRadius:6,padding:'3px 6px',fontSize:10,fontWeight:600,textDecoration:'none'}}>in</a>
                )}
              </div>
            )}

            <p style={{color:'#666',fontSize:13,lineHeight:1.5,marginBottom: hasNeeds ? '0.5rem' : 0}}>{company.description}</p>

            {hasNeeds && (
              <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:10,padding:'8px 10px'}}>
                <p style={{fontSize:11,color:'#E67E22',fontWeight:700,marginBottom:4}}>{ui.swipe.needs}</p>
                {company.needs_description && (
                  <p style={{fontSize:12,color:'#444',lineHeight:1.4,marginBottom: activeTags.length > 0 ? 4 : 0}}>{company.needs_description}</p>
                )}
                {activeTags.length > 0 && (
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {activeTags.map((tag, i) => (
                      <span key={i} style={{background:'white',border:'1px solid #22c55e',borderRadius:20,padding:'2px 8px',fontSize:11,fontWeight:500,color:'#333'}}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:'2rem',alignItems:'center',flexShrink:0,paddingBottom:'0.9rem'}}>
        <button onClick={() => handleSwipe('left')} style={{width:56,height:56,borderRadius:'50%',background:'white',border:'2px solid #E24B4A',color:'#E24B4A',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>✗</button>
        <button onClick={() => handleSwipe('right')} style={{width:64,height:64,borderRadius:'50%',background:'#E24B4A',border:'none',color:'white',fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(226,75,74,0.4)'}}>✓</button>
      </div>

      {!user && <p style={{fontSize:11,color:'#999',textAlign:'center',flexShrink:0}}>{ui.swipe.pressCheck}</p>}
    </div>
  )
}
