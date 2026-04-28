import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminScreen({ user, setScreen }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState([])
  const [stats, setStats] = useState({ total: 0, premium: 0, basic: 0, starter: 0, suspended: 0 })
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => { checkAdmin() }, [])

  const checkAdmin = async () => {
    const { data } = await supabase
      .from('admins').select('user_id').eq('user_id', user.id).single()
    if (data) {
      setIsAdmin(true)
      loadData()
    }
    setLoading(false)
  }

  const loadData = async () => {
    const { data: companiesData } = await supabase
      .from('companies')
      .select('*, subscriptions(plan, status, is_founder)')
      .order('created_at', { ascending: false })

    setCompanies(companiesData || [])

    const total = companiesData?.length || 0
    const premium = companiesData?.filter(c => c.subscriptions?.[0]?.plan === 'premium').length || 0
    const basic = companiesData?.filter(c => c.subscriptions?.[0]?.plan === 'basic').length || 0
    const suspended = companiesData?.filter(c => c.is_suspended).length || 0
    setStats({ total, premium, basic, starter: total - premium - basic, suspended })
  }

  const handleSuspend = async (company) => {
    setActionLoading(company.id)
    await supabase.from('companies')
      .update({ is_suspended: !company.is_suspended })
      .eq('id', company.id)
    await loadData()
    setActionLoading(null)
  }

  const handleDelete = async (company) => {
    if (!window.confirm(`Supprimer définitivement ${company.name} ? Cette action est irréversible.`)) return
    setActionLoading(company.id)
    await supabase.from('companies').delete().eq('id', company.id)
    await supabase.auth.admin?.deleteUser(company.user_id)
    await loadData()
    setActionLoading(null)
  }

  const getPlan = (company) => {
    const plan = company.subscriptions?.[0]?.plan
    return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Starter'
  }

  const getPlanColor = (company) => {
    const plan = getPlan(company)
    if (plan === 'Premium') return '#E24B4A'
    if (plan === 'Basic') return '#185FA5'
    return '#666'
  }

  const filtered = companies.filter(c => {
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.zefix_uid?.includes(search)
    const matchFilter =
      filter === 'all' ||
      (filter === 'premium' && getPlan(c) === 'Premium') ||
      (filter === 'basic' && getPlan(c) === 'Basic') ||
      (filter === 'starter' && getPlan(c) === 'Starter') ||
      (filter === 'suspended' && c.is_suspended)
    return matchSearch && matchFilter
  })

  const formatDate = (d) => new Date(d).toLocaleDateString('fr-CH')

  if (loading) return (
    <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'white'}}>
      <p style={{color:'#999'}}>Vérification des droits...</p>
    </div>
  )

  if (!isAdmin) return (
    <div style={{minHeight:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 2rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',textAlign:'center',gap:'1rem',background:'white'}}>
      <div style={{fontSize:48}}>🚫</div>
      <h2 style={{fontSize:22,fontWeight:700}}>Accès refusé</h2>
      <p style={{color:'#999',fontSize:14}}>Vous n'avez pas les droits d'accès à cette page.</p>
      <button onClick={() => setScreen('app')}
        style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
        Retour à l'app
      </button>
    </div>
  )

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:'#f5f5f5',overflow:'hidden'}}>

      {/* Header */}
      <div style={{background:'#1a1a1a',padding:'calc(env(safe-area-inset-top) + 0.75rem) 1.5rem 0.75rem',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontWeight:700,fontSize:12}}>LK</span>
          </div>
          <div>
            <p style={{color:'white',fontWeight:700,fontSize:15,margin:0}}>Hubbing Admin</p>
            <p style={{color:'#666',fontSize:11,margin:0}}>Tableau de bord</p>
          </div>
        </div>
        <button onClick={() => setScreen('app')}
          style={{background:'none',border:'1px solid #444',borderRadius:8,padding:'6px 12px',color:'#999',fontSize:12,cursor:'pointer'}}>
          ← App
        </button>
      </div>

      <div style={{padding:'1rem',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))',display:'flex',flexDirection:'column',gap:'1rem',maxWidth:430,margin:'0 auto',width:'100%',flex:1,minHeight:0,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          <StatCard label="Total inscrits" value={stats.total} color="#1a1a1a" />
          <StatCard label="Premium ⭐" value={stats.premium} color="#E24B4A" />
          <StatCard label="Basic" value={stats.basic} color="#185FA5" />
          <StatCard label="Suspendus" value={stats.suspended} color="#854F0B" />
        </div>

        {/* Barre fondateurs */}
        <div style={{background:'white',borderRadius:12,padding:'1rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <p style={{fontSize:13,fontWeight:600,margin:0}}>Places Fondateurs</p>
            <p style={{fontSize:13,color:'#E24B4A',fontWeight:600,margin:0}}>{stats.premium}/100</p>
          </div>
          <div style={{background:'#f0f0f0',borderRadius:8,height:8,overflow:'hidden'}}>
            <div style={{height:'100%',background:'#E24B4A',width:`${(stats.premium/100)*100}%`,borderRadius:8}} />
          </div>
        </div>

        {/* Recherche */}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher une entreprise, contact, IDE..."
          style={{padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:14,outline:'none',background:'white',fontFamily:'Plus Jakarta Sans'}} />

        {/* Filtres */}
        <div style={{display:'flex',gap:8,overflowX:'auto'}}>
          {[
            {id:'all',label:`Tous (${stats.total})`},
            {id:'premium',label:`Premium (${stats.premium})`},
            {id:'basic',label:`Basic (${stats.basic})`},
            {id:'starter',label:`Starter (${stats.starter})`},
            {id:'suspended',label:`Suspendus (${stats.suspended})`},
          ].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{padding:'6px 14px',borderRadius:20,border:'none',background: filter===f.id ? '#1a1a1a' : '#fff',color: filter===f.id ? 'white' : '#666',fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste entreprises */}
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.length === 0 ? (
            <div style={{background:'white',borderRadius:12,padding:'2rem',textAlign:'center'}}>
              <p style={{color:'#999',fontSize:14}}>Aucune entreprise trouvée</p>
            </div>
          ) : filtered.map(company => (
            <div key={company.id} style={{background:'white',borderRadius:12,padding:'1rem',border: company.is_suspended ? '2px solid #FECACA' : '1px solid #f0f0f0'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                    <p style={{fontWeight:700,fontSize:15,margin:0}}>{company.name}</p>
                    <span style={{fontSize:11,color:'white',background:getPlanColor(company),padding:'2px 8px',borderRadius:20,fontWeight:600}}>
                      {getPlan(company)}
                    </span>
                    {company.subscriptions?.[0]?.is_founder && (
                      <span style={{fontSize:11,color:'#854F0B',background:'#FEF3C7',padding:'2px 8px',borderRadius:20,fontWeight:600}}>
                        Fondateur ⭐
                      </span>
                    )}
                    {company.is_suspended && (
                      <span style={{fontSize:11,color:'#E24B4A',background:'#FFF5F5',padding:'2px 8px',borderRadius:20,fontWeight:600}}>
                        Suspendu
                      </span>
                    )}
                  </div>
                  {company.contact_name && (
                    <p style={{fontSize:13,color:'#666',margin:'4px 0 0'}}>{company.contact_name} — {company.contact_title}</p>
                  )}
                  <p style={{fontSize:12,color:'#999',margin:'2px 0 0'}}>
                    {company.zefix_uid} · {company.city}, {company.canton}
                  </p>
                  <p style={{fontSize:11,color:'#bbb',margin:'2px 0 0'}}>
                    Inscrit le {formatDate(company.created_at)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div style={{display:'flex',gap:8,marginTop:'0.75rem'}}>
                <button onClick={() => handleSuspend(company)}
                  disabled={actionLoading === company.id}
                  style={{flex:1,padding:'8px',borderRadius:8,border:`1px solid ${company.is_suspended ? '#22c55e' : '#F59E0B'}`,background:'white',color: company.is_suspended ? '#22c55e' : '#F59E0B',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  {actionLoading === company.id ? '...' : company.is_suspended ? '✓ Réactiver' : '⚠ Suspendre'}
                </button>
                <button onClick={() => handleDelete(company)}
                  disabled={actionLoading === company.id}
                  style={{flex:1,padding:'8px',borderRadius:8,border:'1px solid #E24B4A',background:'white',color:'#E24B4A',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  {actionLoading === company.id ? '...' : '🗑 Supprimer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{background:'white',borderRadius:12,padding:'1rem',textAlign:'center',boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
      <p style={{fontSize:28,fontWeight:700,color,margin:0}}>{value}</p>
      <p style={{fontSize:12,color:'#999',marginTop:4}}>{label}</p>
    </div>
  )
}
