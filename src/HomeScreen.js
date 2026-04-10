import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

const sectorColors = {
  'Fiduciaire': '#3B6D11', 'Design & Communication': '#533AB7',
  'Informatique': '#185FA5', 'Construction': '#854F0B',
  'Marketing Digital': '#993556', 'Ressources Humaines': '#0F6E56',
  'Transport & Logistique': '#444441', 'Services': '#993C1D',
}

export default function HomeScreen({ user, setActiveTab }) {
  const [company, setCompany] = useState(null)
  const [stats, setStats] = useState({ matches: 0, messages: 0, followers: 0, totalCompanies: 0 })
  const [matchedCompanies, setMatchedCompanies] = useState([])
  const [founderSlots, setFounderSlots] = useState({ used: 0, max: 100 })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: comp } = await supabase
      .from('companies').select('*').eq('user_id', user.id).single()

    if (comp) {
      setCompany(comp)

      // Matchs que j'ai initiés
      const { data: myMatches } = await supabase
        .from('matches')
        .select('*, company_b(*)')
        .eq('company_a', comp.id)
        .eq('status', 'pending')
      setMatchedCompanies(myMatches || [])

      // Nombre d'entreprises qui me suivent
      const { count: followers } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('company_b', comp.id)

      // Messages envoyés
      const { count: msgCount } = await supabase
        .from('messages').select('*', { count: 'exact', head: true })
        .eq('sender_id', comp.id)

      // Total entreprises sur Hubbing
      const { count: totalCompanies } = await supabase
        .from('companies').select('*', { count: 'exact', head: true })

      setStats({
        matches: myMatches?.length || 0,
        messages: msgCount || 0,
        followers: followers || 0,
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
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  const color = company ? (sectorColors[company.sector] || '#E24B4A') : '#E24B4A'
  const remaining = founderSlots.max - founderSlots.used

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:400}}>
      <p style={{color:'#999'}}>Chargement...</p>
    </div>
  )

  return (
    <div style={{flex:1,overflowY:'auto'}}>

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
        <h2 style={{color:'white',fontSize:22,fontWeight:700,lineHeight:1.2}}>
          {company?.name || user.email}
        </h2>
        {company?.sector && (
          <p style={{color:'rgba(255,255,255,0.75)',fontSize:13,marginTop:4}}>
            {company.sector} · {company.city}, {company.canton}
          </p>
        )}
        <div style={{marginTop:12,background:'rgba(255,255,255,0.15)',borderRadius:8,padding:'6px 12px',display:'inline-block'}}>
          <span style={{color:'white',fontSize:12,fontWeight:600}}>
            🏢 {stats.totalCompanies} entreprises sur Hubbing
          </span>
        </div>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{display:'flex',gap:10,padding:'0 1rem',marginTop:'-1.25rem',position:'relative',zIndex:1}}>
        <div style={{flex:1,background:'white',borderRadius:12,padding:'0.875rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#E24B4A',margin:0}}>{stats.matches}</p>
          <p style={{fontSize:11,color:'#999',marginTop:3}}>Je suis</p>
        </div>
        <div style={{flex:1,background:'white',borderRadius:12,padding:'0.875rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#E24B4A',margin:0}}>{stats.followers}</p>
          <p style={{fontSize:11,color:'#999',marginTop:3}}>Me suivent</p>
        </div>
        <div style={{flex:1,background:'white',borderRadius:12,padding:'0.875rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#3B6D11',margin:0}}>{remaining}</p>
          <p style={{fontSize:11,color:'#999',marginTop:3}}>Places Fondateurs</p>
        </div>
      </div>

      <div style={{padding:'1.25rem 1rem',display:'flex',flexDirection:'column',gap:'1rem'}}>

        {/* Entreprises que je suis */}
        <div style={{background:'white',border:'1px solid #f0f0f0',borderRadius:12,overflow:'hidden'}}>
          <div style={{padding:'0.875rem 1rem',borderBottom:'1px solid #f5f5f5',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{fontWeight:700,fontSize:14,margin:0}}>Entreprises que je suis</p>
            <span onClick={() => setActiveTab('messages')}
              style={{fontSize:12,color:'#E24B4A',cursor:'pointer',fontWeight:600}}>Voir tout →</span>
          </div>
          {matchedCompanies.length === 0 ? (
            <div style={{padding:'1.5rem',textAlign:'center'}}>
              <p style={{color:'#999',fontSize:13}}>Pas encore de connexions</p>
              <button onClick={() => setActiveTab('swipe')}
                style={{marginTop:8,padding:'8px 16px',background:'#E24B4A',color:'white',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Découvrir des entreprises
              </button>
            </div>
          ) : (
            <div>
              {matchedCompanies.slice(0, 4).map(match => {
                const other = match.company_b
                if (!other) return null
                const c = sectorColors[other.sector] || '#E24B4A'
                return (
                  <div key={match.id} onClick={() => setActiveTab('messages')}
                    style={{padding:'0.75rem 1rem',display:'flex',alignItems:'center',gap:12,cursor:'pointer',borderBottom:'1px solid #f9f9f9'}}>
                    <div style={{width:40,height:40,borderRadius:'50%',background:c,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{color:'white',fontWeight:700,fontSize:13}}>
                        {other.name?.substring(0,2).toUpperCase()}
                      </span>
                    </div>
                    <div style={{flex:1}}>
                      <p style={{fontWeight:600,fontSize:14,margin:0}}>{other.name}</p>
                      <p style={{fontSize:12,color:'#999',margin:0}}>{other.sector} · {other.city}</p>
                    </div>
                    <span style={{color:'#ddd',fontSize:16}}>›</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Offre fondateurs */}
        <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <p style={{fontSize:14,color:'#E24B4A',fontWeight:700,margin:0}}>🎉 Offre Fondateurs</p>
            <span style={{fontSize:12,color:'#E24B4A',fontWeight:600}}>{remaining} restantes</span>
          </div>
          <div style={{background:'#fee2e2',borderRadius:8,overflow:'hidden',height:6,marginBottom:8}}>
            <div style={{height:'100%',background:'#E24B4A',width:`${(founderSlots.used/founderSlots.max)*100}%`,borderRadius:8}} />
          </div>
          <p style={{fontSize:12,color:'#666',lineHeight:1.5,margin:0}}>
            2 mois Premium offerts — plus que <strong>{remaining} places</strong> disponibles !
          </p>
          <button style={{marginTop:'0.75rem',width:'100%',padding:'10px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
            Activer l'offre Fondateurs
          </button>
        </div>

        {/* Compléter profil si incomplet */}
        {(!company?.description || !company?.sector) && (
          <div onClick={() => setActiveTab('profile')}
            style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:12,padding:'1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
            <span style={{fontSize:28}}>✏️</span>
            <div style={{flex:1}}>
              <p style={{fontWeight:700,fontSize:14,margin:0}}>Complétez votre profil</p>
              <p style={{fontSize:12,color:'#999',marginTop:2}}>Un profil complet attire 3x plus de matchs</p>
            </div>
            <span style={{color:'#ccc',fontSize:18}}>›</span>
          </div>
        )}

        {/* Raccourci swipe */}
        <div onClick={() => setActiveTab('swipe')}
          style={{background:color,borderRadius:12,padding:'1.25rem',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <p style={{color:'white',fontWeight:700,fontSize:15,margin:0}}>Découvrir des entreprises</p>
            <p style={{color:'rgba(255,255,255,0.75)',fontSize:12,marginTop:3}}>Swipez et créez des connexions B2B</p>
          </div>
          <span style={{fontSize:28}}>💼</span>
        </div>

      </div>
    </div>
  )
}