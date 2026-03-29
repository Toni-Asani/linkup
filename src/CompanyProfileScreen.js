import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

export default function CompanyProfileScreen({ companyId, plan, onBack, setActiveTab }) {
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [contacting, setContacting] = useState(false)

  useEffect(() => { loadCompany() }, [companyId])

  const loadCompany = async () => {
    const { data } = await supabase
      .from('companies').select('*').eq('id', companyId).single()
    setCompany(data)
    setLoading(false)
  }

  const handleContact = async () => {
    if (plan === 'Starter') {
      setShowUpgradeModal(true)
      return
    }
    setContacting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: myCompany } = await supabase
        .from('companies').select('id').eq('user_id', user.id).single()
      if (!myCompany) return

      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .or(`and(company_a.eq.${myCompany.id},company_b.eq.${companyId}),and(company_a.eq.${companyId},company_b.eq.${myCompany.id})`)
        .maybeSingle()

      if (!existing) {
        await supabase.from('matches').insert({
          company_a: myCompany.id,
          company_b: companyId,
          status: 'pending'
        })
      }
      setActiveTab && setActiveTab('messages')
    } catch (e) {
      console.error(e)
    }
    setContacting(false)
  }

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:400}}>
      <p style={{color:'#999'}}>Chargement...</p>
    </div>
  )

  if (!company) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center'}}>
      <p style={{color:'#999'}}>Profil introuvable</p>
    </div>
  )

  const color = sectorColors[company.sector] || '#E24B4A'
  const initials = company.name?.substring(0, 2).toUpperCase()
  const isBasic = plan === 'Basic' || plan === 'Premium'
  const isPremium = plan === 'Premium'
  const isStarter = !isBasic

  let parsedTags = []
  try { parsedTags = company.needs_tags ? JSON.parse(company.needs_tags) : [] } catch { parsedTags = [] }
  const activeTags = parsedTags.filter(t => {
    if (!t.expires) return true
    return new Date(t.expires) > new Date()
  })
  const hasNeeds = company.needs_description || activeTags.length > 0

  return (
    <div style={{flex:1,overflowY:'auto'}}>

      {/* Modal upgrade Starter */}
      {showUpgradeModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
          <div style={{background:'white',borderRadius:16,padding:'2rem',width:'100%',maxWidth:340,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:'0.75rem'}}>🔒</div>
            <h3 style={{fontSize:18,fontWeight:700,marginBottom:8}}>Fonctionnalité Basic</h3>
            <p style={{fontSize:14,color:'#666',lineHeight:1.6,marginBottom:'1.25rem'}}>
              Passez en Basic ou Premium pour contacter des entreprises et accéder à la messagerie B2B.
            </p>
            <button onClick={() => { setShowUpgradeModal(false); setActiveTab && setActiveTab('pricing') }}
              style={{width:'100%',padding:'13px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
              Voir les forfaits →
            </button>
            <button onClick={() => setShowUpgradeModal(false)}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:color,padding:'1rem 1.5rem 3rem',position:'relative',textAlign:'center'}}>
        <button onClick={onBack}
          style={{position:'absolute',top:16,left:16,background:'rgba(255,255,255,0.2)',border:'none',borderRadius:20,padding:'6px 12px',color:'white',fontSize:13,cursor:'pointer',fontWeight:600}}>
          ← Retour
        </button>
        <div style={{width:80,height:80,margin:'2rem auto 0',borderRadius:'50%',overflow:'hidden',border:'3px solid white'}}>
          {company.logo_url ? (
            <img src={company.logo_url} alt="logo" style={{width:'100%',height:'100%',objectFit:'cover'}} />
          ) : (
            <div style={{width:'100%',height:'100%',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{color:'white',fontWeight:700,fontSize:28}}>{initials}</span>
            </div>
          )}
        </div>
        <h2 style={{color:'white',fontSize:20,fontWeight:700,marginTop:'0.75rem'}}>{company.name}</h2>
        {company.sector && <p style={{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:2}}>{company.sector}</p>}
        {company.city && <p style={{color:'rgba(255,255,255,0.7)',fontSize:13,marginTop:2}}>📍 {company.city}{company.canton ? `, ${company.canton}` : ''}</p>}
      </div>

      <div style={{padding:'1.5rem 1rem',display:'flex',flexDirection:'column',gap:'0.75rem',marginTop:'-1rem'}}>

        {/* Description */}
        {company.description && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:6}}>À PROPOS</p>
            <p style={{fontSize:14,color:'#444',lineHeight:1.6}}>{company.description}</p>
          </div>
        )}

        {/* Besoins — visibles par tous, interaction bloquée pour Starter */}
        {hasNeeds && (
          <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#E67E22',fontWeight:700,marginBottom:8}}>💼 BESOINS</p>
            {company.needs_description && (
              <p style={{fontSize:14,color:'#444',lineHeight:1.6,marginBottom: activeTags.length > 0 ? 10 : 0}}>
                {company.needs_description}
              </p>
            )}
            {activeTags.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                {activeTags.map((tag, i) => (
                  <span key={i} style={{background:'white',border:'1px solid #22c55e',borderRadius:20,padding:'4px 10px',fontSize:12,fontWeight:500,color:'#333'}}>
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
            {isStarter ? (
              <div style={{background:'#f5f5f5',borderRadius:10,padding:'10px 12px',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:16}}>🔒</span>
                <p style={{fontSize:12,color:'#666',margin:0,flex:1}}>Passez en <strong>Basic ou Premium</strong> pour répondre à ces besoins</p>
                <button onClick={() => setActiveTab && setActiveTab('pricing')}
                  style={{background:'#E24B4A',color:'white',border:'none',borderRadius:8,padding:'6px 10px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
                  Upgrader →
                </button>
              </div>
            ) : (
              <button onClick={handleContact}
                style={{width:'100%',padding:'10px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Répondre à ce besoin →
              </button>
            )}
          </div>
        )}

        {/* Décisionnaire */}
        {company.contact_name && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:8}}>DÉCIDEUR</p>
            {isPremium ? (
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {company.contact_photo_url ? (
                  <img src={company.contact_photo_url} alt="contact"
                    style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',border:'2px solid #eee',flexShrink:0}} />
                ) : (
                  <div style={{width:52,height:52,borderRadius:'50%',background:'#e0e0e0',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:22}}>👤</span>
                  </div>
                )}
                <div style={{flex:1}}>
                  <p style={{fontSize:15,fontWeight:700,margin:0}}>{company.contact_name}</p>
                  {company.contact_title && <p style={{fontSize:13,color:'#666',margin:0}}>{company.contact_title}</p>}
                  {company.contact_phone && <p style={{fontSize:13,color:'#444',margin:'4px 0 0'}}>{company.contact_phone}</p>}
                </div>
                {company.contact_linkedin && (
                  <a href={company.contact_linkedin} target="_blank" rel="noreferrer"
                    style={{background:'#0A66C2',color:'white',borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:600,textDecoration:'none',flexShrink:0}}>
                    in
                  </a>
                )}
              </div>
            ) : isBasic ? (
              <div>
                <p style={{fontSize:14,fontWeight:600,margin:0}}>{company.contact_name}</p>
                {company.contact_title && <p style={{fontSize:13,color:'#666',margin:'2px 0 0'}}>{company.contact_title}</p>}
                {company.contact_phone && <p style={{fontSize:13,color:'#444',margin:'4px 0 0'}}>{company.contact_phone}</p>}
                <div style={{marginTop:8,background:'#f0f0f0',borderRadius:8,padding:'6px 10px',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:12}}>🔒</span>
                  <span style={{fontSize:12,color:'#999',flex:1}}>Photo et LinkedIn disponibles en Premium</span>
                  <button onClick={() => setActiveTab && setActiveTab('pricing')}
                    style={{background:'#E24B4A',color:'white',border:'none',borderRadius:8,padding:'4px 8px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                    Upgrader →
                  </button>
                </div>
              </div>
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:8,background:'#f5f5f5',borderRadius:10,padding:'10px 12px'}}>
                <span style={{fontSize:16}}>🔒</span>
                <p style={{fontSize:12,color:'#666',margin:0,flex:1}}>Disponible dès le plan <strong>Basic</strong></p>
                <button onClick={() => setActiveTab && setActiveTab('pricing')}
                  style={{background:'#E24B4A',color:'white',border:'none',borderRadius:8,padding:'6px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  Upgrader →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Infos */}
        <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
          <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:8}}>INFORMATIONS</p>
          {company.city && <InfoRow label="Ville" value={`${company.city}${company.canton ? `, ${company.canton}` : ''}`} />}
          {company.website && <InfoRow label="Site web" value={company.website} color="#185FA5" />}
        </div>

        {/* Bouton Contacter */}
        <button onClick={handleContact} disabled={contacting}
          style={{width:'100%',padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {contacting ? 'Connexion...' : `💬 Contacter ${company.name}`}
        </button>
        {isStarter && (
          <p style={{fontSize:11,color:'#999',textAlign:'center',marginTop:-8}}>
            🔒 La messagerie est disponible dès le plan Basic
          </p>
        )}

      </div>
    </div>
  )
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
      <span style={{fontSize:13,color:'#666'}}>{label}</span>
      <span style={{fontSize:13,color:color||'#444',fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{value}</span>
    </div>
  )
}