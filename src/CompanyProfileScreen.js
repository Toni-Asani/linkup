import { useState, useEffect } from 'react'
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

export default function CompanyProfileScreen({ companyId, plan, onBack, setActiveTab, setSelectedCompanyId, setDirectMessageCompanyId, setDirectMessageDraft, lang = 'fr' }) {
  const ui = getUiText(lang)
  const [company, setCompany] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [contacting, setContacting] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [avgRating, setAvgRating] = useState(null)
  const [reviewCount, setReviewCount] = useState(0)
  const [reportReason, setReportReason] = useState('')
  const [reportComment, setReportComment] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [zoomImage, setZoomImage] = useState(null)

  useEffect(() => { loadCompany() }, [companyId])

  const loadCompany = async () => {
    const { data } = await supabase
      .from('companies').select('*').eq('id', companyId).single()
    const companyWithSubscription = await attachCompanySubscriptions(supabase, data)
    setCompany(companyWithSubscription)
    setLoading(false)
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewed_company_id', companyId)
      .eq('status', 'approved')
    if (reviews && reviews.length > 0) {
      const avg = reviews.reduce((a, b) => a + b.rating, 0) / reviews.length
      setAvgRating(avg.toFixed(1))
      setReviewCount(reviews.length)
    }
  }

  const handleReport = async () => {
  if (!reportReason) return
  setSubmittingReport(true)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: myCompany } = await supabase
      .from('companies').select('id').eq('user_id', user.id).single()
    if (!myCompany) return
    await supabase.from('reports').insert({
      reporter_company_id: myCompany.id,
      reported_company_id: companyId,
      reason: reportReason,
      comment: reportComment,
    })
    setShowReportModal(false)
    setReportReason('')
    setReportComment('')
    alert(ui.companyProfile.reportSent)
  } catch (e) {
    console.error(e)
  }
  setSubmittingReport(false)
}
  const handleContact = async (needSubject = '') => {
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
      const cleanNeedSubject = String(needSubject || '').replace(/\s+/g, ' ').trim()
      if (cleanNeedSubject) {
        setDirectMessageDraft && setDirectMessageDraft({ subject: cleanNeedSubject.slice(0, 45) })
      }
      setDirectMessageCompanyId && setDirectMessageCompanyId(companyId)
      setSelectedCompanyId && setSelectedCompanyId(null)
      setActiveTab && setActiveTab('messages')
    } catch (e) {
      console.error(e)
    }
    setContacting(false)
  }

  if (loading) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',height:400}}>
      <p style={{color:'#999'}}>{ui.common.loading}</p>
    </div>
  )

  if (!company) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center'}}>
      <p style={{color:'#999'}}>{ui.common.companyNotFound}</p>
    </div>
  )

  const color = sectorColors[company.sector] || '#E24B4A'
  const initials = company.name?.substring(0, 2).toUpperCase()
  const isBasic = plan === 'Basic' || plan === 'Premium'
  const isPremium = plan === 'Premium'
  const companyIsPremium = isPremiumCompany(company)
  const isStarter = !isBasic
  const goToPricing = () => {
    setSelectedCompanyId && setSelectedCompanyId(null)
    setActiveTab && setActiveTab('pricing')
  }

  let parsedTags = []
  try { parsedTags = company.needs_tags ? JSON.parse(company.needs_tags) : [] } catch { parsedTags = [] }
  const activeTags = parsedTags.filter(t => {
    if (!t.expires) return true
    return new Date(t.expires) > new Date()
  })
  const hasNeeds = company.needs_description || activeTags.length > 0
  const fallbackNeedSubject = activeTags[0]?.label || company.needs_description || company.name

  return (
    <div style={{flex:1,overflowY:'auto'}}>

      {zoomImage && (
        <div onClick={() => setZoomImage(null)}
          style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:600,padding:'calc(env(safe-area-inset-top) + 1rem) 1rem calc(env(safe-area-inset-bottom) + 1rem)'}}>
          <button onClick={() => setZoomImage(null)} aria-label="Fermer"
            style={{position:'absolute',top:'calc(env(safe-area-inset-top) + 14px)',right:14,width:36,height:36,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.35)',background:'rgba(255,255,255,0.12)',color:'white',fontSize:20,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            x
          </button>
          <img src={zoomImage.src} alt={zoomImage.alt}
            onClick={e => e.stopPropagation()}
            style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:12,boxShadow:'0 18px 60px rgba(0,0,0,0.45)'}} />
        </div>
      )}

      {/* Modal upgrade Starter */}
      {showUpgradeModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:'1rem'}}>
          <div style={{background:'white',borderRadius:16,padding:'2rem',width:'100%',maxWidth:340,textAlign:'center'}}>
            <div style={{fontSize:40,marginBottom:'0.75rem'}}>🔒</div>
            <h3 style={{fontSize:18,fontWeight:700,marginBottom:8}}>{ui.companyProfile.featureBasic}</h3>
            <p style={{fontSize:14,color:'#666',lineHeight:1.6,marginBottom:'1.25rem'}}>
              {ui.companyProfile.upgradeDesc}
            </p>
            <button onClick={() => { setShowUpgradeModal(false); setSelectedCompanyId && setSelectedCompanyId(null); setActiveTab && setActiveTab('pricing') }}
              style={{width:'100%',padding:'13px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
              {ui.common.viewPlans}
            </button>
            <button onClick={() => setShowUpgradeModal(false)}
              style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
              {ui.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:color,padding:'1rem 1.5rem 3rem',position:'relative',textAlign:'center'}}>
        <button onClick={onBack}
          style={{position:'absolute',top:16,left:16,background:'rgba(255,255,255,0.2)',border:'none',borderRadius:20,padding:'6px 12px',color:'white',fontSize:13,cursor:'pointer',fontWeight:600}}>
          {ui.common.back}
        </button>
        <div style={{width:80,height:80,margin:'2rem auto 0',borderRadius:'50%',overflow:'hidden',border:'3px solid white'}}>
          {company.logo_url ? (
            <button onClick={() => setZoomImage({ src: company.logo_url, alt: company.name || 'Logo' })}
              aria-label="Agrandir le logo"
              style={{width:'100%',height:'100%',border:'none',padding:0,background:'transparent',cursor:'zoom-in',display:'block'}}>
              <img src={company.logo_url} alt="logo" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
            </button>
          ) : (
            <div style={{width:'100%',height:'100%',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <span style={{color:'white',fontWeight:700,fontSize:28}}>{initials}</span>
            </div>
          )}
        </div>
        <h2 style={{color:'white',fontSize:20,fontWeight:700,marginTop:'0.75rem',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          <span>{company.name}</span>
          {companyIsPremium && <VerifiedBadge size={22} />}
        </h2>
        {company.is_suspended && (
          <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:8,padding:'6px 12px',marginTop:8,display:'inline-block'}}>
            <span style={{fontSize:12,color:'#E24B4A',fontWeight:600}}>{ui.companyProfile.inactive}</span>
          </div>
        )}
        {company.sector && <p style={{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:2}}>{company.sector}</p>}
        {company.city && <p style={{color:'rgba(255,255,255,0.7)',fontSize:13,marginTop:2}}>📍 {company.city}{company.canton ? `, ${company.canton}` : ''}</p>}
        {avgRating && (
          <div style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            <span style={{color:'#F39C12',fontSize:16}}>{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5-Math.round(avgRating))}</span>
            <span style={{color:'rgba(255,255,255,0.9)',fontSize:13,fontWeight:600}}>{avgRating}/5</span>
            <span style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>{ui.companyProfile.reviews(reviewCount)}</span>
          </div>
        )}
      </div>

      <div style={{padding:'1.5rem 1rem',display:'flex',flexDirection:'column',gap:'0.75rem',marginTop:'-1rem'}}>

        {/* Description */}
        {company.description && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:6}}>{ui.companyProfile.about}</p>
            <p style={{fontSize:14,color:'#444',lineHeight:1.6}}>{company.description}</p>
          </div>
        )}

        {/* Besoins — visibles par tous, réponse limitée par le plan dans la messagerie */}
        {hasNeeds && (
          <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#E67E22',fontWeight:700,marginBottom:8}}>{ui.companyProfile.needs}</p>
            {company.needs_description && (
              <p onClick={() => handleContact(company.needs_description)}
                style={{fontSize:14,color:'#444',lineHeight:1.6,marginBottom: activeTags.length > 0 ? 10 : 0,cursor:'pointer'}}>
                {company.needs_description}
              </p>
            )}
            {activeTags.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
                {activeTags.map((tag, i) => (
                  <button key={i} onClick={() => handleContact(tag.label)}
                    style={{background:'white',border:'1px solid #22c55e',borderRadius:20,padding:'4px 10px',fontSize:12,fontWeight:500,color:'#333',cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
                    {tag.label}
                  </button>
                ))}
              </div>
            )}
            {isStarter && (
              <p style={{fontSize:11,color:'#777',margin:'0 0 8px',lineHeight:1.4}}>{ui.companyProfile.upgradeForNeeds}</p>
            )}
            <button onClick={() => handleContact(fallbackNeedSubject)}
              style={{width:'100%',padding:'10px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
              {ui.companyProfile.answerNeed}
            </button>
          </div>
        )}

        {/* Décisionnaire */}
        {company.contact_name && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:8}}>{ui.companyProfile.decisionMaker}</p>
            {isPremium ? (
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {company.contact_photo_url ? (
                  <button onClick={() => setZoomImage({ src: company.contact_photo_url, alt: company.contact_name || 'Contact' })}
                    aria-label="Agrandir la photo"
                    style={{width:52,height:52,borderRadius:'50%',border:'2px solid #eee',padding:0,overflow:'hidden',background:'transparent',cursor:'zoom-in',flexShrink:0}}>
                    <img src={company.contact_photo_url} alt="contact"
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                  </button>
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
              <LockedRow text={ui.companyProfile.fullContactPremium} button={ui.common.upgrade} onClick={goToPricing} />
            ) : (
              <LockedRow text={ui.companyProfile.fullContactPremium} button={ui.common.upgrade} onClick={goToPricing} />
            )}
          </div>
        )}

        {/* Infos */}
        <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
          <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:8}}>{ui.companyProfile.information}</p>
          {company.city && <InfoRow label={ui.companyProfile.city} value={`${company.city}${company.canton ? `, ${company.canton}` : ''}`} />}
          {company.address && (
            isBasic ? (
              <InfoRow label={ui.companyProfile.address} value={company.address} />
            ) : (
              <LockedRow text={ui.companyProfile.addressBasic} button={ui.common.upgrade} onClick={goToPricing} compact />
            )
          )}
          {company.website && (
            isPremium ? (
              <InfoRow label={ui.companyProfile.website} value={company.website} color="#185FA5" />
            ) : (
              <LockedRow text={ui.companyProfile.websitePremium} button={ui.common.upgrade} onClick={goToPricing} compact />
            )
          )}
        </div>

        {/* Bouton Contacter */}
        <button onClick={() => handleContact()} disabled={contacting}
          style={{width:'100%',padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {contacting ? ui.companyProfile.connecting : ui.companyProfile.contact(company.name)}
        </button>
        {isStarter && (
          <p style={{fontSize:11,color:'#999',textAlign:'center',marginTop:-8}}>
            {ui.companyProfile.basicMessaging}
          </p>
        )}

        {/* Bouton signaler */}
        <div style={{textAlign:'center'}}>
          <button onClick={() => setShowReportModal(true)}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#999',textDecoration:'underline'}}>
            {ui.companyProfile.reportProfile}
          </button>
        </div>

      </div>

      {/* Modal signalement */}
      {showReportModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:'1rem'}}>
          <div style={{background:'white',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:360}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
              <h3 style={{fontSize:17,fontWeight:700}}>{ui.companyProfile.reportTitle}</h3>
              <button onClick={() => setShowReportModal(false)}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#999'}}>✕</button>
            </div>
            <p style={{fontSize:13,color:'#666',marginBottom:12}}>{ui.companyProfile.reportReason}</p>
            {ui.companyProfile.reasons.map(r => (
              <div key={r.value} onClick={() => setReportReason(r.value)}
                style={{padding:'10px 12px',borderRadius:10,border:`2px solid ${reportReason === r.value ? '#E24B4A' : '#eee'}`,marginBottom:8,cursor:'pointer',background: reportReason === r.value ? '#FFF5F5' : 'white'}}>
                <p style={{fontSize:13,fontWeight: reportReason === r.value ? 600 : 400,color: reportReason === r.value ? '#E24B4A' : '#444',margin:0}}>{r.label}</p>
              </div>
            ))}
            <textarea
              value={reportComment}
              onChange={e => setReportComment(e.target.value)}
              placeholder={ui.companyProfile.reportDetails}
              rows={3}
              style={{width:'100%',padding:'10px',border:'1px solid #ddd',borderRadius:10,fontSize:13,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical',marginTop:4,marginBottom:12}}
            />
            <p style={{fontSize:11,color:'#999',marginBottom:12}}>
              {ui.companyProfile.reportNote}
            </p>
            <button onClick={handleReport} disabled={!reportReason || submittingReport}
              style={{width:'100%',padding:'13px',background: reportReason ? '#E24B4A' : '#eee',color: reportReason ? 'white' : '#999',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor: reportReason ? 'pointer' : 'default'}}>
              {submittingReport ? ui.common.sending : ui.companyProfile.sendReport}
            </button>
          </div>
        </div>
      )}
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

function LockedRow({ text, button, onClick, compact = false }) {
  return (
    <div style={{marginTop:compact ? 6 : 0,background:'#f0f0f0',borderRadius:8,padding:compact ? '7px 10px' : '10px 12px',display:'flex',alignItems:'center',gap:8}}>
      <span style={{fontSize:14}}>🔒</span>
      <p style={{fontSize:12,color:'#666',margin:0,flex:1,lineHeight:1.35}}>{text}</p>
      <button onClick={onClick}
        style={{background:'#E24B4A',color:'white',border:'none',borderRadius:8,padding:compact ? '4px 8px' : '6px 10px',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
        {button}
      </button>
    </div>
  )
}
