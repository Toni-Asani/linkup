import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import SwipeScreen from './SwipeScreen'
import MapScreen from './MapScreen'
import ProfileScreen from './ProfileScreen'
import MessagesScreen from './MessagesScreen'
import HomeScreen from './HomeScreen'

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
        ) : null}
      </div>
    </>
  )
}

function LandingScreen({ setScreen }) {
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.2rem'}}>
      <div style={{width:72,height:72,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{color:'white',fontWeight:700,fontSize:24}}>LK</span>
      </div>
      <h1 style={{fontSize:28,fontWeight:700,color:'#1a1a1a',textAlign:'center'}}>LinkUp</h1>
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
    </div>
  )
}

function VisitorMode({ setScreen }) {
  const [activeTab, setActiveTab] = useState('swipe')
  const tabStyle = (tab) => ({
    flex:1, padding:'12px 0', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#999',
    fontWeight: activeTab === tab ? 600 : 400,
    borderTop: activeTab === tab ? '2px solid #E24B4A' : '2px solid transparent',
    fontFamily:'Plus Jakarta Sans'
  })
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontWeight:700,fontSize:12}}>LK</span>
          </div>
          <span style={{fontWeight:700,fontSize:16}}>LinkUp</span>
        </div>
        <span style={{fontSize:12,color:'#999',background:'#f5f5f5',padding:'4px 10px',borderRadius:20}}>Mode visiteur</span>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1rem',textAlign:'center'}}>
        <div style={{background:'#f9f9f9',borderRadius:16,padding:'2rem',width:'100%',border:'1px solid #eee'}}>
          <div style={{fontSize:40,marginBottom:'1rem'}}>🔒</div>
          <h3 style={{fontSize:18,fontWeight:700,marginBottom:'0.5rem'}}>
            {activeTab === 'swipe' && 'Découvrez les entreprises'}
            {activeTab === 'map' && 'Carte des entreprises'}
            {activeTab === 'messages' && 'Messagerie B2B'}
            {activeTab === 'profile' && 'Votre profil'}
            {activeTab === 'home' && 'Tableau de bord'}
          </h3>
          <p style={{color:'#999',fontSize:14,lineHeight:1.6,marginBottom:'1.5rem'}}>
            Créez un compte gratuit pour accéder à toutes les fonctionnalités de LinkUp.
          </p>
          <button onClick={() => setScreen('register')}
            style={{width:'100%',padding:'13px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
            Créer un compte gratuit
          </button>
          <button onClick={() => setScreen('login')}
            style={{width:'100%',padding:'13px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
            Se connecter
          </button>
        </div>
      </div>
      <div style={{borderTop:'1px solid #f0f0f0',display:'flex',background:'white'}}>
        {[
          {id:'home',label:'Accueil',icon:'🏠'},
          {id:'map',label:'Carte',icon:'🗺️'},
          {id:'swipe',label:'Swipe',icon:'💼'},
          {id:'messages',label:'Messages',icon:'💬'},
          {id:'profile',label:'Profil',icon:'👤'},
        ].map(tab => (
          <button key={tab.id} onClick={() => tab.id === 'home' ? setScreen('home') : setActiveTab(tab.id)} style={tabStyle(tab.id)}>
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
    </div>
  )
}

function RegisterScreen({ setScreen }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [zefix, setZefix] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    setError('')
    if (!email || !password || !company || !zefix) {
      setError('Veuillez remplir tous les champs')
      setLoading(false)
      return
    }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) {
      await supabase.from('companies').insert({ user_id: data.user.id, name: company, zefix_uid: zefix })
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1rem',textAlign:'center'}}>
      <div style={{fontSize:48}}>🎉</div>
      <h2 style={{fontSize:22,fontWeight:700}}>Compte créé !</h2>
      <p style={{color:'#666',fontSize:15}}>Bienvenue parmi les membres fondateurs de LinkUp !</p>
      <button onClick={() => setScreen('login')}
        style={{padding:'14px 32px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
        Se connecter
      </button>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',padding:'2rem',gap:'1rem'}}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,marginBottom:'0.5rem'}}>← Retour</button>
      <h2 style={{fontSize:24,fontWeight:700}}>Créer un compte</h2>
      <p style={{color:'#666',fontSize:13,marginBottom:'0.5rem'}}>Réservé aux entreprises enregistrées en Suisse</p>
      <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Nom de l'entreprise"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={zefix} onChange={e => setZefix(e.target.value)} placeholder="Numéro IDE (CHE-xxx.xxx.xxx)"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email professionnel" type="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe (min. 6 caractères)" type="password"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
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
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontWeight:700,fontSize:12}}>LK</span>
          </div>
          <span style={{fontWeight:700,fontSize:16}}>LinkUp</span>
        </div>
        <button onClick={handleLogout} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
          Déconnexion
        </button>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {activeTab === 'home' && <HomeScreen user={user} setActiveTab={setActiveTab} />}
        {activeTab === 'swipe' && <SwipeScreen user={user} />}
        {activeTab === 'map' && <MapScreen />}
        {activeTab === 'messages' && <MessagesScreen user={user} />}
        {activeTab === 'profile' && <ProfileScreen user={user} />}
      </div>

      <div style={{borderTop:'1px solid #f0f0f0',display:'flex',background:'white'}}>
        {[
          {id:'home',label:'Accueil',icon:'🏠'},
          {id:'map',label:'Carte',icon:'🗺️'},
          {id:'swipe',label:'Swipe',icon:'💼'},
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