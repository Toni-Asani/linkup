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
import CompanyProfileScreen from './CompanyProfileScreen'

const styles = `
  @keyframes pulse { 0%, 100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f5; }
  .app { max-width: 430px; margin: 0 auto; min-height: 100vh; background: white; position: relative; }
`

const translations = {
  fr: {
    appTagline: 'Le réseau B2B pour les entreprises suisses',
    founderOffer: '🎉 Offre Fondateurs',
    founderOfferDesc: '2 mois offerts pour les 100 premiers abonnés Premium',
    createAccount: 'Créer un compte',
    login: 'Se connecter',
    visitorMode: 'Continuer en mode visiteur',
    legal: 'CGU · Confidentialité · Mentions légales',
    registerTitle: 'Créer un compte',
    registerSubtitle: 'Réservé aux entreprises enregistrées en Suisse',
    companyInfo: 'INFORMATIONS ENTREPRISE',
    companyName: "Nom de l'entreprise *",
    ideNumber: 'Numéro IDE (CHE-xxx.xxx.xxx) *',
    companyAddress: "Adresse de l'entreprise *",
    contactInfo: 'DÉCIDEUR / CONTACT PRINCIPAL',
    contactName: 'Nom et prénom du décideur *',
    contactTitle: 'Titre du poste (CEO, Directeur...) *',
    access: 'ACCÈS',
    email: 'Email professionnel *',
    password: 'Mot de passe (min. 6 caractères) *',
    acceptCGU: "J'accepte les",
    cgu: "Conditions Générales d'Utilisation",
    and: 'et la',
    privacy: 'Politique de Confidentialité',
    of: 'de Hubbing.',
    creating: 'Création...',
    createBtn: 'Créer mon compte',
    loginTitle: 'Se connecter',
    back: '← Retour',
    noAccount: "Pas de compte ?",
    register: "S'inscrire",
    connecting: 'Connexion...',
    loginBtn: 'Se connecter',
    successTitle: 'Compte créé !',
    successMsg: 'Un email de confirmation vous a été envoyé. Cliquez sur le lien pour activer votre compte.',
    successBtn: 'Se connecter',
    errorFields: 'Veuillez remplir tous les champs obligatoires',
    errorCGU: 'Veuillez accepter les CGU pour continuer',
    errorEmail: 'Veuillez utiliser votre email professionnel (ex: vous@votreentreprise.ch)',
    errorZefix: 'Numéro IDE introuvable. Vérifiez que votre entreprise est enregistrée en Suisse.',
    errorZefixNotFound: 'Entreprise non trouvée dans le registre suisse (Zefix).',
    errorZefixRetry: 'Impossible de vérifier le numéro IDE. Réessayez.',
    demoMode: 'Mode visiteur',
    demoSwipe: '👀 Mode visiteur — connectez-vous pour matcher',
    demoMap: '👀 Mode visiteur — connectez-vous pour voir toutes les entreprises',
    companies: 'entreprises enregistrées en Suisse',
    mapTitle: 'Carte des entreprises',
    seeMap: 'Voir la carte complète',
    messagesTitle: 'Messagerie B2B',
    messagesDesc: 'Échangez directement avec vos connexions business',
    accessMessages: 'Accéder à la messagerie',
    pricing: 'Nos tarifs',
    pricingDesc: 'Développez votre réseau B2B en Suisse',
    lockTitle: 'Créez un compte gratuit',
    lockDesc: 'Rejoignez Hubbing pour accéder à toutes les fonctionnalités B2B.',
    createFree: 'Créer un compte gratuit',
    continueDemo: 'Continuer en mode démo',
    logout: 'Déconnexion',
    changeLanguage: '🌐 Langue',
  },
  de: {
    appTagline: 'Das B2B-Netzwerk für Schweizer Unternehmen',
    founderOffer: '🎉 Gründerangebot',
    founderOfferDesc: '2 Monate gratis für die ersten 100 Premium-Abonnenten',
    createAccount: 'Konto erstellen',
    login: 'Anmelden',
    visitorMode: 'Als Besucher fortfahren',
    legal: 'AGB · Datenschutz · Impressum',
    registerTitle: 'Konto erstellen',
    registerSubtitle: 'Nur für in der Schweiz registrierte Unternehmen',
    companyInfo: 'UNTERNEHMENSINFORMATIONEN',
    companyName: 'Unternehmensname *',
    ideNumber: 'UID-Nummer (CHE-xxx.xxx.xxx) *',
    companyAddress: 'Unternehmensadresse *',
    contactInfo: 'ENTSCHEIDUNGSTRÄGER / HAUPTKONTAKT',
    contactName: 'Vor- und Nachname *',
    contactTitle: 'Berufsbezeichnung (CEO, Direktor...) *',
    access: 'ZUGANG',
    email: 'Geschäftliche E-Mail *',
    password: 'Passwort (mind. 6 Zeichen) *',
    acceptCGU: 'Ich akzeptiere die',
    cgu: 'Allgemeinen Geschäftsbedingungen',
    and: 'und die',
    privacy: 'Datenschutzrichtlinie',
    of: 'von Hubbing.',
    creating: 'Wird erstellt...',
    createBtn: 'Konto erstellen',
    loginTitle: 'Anmelden',
    back: '← Zurück',
    noAccount: 'Kein Konto?',
    register: 'Registrieren',
    connecting: 'Verbindung...',
    loginBtn: 'Anmelden',
    successTitle: 'Konto erstellt!',
    successMsg: 'Eine Bestätigungs-E-Mail wurde gesendet. Klicken Sie auf den Link, um Ihr Konto zu aktivieren.',
    successBtn: 'Anmelden',
    errorFields: 'Bitte füllen Sie alle Pflichtfelder aus',
    errorCGU: 'Bitte akzeptieren Sie die AGB',
    errorEmail: 'Bitte verwenden Sie Ihre geschäftliche E-Mail (z.B. sie@ihrfirma.ch)',
    errorZefix: 'UID-Nummer nicht gefunden. Prüfen Sie, ob Ihr Unternehmen in der Schweiz registriert ist.',
    errorZefixNotFound: 'Unternehmen nicht im Schweizer Register (Zefix) gefunden.',
    errorZefixRetry: 'UID-Nummer konnte nicht verifiziert werden. Versuchen Sie es erneut.',
    demoMode: 'Besucher-Modus',
    demoSwipe: '👀 Besucher-Modus — anmelden zum Matchen',
    demoMap: '👀 Besucher-Modus — anmelden für alle Unternehmen',
    companies: 'registrierte Unternehmen in der Schweiz',
    mapTitle: 'Unternehmenskarte',
    seeMap: 'Vollständige Karte anzeigen',
    messagesTitle: 'B2B-Messaging',
    messagesDesc: 'Tauschen Sie sich direkt mit Ihren Business-Kontakten aus',
    accessMessages: 'Zum Messaging',
    pricing: 'Unsere Preise',
    pricingDesc: 'Entwickeln Sie Ihr B2B-Netzwerk in der Schweiz',
    lockTitle: 'Kostenloses Konto erstellen',
    lockDesc: 'Treten Sie Hubbing bei, um alle B2B-Funktionen zu nutzen.',
    createFree: 'Kostenloses Konto erstellen',
    continueDemo: 'Im Demo-Modus fortfahren',
    logout: 'Abmelden',
    changeLanguage: '🌐 Sprache',
  },
  it: {
    appTagline: 'La rete B2B per le aziende svizzere',
    founderOffer: '🎉 Offerta Fondatori',
    founderOfferDesc: '2 mesi gratuiti per i primi 100 abbonati Premium',
    createAccount: 'Crea un account',
    login: 'Accedi',
    visitorMode: 'Continua in modalità visitatore',
    legal: 'CGU · Privacy · Note legali',
    registerTitle: 'Crea un account',
    registerSubtitle: 'Riservato alle aziende registrate in Svizzera',
    companyInfo: 'INFORMAZIONI AZIENDALI',
    companyName: "Nome dell'azienda *",
    ideNumber: 'Numero IDE (CHE-xxx.xxx.xxx) *',
    companyAddress: "Indirizzo dell'azienda *",
    contactInfo: 'RESPONSABILE / CONTATTO PRINCIPALE',
    contactName: 'Nome e cognome *',
    contactTitle: 'Titolo (CEO, Direttore...) *',
    access: 'ACCESSO',
    email: 'Email professionale *',
    password: 'Password (min. 6 caratteri) *',
    acceptCGU: 'Accetto i',
    cgu: 'Termini e Condizioni',
    and: 'e la',
    privacy: 'Politica sulla Privacy',
    of: 'di Hubbing.',
    creating: 'Creazione...',
    createBtn: 'Crea il mio account',
    loginTitle: 'Accedi',
    back: '← Indietro',
    noAccount: 'Nessun account?',
    register: 'Registrati',
    connecting: 'Connessione...',
    loginBtn: 'Accedi',
    successTitle: 'Account creato!',
    successMsg: "Un'email di conferma è stata inviata. Clicca sul link per attivare il tuo account.",
    successBtn: 'Accedi',
    errorFields: 'Si prega di compilare tutti i campi obbligatori',
    errorCGU: 'Si prega di accettare i CGU per continuare',
    errorEmail: "Utilizzare l'email professionale (es: voi@vostraazienda.ch)",
    errorZefix: 'Numero IDE non trovato. Verificare che la sua azienda sia registrata in Svizzera.',
    errorZefixNotFound: 'Azienda non trovata nel registro svizzero (Zefix).',
    errorZefixRetry: 'Impossibile verificare il numero IDE. Riprovare.',
    demoMode: 'Modalità visitatore',
    demoSwipe: '👀 Modalità visitatore — accedi per fare match',
    demoMap: '👀 Modalità visitatore — accedi per vedere tutte le aziende',
    companies: 'aziende registrate in Svizzera',
    mapTitle: 'Mappa delle aziende',
    seeMap: 'Vedi la mappa completa',
    messagesTitle: 'Messaggistica B2B',
    messagesDesc: 'Scambia messaggi direttamente con i tuoi contatti business',
    accessMessages: 'Accedi alla messaggistica',
    pricing: 'I nostri prezzi',
    pricingDesc: 'Sviluppa la tua rete B2B in Svizzera',
    lockTitle: 'Crea un account gratuito',
    lockDesc: 'Unisciti a Hubbing per accedere a tutte le funzionalità B2B.',
    createFree: 'Crea un account gratuito',
    continueDemo: 'Continua in modalità demo',
    logout: 'Disconnetti',
    changeLanguage: '🌐 Lingua',
  },
  en: {
    appTagline: 'The B2B network for Swiss companies',
    founderOffer: '🎉 Founder Offer',
    founderOfferDesc: '2 months free for the first 100 Premium subscribers',
    createAccount: 'Create an account',
    login: 'Log in',
    visitorMode: 'Continue as visitor',
    legal: 'T&C · Privacy · Legal notice',
    registerTitle: 'Create an account',
    registerSubtitle: 'Reserved for companies registered in Switzerland',
    companyInfo: 'COMPANY INFORMATION',
    companyName: 'Company name *',
    ideNumber: 'IDE number (CHE-xxx.xxx.xxx) *',
    companyAddress: 'Company address *',
    contactInfo: 'DECISION MAKER / MAIN CONTACT',
    contactName: 'Full name *',
    contactTitle: 'Job title (CEO, Director...) *',
    access: 'ACCESS',
    email: 'Professional email *',
    password: 'Password (min. 6 characters) *',
    acceptCGU: 'I accept the',
    cgu: 'Terms and Conditions',
    and: 'and the',
    privacy: 'Privacy Policy',
    of: 'of Hubbing.',
    creating: 'Creating...',
    createBtn: 'Create my account',
    loginTitle: 'Log in',
    back: '← Back',
    noAccount: 'No account?',
    register: 'Sign up',
    connecting: 'Connecting...',
    loginBtn: 'Log in',
    successTitle: 'Account created!',
    successMsg: 'A confirmation email has been sent. Click the link to activate your account.',
    successBtn: 'Log in',
    errorFields: 'Please fill in all required fields',
    errorCGU: 'Please accept the T&C to continue',
    errorEmail: 'Please use your professional email (e.g. you@yourcompany.ch)',
    errorZefix: 'IDE number not found. Check that your company is registered in Switzerland.',
    errorZefixNotFound: 'Company not found in the Swiss register (Zefix).',
    errorZefixRetry: 'Unable to verify IDE number. Please try again.',
    demoMode: 'Visitor mode',
    demoSwipe: '👀 Visitor mode — log in to match',
    demoMap: '👀 Visitor mode — log in to see all companies',
    companies: 'companies registered in Switzerland',
    mapTitle: 'Company map',
    seeMap: 'See full map',
    messagesTitle: 'B2B Messaging',
    messagesDesc: 'Exchange messages directly with your business connections',
    accessMessages: 'Access messaging',
    pricing: 'Our pricing',
    pricingDesc: 'Grow your B2B network in Switzerland',
    lockTitle: 'Create a free account',
    lockDesc: 'Join Hubbing to access all B2B features.',
    createFree: 'Create a free account',
    continueDemo: 'Continue in demo mode',
    logout: 'Log out',
    changeLanguage: '🌐 Language',
  }
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState('fr')
  const isProduction = window.location.hostname === 'hubbing.ch' || window.location.hostname === 'www.hubbing.ch'
  const t = translations[lang]

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      const params = new URLSearchParams(window.location.search)
      if (params.get('admin') === 'true') setScreen('admin')
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Plus Jakarta Sans'}}>Chargement...</div>
if (isProduction) return (
    <>
      <style>{styles + `
        @keyframes pulse { 0%, 100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .waitlist-input:focus { outline: none; border-color: #E24B4A !important; }
        .waitlist-btn:hover { background: #c93a39 !important; }
      `}</style>
      <div className="app">
        <WaitlistScreen />
      </div>
    </>
  )

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {user ? (
          <Dashboard user={user} setUser={setUser} t={t} lang={lang} setLang={setLang} />
        ) : screen === 'home' ? (
          <LandingScreen setScreen={setScreen} t={t} lang={lang} setLang={setLang} />
        ) : screen === 'login' ? (
          <LoginScreen setScreen={setScreen} t={t} />
        ) : screen === 'register' ? (
          <RegisterScreen setScreen={setScreen} t={t} />
        ) : screen === 'visitor' ? (
          <VisitorMode setScreen={setScreen} t={t} />
        ) : screen === 'legal' ? (
          <LegalScreen setScreen={setScreen} lang={lang} />
        ) : screen === 'admin' ? (
          <AdminScreen user={user} setScreen={setScreen} />
        ) : null}
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
function WaitlistScreen() {
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState({})

  useEffect(() => {
    const target = new Date('2026-05-01T00:00:00')
    const interval = setInterval(() => {
      const now = new Date()
      const diff = target - now
      if (diff <= 0) {
        clearInterval(interval)
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleWaitlist = async () => {
    setLoading(true)
    setError('')
    if (!email || !email.includes('@')) {
      setError('Veuillez entrer un email valide')
      setLoading(false)
      return
    }
    const { error } = await supabase.from('waitlist').insert({ email })
    if (error) {
      if (error.code === '23505') {
        setError('Cet email est déjà inscrit !')
      } else {
        setError('Une erreur est survenue. Réessayez.')
      }
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  const CountBox = ({ value, label }) => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',background:'#1a1a1a',borderRadius:12,padding:'12px 16px',minWidth:64}}>
      <span style={{fontSize:28,fontWeight:800,color:'white',letterSpacing:'-1px',fontFamily:'Plus Jakarta Sans'}}>
        {String(value).padStart(2, '0')}
      </span>
      <span style={{fontSize:10,color:'#999',fontWeight:500,marginTop:2,textTransform:'uppercase',letterSpacing:'0.5px'}}>
        {label}
      </span>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.5rem',textAlign:'center',position:'relative',background:'white'}}>

      {/* Logo */}
      <div style={{width:72,height:72,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeUp 0.6s ease 0.1s both'}}>
        <span style={{color:'white',fontWeight:800,fontSize:22}}>HB</span>
      </div>

      <h1 style={{fontSize:32,fontWeight:800,letterSpacing:'-1px',animation:'fadeUp 0.6s ease 0.2s both'}}>Hubbing</h1>
      <p style={{color:'#666',fontSize:15,animation:'fadeUp 0.6s ease 0.3s both'}}>Le réseau B2B pour les entreprises suisses</p>

      <div style={{width:40,height:2,background:'#E24B4A',borderRadius:2,animation:'fadeUp 0.6s ease 0.4s both'}}></div>

      {/* Badge */}
      <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:100,padding:'8px 20px',animation:'fadeUp 0.6s ease 0.5s both'}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:'#E24B4A',animation:'pulse 2s ease infinite'}}></div>
        <span style={{fontSize:13,fontWeight:600,color:'#E24B4A'}}>Lancement le 1er mai 2026 🎉</span>
      </div>

      {/* Compte à rebours */}
      <div style={{display:'flex',gap:'0.75rem',animation:'fadeUp 0.6s ease 0.6s both'}}>
        <CountBox value={timeLeft.days ?? '--'} label="Jours" />
        <CountBox value={timeLeft.hours ?? '--'} label="Heures" />
        <CountBox value={timeLeft.minutes ?? '--'} label="Minutes" />
        <CountBox value={timeLeft.seconds ?? '--'} label="Secondes" />
      </div>

      {/* Message */}
      <div style={{animation:'fadeUp 0.6s ease 0.7s both'}}>
        <h2 style={{fontSize:22,fontWeight:700,letterSpacing:'-0.5px',lineHeight:1.3,marginBottom:'0.5rem'}}>
          Le networking B2B<br />
          <span style={{color:'#E24B4A'}}>réinventé</span> pour la Suisse
        </h2>
        <p style={{color:'#666',fontSize:14,lineHeight:1.7,maxWidth:300,margin:'0 auto'}}>
          Nous préparons quelque chose de grand.<br />
          Soyez parmi les premiers à rejoindre Hubbing.
        </p>
      </div>

      {/* Offre fondateur */}
      <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem',width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.8s both'}}>
        <p style={{fontSize:13,color:'#E24B4A',fontWeight:700}}>🎉 Offre Fondateurs</p>
        <p style={{fontSize:12,color:'#666',marginTop:4}}>2 mois offerts pour les 100 premiers abonnés Premium</p>
      </div>

      {/* Formulaire waitlist */}
      {!success ? (
        <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:'0.75rem',animation:'fadeUp 0.6s ease 0.9s both'}}>
          <p style={{fontSize:13,fontWeight:600,color:'#1a1a1a'}}>Inscrivez-vous pour être notifié au lancement :</p>
          <input
            className="waitlist-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleWaitlist()}
            placeholder="votre@email.ch"
            type="email"
            style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,width:'100%',fontFamily:'Plus Jakarta Sans'}}
          />
          {error && <p style={{color:'#E24B4A',fontSize:13}}>{error}</p>}
          <button
            className="waitlist-btn"
            onClick={handleWaitlist}
            disabled={loading}
            style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',transition:'background 0.2s',fontFamily:'Plus Jakarta Sans'}}>
            {loading ? 'Inscription...' : "M'inscrire sur la liste d'attente →"}
          </button>
        </div>
      ) : (
        <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:12,padding:'1.25rem',width:'100%',maxWidth:340,textAlign:'center',animation:'fadeUp 0.4s ease both'}}>
          <div style={{fontSize:32,marginBottom:8}}>🎉</div>
          <p style={{fontWeight:700,fontSize:15,color:'#166534'}}>Vous êtes sur la liste !</p>
          <p style={{fontSize:13,color:'#15803d',marginTop:4}}>Nous vous contacterons dès le lancement le 1er mai.</p>
        </div>
      )}

      {/* Features */}
      <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',justifyContent:'center',animation:'fadeUp 0.6s ease 1s both'}}>
        {['💼 Swipe B2B','🗺️ Carte interactive','✅ Vérification Zefix','💬 Messagerie pro'].map(f => (
          <span key={f} style={{background:'#f5f5f5',borderRadius:100,padding:'7px 14px',fontSize:12,fontWeight:500,color:'#666'}}>{f}</span>
        ))}
      </div>

      <p style={{fontSize:13,color:'#bbb',animation:'fadeUp 0.6s ease 1.1s both'}}>
        Des questions ? <a href="mailto:contact@hubbing.ch" style={{color:'#E24B4A',textDecoration:'none',fontWeight:500}}>contact@hubbing.ch</a>
      </p>

      <p style={{fontSize:12,color:'#ccc',textAlign:'center'}}>🇨🇭 Made in Switzerland</p>
    </div>
  )
}
function LandingScreen({ setScreen, t, lang, setLang }) {
  const [showLangMenu, setShowLangMenu] = useState(false)
  const langs = [
    { code: 'fr', label: '🇫🇷 Français' },
    { code: 'de', label: '🇩🇪 Deutsch' },
    { code: 'it', label: '🇮🇹 Italiano' },
    { code: 'en', label: '🇬🇧 English' },
  ]

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1.2rem',position:'relative'}}>
      <div style={{position:'absolute',top:'1rem',right:'1rem'}}>
        <button onClick={() => setShowLangMenu(!showLangMenu)}
          style={{background:'#f5f5f5',border:'1px solid #eee',borderRadius:20,padding:'6px 14px',fontSize:13,cursor:'pointer',fontFamily:'Plus Jakarta Sans',fontWeight:500}}>
          {t.changeLanguage}
        </button>
        {showLangMenu && (
          <div style={{position:'absolute',right:0,top:'110%',background:'white',border:'1px solid #eee',borderRadius:12,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',overflow:'hidden',zIndex:100}}>
            {langs.map(l => (
              <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false) }}
                style={{display:'block',width:'100%',padding:'10px 20px',background: lang === l.code ? '#FFF5F5' : 'white',border:'none',cursor:'pointer',fontSize:14,textAlign:'left',fontFamily:'Plus Jakarta Sans',color: lang === l.code ? '#E24B4A' : '#333',fontWeight: lang === l.code ? 600 : 400}}>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{width:72,height:72,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{color:'white',fontWeight:700,fontSize:24}}>HB</span>
      </div>
      <h1 style={{fontSize:28,fontWeight:700,color:'#1a1a1a',textAlign:'center'}}>Hubbing</h1>
      <p style={{color:'#666',textAlign:'center',fontSize:15,lineHeight:1.6}}>{t.appTagline}</p>
      <div style={{width:'100%',background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem',textAlign:'center'}}>
        <p style={{fontSize:13,color:'#E24B4A',fontWeight:600}}>{t.founderOffer}</p>
        <p style={{fontSize:12,color:'#666',marginTop:4}}>{t.founderOfferDesc}</p>
      </div>
      <button onClick={() => setScreen('register')}
        style={{width:'100%',padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        {t.createAccount}
      </button>
      <button onClick={() => setScreen('login')}
        style={{width:'100%',padding:'14px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        {t.login}
      </button>
      <button onClick={() => setScreen('visitor')}
        style={{width:'100%',padding:'12px',background:'none',color:'#999',border:'none',fontSize:14,cursor:'pointer',textDecoration:'underline'}}>
        {t.visitorMode}
      </button>
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline'}}>
        {t.legal}
      </button>
    </div>
  )
}
function LoginScreen({ setScreen, t }) {
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
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,marginBottom:'1rem'}}>
        {t.back}
      </button>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:'0.5rem'}}>{t.loginTitle}</h2>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} type="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} type="password"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      {error && <p style={{color:'#E24B4A',fontSize:13}}>{error}</p>}
      <button onClick={handleLogin} disabled={loading}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        {loading ? t.connecting : t.loginBtn}
      </button>
      <p style={{textAlign:'center',fontSize:14,color:'#666'}}>
        {t.noAccount} <span onClick={() => setScreen('register')} style={{color:'#E24B4A',cursor:'pointer',fontWeight:600}}>{t.register}</span>
      </p>
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline',marginTop:'auto'}}>
        {t.legal}
      </button>
    </div>
  )
}

function RegisterScreen({ setScreen, t }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [zefix, setZefix] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [canton, setCanton] = useState('')
  const [npa, setNpa] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
 const [zefixStatus, setZefixStatus] = useState('idle') // idle, checking, valid, invalid
const [zefixCompanyName, setZefixCompanyName] = useState('')

const handleZefixLookup = (ideNumber) => {
  setZefix(ideNumber)
  const clean = ideNumber.replace(/[^0-9]/g, '').trim()
  if (clean.length === 9) {
    setZefixStatus('valid')
  } else if (ideNumber.length > 3) {
    setZefixStatus('invalid')
  } else {
    setZefixStatus('idle')
  }
}

const handleRegister = async () => {
    setLoading(true)
    setError('')

    const forbiddenDomains = ['gmail.com','hotmail.com','yahoo.com','outlook.com','icloud.com','live.com','msn.com','hotmail.fr','yahoo.fr','gmail.fr','bluewin.ch','gmx.ch','gmx.net','web.de']
    const emailDomain = email.split('@')[1]?.toLowerCase()
    if (forbiddenDomains.includes(emailDomain)) {
      setError(t.errorEmail)
      setLoading(false)
      return
    }

if (!email || !password || !company || !zefix || !contactName || !contactTitle || !address || !city || !canton || !npa) {      setError(t.errorFields)
      setLoading(false)
      return
    }
    if (!accepted) {
      setError(t.errorCGU)
      setLoading(false)
      return
    }
if (zefixStatus === 'invalid') {
  setError(t.errorZefix)
  setLoading(false)
  return
}
    const clean = zefix.replace(/[^0-9]/g, '').trim()
    if (clean.length === 9) {
  setZefixStatus('valid')
} else {
  setZefixStatus('idle')
}

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    
    const userId = data?.user?.id || data?.session?.user?.id
    if (userId) {
      const { error: insertError } = await supabase.from('companies').insert({
        user_id: userId,
      name: company,
      zefix_uid: zefix,
      contact_name: contactName,
      contact_title: contactTitle,
      address: `${address}, ${npa} ${city}`,
     city: city,
     canton: canton,
      })
      if (insertError) console.error('Insert error:', insertError)
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',gap:'1rem',textAlign:'center'}}>
      <div style={{fontSize:48}}>🎉</div>
      <h2 style={{fontSize:22,fontWeight:700}}>{t.successTitle}</h2>
      <p style={{color:'#666',fontSize:15}}>{t.successMsg}</p>
      <button onClick={() => setScreen('login')}
        style={{padding:'14px 32px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
        {t.successBtn}
      </button>
    </div>
  )

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',padding:'2rem',gap:'1rem',overflowY:'auto'}}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14}}>
        {t.back}
      </button>
      <h2 style={{fontSize:24,fontWeight:700}}>{t.registerTitle}</h2>
      <p style={{color:'#666',fontSize:13}}>{t.registerSubtitle}</p>

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.5rem'}}>{t.companyInfo}</p>
      <input value={company} onChange={e => setCompany(e.target.value)} placeholder={t.companyName}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={zefix} onChange={e => handleZefixLookup(e.target.value)} placeholder={t.ideNumber}
  style={{padding:'14px',border:`1px solid ${zefixStatus === 'valid' ? '#22c55e' : zefixStatus === 'invalid' ? '#E24B4A' : '#ddd'}`,borderRadius:10,fontSize:15,outline:'none'}} />
{zefixStatus === 'valid' && <p style={{fontSize:12,color:'#F39C12'}}>⏳ Numéro à vérifier — un email de confirmation vous sera envoyé dans les 24h</p>}
{zefixStatus === 'invalid' && <p style={{fontSize:12,color:'#E24B4A'}}>❌ Format invalide. Utilisez le format CHE-xxx.xxx.xxx (9 chiffres)</p>}
      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rue et numéro *"
  style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
<div style={{display:'flex',gap:8}}>
  <input value={npa} onChange={e => setNpa(e.target.value)} placeholder="NPA *"
    style={{width:100,padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ville *"
    style={{flex:1,padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
</div>
<select value={canton} onChange={e => setCanton(e.target.value)}
  style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none',background:'white',fontFamily:'Plus Jakarta Sans'}}>
  <option value="">Canton *</option>
  {['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'].map(c => (
    <option key={c} value={c}>{c}</option>
  ))}
</select>

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{t.contactInfo}</p>
      <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder={t.contactName}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder={t.contactTitle}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{t.access}</p>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} type="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} type="password"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:15,outline:'none'}} />

      <div style={{display:'flex',alignItems:'flex-start',gap:10,marginTop:'0.25rem'}}>
        <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
          style={{marginTop:3,cursor:'pointer',width:16,height:16,flexShrink:0}} />
        <p style={{fontSize:13,color:'#666',lineHeight:1.5}}>
          {t.acceptCGU} <span onClick={() => setScreen('legal')} style={{color:'#E24B4A',cursor:'pointer',textDecoration:'underline'}}>{t.cgu}</span> {t.and} <span onClick={() => setScreen('legal')} style={{color:'#E24B4A',cursor:'pointer',textDecoration:'underline'}}>{t.privacy}</span> {t.of}
        </p>
      </div>

      {error && <p style={{color:'#E24B4A',fontSize:13}}>{error}</p>}
      <button onClick={handleRegister} disabled={loading}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer',marginTop:'0.5rem'}}>
        {loading ? t.creating : t.createBtn}
      </button>
    </div>
  )
}

function VisitorMode({ setScreen, t }) {
  const [activeTab, setActiveTab] = useState('swipe')
  const [showModal, setShowModal] = useState(false)

  const tabStyle = (tab) => ({
    flex:1, padding:'12px 0', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#999',
    fontWeight: activeTab === tab ? 600 : 400,
    borderTop: activeTab === tab ? '2px solid #E24B4A' : '2px solid transparent',
    fontFamily:'Plus Jakarta Sans'
  })

  const Modal = () => (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'1rem'}}>
      <div style={{background:'white',borderRadius:16,padding:'2rem',width:'100%',maxWidth:340,textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:'0.75rem'}}>🔒</div>
        <h3 style={{fontSize:18,fontWeight:700,marginBottom:8}}>{t.lockTitle}</h3>
        <p style={{fontSize:14,color:'#666',lineHeight:1.6,marginBottom:'1.25rem'}}>{t.lockDesc}</p>
        <button onClick={() => setScreen('register')}
          style={{width:'100%',padding:'13px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
          {t.createFree}
        </button>
        <button onClick={() => setScreen('login')}
          style={{width:'100%',padding:'13px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer',marginBottom:'0.75rem'}}>
          {t.login}
        </button>
        <button onClick={() => setShowModal(false)}
          style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
          {t.continueDemo}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {showModal && <Modal />}

      {/* Header */}
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontWeight:700,fontSize:12}}>HB</span>
          </div>
          <span style={{fontWeight:700,fontSize:16}}>Hubbing</span>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => setScreen('register')}
            style={{background:'#E24B4A',color:'white',border:'none',borderRadius:20,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            S'inscrire
          </button>
          <button onClick={() => setScreen('login')}
            style={{background:'white',color:'#E24B4A',border:'1px solid #E24B4A',borderRadius:20,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            Connexion
          </button>
        </div>
      </div>

      {/* Contenu */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {activeTab === 'swipe' && <SwipeScreen user={null} setScreen={setScreen} />}
        {activeTab === 'map' && <MapScreen user={null} setScreen={setScreen} />}
        {activeTab === 'messages' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
            <div style={{fontSize:48}}>💬</div>
            <h3 style={{fontSize:18,fontWeight:700}}>{t.messagesTitle}</h3>
            <p style={{color:'#999',fontSize:14,lineHeight:1.6}}>{t.messagesDesc}</p>
            <button onClick={() => setShowModal(true)}
              style={{padding:'12px 24px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:600,cursor:'pointer'}}>
              {t.accessMessages}
            </button>
          </div>
        )}
        {activeTab === 'pricing' && (
          <div style={{flex:1,overflowY:'auto',padding:'1.5rem 1rem'}}>
            <div style={{textAlign:'center',marginBottom:'1.25rem'}}>
              <h2 style={{fontSize:20,fontWeight:700,marginBottom:4}}>{t.pricing}</h2>
              <p style={{fontSize:13,color:'#666'}}>{t.pricingDesc}</p>
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

      {/* Barre de navigation */}
      <div style={{borderTop:'1px solid #f0f0f0',display:'flex',background:'white',flexShrink:0}}>
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

function Dashboard({ user, setUser, t, lang, setLang }) {
  const [activeTab, setActiveTab] = useState('home')
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [userPlan, setUserPlan] = useState('Starter')
  const [unreadCount, setUnreadCount] = useState(0)

useEffect(() => {
  loadUnreadCount()
  const sub = supabase
    .channel('notifications-' + user.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${user.id}`
    }, () => { loadUnreadCount() })
    .subscribe()
  return () => supabase.removeChannel(sub)
}, [user])

const loadUnreadCount = async () => {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)
  setUnreadCount(count || 0)
}
  useEffect(() => {
  supabase.from('subscriptions').select('plan').eq('user_id', user.id).single()
    .then(({ data }) => {
      if (data) setUserPlan(data.plan.charAt(0).toUpperCase() + data.plan.slice(1))
    })
}, [user])
  const handleLogout = async () => { await supabase.auth.signOut() }

const handleTabChange = (tab) => {
  setActiveTab(tab)
  setSelectedCompanyId(null)
}

  const tabStyle = (tab) => ({
    flex:1, padding:'12px 0', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#999',
    fontWeight: activeTab === tab ? 600 : 400,
    borderTop: activeTab === tab ? '2px solid #E24B4A' : '2px solid transparent',
    fontFamily:'Plus Jakarta Sans'
  })

  const langs = [
    { code: 'fr', label: '🇫🇷' },
    { code: 'de', label: '🇩🇪' },
    { code: 'it', label: '🇮🇹' },
    { code: 'en', label: '🇬🇧' },
  ]

  return (
    <div style={{height:'100vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'0.875rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{color:'white',fontWeight:700,fontSize:12}}>HB</span>
          </div>
          <span style={{fontWeight:700,fontSize:16}}>Hubbing</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'flex',gap:4}}>
            {langs.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                style={{background: lang === l.code ? '#FFF5F5' : 'none', border: lang === l.code ? '1px solid #FECACA' : '1px solid transparent', borderRadius:8, padding:'4px 6px', cursor:'pointer', fontSize:16}}>
                {l.label}
              </button>
            ))}
          </div>
          <button onClick={() => setActiveTab('pricing')}
            style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:20,padding:'5px 12px',cursor:'pointer'}}>
            <PlanBadge user={user} />
          </button>
          <button onClick={handleLogout} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'#999'}}>
            {t.logout}
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto',position:'relative'}}>
  {selectedCompanyId ? (
    <CompanyProfileScreen
  companyId={selectedCompanyId}
  plan={userPlan}
  onBack={() => setSelectedCompanyId(null)}
  setActiveTab={setActiveTab}
  setSelectedCompanyId={setSelectedCompanyId}
/>
  ) : (
    <>
      {activeTab === 'home' && <HomeScreen user={user} setActiveTab={setActiveTab} />}
      {activeTab === 'swipe' && <SwipeScreen user={user} />}
      {activeTab === 'map' && <MapScreen user={user} setSelectedCompanyId={setSelectedCompanyId} setActiveTab={setActiveTab} />}
      {activeTab === 'messages' && <MessagesScreen user={user} plan={userPlan} setSelectedCompanyId={setSelectedCompanyId} />}
      {activeTab === 'pricing' && <PricingScreen user={user} setActiveTab={setActiveTab} />}
      {activeTab === 'profile' && <ProfileScreen user={user} setActiveTab={setActiveTab} />}
    </>
  )}
</div>

      <div style={{borderTop:'1px solid #f0f0f0',display:'flex',background:'white'}}>
  {[
    {id:'home',label:'Accueil',icon:'🏠'},
    {id:'swipe',label:'Swipe',icon:'💼'},
    {id:'map',label:'Carte',icon:'🗺️'},
    {id:'messages',label:'Messages',icon:'💬'},
    {id:'profile',label:'Profil',icon:'👤'},
  ].map(tab => (
    <button key={tab.id} onClick={() => handleTabChange(tab.id)} style={tabStyle(tab.id)}>
      <div style={{position:'relative',display:'inline-block',fontSize:20,marginBottom:2}}>
        {tab.icon}
        {tab.id === 'messages' && unreadCount > 0 && (
          <div style={{position:'absolute',top:-4,right:-6,background:'#E24B4A',color:'white',borderRadius:'50%',width:16,height:16,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>
      {tab.label}
    </button>
  ))}
</div>
    </div>
  )
}