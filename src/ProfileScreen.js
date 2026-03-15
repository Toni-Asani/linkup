import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

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

export default function ProfileScreen({ user }) {
  const [company, setCompany] = useState(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ matches: 0 })
  const [form, setForm] = useState({})
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (data) {
      setCompany(data)
      setForm(data)
      loadStats(data.id)
    }
    setLoading(false)
  }

  const loadStats = async (companyId) => {
    const { count } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .or(`company_a.eq.${companyId},company_b.eq.${companyId}`)
    setStats({ matches: count || 0 })
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('companies')
      .update({
        name: form.name,
        sector: form.sector,
        canton: form.canton,
        city: form.city,
        description: form.description,
        website: form.website,
      })
      .eq('user_id', user.id)
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
  const initials = company.name.substring(0, 2).toUpperCase()

  if (editing) return (
    <div style={{flex:1,overflowY:'auto',padding:'1.5rem',display:'flex',flexDirection:'column',gap:'1rem'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'0.5rem'}}>
        <h2 style={{fontSize:20,fontWeight:700}}>Modifier le profil</h2>
        <button onClick={() => setEditing(false)}
          style={{background:'none',border:'none',cursor:'pointer',color:'#999',fontSize:14}}>
          Annuler
        </button>
      </div>

      <div>
        <label style={{fontSize:12,color:'#999',fontWeight:600,display:'block',marginBottom:6}}>NOM DE L'ENTREPRISE</label>
        <input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})}
          style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans'}} />
      </div>

      <div>
        <label style={{fontSize:12,color:'#999',fontWeight:600,display:'block',marginBottom:6}}>SECTEUR</label>
        <select value={form.sector || ''} onChange={e => setForm({...form, sector: e.target.value})}
          style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans',background:'white'}}>
          <option value="">Choisir un secteur</option>
          {sectors.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{display:'flex',gap:12}}>
        <div style={{flex:1}}>
          <label style={{fontSize:12,color:'#999',fontWeight:600,display:'block',marginBottom:6}}>CANTON</label>
          <select value={form.canton || ''} onChange={e => setForm({...form, canton: e.target.value})}
            style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans',background:'white'}}>
            <option value="">Canton</option>
            {cantons.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{flex:2}}>
          <label style={{fontSize:12,color:'#999',fontWeight:600,display:'block',marginBottom:6}}>VILLE</label>
          <input value={form.city || ''} onChange={e => setForm({...form, city: e.target.value})}
            style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans'}} />
        </div>
      </div>

      <div>
        <label style={{fontSize:12,color:'#999',fontWeight:600,display:'block',marginBottom:6}}>DESCRIPTION</label>
        <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})}
          rows={4} placeholder="Décrivez votre entreprise, vos services..."
          style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans',resize:'vertical'}} />
      </div>

      <div>
        <label style={{fontSize:12,color:'#999',fontWeight:600,display:'block',marginBottom:6}}>SITE WEB</label>
        <input value={form.website || ''} onChange={e => setForm({...form, website: e.target.value})}
          placeholder="https://monentreprise.ch"
          style={{width:'100%',padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',fontFamily:'Plus Jakarta Sans'}} />
      </div>

      <button onClick={handleSave} disabled={saving}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer',marginTop:'0.5rem'}}>
        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
      </button>
    </div>
  )

  return (
    <div style={{flex:1,overflowY:'auto'}}>

      {/* Header profil */}
      <div style={{background: color, padding:'2rem 1.5rem 3rem',position:'relative'}}>
        <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
          <span style={{color:'white',fontWeight:700,fontSize:28}}>{initials}</span>
        </div>
        <h2 style={{color:'white',fontSize:20,fontWeight:700,textAlign:'center',marginTop:'0.75rem'}}>{company.name}</h2>
        {company.sector && (
          <p style={{color:'rgba(255,255,255,0.8)',fontSize:13,textAlign:'center',marginTop:4}}>{company.sector}</p>
        )}
        {company.city && company.canton && (
          <p style={{color:'rgba(255,255,255,0.7)',fontSize:13,textAlign:'center',marginTop:2}}>📍 {company.city}, {company.canton}</p>
        )}
      </div>

      {/* Stats */}
      <div style={{display:'flex',margin:'-1.25rem 1rem 0',gap:12,position:'relative',zIndex:1}}>
        <div style={{flex:1,background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#E24B4A'}}>{stats.matches}</p>
          <p style={{fontSize:12,color:'#999',marginTop:2}}>Matchs</p>
        </div>
        <div style={{flex:1,background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
          <p style={{fontSize:24,fontWeight:700,color:'#E24B4A'}}>0</p>
          <p style={{fontSize:12,color:'#999',marginTop:2}}>Messages</p>
        </div>
        <div style={{flex:1,background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
          <p style={{fontSize:14,fontWeight:700,color:'#3B6D11'}}>Starter</p>
          <p style={{fontSize:12,color:'#999',marginTop:2}}>Abonnement</p>
        </div>
      </div>

      {/* Infos */}
      <div style={{padding:'1.5rem 1rem',display:'flex',flexDirection:'column',gap:'0.75rem',marginTop:'0.5rem'}}>

        {success && (
          <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:10,padding:'0.75rem',textAlign:'center'}}>
            <p style={{color:'#166534',fontSize:14,fontWeight:600}}>✓ Profil mis à jour !</p>
          </div>
        )}

        {company.description && (
          <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem'}}>
            <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:6}}>À PROPOS</p>
            <p style={{fontSize:14,color:'#444',lineHeight:1.6}}>{company.description}</p>
          </div>
        )}

        <div style={{background:'#f9f9f9',borderRadius:12,padding:'1rem',display:'flex',flexDirection:'column',gap:8}}>
          <p style={{fontSize:12,color:'#999',fontWeight:600,marginBottom:2}}>INFORMATIONS</p>
          {company.zefix_uid && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:14,color:'#666'}}>Numéro IDE</span>
              <span style={{fontSize:14,color:'#444',fontWeight:500}}>{company.zefix_uid}</span>
            </div>
          )}
          {company.website && (
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:14,color:'#666'}}>Site web</span>
              <span style={{fontSize:14,color:'#185FA5'}}>{company.website}</span>
            </div>
          )}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:14,color:'#666'}}>Email</span>
            <span style={{fontSize:14,color:'#444'}}>{user.email}</span>
          </div>
        </div>

        {/* Offre fondateurs */}
        <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem',textAlign:'center'}}>
          <p style={{fontSize:13,color:'#E24B4A',fontWeight:600}}>🎉 Membre Fondateur</p>
          <p style={{fontSize:12,color:'#666',marginTop:4,lineHeight:1.5}}>Passez à Premium et bénéficiez de 2 mois offerts — offre exclusive fondateurs !</p>
          <button style={{marginTop:'0.75rem',padding:'10px 20px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}}>
            Passer à Premium
          </button>
        </div>

        <button onClick={() => setEditing(true)}
          style={{padding:'14px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
          Modifier mon profil
        </button>
      </div>
    </div>
  )
}