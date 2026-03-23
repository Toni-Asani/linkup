import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'

const sectorColors = {
  'Fiduciaire': '#3B6D11', 'Design & Communication': '#533AB7',
  'Informatique': '#185FA5', 'Construction': '#854F0B',
  'Marketing Digital': '#993556', 'Ressources Humaines': '#0F6E56',
  'Transport & Logistique': '#444441', 'Services': '#993C1D',
}

const sectors = [
  'Fiduciaire', 'Design & Communication', 'Informatique', 'Construction',
  'Marketing Digital', 'Ressources Humaines', 'Transport & Logistique',
  'Services', 'Juridique', 'Immobilier', 'Finance', 'Santé', 'Autre'
]

const cantons = [
  'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR',
  'JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG',
  'TI','UR','VD','VS','ZG','ZH'
]

export default function ProfileScreen({ user, setActiveTab }) {
  const [company, setCompany] = useState(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [stats, setStats] = useState({ matches: 0 })
  const [form, setForm] = useState({})
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    const { data } = await supabase
      .from('companies').select('*').eq('user_id', user.id).single()
    if (data) {
      setCompany(data)
      setForm(data)
      loadStats(data.id)
    }
    setLoading(false)
  }

  const loadStats = async (companyId) => {
    const { count } = await supabase
      .from('matches').select('*', { count: 'exact', head: true })
      .or(`company_a.eq.${companyId},company_b.eq.${companyId}`)
    setStats({ matches: count || 0 })
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${user.id}-logo.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('logos').upload(fileName, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
      await supabase.from('companies').update({ logo_url: urlData.publicUrl }).eq('user_id', user.id)
      setCompany({ ...company, logo_url: urlData.publicUrl })
      setForm({ ...form, logo_url: urlData.publicUrl })
    } catch (e) {
      alert('Erreur lors du téléchargement. Vérifiez que le bucket "logos" existe dans Supabase Storage.')
    }
    setUploadingLogo(false)
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
      contact_name: form.contact_name,
      contact_title: form.contact_title,
      contact_phone: form.contact_phone,
      address: form.address,
    }).eq('user_id', user.id)
    if (!error) {
      setCompany({ ...company, ...form })
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

      <button onClick={handleSave} disabled={saving}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer',marginTop:'0.5rem'}}>
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  )

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
        {company.city && <p style={{color:'rgba(255,255,255,0.7)',fontSize:13,marginTop:2}}>📍 {company.city}, {company.canton}</p>}
      </div>

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

        {/* Décideur */}
        {company.contact_name && (
          <InfoCard title="DÉCIDEUR / CONTACT PRINCIPAL">
            <InfoRow label="Nom" value={company.contact_name} />
            {company.contact_title && <InfoRow label="Titre" value={company.contact_title} />}
            {company.contact_phone && <InfoRow label="Téléphone" value={company.contact_phone} />}
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