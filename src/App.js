import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SwipeScreen from './SwipeScreen'
import MapScreen from './MapScreen'
import ProfileScreen from './ProfileScreen'
import MessagesScreen from './MessagesScreen'
import HomeScreen from './HomeScreen'
import PricingScreen from './PricingScreen'
import LegalScreen from './LegalScreen'
import AdminScreen from './AdminScreen'

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f5; }
  .app { max-width: 430px; margin: 0 auto; min-height: 100vh; background: white; position: relative; }
`

export default function App() {
  const [screen, setScreen] = useState('home')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      const params = new URLSearchParams(window.location.search)
if (params.get('admin') === 'true') {
  setScreen('admin')
}
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Plus Jakarta Sans'}}>Chargement...</div>

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {user ? (
          <Dashboard user={user} setUser={setUser} />
        ) : screen === 'home' ? (
          <LandingScreen setScreen={setScreen} />
        ) : screen === 'login' ? (
          <LoginScreen setScreen={setScreen} />
        ) : screen === 'register' ? (
          <RegisterScreen setScreen={setScreen} />
        ) : screen === 'visitor' ? (
          <VisitorMode setScreen={setScreen} />
        ) : screen === 'legal' ? (
          <LegalScreen setScreen={setScreen} />
        ) : screen === 'admin' ? (
          <AdminScreen user={user} setScreen={setScreen} />
        ): null}
      </div>
    </>
  )
}

function PlanBadge({ user }) {
  const [plan, setPlan] = useState('Starter')
  useEffect(() => {
    supabase.from('subscriptions')
      .select('plan').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) setPlan(data.plan.charAt(0).toUpperCase() + data.plan.slice(1))
      })
  }, [user])
  const colors = { Starter: '#666', Basic: '#185FA5', Premium: '#E24B4A' }
  return (
    <span style={{color: colors[plan] || '#666', fontSize:12, fontWeight:600}}>
      {plan === 'Premium' ? '⭐' : plan === 'Basic' ? '✦' : ''} {plan} →
    </span>
  )
}

function LandingScreen({ setScreen }) {
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.2rem'}}>
      <div style={{width:72,height:72,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{color:'white',fontWeight:700,fontSize:24}}>LK</span>
      </div>
      <h1 style={{fontSize:28,fontWeight:700,color:'#1a1a1a',textAlign:'center'}}>Hubbing</h1>
      <p style={{color:'#666',textAlign:'center',fontSize:15,lineHeight:1.6}}>Le réseau B2B pour les entreprises suisses</p>
      <div style={{width:'100%',background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem',textAlign:'center'}}>
        <p style={{fontSize:13,color:'#E24B4A',fontWeight:600}}>🎉 Offre Fondateurs</p>
        <p style={{fontSize:12,color:'#666',marginTop:4}}>2 mois offerts pour les 100 premiers abonnés Premium</p>
      </div>
      <button onClick={() => setScreen('register')}
        style={{width:'100%',padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        Créer un compte
      </button>
      <button onClick={() => setScreen('login')}
        style={{width:'100%',padding:'14px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        Se connecter
      </button>
      <button onClick={() => setScreen('visitor')}
        style={{width:'100%',padding:'12px',background:'none',color:'#999',border:'none',fontSize:14,cursor:'pointer',textDecoration:'underline'}}>
        Continuer en mode visiteur
      </button>
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline'}}>
        CGU · Confidentialité · Mentions légales
      </button>
    </div>
  )
}

function VisitorMode({ setScreen }) {
  const [activeTab, setActiveTab] = useState('swipe')
  const [showModal, setShowModal] = useState(false)
  const [companies, setCompanies] = useState([])
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    supabase.from('companies').select('*').limit(10).then(({ data }) => setCompanies(data || []))
  }, [])

  const tabStyle = (tab) => ({
    flex:1, padding:'12px 0', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#999',
    fontWeight: activeTab === tab ? 600 : 400,
    borderTop: activeTab === tab ? '2px solid #E24B4A' : '2px solid transparent',
    fontFamily:'Plus Jakarta Sans'
  })

  const sectorColors = {
    'Fiduciaire': '#3B6D11', 'Design & Communication': '#533AB7',
    'Informatique': '#185FA5', 'Construction': '#854F0B',
    'Marketing Digital': '#993556', 'Ressources Humaines': '#0F6E56',
    'Transport & Logistique': '#444441', 'Services': '#993C1D',
  }

  const Modal = () => (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'1rem'}}>
      <div style={{background:'white',borderRadius:16,padding:'2rem',width:'100%',maxWidth:340,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:'0.75rem'}}>🔒</div>
        <h3 style={{fontSize:18,fontWeight:700,marginBottom:8}}>Créez un compte gratuit</h3>
        <p style={{fontSize:14,color:'#666',lineHeight:1.6,marginBottom:'1.25rem'}}>
          Rejoignez Hubbing pour accéder à toutes les fonctionnalités B2B.
        </p>
        <button onClick={() => setScreen('register')}
          style={{width:'100%',padding:'13px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
          Créer un compte gratuit
        </button>
        <button onClick={() => setScreen('login')}
          style={{width:'100%',padding:'13px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
          Se connecter
        </button>
        <button onClick={() => setShowModal(false)}
          style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
          Continuer en mode démo
        </button>
      </div>
    </div>
  )

  const company = companies[current]

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      {showModal && <Modal />}

      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontWeight:700,fontSize:12}}>LK</span>
          </div>
          <span style={{fontWeight:700,fontSize:16}}>Hubbing</span>
        </div>
        <span style={{fontSize:12,color:'#999',background:'#f5f5f5',padding:'4px 10px',borderRadius:20}}>Mode démo</span>
      </div>

      <div style={{flex:1,overflow:'hidden'}}>

        {/* SWIPE DEMO */}
        {activeTab === 'swipe' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'1.5rem 1rem',gap:'1rem'}}>
            <p style={{fontSize:13,color:'#999',background:'#f5f5f5',padding:'6px 14px',borderRadius:20}}>
              👀 Mode démo — connectez-vous pour matcher
            </p>
            {company ? (
              <div style={{width:'100%',maxWidth:360,background:'white',borderRadius:20,border:'1px solid #eee',boxShadow:'0 8px 30px rgba(0,0,0,0.08)',overflow:'hidden'}}>
                <div style={{height:140,background:sectorColors[company.sector]||'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <div style={{width:72,height:72,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{color:'white',fontWeight:700,fontSize:24}}>{company.name?.substring(0,2).toUpperCase()}</span>
                  </div>
                </div>
                <div style={{padding:'1.25rem'}}>
                  <h3 style={{fontSize:20,fontWeight:700,marginBottom:4}}>{company.name}</h3>
                  <div style={{display:'flex',gap:8,marginBottom:'0.75rem',flexWrap:'wrap'}}>
                    <span style={{background:'#f5f5f5',color:'#666',padding:'3px 10px',borderRadius:20,fontSize:12}}>{company.sector}</span>
                    <span style={{background:'#f5f5f5',color:'#666',padding:'3px 10px',borderRadius:20,fontSize:12}}>📍 {company.city}, {company.canton}</span>
                  </div>
                  <p style={{color:'#666',fontSize:14,lineHeight:1.6}}>{company.description}</p>
                </div>
              </div>
            ) : (
              <p style={{color:'#999'}}>Chargement...</p>
            )}
            <div style={{display:'flex',gap:'2rem',alignItems:'center'}}>
              <button onClick={() => setShowModal(true)}
                style={{width:60,height:60,borderRadius:'50%',background:'white',border:'2px solid #E24B4A',color:'#E24B4A',fontSize:24,cursor:'pointer'}}>
                ✗
              </button>
              <button onClick={() => setShowModal(true)}
                style={{width:70,height:70,borderRadius:'50%',background:'#E24B4A',border:'none',color:'white',fontSize:26,cursor:'pointer',boxShadow:'0 4px 16px rgba(226,75,74,0.4)'}}>
                ✓
              </button>
            </div>
          </div>
        )}

        {/* MAP DEMO */}
        {activeTab === 'map' && (
          <div style={{flex:1,display:'flex',flexDirection:'column'}}>
            <div style={{padding:'0.75rem 1rem',background:'#FFF5F5',textAlign:'center'}}>
              <p style={{fontSize:12,color:'#E24B4A',fontWeight:600}}>👀 Mode démo — connectez-vous pour voir toutes les entreprises</p>
            </div>
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'1rem',padding:'2rem',textAlign:'center'}}>
              <div style={{fontSize:48}}>🗺️</div>
              <h3 style={{fontSize:18,fontWeight:700}}>Carte des entreprises</h3>
              <p style={{color:'#999',fontSize:14}}>{companies.length} entreprises enregistrées en Suisse</p>
              <button onClick={() => setShowModal(true)}
                style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
                Voir la carte complète
              </button>
            </div>
          </div>
        )}

        {/* MESSAGES DEMO */}
        {activeTab === 'messages' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
            <div style={{fontSize:48}}>💬</div>
            <h3 style={{fontSize:18,fontWeight:700}}>Messagerie B2B</h3>
            <p style={{color:'#999',fontSize:14,lineHeight:1.6}}>Échangez directement avec vos connexions business</p>
            <button onClick={() => setShowModal(true)}
              style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
              Accéder à la messagerie
            </button>
          </div>
        )}

        {/* PRICING DEMO */}
        {activeTab === 'pricing' && (
          <div style={{flex:1,overflowY:'auto',padding:'1.5rem 1rem'}}>
            <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
              <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>Nos tarifs</h2>
              <p style={{fontSize:13,color:'#666'}}>Développez votre réseau B2B en Suisse</p>
            </div>
            {[
              {name:'Starter',price:'Gratuit',color:'#666',features:['Profil entreprise','5 swipes/jour','Visible sur la carte']},
              {name:'Basic',price:'CHF 19/mois',color:'#185FA5',features:['Swipes illimités','Messagerie B2B','Statistiques']},
              {name:'Premium',price:'CHF 39/mois',color:'#E24B4A',features:['Tout Basic inclus','Badge Fondateur ⭐','Visibilité prioritaire','2 mois offerts'],highlight:true},
            ].map(plan => (
              <div key={plan.name} onClick={() => setShowModal(true)}
                style={{border: plan.highlight ? `2px solid ${plan.color}` : '1px solid #eee',borderRadius:12,padding:'1rem',marginBottom:'0.75rem',cursor:'pointer',background:'white'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <h3 style={{fontSize:16,fontWeight:700,color:plan.color,margin:0}}>{plan.name}</h3>
                  <span style={{fontSize:14,fontWeight:600,color:'#1a1a1a'}}>{plan.price}</span>
                </div>
                {plan.features.map((f,i) => (
                  <p key={i} style={{fontSize:12,color:'#666',margin:'3px 0'}}>✓ {f}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{borderTop:'1px solid #f0f0f0',display:'flex',background:'white'}}>
        {[
          {id:'swipe',label:'Swipe',icon:'💼'},
          {id:'map',label:'Carte',icon:'🗺️'},
          {id:'messages',label:'Messages',icon:'💬'},
          {id:'pricing',label:'Tarifs',icon:'💳'},
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(tab.id)}>
            <div style={{fontSize:20,marginBottom:2}}>{tab.icon}</div>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function LoginScreen({ setScreen }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',padding:'2rem',gap:'1rem'}}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,marginBottom:'1rem'}}>← Retour</button>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:'0.5rem'}}>Se connecter</h2>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email professionnel" type="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" type="password"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      {error && <p style={{color:'#E24B4A',fontSize:13}}>{error}</p>}
      <button onClick={handleLogin} disabled={loading}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
      <p style={{textAlign:'center',fontSize:14,color:'#666'}}>
        Pas de compte ? <span onClick={() => setScreen('register')} style={{color:'#E24B4A',cursor:'pointer',fontWeight:600}}>S'inscrire</span>
      </p>
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline',marginTop:'auto'}}>
        CGU · Confidentialité · Mentions légales
      </button>
    </div>
  )
}

function RegisterScreen({ setScreen }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [zefix, setZefix] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [address, setAddress] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    setError('')
    if (!email || !password || !company || !zefix || !contactName || !contactTitle || !address) {
      setError('Veuillez remplir tous les champs obligatoires')
      setLoading(false)
      return
    }
    if (!accepted) {
      setError('Veuillez accepter les CGU pour continuer')
      setLoading(false)
      return
    }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('companies').insert({
        user_id: data.user.id,
        name: company,
        zefix_uid: zefix,
        contact_name: contactName,
        contact_title: contactTitle,
        address: address
      })
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1rem',textAlign:'center'}}>
      <div style={{fontSize:48}}>🎉</div>
      <h2 style={{fontSize:22,fontWeight:700}}>Compte créé !</h2>
      <p style={{color:'#666',fontSize:15}}>Bienvenue parmi les membres fondateurs de Hubbing !</p>
      <button onClick={() => setScreen('login')}
        style={{padding:'14px 32px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
        Se connecter
      </button>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',padding:'2rem',gap:'1rem',overflowY:'auto'}}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14}}>← Retour</button>
      <h2 style={{fontSize:24,fontWeight:700}}>Créer un compte</h2>
      <p style={{color:'#666',fontSize:13}}>Réservé aux entreprises enregistrées en Suisse</p>

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.5rem'}}>INFORMATIONS ENTREPRISE</p>
      <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Nom de l'entreprise *"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={zefix} onChange={e => setZefix(e.target.value)} placeholder="Numéro IDE (CHE-xxx.xxx.xxx) *"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse de l'entreprise *"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>DÉCIDEUR / CONTACT PRINCIPAL</p>
      <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nom et prénom du décideur *"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="Titre du poste (CEO, Directeur...) *"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>ACCÈS</p>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email professionnel *" type="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe (min. 6 caractères) *" type="password"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />

      <div style={{display:'flex',alignItems:'flex-start',gap:10,marginTop:'0.25rem'}}>
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
          style={{marginTop:3,cursor:'pointer',width:16,height:16,flexShrink:0}} />
        <p style={{fontSize:13,color:'#666',lineHeight:1.5}}>
          J'accepte les <span onClick={() => setScreen('legal')} style={{color:'#E24B4A',cursor:'pointer',textDecoration:'underline'}}>Conditions Générales d'Utilisation</span> et la <span onClick={() => setScreen('legal')} style={{color:'#E24B4A',cursor:'pointer',textDecoration:'underline'}}>Politique de Confidentialité</span> de Hubbing.
        </p>
      </div>

      {error && <p style={{color:'#E24B4A',fontSize:13}}>{error}</p>}
      <button onClick={handleRegister} disabled={loading}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer',marginTop:'0.5rem'}}>
        {loading ? 'Création...' : 'Créer mon compte'}
      </button>
    </div>
  )
}

function Dashboard({ user, setUser }) {
  const [activeTab, setActiveTab] = useState('home')
  const handleLogout = async () => { await supabase.auth.signOut() }

  const tabStyle = (tab) => ({
    flex:1, padding:'12px 0', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#999',
    fontWeight: activeTab === tab ? 600 : 400,
    borderTop: activeTab === tab ? '2px solid #E24B4A' : '2px solid transparent',
    fontFamily:'Plus Jakarta Sans'
  })

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'0.875rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontWeight:700,fontSize:12}}>LK</span>
          </div>
          <span style={{fontWeight:700,fontSize:16}}>Hubbing</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={() => setActiveTab('pricing')}
            style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:20,padding:'5px 12px',cursor:'pointer'}}>
            <PlanBadge user={user} />
          </button>
          <button onClick={handleLogout} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {activeTab === 'home' && <HomeScreen user={user} setActiveTab={setActiveTab} />}
        {activeTab === 'swipe' && <SwipeScreen user={user} />}
        {activeTab === 'map' && <MapScreen />}
        {activeTab === 'messages' && <MessagesScreen user={user} />}
        {activeTab === 'pricing' && <PricingScreen user={user} setActiveTab={setActiveTab} />}
        {activeTab === 'profile' && <ProfileScreen user={user} setActiveTab={setActiveTab} />}
      </div>

      <div style={{borderTop:'1px solid #f0f0f0',display:'flex',background:'white'}}>
        {[
          {id:'home',label:'Accueil',icon:'🏠'},
          {id:'swipe',label:'Swipe',icon:'💼'},
          {id:'map',label:'Carte',icon:'🗺️'},
          {id:'messages',label:'Messages',icon:'💬'},
          {id:'profile',label:'Profil',icon:'👤'},
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(tab.id)}>
            <div style={{fontSize:20,marginBottom:2}}>{tab.icon}</div>
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}