import { useState, useEffect, useRef } from 'react'
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

const sectors = Object.keys(sectorColors)

const cantons = [
  'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR',
  'JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG',
  'TI','UR','VD','VS','ZG','ZH'
]

export default function ProfileScreen({ user, setActiveTab }) {
  const [uploadingContact, setUploadingContact] = useState(false)
  const [company, setCompany] = useState(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [stats, setStats] = useState({ matches: 0 })
  const [form, setForm] = useState({})
  const [success, setSuccess] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [tags, setTags] = useState([])
  const fileInputRef = useRef(null)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data } = await supabase
      .from('companies').select('*').eq('user_id', user.id).single()
    if (data) {
      setCompany(data)
      setForm(data)
      loadStats(data.id)
      try {
        setTags(data.needs_tags ? JSON.parse(data.needs_tags) : [])
      } catch { setTags([]) }
    }
    setLoading(false)
  }

  const loadStats = async (companyId) => {
    const { count } = await supabase
      .from('matches').select('*', { count: 'exact', head: true })
      .or(`company_a.eq.${companyId},company_b.eq.${companyId}`)
    setStats({ matches: count || 0 })
  }

  const handleContactPhotoUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  setUploadingContact(true)
  try {
    const ext = file.name.split('.').pop()
    const fileName = `${user.id}-contact.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('logos').upload(fileName, file, { upsert: true })
    if (uploadError) throw uploadError
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
    setForm({ ...form, contact_photo_url: urlData.publicUrl })
  } catch (e) {
    alert('Erreur lors du téléchargement.')
  }
  setUploadingContact(false)
}

  const addTag = () => {
    if (!newTag.trim() || tags.includes(newTag.trim())) return
    setTags([...tags, newTag.trim()])
    setNewTag('')
  }

  const removeTag = (tag) => {
    setTags(tags.filter(t => t !== tag))
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('companies').update({
      name: form.name,
      sector: form.sector,
      canton: form.canton,
      city: form.city,
      description: form.description,
      website: form.website,
      contact_linkedin: form.contact_linkedin,
      contact_photo_url: form.contact_photo_url,
      contact_name: form.contact_name,
      contact_title: form.contact_title,
      contact_phone: form.contact_phone,
      address: form.address,
      needs_description: form.needs_description,
      needs_tags: JSON.stringify(tags),
    }).eq('user_id', user.id)
    if (!error) {
      setCompany({ ...company, ...form, needs_tags: JSON.stringify(tags) })
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
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

  const getTagStatus = (expires) => {
    if (!expires) return 'active'
    const diff = new Date(expires) - new Date()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return 'expired'
    if (days <= 7) return 'soon'
    return 'active'
  }

  const getTagColor = (expires) => {
    const status = getTagStatus(expires)
    if (status === 'expired') return '#E24B4A'
    if (status === 'soon') return '#F39C12'
    return '#22c55e'
  }

  const getTagLabel = (expires) => {
    if (!expires) return ''
    const diff = new Date(expires) - new Date()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return '⚠️ Expiré'
    if (days === 0) return "⏰ Expire aujourd'hui"
    if (days <= 7) return `⏰ ${days}j restants`
    return `✓ jusqu'au ${new Date(expires).toLocaleDateString('fr-CH')}`
  }

  if (editing) return (
    <div style={{flex:1,overflowY:'auto',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <h2 style={{fontSize:20,fontWeight:700}}>Modifier le profil</h2>
        <button onClick={() => setEditing(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:14}}>Annuler</button>
      </div>

      <Label>ENTREPRISE</Label>
      <Input value={form.name||''} onChange={e => setForm({...form,name:e.target.value})} placeholder="Nom de l'entreprise *" />
      <select value={form.sector||''} onChange={e => setForm({...form,sector:e.target.value})}
        style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',background:'white',fontFamily:'Plus Jakarta Sans'}}>
        <option value="">Secteur d'activité</option>
        {sectors.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <div style={{display:'flex',gap:12}}>
        <select value={form.canton||''} onChange={e => setForm({...form,canton:e.target.value})}
          style={{flex:1,padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',background:'white',fontFamily:'Plus Jakarta Sans'}}>
          <option value="">Canton</option>
          {cantons.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Input style={{flex:2}} value={form.city||''} onChange={e => setForm({...form,city:e.target.value})} placeholder="Ville" />
      </div>
      <Input value={form.address||''} onChange={e => setForm({...form,address:e.target.value})} placeholder="Adresse complète *" />
      <textarea value={form.description||''} onChange={e => setForm({...form,description:e.target.value})}
        rows={3} placeholder="Description de l'entreprise..."
        style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical'}} />
      <Input value={form.website||''} onChange={e => setForm({...form,website:e.target.value})} placeholder="Site web (https://...)" />

      <Label>DÉCIDEUR / CONTACT PRINCIPAL</Label>
<Input value={form.contact_name||''} onChange={e => setForm({...form,contact_name:e.target.value})} placeholder="Nom et prénom *" />
<Input value={form.contact_title||''} onChange={e => setForm({...form,contact_title:e.target.value})} placeholder="Titre (CEO, Directeur, Gérant...)" />
<Input value={form.contact_phone||''} onChange={e => setForm({...form,contact_phone:e.target.value})} placeholder="Téléphone direct" />
<Input value={form.contact_linkedin||''} onChange={e => setForm({...form,contact_linkedin:e.target.value})} placeholder="LinkedIn (https://linkedin.com/in/...)" />

{/* Photo décisionnaire */}
<p style={{fontSize:12,color:'#666'}}>Photo du décisionnaire :</p>
<div style={{display:'flex',alignItems:'center',gap:12}}>
  {form.contact_photo_url ? (
    <img src={form.contact_photo_url} alt="contact"
      style={{width:56,height:56,borderRadius:'50%',objectFit:'cover',border:'2px solid #ddd'}} />
  ) : (
    <div style={{width:56,height:56,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <span style={{fontSize:24}}>👤</span>
    </div>
  )}
  <label style={{padding:'10px 16px',background:'#f0f0f0',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
    {uploadingContact ? 'Upload...' : 'Choisir une photo'}
    <input type="file" accept="image/*" style={{display:'none'}} onChange={handleContactPhotoUpload} />
  </label>
</div>
      <Label>NOS BESOINS</Label>
      <textarea value={form.needs_description||''} onChange={e => setForm({...form,needs_description:e.target.value})}
        rows={3} placeholder="Décrivez vos besoins en détail... (ex: Cherche ingénieur civil freelance pour chantiers résidentiels à Lausanne)"
        style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:14,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical'}} />

      <p style={{fontSize:12,color:'#666'}}>Ajoutez des besoins spécifiques avec une date d'échéance :</p>

      {/* Tags existants */}
      {tags.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {tags.map((tag, i) => (
            <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'#f9f9f9',borderRadius:10,padding:'8px 12px'}}>
              <div>
                <span style={{fontSize:14,fontWeight:500}}>{tag.label}</span>
                {tag.expires && (
                  <span style={{fontSize:11,color:getTagColor(tag.expires),marginLeft:8}}>
                    {getTagLabel(tag.expires)}
                  </span>
                )}
              </div>
              <button onClick={() => removeTag(tag)}
                style={{background:'none',border:'none',cursor:'pointer',color:'#E24B4A',fontSize:16}}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Ajouter un tag */}
      <div style={{display:'flex',flexDirection:'column',gap:8,background:'#f9f9f9',borderRadius:10,padding:'12px'}}>
        <Input value={newTag} onChange={e => setNewTag(e.target.value)}
          placeholder="Ex: Ingénieur civil, Électricien, Comptable..." />
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <input type="date" value={form.newTagExpiry||''} onChange={e => setForm({...form,newTagExpiry:e.target.value})}
            style={{flex:1,padding:'10px',border:'1px solid #ddd',borderRadius:10,fontSize:14,outline:'none',fontFamily:'Plus Jakarta Sans'}} />
          <button onClick={() => {
            if (!newTag.trim()) return
            setTags([...tags, { label: newTag.trim(), expires: form.newTagExpiry || null }])
            setNewTag('')
            setForm({...form, newTagExpiry: ''})
          }}
            style={{padding:'10px 16px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:14,fontWeight:600,cursor:'pointer'}}>
            + Ajouter
          </button>
        </div>
        <p style={{fontSize:11,color:'#999'}}>La date d'échéance est optionnelle</p>
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer',marginTop:'0.5rem'}}>
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  )

  // Récupérer les tags parsés
  let parsedTags = []
  try { parsedTags = company.needs_tags ? JSON.parse(company.needs_tags) : [] } catch { parsedTags = [] }
  const activeTags = parsedTags.filter(t => getTagStatus(t.expires) !== 'expired')

  return (
    <div style={{flex:1,overflowY:'auto'}}>

      {/* Header */}
      <div style={{background:color,padding:'2rem 1.5rem 3rem',position:'relative',textAlign:'center'}}>
        <div style={{position:'relative',width:88,height:88,margin:'0 auto',cursor:'pointer'}}
          onClick={() => fileInputRef.current?.click()}>
          {company.logo_url ? (
            <img src={company.logo_url} alt="logo"
              style={{width:88,height:88,borderRadius:'50%',objectFit:'cover',border:'3px solid white'}} />
          ) : (
            <div style={{width:88,height:88,borderRadius:'50%',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center',border:'3px solid rgba(255,255,255,0.5)'}}>
              <span style={{color:'white',fontWeight:700,fontSize:28}}>{initials}</span>
            </div>
          )}
          <div style={{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:'50%',background:'white',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'}}>
            <span style={{fontSize:14}}>📷</span>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{display:'none'}} />
        {uploadingLogo && <p style={{color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:4}}>Téléchargement...</p>}
        <h2 style={{color:'white',fontSize:20,fontWeight:700,marginTop:'0.75rem'}}>{company.name}</h2>
        {company.sector && <p style={{color:'rgba(255,255,255,0.8)',fontSize:13,marginTop:2}}>{company.sector}</p>}
        {company.city && <p style={{color:'rgba(255,255,255,0.7)',fontSize:13,marginTop:2}}>📍 {company.city}{company.canton ? `, ${company.canton}` : ''}</p>}      </div>

      {/* Stats */}
      <div style={{display:'flex',margin:'-1.25rem 1rem 0',gap:12,position:'relative',zIndex:1}}>
        <StatCard value={stats.matches} label="Matchs" color="#E24B4A" />
        <StatCard value="0" label="Messages" color="#E24B4A" />
        <div style={{flex:1,background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',cursor:'pointer'}}
          onClick={() => setActiveTab && setActiveTab('pricing')}>
          <p style={{fontSize:13,fontWeight:700,color:'#3B6D11',margin:0}}>Starter</p>
          <p style={{fontSize:11,color:'#999',marginTop:3}}>Mon plan →</p>
        </div>
      </div>

      <div style={{padding:'1.5rem 1rem',display:'flex',flexDirection:'column',gap:'0.75rem',marginTop:'0.5rem'}}>

        {success && (
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'0.75rem',textAlign:'center'}}>
            <p style={{color:'#166534',fontSize:14,fontWeight:600}}>✓ Profil mis à jour !</p>
          </div>
        )}

        {/* Nos besoins */}
        {(company.needs_description || activeTags.length > 0) && (
          <div style={{background:'#FFF9F0',border:'1px solid #FDE8C0',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#E67E22',fontWeight:700,marginBottom:8}}>💼 NOS BESOINS</p>
            {company.needs_description && (
              <p style={{fontSize:14,color:'#444',lineHeight:1.6,marginBottom: activeTags.length > 0 ? 10 : 0}}>
                {company.needs_description}
              </p>
            )}
            {activeTags.length > 0 && (
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {activeTags.map((tag, i) => (
                  <div key={i} style={{background:'white',border:`1px solid ${getTagColor(tag.expires)}`,borderRadius:20,padding:'4px 10px',display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:getTagColor(tag.expires)}}></div>
                    <span style={{fontSize:12,fontWeight:500,color:'#333'}}>{tag.label}</span>
                    {tag.expires && <span style={{fontSize:10,color:getTagColor(tag.expires)}}>{getTagLabel(tag.expires)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Décideur */}
        {company.contact_name && (
  <InfoCard title="DÉCIDEUR / CONTACT PRINCIPAL">
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:8}}>
      {company.contact_photo_url ? (
        <img src={company.contact_photo_url} alt="contact"
          style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',border:'2px solid #eee'}} />
      ) : (
        <div style={{width:52,height:52,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:22}}>👤</span>
        </div>
      )}
      <div>
        <p style={{fontSize:15,fontWeight:700,margin:0}}>{company.contact_name}</p>
        {company.contact_title && <p style={{fontSize:13,color:'#666',margin:0}}>{company.contact_title}</p>}
      </div>
    </div>
    {company.contact_phone && <InfoRow label="Téléphone" value={company.contact_phone} />}
    {company.contact_linkedin && (
      <InfoRow label="LinkedIn" value="Voir le profil →" color="#0A66C2" />
    )}
  </InfoCard>
)}

        {/* Description */}
        {company.description && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:6}}>À PROPOS</p>
            <p style={{fontSize:14,color:'#444',lineHeight:1.6}}>{company.description}</p>
          </div>
        )}

        {/* Infos entreprise */}
        <InfoCard title="INFORMATIONS ENTREPRISE">
          {company.zefix_uid && <InfoRow label="Numéro IDE" value={company.zefix_uid} />}
          {company.address && <InfoRow label="Adresse" value={company.address} />}
          {company.website && <InfoRow label="Site web" value={company.website} color="#185FA5" />}
          <InfoRow label="Email" value={user.email} />
        </InfoCard>

        {/* Offre fondateurs */}
        <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem',textAlign:'center'}}>
          <p style={{fontSize:13,color:'#E24B4A',fontWeight:600}}>🎉 Offre Fondateurs</p>
          <p style={{fontSize:12,color:'#666',marginTop:4,lineHeight:1.5}}>2 mois Premium offerts pour les 100 premiers membres !</p>
          <button onClick={() => setActiveTab && setActiveTab('pricing')}
            style={{marginTop:'0.75rem',padding:'10px 20px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
            Voir les plans
          </button>
        </div>

        <button onClick={() => setEditing(true)}
          style={{padding:'14px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
          Modifier mon profil
        </button>
        <button onClick={() => window.location.href = window.location.pathname + '?admin=true'}
          style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#eee',textAlign:'center',padding:'4px',width:'100%'}}>
          ···
        </button>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{children}</p>
}

function Input({ value, onChange, placeholder, style }) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans',width:'100%',...style}} />
  )
}

function StatCard({ value, label, color }) {
  return (
    <div style={{flex:1,background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
      <p style={{fontSize:24,fontWeight:700,color,margin:0}}>{value}</p>
      <p style={{fontSize:11,color:'#999',marginTop:3}}>{label}</p>
    </div>
  )
}

function InfoCard({ title, children }) {
  return (
    <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
      <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:8}}>{title}</p>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:13,color:'#666'}}>{label}</span>
      <span style={{fontSize:13,color:color||'#444',fontWeight:500,textAlign:'right',maxWidth:'60%'}}>{value}</span>
    </div>
  )
}