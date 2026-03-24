import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function SwipeScreen({ user, setScreen }) {
  const [companies, setCompanies] = useState([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [decision, setDecision] = useState(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const startPos = useRef(null)
  const cardRef = useRef(null)

  useEffect(() => {
    loadCompanies()
  }, [])

  const loadCompanies = async () => {
    setLoading(true)
    let query = supabase.from('companies').select('*').limit(20)
    if (user) {
      const { data: myCompany } = await supabase
        .from('companies').select('id').eq('user_id', user.id).single()
      if (myCompany) query = query.neq('id', myCompany.id)
    }
    const { data } = await query
    setCompanies(data || [])
    setLoading(false)
  }

  const handleSwipe = async (direction) => {
    if (current >= companies.length || decision) return
    const company = companies[current]

    if (direction === 'right') {
      if (user) {
        const { data: myCompany } = await supabase
          .from('companies').select('id').eq('user_id', user.id).single()
        if (myCompany) {
          await supabase.from('matches').insert({
            company_a: myCompany.id,
            company_b: company.id,
            initiated_by: myCompany.id,
            status: 'pending'
          })
        }
        setShowMatchModal(true)
        setTimeout(() => setShowMatchModal(false), 1500)
      }
    }

    setDecision(direction)
    setTimeout(() => {
      setCurrent(c => c + 1)
      setOffset({ x: 0, y: 0 })
      setDecision(null)
    }, 400)
  }

  const onPointerDown = (e) => {
    if (decision) return
    setDragging(true)
    startPos.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerMove = (e) => {
    if (!dragging || !startPos.current || decision) return
    setOffset({
      x: e.clientX - startPos.current.x,
      y: e.clientY - startPos.current.y
    })
  }

  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (offset.x > 80) handleSwipe('right')
    else if (offset.x < -80) handleSwipe('left')
    else setOffset({ x: 0, y: 0 })
    startPos.current = null
  }

  const rotate = offset.x * 0.08
  const likeOpacity = Math.max(0, Math.min(offset.x / 80, 1))
  const passOpacity = Math.max(0, Math.min(-offset.x / 80, 1))

  const sectorColors = {
    'Fiduciaire': '#3B6D11',
    'Design & Communication': '#533AB7',
    'Informatique': '#185FA5',
    'Construction': '#854F0B',
    'Marketing Digital': '#993556',
    'Ressources Humaines': '#0F6E56',
    'Transport & Logistique': '#444441',
    'Services': '#993C1D',
  }

  const getCardTransform = () => {
    if (decision === 'right') return 'translateX(150%) rotate(20deg)'
    if (decision === 'left') return 'translateX(-150%) rotate(-20deg)'
    return `translateX(${offset.x}px) translateY(${offset.y * 0.3}px) rotate(${rotate}deg)`
  }

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:400}}>
      <p style={{color:'#999'}}>Chargement...</p>
    </div>
  )

  if (current >= companies.length) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
      <div style={{fontSize:48}}>🎉</div>
      <h3 style={{fontSize:20,fontWeight:700}}>C'est tout pour l'instant !</h3>
      <p style={{color:'#999',fontSize:14}}>Revenez bientôt pour découvrir de nouvelles entreprises.</p>
      <button onClick={() => { setCurrent(0); loadCompanies() }}
        style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
        Recommencer
      </button>
    </div>
  )

  const company = companies[current]
  const nextCompany = companies[current + 1]
  const color = sectorColors[company.sector] || '#E24B4A'

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'1.5rem 1rem',gap:'1.5rem',userSelect:'none'}}>

      {/* Match modal visiteur */}
      {showMatchModal && user && (
        <div style={{position:'fixed',top:'20%',left:'50%',transform:'translateX(-50%)',background:'white',borderRadius:16,padding:'1.5rem 2rem',boxShadow:'0 8px 40px rgba(0,0,0,0.15)',zIndex:100,textAlign:'center'}}>
          <div style={{fontSize:36}}>🎉</div>
          <p style={{fontWeight:700,fontSize:16,marginTop:8}}>Match envoyé !</p>
        </div>
      )}

      {/* Bannière visiteur */}
      {!user && (
        <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'0.75rem 1rem',width:'100%',textAlign:'center'}}>
          <p style={{fontSize:12,color:'#E24B4A',fontWeight:600}}>
            👀 Mode démo — <span onClick={() => setScreen && setScreen('register')} style={{textDecoration:'underline',cursor:'pointer'}}>Créez un compte</span> pour sauvegarder vos matches
          </p>
        </div>
      )}

      {/* Compteur */}
      <span style={{fontSize:13,color:'#999'}}>{current + 1} / {companies.length}</span>

      {/* Zone cartes */}
      <div style={{position:'relative',width:'100%',maxWidth:360,height:420}}>

        {/* Carte suivante */}
        {nextCompany && (
          <div style={{
            position:'absolute',top:8,left:8,right:8,height:400,
            background:'white',borderRadius:20,border:'1px solid #eee',
            transform:'scale(0.97)',zIndex:1
          }} />
        )}

        {/* Carte principale */}
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            position:'absolute',top:0,left:0,right:0,height:400,
            background:'white',borderRadius:20,border:'1px solid #eee',
            boxShadow:'0 8px 30px rgba(0,0,0,0.08)',
            transform: getCardTransform(),
            transition: dragging ? 'none' : 'transform 0.4s ease',
            cursor: decision ? 'default' : 'grab',
            zIndex:2,overflow:'hidden',
          }}
        >
          {/* Header coloré */}
          <div style={{height:140,background:color,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
            <div style={{width:72,height:72,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{color:'white',fontWeight:700,fontSize:24}}>
                {company.name.substring(0,2).toUpperCase()}
              </span>
            </div>
            {/* Badge LIKE */}
            <div style={{position:'absolute',top:16,left:16,opacity:likeOpacity,transform:'rotate(-15deg)',background:'#22c55e',color:'white',padding:'6px 14px',borderRadius:8,fontWeight:700,fontSize:16,border:'2px solid white'}}>
              MATCH ✓
            </div>
            {/* Badge PASS */}
            <div style={{position:'absolute',top:16,right:16,opacity:passOpacity,transform:'rotate(15deg)',background:'#E24B4A',color:'white',padding:'6px 14px',borderRadius:8,fontWeight:700,fontSize:16,border:'2px solid white'}}>
              PASS ✗
            </div>
          </div>

          {/* Infos */}
          <div style={{padding:'1.25rem'}}>
            <h3 style={{fontSize:20,fontWeight:700,marginBottom:4}}>{company.name}</h3>
            <div style={{display:'flex',gap:8,marginBottom:'0.75rem',flexWrap:'wrap'}}>
              <span style={{background:color+'15',color:color,padding:'3px 10px',borderRadius:20,fontSize:12,fontWeight:600}}>
                {company.sector}
              </span>
              <span style={{background:'#f5f5f5',color:'#666',padding:'3px 10px',borderRadius:20,fontSize:12}}>
                📍 {company.city}, {company.canton}
              </span>
            </div>
            <p style={{color:'#666',fontSize:14,lineHeight:1.6}}>{company.description}</p>
          </div>
        </div>
      </div>

      {/* Boutons */}
      <div style={{display:'flex',gap:'2rem',alignItems:'center'}}>
        <button onClick={() => handleSwipe('left')}
          style={{width:60,height:60,borderRadius:'50%',background:'white',border:'2px solid #E24B4A',color:'#E24B4A',fontSize:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
          ✗
        </button>
        <button
          onClick={() => user ? handleSwipe('right') : setScreen && setScreen('register')}
          style={{width:70,height:70,borderRadius:'50%',background:'#E24B4A',border:'none',color:'white',fontSize:26,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 16px rgba(226,75,74,0.4)'}}>
          ✓
        </button>
      </div>

      {/* CTA visiteur sous les boutons */}
      {!user && (
        <p style={{fontSize:12,color:'#999',textAlign:'center'}}>
          Appuyez sur ✓ pour créer un compte et sauvegarder vos matches
        </p>
      )}
    </div>
  )
}