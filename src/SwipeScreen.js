import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { useState, useEffect, useRef, useCallback } from 'react'

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

const haversine = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export default function SwipeScreen({ user, setScreen }) {
  const [companies, setCompanies] = useState([])
  const [filteredCompanies, setFilteredCompanies] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [decision, setDecision] = useState(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [allSeen, setAllSeen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filterRadius, setFilterRadius] = useState(300)
  const [filterSector, setFilterSector] = useState('')
  const [myCompanyCoords, setMyCompanyCoords] = useState(null)
  const [ratings, setRatings] = useState({})
  const cardRef = useRef(null)
  const cardCallbackRef = useCallback((node) => {
  if (node) {
    cardRef.current = node
  }
}, [])
  const hammerRef = useRef(null)
  const decisionRef = useRef(null)
  const currentRef = useRef(0)
  const companiesRef = useRef([])

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
    if (user && !ignoreHistory) {
      const { data: myCompany } = await supabase.from('companies').select('id, lat, lng').eq('user_id', user.id).single()
      if (myCompany) {
        if (myCompany.lat && myCompany.lng) setMyCompanyCoords({ lat: myCompany.lat, lng: myCompany.lng })
        const { data: history } = await supabase.from('swipe_history').select('company_id').eq('user_id', user.id)
        seenIds = (history || []).map(h => h.company_id)
        seenIds.push(myCompany.id)
      }
    } else if (user) {
      const { data: myCompany } = await supabase.from('companies').select('id, lat, lng').eq('user_id', user.id).single()
      if (myCompany) {
        if (myCompany.lat && myCompany.lng) setMyCompanyCoords({ lat: myCompany.lat, lng: myCompany.lng })
        seenIds.push(myCompany.id)
      }
    }
    let query = supabase.from('companies').select('*').limit(100)
    if (seenIds.length > 0) query = query.not('id', 'in', `(${seenIds.join(',')})`)
    const { data } = await query
    if (!data || data.length === 0) {
      setAllSeen(true)
      setCompanies([])
      setFilteredCompanies([])
    } else {
      setCompanies(data)
      const avgRatings = await loadRatings(data)
      setRatings(avgRatings)
    }
    setLoading(false)
  }

  const saveSwipeHistory = async (companyId, direction) => {
    if (!user) return
    await supabase.from('swipe_history').upsert({ user_id: user.id, company_id: companyId, direction }, { onConflict: 'user_id,company_id' })
  }

  const handleSwipe = async (direction) => {
    if (decisionRef.current) return
    const company = companiesRef.current[currentRef.current]
    if (!company) return

    if (direction === 'right') {
      if (!user) {
        setShowMatchModal(true)
        setTimeout(() => setShowMatchModal(false), 3000)
        setDecision(direction)
        setTimeout(() => { setCurrent(c => c + 1); setOffset({ x: 0, y: 0 }); setDecision(null); decisionRef.current = null }, 400)
        return
      }
      const { data: myCompany } = await supabase.from('companies').select('id').eq('user_id', user.id).single()
      if (myCompany) {
        const { data: existing } = await supabase.from('matches').select('id').or(`and(company_a.eq.${myCompany.id},company_b.eq.${company.id}),and(company_a.eq.${company.id},company_b.eq.${myCompany.id})`).maybeSingle()
        if (!existing) {
          const { data: newMatch } = await supabase.from('matches').insert({ company_a: myCompany.id, company_b: company.id, status: 'pending' }).select().single()
          if (newMatch) {
            const { data: otherUser } = await supabase.from('companies').select('user_id').eq('id', company.id).single()
            if (otherUser) {
              await supabase.from('notifications').insert([
                { user_id: user.id, type: 'new_match', match_id: newMatch.id },
                { user_id: otherUser.user_id, type: 'new_match', match_id: newMatch.id }
              ])
            }
          }
        }
      }
      setShowMatchModal(true)
      setTimeout(() => setShowMatchModal(false), 1500)
    }

    await saveSwipeHistory(company.id, direction)
    decisionRef.current = direction
    setDecision(direction)
    setTimeout(() => { setCurrent(c => c + 1); setOffset({ x: 0, y: 0 }); setDecision(null); decisionRef.current = null }, 400)
  }
useEffect(() => {
  if (filteredCompanies.length === 0) return
  
  const timer = setTimeout(() => {
    const card = cardRef.current
    console.log('card ref after timeout:', card)
    if (!card) return

    let startX = 0
    let startY = 0
    let isDragging = false

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      isDragging = true
    }

    const onTouchMove = (e) => {
      if (!isDragging || decisionRef.current) return
      const deltaX = e.touches[0].clientX - startX
      const deltaY = e.touches[0].clientY - startY
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault()
        setOffset({ x: deltaX, y: deltaY * 0.1 })
      }
    }

    const onTouchEnd = (e) => {
      if (!isDragging || decisionRef.current) return
      isDragging = false
      const deltaX = e.changedTouches[0].clientX - startX
      if (deltaX > 60) handleSwipe('right')
      else if (deltaX < -60) handleSwipe('left')
      else setOffset({ x: 0, y: 0 })
    }

    // Mouse events pour desktop
    let mouseStartX = 0
    let isMouseDragging = false

    const onMouseDown = (e) => {
  console.log('mousedown detected!', e.clientX)
  mouseStartX = e.clientX
  isMouseDragging = true
}

    const onMouseMove = (e) => {
      if (!isMouseDragging || decisionRef.current) return
      const deltaX = e.clientX - mouseStartX
      setOffset({ x: deltaX, y: 0 })
    }

    const onMouseUp = (e) => {
      if (!isMouseDragging || decisionRef.current) return
      isMouseDragging = false
      const deltaX = e.clientX - mouseStartX
      if (deltaX > 80) handleSwipe('right')
      else if (deltaX < -80) handleSwipe('left')
      else setOffset({ x: 0, y: 0 })
    }

    card.addEventListener('touchstart', onTouchStart, { passive: true })
    card.addEventListener('touchmove', onTouchMove, { passive: false })
    card.addEventListener('touchend', onTouchEnd, { passive: true })
    card.addEventListener('mousedown', onMouseDown)
    card.addEventListener('mousemove', onMouseMove)
    card.addEventListener('mouseup', onMouseUp)
    card.addEventListener('mouseleave', onMouseUp)

    card._cleanup = () => {
      card.removeEventListener('touchstart', onTouchStart)
      card.removeEventListener('touchmove', onTouchMove)
      card.removeEventListener('touchend', onTouchEnd)
      card.removeEventListener('mousedown', onMouseDown)
      card.removeEventListener('mousemove', onMouseMove)
      card.removeEventListener('mouseup', onMouseUp)
      card.removeEventListener('mouseleave', onMouseUp)
    }
  }, 300)

  return () => {
    clearTimeout(timer)
    const card = cardRef.current
    if (card && card._cleanup) card._cleanup()
  }
}, [filteredCompanies.length, current])
  const rotate = offset.x * 0.08
  const likeOpacity = Math.max(0, Math.min(offset.x / 80, 1))
  const passOpacity = Math.max(0, Math.min(-offset.x / 80, 1))

  const getCardTransform = () => {
    if (decision === 'right') return 'translateX(150%) rotate(20deg)'
    if (decision === 'left') return 'translateX(-150%) rotate(-20deg)'
    return `translateX(${offset.x}px) translateY(${offset.y}px) rotate(${rotate}deg)`
  }

  const activeFilters = (filterSector ? 1 : 0) + (filterRadius < 300 ? 1 : 0)

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:400}}>
      <p style={{color:'#999'}}>Chargement...</p>
    </div>
  )

  if (allSeen || current >= filteredCompanies.length) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
      <div style={{fontSize:48}}>{activeFilters > 0 ? '🔍' : '🎉'}</div>
      <h3 style={{fontSize:20,fontWeight:700}}>{activeFilters > 0 ? 'Aucun résultat pour ces filtres' : 'Vous avez tout vu !'}</h3>
      <p style={{color:'#999',fontSize:14}}>{activeFilters > 0 ? "Essayez d'élargir le rayon ou changer de secteur." : 'Vous avez parcouru toutes les entreprises disponibles.'}</p>
      {activeFilters > 0 && <button onClick={() => { setFilterSector(''); setFilterRadius(300) }} style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>Effacer les filtres</button>}
      <button onClick={() => loadCompanies(true)} style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>Tout revoir depuis le début</button>
      <button onClick={() => loadCompanies(false)} style={{padding:'12px 24px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>Voir uniquement les nouvelles</button>
    </div>
  )

  const company = filteredCompanies[current]
  const nextCompany = filteredCompanies[current + 1]
  const color = sectorColors[company.sector] || '#E24B4A'

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'0.75rem 1rem',gap:'0.75rem',userSelect:'none',overflow:'hidden'}}>

      {showMatchModal && (
        <div style={{position:'fixed',top:'15%',left:'50%',transform:'translateX(-50%)',background:'white',borderRadius:16,padding:'1.5rem 2rem',boxShadow:'0 8px 40px rgba(0,0,0,0.15)',zIndex:100,textAlign:'center',width:'80%',maxWidth:300}}>
          {user ? (
            <><div style={{fontSize:36}}>🎉</div><p style={{fontWeight:700,fontSize:16,marginTop:8}}>Match envoyé !</p></>
          ) : (
            <>
              <div style={{fontSize:36}}>🔒</div>
              <p style={{fontWeight:700,fontSize:16,marginTop:8}}>Créez un compte !</p>
              <p style={{fontSize:13,color:'#666',marginTop:4,marginBottom:12}}>Inscrivez-vous pour sauvegarder ce match.</p>
              <button onClick={() => setScreen && setScreen('register')} style={{width:'100%',padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:8}}>Créer un compte →</button>
              <button onClick={() => setScreen && setScreen('login')} style={{width:'100%',padding:'12px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer',marginBottom:8}}>Se connecter →</button>
              <button onClick={() => setShowMatchModal(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>Continuer en mode visiteur</button>
            </>
          )}
        </div>
      )}

      {showFilters && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:200}} onClick={() => setShowFilters(false)}>
          <div style={{position:'absolute',bottom:0,left:0,right:0,background:'white',borderRadius:'20px 20px 0 0',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'1.25rem'}} onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3 style={{fontSize:18,fontWeight:700}}>Filtres</h3>
              <button onClick={() => setShowFilters(false)} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'#999'}}>✕</button>
            </div>
            <div>
              <p style={{fontSize:13,fontWeight:600,color:'#444',marginBottom:8}}>📍 Rayon : {filterRadius >= 300 ? 'Toute la Suisse' : `${filterRadius} km`}</p>
              <input type="range" min={10} max={300} step={10} value={filterRadius} onChange={e => setFilterRadius(Number(e.target.value))} style={{width:'100%',accentColor:'#E24B4A'}} />
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#999',marginTop:4}}><span>10 km</span><span>Toute la Suisse</span></div>
              {!myCompanyCoords && <p style={{fontSize:11,color:'#F39C12',marginTop:6}}>⚠️ Sauvegardez votre profil pour activer le filtre par rayon</p>}
            </div>
            <div>
              <p style={{fontSize:13,fontWeight:600,color:'#444',marginBottom:8}}>🏢 Secteur</p>
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:14,outline:'none',background:'white',fontFamily:'Plus Jakarta Sans'}}>
                <option value="">Tous les secteurs</option>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => { setFilterSector(''); setFilterRadius(300) }} style={{flex:1,padding:'12px',background:'#f5f5f5',color:'#444',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>Effacer</button>
              <button onClick={() => setShowFilters(false)} style={{flex:2,padding:'12px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>Appliquer ({filteredCompanies.length} résultats)</button>
            </div>
          </div>
        </div>
      )}

      {!user && (
        <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'0.5rem 1rem',width:'100%',textAlign:'center'}}>
          <p style={{fontSize:12,color:'#E24B4A',fontWeight:600}}>
            👀 Mode visiteur — <span onClick={() => setScreen && setScreen('register')} style={{textDecoration:'underline',cursor:'pointer'}}>Créez un compte</span> pour sauvegarder vos matches
          </p>
        </div>
      )}

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%'}}>
        <span style={{fontSize:13,color:'#999'}}>{current + 1} / {filteredCompanies.length}</span>
        <button onClick={() => setShowFilters(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background: activeFilters > 0 ? '#E24B4A' : 'white',color: activeFilters > 0 ? 'white' : '#444',border:'1px solid #ddd',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer'}}>
          🎛 Filtres {activeFilters > 0 ? `(${activeFilters})` : ''}
        </button>
      </div>

      {/* Zone de swipe */}
      <div style={{position:'relative',width:'100%',flex:1,minHeight:0}}>
        {nextCompany && (
          <div style={{position:'absolute',top:8,left:8,right:8,bottom:0,background:'white',borderRadius:20,border:'1px solid #eee',transform:'scale(0.97)',zIndex:1}} />
        )}
        <div ref={cardCallbackRef} style={{
          position:'absolute',top:0,left:0,right:0,bottom:0,
          background:'white',borderRadius:20,border:'1px solid #eee',
          boxShadow:'0 8px 30px rgba(0,0,0,0.08)',
          transform: getCardTransform(),
          transition: decision ? 'transform 0.4s ease' : 'none',
          cursor:'grab', zIndex:2, overflow:'hidden',
          touchAction:'none',
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
            <h3 style={{fontSize:17,fontWeight:700,marginBottom:4}}>{company.name}</h3>
            <div style={{display:'flex',gap:6,marginBottom:'0.5rem',flexWrap:'wrap'}}>
              <span style={{background:color+'15',color:color,padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>{company.sector}</span>
              <span style={{background:'#f5f5f5',color:'#666',padding:'2px 8px',borderRadius:20,fontSize:11}}>📍 {company.city}, {company.canton}</span>
              <span style={{background:'#f5f5f5',color: ratings[company.id] ? '#E67E22' : '#ccc',padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:600}}>★ {ratings[company.id] || 'Nouveau'}</span>
            </div>
            {company.contact_name && (
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
            <p style={{color:'#666',fontSize:13,lineHeight:1.5}}>{company.description}</p>
          </div>
        </div>
      </div>

      {/* Boutons */}
      <div style={{display:'flex',gap:'2rem',alignItems:'center',flexShrink:0,paddingBottom:'0.25rem'}}>
        <button onClick={() => handleSwipe('left')} style={{width:56,height:56,borderRadius:'50%',background:'white',border:'2px solid #E24B4A',color:'#E24B4A',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>✗</button>
        <button onClick={() => handleSwipe('right')} style={{width:64,height:64,borderRadius:'50%',background:'#E24B4A',border:'none',color:'white',fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(226,75,74,0.4)'}}>✓</button>
      </div>

      {!user && <p style={{fontSize:11,color:'#999',textAlign:'center',flexShrink:0}}>Appuyez sur ✓ pour créer un compte</p>}
    </div>
  )
}