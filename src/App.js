import React, { useState, useEffect, Suspense } from 'react'
import { supabase } from './supabaseClient'
import SwipeScreen from './SwipeScreen'
import ProfileScreen from './ProfileScreen'
import MessagesScreen from './MessagesScreen'
import HomeScreen from './HomeScreen'
import PricingScreen from './PricingScreen'
import LegalScreen from './LegalScreen'
import AdminScreen from './AdminScreen'
import CompanyProfileScreen from './CompanyProfileScreen'
import PrivacyPolicy from './PrivacyPolicy'
import { getUiText } from './i18n'

const MapScreen = React.lazy(() => import('./MapScreen'))

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');

  @keyframes pulse { 
    0%, 100% { opacity:1; transform:scale(1); } 
    50% { opacity:0.5; transform:scale(0.8); } 
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body, #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  body {
    font-family: 'Plus Jakarta Sans', sans-serif;
    background: #f5f5f5;
    overscroll-behavior: none;
  }

  .app {
    width: 100%;
    max-width: 430px;
    height: 100dvh;
    min-height: 100dvh;
    margin: 0 auto;
    background: white;
    position: relative;
    overflow: hidden;
  }

  input, textarea, select {
    font-size: 16px;
  }
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
  const hostname = window.location.hostname.toLowerCase()
  const isStandalonePwa = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true
  const isMarketingSite = (hostname === 'hubbing.ch' || hostname === 'www.hubbing.ch') && !isStandalonePwa
  const t = translations[lang]

  useEffect(() => {
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    setUser(session?.user ?? null)    
    // Vérifier si retour de Stripe
    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('payment')
    const paymentPlan = params.get('plan')
    if (paymentStatus === 'success' && paymentPlan && session?.user) {
      const isFounder = paymentPlan === 'premium'
      await supabase.from('subscriptions').upsert({
        user_id: session.user.id,
        plan: paymentPlan,
        status: 'active',
        is_founder: isFounder,
        current_period_ends_at: new Date(Date.now() + (isFounder ? 90 : 30) * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'user_id' })
      alert(`✅ Abonnement ${paymentPlan} activé avec succès !`)
      window.history.replaceState({}, '', window.location.pathname)
    }
    
    setLoading(false)
  })
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null)
  })
  return () => subscription.unsubscribe()
}, [])
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh',background:'white',fontFamily:'Plus Jakarta Sans'}}>Chargement...</div>
if (isMarketingSite) return (
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
        {screen === 'privacy' ? (
  <PrivacyPolicy setScreen={setScreen} lang={lang} />
) : user ? (
  <Dashboard user={user} setUser={setUser} t={t} lang={lang} setLang={setLang} />
) : screen === 'home' ? (
          <LandingScreen setScreen={setScreen} t={t} lang={lang} setLang={setLang} />
        ) : screen === 'login' ? (
          <LoginScreen setScreen={setScreen} t={t} />
        ) : screen === 'register' ? (
          <RegisterScreen setScreen={setScreen} t={t} />
        ) : screen === 'visitor' ? (
          <VisitorMode setScreen={setScreen} t={t} lang={lang} setLang={setLang} />
        ) : screen === 'legal' ? (
          <LegalScreen setScreen={setScreen} lang={lang} />
          ) : screen === 'privacy' ? (
  <PrivacyPolicy setScreen={setScreen} lang={lang} />
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

function InstallAppButton({ compact = false }) {
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const updateStandalone = () => {
      setIsStandalone(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true)
    }
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event)
    }
    const handleInstalled = () => {
      setIsStandalone(true)
      setDeferredInstallPrompt(null)
      setShowInstallHelp(false)
    }

    updateStandalone()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt()
      const choice = await deferredInstallPrompt.userChoice
      setDeferredInstallPrompt(null)
      if (choice?.outcome !== 'accepted') setShowInstallHelp(true)
      return
    }
    setShowInstallHelp(value => !value)
  }

  return (
    <div style={{width:'100%',maxWidth:compact ? '100%' : 340}}>
      <button
        onClick={handleInstallApp}
        disabled={isStandalone}
        style={{width:'100%',padding:compact ? '12px 14px' : '13px 16px',background:isStandalone ? '#f0fdf4' : '#1a1a1a',color:isStandalone ? '#15803d' : 'white',border:isStandalone ? '1px solid #bbf7d0' : 'none',borderRadius:12,fontSize:compact ? 13 : 14,fontWeight:700,cursor:isStandalone ? 'default' : 'pointer',fontFamily:'Plus Jakarta Sans',boxShadow:isStandalone ? 'none' : '0 8px 24px rgba(0,0,0,0.12)'}}>
        {isStandalone ? 'Application installée' : "Installer l'application sur ce téléphone"}
      </button>
      {showInstallHelp && !isStandalone && (
        <div style={{marginTop:10,background:'#f9f9f9',border:'1px solid #eee',borderRadius:12,padding:'0.85rem',textAlign:'left'}}>
          <p style={{fontSize:12,color:'#1a1a1a',fontWeight:700,margin:'0 0 6px'}}>Installation sur téléphone</p>
          <p style={{fontSize:12,color:'#666',lineHeight:1.5,margin:0}}>
            Sur iPhone : ouvrez cette page dans Safari, touchez le bouton Partager, puis "Ajouter à l'écran d'accueil".<br />
            Sur Android : touchez le menu du navigateur, puis "Installer l'application".
          </p>
        </div>
      )}
    </div>
  )
}

function WaitlistScreen() {
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState({})
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

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

  useEffect(() => {
    const updateStandalone = () => {
      setIsStandalone(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true)
    }
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event)
    }
    const handleInstalled = () => {
      setIsStandalone(true)
      setDeferredInstallPrompt(null)
      setShowInstallHelp(false)
    }

    updateStandalone()
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt()
      const choice = await deferredInstallPrompt.userChoice
      setDeferredInstallPrompt(null)
      if (choice?.outcome !== 'accepted') setShowInstallHelp(true)
      return
    }
    setShowInstallHelp(value => !value)
  }

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
        setError('Cet email est déjà inscrit sur la liste !')
      } else {
        setError('Une erreur est survenue. Réessayez.')
      }
      setLoading(false)
      return
    }
    // Envoi email en arrière-plan sans bloquer
    fetch('https://rxjrcbdeyouafhtizneh.supabase.co/functions/v1/waitlist-email', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ email })
    }).catch(e => console.log('Email error:', e))

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

  const Feature = ({ icon, title, desc }) => (
    <div style={{background:'#f9f9f9',borderRadius:16,padding:'1.25rem',textAlign:'left',width:'100%',maxWidth:340}}>
      <div style={{fontSize:28,marginBottom:8}}>{icon}</div>
      <p style={{fontSize:14,fontWeight:700,color:'#1a1a1a',margin:'0 0 4px'}}>{title}</p>
      <p style={{fontSize:13,color:'#666',margin:0,lineHeight:1.5}}>{desc}</p>
    </div>
  )

  const MockupCard = ({ emoji, title, subtitle, badge, badgeColor }) => (
    <div style={{background:'white',borderRadius:20,padding:'1rem',boxShadow:'0 8px 30px rgba(0,0,0,0.1)',width:140,flexShrink:0}}>
      <div style={{width:48,height:48,borderRadius:'50%',background:badgeColor||'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px'}}>
        <span style={{fontSize:22}}>{emoji}</span>
      </div>
      <p style={{fontSize:12,fontWeight:700,margin:'0 0 2px',textAlign:'center'}}>{title}</p>
      <p style={{fontSize:10,color:'#999',margin:'0 0 8px',textAlign:'center'}}>{subtitle}</p>
      {badge && (
        <div style={{background:'#FFF5F5',borderRadius:20,padding:'3px 8px',textAlign:'center'}}>
          <span style={{fontSize:10,color:'#E24B4A',fontWeight:600}}>{badge}</span>
        </div>
      )}
    </div>
  )

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 10rem)',gap:'1.5rem',textAlign:'center',position:'relative',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>

      {/* Logo */}
      <img src="/LOGO-HUBBING-ICON.svg" alt="Hubbing" style={{width:72,height:72,borderRadius:'50%',animation:'fadeUp 0.6s ease 0.1s both'}} />

<h1 style={{fontSize:32,fontWeight:700,letterSpacing:'-1px',animation:'fadeUp 0.6s ease 0.2s both',fontFamily:'Nunito, sans-serif', fontWeight:800, letterSpacing:'-0.5px'}}>hubbing</h1>
      {/* Badge lancement */}
      <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:100,padding:'8px 20px',animation:'fadeUp 0.6s ease 0.3s both'}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:'#E24B4A',animation:'pulse 2s ease infinite'}}></div>
        <span style={{fontSize:13,fontWeight:600,color:'#E24B4A'}}>Lancement le 1er mai 2026 🎉</span>
      </div>

      <div style={{width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.35s both'}}>
        <button
          onClick={handleInstallApp}
          disabled={isStandalone}
          style={{width:'100%',padding:'13px 16px',background:isStandalone ? '#f0fdf4' : '#1a1a1a',color:isStandalone ? '#15803d' : 'white',border:isStandalone ? '1px solid #bbf7d0' : 'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:isStandalone ? 'default' : 'pointer',fontFamily:'Plus Jakarta Sans',boxShadow:isStandalone ? 'none' : '0 8px 24px rgba(0,0,0,0.12)'}}>
          {isStandalone ? 'Application installée' : "Installer l'application sur mon téléphone"}
        </button>
        {showInstallHelp && !isStandalone && (
          <div style={{marginTop:10,background:'#f9f9f9',border:'1px solid #eee',borderRadius:12,padding:'0.85rem',textAlign:'left'}}>
            <p style={{fontSize:12,color:'#1a1a1a',fontWeight:700,margin:'0 0 6px'}}>Installation sur téléphone</p>
            <p style={{fontSize:12,color:'#666',lineHeight:1.5,margin:0}}>
              Sur iPhone : ouvrez cette page dans Safari, touchez le bouton Partager, puis "Ajouter à l'écran d'accueil".<br />
              Sur Android : touchez le menu du navigateur, puis "Installer l'application".
            </p>
          </div>
        )}
      </div>

{/* Compte à rebours */}
      <div style={{display:'flex',gap:'0.75rem',animation:'fadeUp 0.6s ease 0.6s both'}}>
        <CountBox value={timeLeft.days ?? '--'} label="Jours" />
        <CountBox value={timeLeft.hours ?? '--'} label="Heures" />
        <CountBox value={timeLeft.minutes ?? '--'} label="Minutes" />
        <CountBox value={timeLeft.seconds ?? '--'} label="Secondes" />
      </div>

      {/* Headline forte */}
      <div style={{animation:'fadeUp 0.6s ease 0.4s both'}}>
        <h2 style={{fontSize:26,fontWeight:800,letterSpacing:'-0.5px',lineHeight:1.2,marginBottom:'0.75rem'}}>
          Trouvez vos partenaires<br />
          business en Suisse<br />
          <span style={{color:'#E24B4A'}}>en 30 secondes</span>
        </h2>
        <p style={{color:'#666',fontSize:14,lineHeight:1.7,maxWidth:300,margin:'0 auto'}}>
          Hubbing est la première app de mise en relation B2B locale en Suisse. Swipez, matchez et collaborez avec les bonnes entreprises près de chez vous.
        </p>
      </div>

      {/* Mockup screenshots */}
      <div style={{display:'flex',gap:10,justifyContent:'center',alignItems:'stretch',animation:'fadeUp 0.6s ease 0.5s both',overflow:'visible',width:'100%',maxWidth:340,minHeight:168,flexShrink:0}}>
        {/* Screenshot 1 - Swipe */}
        <div style={{background:'white',borderRadius:20,padding:'0.75rem',boxShadow:'0 8px 30px rgba(0,0,0,0.12)',width:96,minHeight:160,flexShrink:0,border:'1px solid #f0f0f0',display:'flex',flexDirection:'column'}}>
          <div style={{background:'#E24B4A',borderRadius:12,padding:'0.75rem',marginBottom:8,textAlign:'center'}}>
            <span style={{fontSize:28}}>🏢</span>
          </div>
          <p style={{fontSize:9,fontWeight:700,margin:'0 0 2px',color:'#1a1a1a'}}>Fiduciaire Rochat</p>
          <p style={{fontSize:8,color:'#999',margin:'0 0 6px'}}>Lausanne, VD</p>
          <div style={{display:'flex',justifyContent:'center',gap:6}}>
            <div style={{width:24,height:24,borderRadius:'50%',border:'2px solid #E24B4A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>✗</div>
            <div style={{width:28,height:28,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'white'}}>✓</div>
          </div>
          <p style={{fontSize:8,color:'#E24B4A',fontWeight:600,marginTop:6,textAlign:'center'}}>💼 SWIPE</p>
        </div>

        {/* Screenshot 2 - Match */}
        <div style={{background:'white',borderRadius:20,padding:'0.75rem',boxShadow:'0 8px 30px rgba(0,0,0,0.12)',width:96,minHeight:160,flexShrink:0,border:'1px solid #f0f0f0',display:'flex',flexDirection:'column'}}>
          <div style={{background:'#22c55e',borderRadius:12,padding:'0.5rem',marginBottom:6,textAlign:'center'}}>
            <p style={{color:'white',fontWeight:800,fontSize:11,margin:0}}>🎉 MATCH !</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:6}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:'#185FA5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'white',fontWeight:700}}>TE</div>
            <div style={{width:20,height:20,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'white',fontWeight:700}}>HB</div>
          </div>
          <p style={{fontSize:8,color:'#666',margin:'0 0 6px',lineHeight:1.4}}>TechSoft Zürich AG vous a matché !</p>
          <div style={{background:'#E24B4A',borderRadius:8,padding:'4px',textAlign:'center'}}>
            <p style={{color:'white',fontSize:8,fontWeight:600,margin:0}}>💬 Contacter</p>
          </div>
          <p style={{fontSize:8,color:'#185FA5',fontWeight:600,marginTop:6,textAlign:'center'}}>💬 MESSAGES</p>
        </div>

        {/* Screenshot 3 - Carte */}
        <div style={{background:'white',borderRadius:20,padding:'0.75rem',boxShadow:'0 8px 30px rgba(0,0,0,0.12)',width:96,minHeight:160,flexShrink:0,border:'1px solid #f0f0f0',display:'flex',flexDirection:'column'}}>
          <div style={{background:'#f0f9ff',borderRadius:12,padding:'0.5rem',marginBottom:6,position:'relative',overflow:'hidden',height:50}}>
            {/* Mini carte simulée */}
            <div style={{position:'absolute',top:8,left:12,width:8,height:8,borderRadius:'50%',background:'#E24B4A'}}></div>
            <div style={{position:'absolute',top:20,left:30,width:6,height:6,borderRadius:'50%',background:'#185FA5'}}></div>
            <div style={{position:'absolute',top:12,left:50,width:7,height:7,borderRadius:'50%',background:'#22c55e'}}></div>
            <div style={{position:'absolute',top:25,left:20,width:5,height:5,borderRadius:'50%',background:'#F39C12'}}></div>
            <div style={{position:'absolute',top:8,left:60,width:6,height:6,borderRadius:'50%',background:'#E24B4A'}}></div>
          </div>
          <p style={{fontSize:9,fontWeight:700,margin:'0 0 2px',color:'#1a1a1a'}}>9 entreprises</p>
          <p style={{fontSize:8,color:'#999',margin:'0 0 4px'}}>près de vous</p>
          <div style={{background:'#f5f5f5',borderRadius:6,padding:'3px',textAlign:'center'}}>
            <p style={{fontSize:7,color:'#666',margin:0}}>🔍 VD · Informatique</p>
          </div>
          <p style={{fontSize:8,color:'#22c55e',fontWeight:600,marginTop:6,textAlign:'center'}}>🗺️ CARTE</p>
        </div>
      </div>

      {/* Features */}
      <div style={{display:'flex',flexDirection:'column',gap:12,width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.7s both'}}>
        <Feature icon="💼" title="Swipe B2B" desc="Découvrez des entreprises locales et matchez avec celles qui correspondent à vos besoins en un seul geste." />
        <Feature icon="🗺️" title="Carte interactive" desc="Visualisez toutes les entreprises autour de vous, filtrez par secteur et canton." />
        <Feature icon="💬" title="Messagerie pro" desc="Échangez directement avec vos connexions B2B et partagez des documents en toute sécurité." />
      </div>

      {/* Offre fondateur */}
      <div style={{background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem',width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.8s both'}}>
        <p style={{fontSize:13,color:'#E24B4A',fontWeight:700}}>🎉 Offre Fondateurs — 100 places</p>
        <p style={{fontSize:12,color:'#666',marginTop:4,lineHeight:1.5}}>
          Les 100 premiers abonnés Premium recevront <strong>2 mois d'abonnement Premium offerts</strong>. Ne manquez pas cette opportunité unique !
        </p>
      </div>

      <p style={{fontSize:13,color:'#bbb',animation:'fadeUp 0.6s ease 1s both'}}>
        Des questions ? <a href="mailto:contact@hubbing.ch" style={{color:'#E24B4A',textDecoration:'none',fontWeight:500}}>contact@hubbing.ch</a>
      </p>
      <p style={{fontSize:12,color:'#ccc',textAlign:'center'}}>🇨🇭 Made in Switzerland</p>
      <p style={{fontSize:11,color:'#ddd',textAlign:'center'}}>© {new Date().getFullYear()} Hubbing — Tous droits réservés</p>

      <div style={{position:'fixed',left:'50%',bottom:0,transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'white',borderTop:'1px solid #f0f0f0',boxShadow:'0 -8px 30px rgba(0,0,0,0.08)',padding:'0.9rem 1rem calc(env(safe-area-inset-bottom) + 0.9rem)',zIndex:20}}>
        {!success ? (
          <div style={{display:'flex',flexDirection:'column',gap:'0.6rem'}}>
            <p style={{fontSize:12,fontWeight:600,color:'#1a1a1a',lineHeight:1.4}}>
              Entrez votre adresse email et nous vous informerons du lancement.
            </p>
            <div style={{display:'flex',gap:8}}>
              <input
                className="waitlist-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleWaitlist()}
                placeholder="votre@email.ch"
                type="email"
                style={{flex:1,minWidth:0,padding:'12px',border:'1px solid #ddd',borderRadius:10,fontSize:16,fontFamily:'Plus Jakarta Sans'}}
              />
              <button
                className="waitlist-btn"
                onClick={handleWaitlist}
                disabled={loading}
                style={{padding:'12px 14px',background:'#E24B4A',color:'white',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',transition:'background 0.2s',fontFamily:'Plus Jakarta Sans',whiteSpace:'nowrap'}}>
                {loading ? '...' : "M'informer"}
              </button>
            </div>
            {error && <p style={{color:'#E24B4A',fontSize:12,textAlign:'left'}}>{error}</p>}
          </div>
        ) : (
          <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:12,padding:'0.8rem',textAlign:'center'}}>
            <p style={{fontWeight:700,fontSize:14,color:'#166534'}}>Vous êtes sur la liste !</p>
            <p style={{fontSize:12,color:'#15803d',marginTop:3}}>Nous vous contacterons dès le lancement le 1er mai.</p>
          </div>
        )}
      </div>
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
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 1.25rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',gap:'1.2rem',position:'relative',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top) + 1rem)',right:'1rem'}}>
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

      <img src="/LOGO-HUBBING.svg" alt="Hubbing" style={{width:72,height:72,borderRadius:'50%'}} />
      <h1 style={{fontSize:28,fontWeight:700,color:'#1a1a1a',textAlign:'center'}}>Hubbing</h1>
      <p style={{color:'#666',textAlign:'center',fontSize:15,lineHeight:1.6}}>{t.appTagline}</p>
      <div style={{width:'100%',background:'#FFF5F5',border:'1px solid #FECACA',borderRadius:12,padding:'1rem',textAlign:'center'}}>
        <p style={{fontSize:13,color:'#E24B4A',fontWeight:600}}>{t.founderOffer}</p>
        <p style={{fontSize:12,color:'#666',marginTop:4}}>{t.founderOfferDesc}</p>
      </div>
      <InstallAppButton compact />
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
      {/* Bannière App Store / Google Play */}
      <div style={{background:'#1a1a1a',borderRadius:12,padding:'1rem',width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div>
          <p style={{color:'white',fontWeight:700,fontSize:14,margin:0}}>📱 Application mobile</p>
          <p style={{color:'rgba(255,255,255,0.6)',fontSize:12,marginTop:3}}>Bientôt disponible sur</p>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <div style={{background:'rgba(255,255,255,0.1)',borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:16}}></span>
              <span style={{color:'white',fontSize:11,fontWeight:600}}>App Store</span>
            </div>
            <div style={{background:'rgba(255,255,255,0.1)',borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:16}}>🤖</span>
              <span style={{color:'white',fontSize:11,fontWeight:600}}>Google Play</span>
            </div>
          </div>
        </div>
        <span style={{fontSize:32}}>📲</span>
      </div>
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline'}}>
        {t.legal}
      </button>
      <p style={{fontSize:11,color:'#ccc',textAlign:'center',margin:0}}>© {new Date().getFullYear()} Hubbing — Tous droits réservés</p>
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
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',gap:'1rem',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,alignSelf:'flex-start',padding:'0.25rem 0',marginBottom:'0.5rem'}}>
        {t.back}
      </button>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:'0.5rem'}}>{t.loginTitle}</h2>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} type="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} type="password"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
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
    // Email de confirmation à la personne
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Hubbing <contact@hubbing.ch>',
        to: email,
        subject: '🎉 Vous êtes sur la liste Hubbing !',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
          <img src="https://www.hubbing.ch/LOGO-HUBBING-ICON.svg" width="64" style="border-radius:50%" />
          <h2 style="color:#1a1a1a;margin-top:1rem">Vous êtes sur la liste ! 🎉</h2>
          <p style="color:#666;line-height:1.6">Merci pour votre inscription. Vous serez parmi les premiers à accéder à <strong>Hubbing</strong> dès le lancement le <strong>1er mai 2026</strong>.</p>
          <p style="color:#666;line-height:1.6">En tant que membre de la liste d'attente, vous bénéficierez de l'<strong>offre Fondateurs — 2 mois Premium offerts</strong>.</p>
          <a href="https://www.hubbing.ch" style="display:inline-block;margin-top:1rem;padding:12px 24px;background:#E24B4A;color:white;text-decoration:none;border-radius:10px;font-weight:600">Découvrir Hubbing →</a>
          <p style="color:#bbb;font-size:12px;margin-top:2rem">🇨🇭 Made in Switzerland · <a href="mailto:contact@hubbing.ch" style="color:#bbb">contact@hubbing.ch</a></p>
        </div>`
      })
    })

    // Email de notification à toi
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Hubbing <contact@hubbing.ch>',
        to: 'contact@hubbing.ch',
        subject: `🔔 Nouvel inscrit waitlist : ${email}`,
        html: `<p>Nouvel inscrit sur la waitlist Hubbing :</p><p><strong>${email}</strong></p>`
      })
    })

    await fetch('https://rxjrcbdeyouafhtizneh.supabase.co/functions/v1/waitlist-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })

    setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',gap:'1rem',textAlign:'center',background:'white'}}>
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
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 2.5rem)',gap:'1rem',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch',background:'white'}}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,alignSelf:'flex-start',padding:'0.25rem 0',marginBottom:'0.5rem'}}>
        {t.back}
      </button>
      <h2 style={{fontSize:24,fontWeight:700}}>{t.registerTitle}</h2>
      <p style={{color:'#666',fontSize:13}}>{t.registerSubtitle}</p>

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.5rem'}}>{t.companyInfo}</p>
      <input value={company} onChange={e => setCompany(e.target.value)} placeholder={t.companyName}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      <input value={zefix} onChange={e => handleZefixLookup(e.target.value)} placeholder={t.ideNumber}
  style={{padding:'14px',border:`1px solid ${zefixStatus === 'valid' ? '#22c55e' : zefixStatus === 'invalid' ? '#E24B4A' : '#ddd'}`,borderRadius:10,fontSize:16,outline:'none'}} />
{zefixStatus === 'valid' && <p style={{fontSize:12,color:'#F39C12'}}>⏳ Numéro à vérifier — un email de confirmation vous sera envoyé dans les 24h</p>}
{zefixStatus === 'invalid' && <p style={{fontSize:12,color:'#E24B4A'}}>❌ Format invalide. Utilisez le format CHE-xxx.xxx.xxx (9 chiffres)</p>}
      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rue et numéro *"
  style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
<div style={{display:'flex',gap:8}}>
  <input value={npa} onChange={e => setNpa(e.target.value)} placeholder="NPA *"
    style={{width:100,padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ville *"
    style={{flex:1,padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
</div>
<select value={canton} onChange={e => setCanton(e.target.value)}
  style={{width:'100%',height:54,padding:'0 14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,lineHeight:'22px',outline:'none',backgroundColor:'white',color:canton ? '#111' : '#999',WebkitTextFillColor:canton ? '#111' : '#999',fontFamily:'Plus Jakarta Sans',colorScheme:'light',appearance:'auto',WebkitAppearance:'menulist'}}>
  <option value="" style={{color:'#999',background:'white'}}>Canton *</option>
  {['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'].map(c => (
    <option key={c} value={c} style={{color:'#111',background:'white'}}>{c}</option>
  ))}
</select>

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{t.contactInfo}</p>
      <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder={t.contactName}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder={t.contactTitle}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{t.access}</p>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} type="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} type="password"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />

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

function VisitorMode({ setScreen, t, lang, setLang }) {
  const [activeTab, setActiveTab] = useState('swipe')
  const [showModal, setShowModal] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const ui = getUiText(lang)

  const tabStyle = (tab) => ({
    flex:1, padding:'8px 0 4px', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#999',
    fontWeight: activeTab === tab ? 600 : 400,
    borderTop: activeTab === tab ? '2px solid #E24B4A' : '2px solid transparent',
    fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
    <div style={{
  height:'100dvh',
  display:'flex',
  flexDirection:'column',
  overflow:'hidden',
  background:'white'
}}>
      {showModal && <Modal />}

      <div style={{
  padding:'calc(env(safe-area-inset-top) + 0.55rem) 1rem 0.55rem',
  borderBottom:'1px solid #f0f0f0',
  display:'flex',
  alignItems:'center',
  justifyContent:'space-between',
  flexShrink:0,
  background:'white',
  zIndex:20
}}>
        <div onClick={() => setScreen('home')} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
  <img src="/LOGO-HUBBING.svg" alt="Hubbing" style={{width:32,height:32,borderRadius:'50%'}} />
  <span style={{fontWeight:700,fontSize:16}}>Hubbing</span>
</div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{position:'relative'}}>
            <button onClick={() => setShowLangMenu(!showLangMenu)}
              style={{background:'#f5f5f5',border:'1px solid #eee',borderRadius:20,padding:'5px 10px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
              {lang.toUpperCase()} ▾
            </button>
            {showLangMenu && (
              <div style={{position:'absolute',right:0,top:'110%',background:'white',border:'1px solid #eee',borderRadius:12,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',overflow:'hidden',zIndex:100,minWidth:120}}>
                {[{code:'fr',label:'Français'},{code:'de',label:'Deutsch'},{code:'it',label:'Italiano'},{code:'en',label:'English'}].map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false) }}
                    style={{display:'block',width:'100%',padding:'8px 16px',background: lang === l.code ? '#FFF5F5' : 'white',border:'none',cursor:'pointer',fontSize:13,textAlign:'left',color: lang === l.code ? '#E24B4A' : '#333',fontWeight: lang === l.code ? 600 : 400}}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setScreen('register')}
            style={{background:'#E24B4A',color:'white',border:'none',borderRadius:20,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {t.createAccount}
          </button>
          <button onClick={() => setScreen('login')}
            style={{background:'white',color:'#E24B4A',border:'1px solid #E24B4A',borderRadius:20,padding:'6px 12px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            {t.login}
          </button>
        </div>
      </div>

      <div style={{
  flex:1,
  minHeight:0,
  display:'flex',
  flexDirection:'column',
  overflowY:'auto',
  overflowX:'hidden',
  WebkitOverflowScrolling:'touch',
  paddingBottom:'calc(60px + env(safe-area-inset-bottom))'
}}>
        {activeTab === 'swipe' && <SwipeScreen user={null} setScreen={setScreen} lang={lang} />}
       {activeTab === 'map' && <Suspense fallback={<div>{ui.common.loading}</div>}><MapScreen user={null} setScreen={setScreen} lang={lang} /></Suspense>}
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
              {name:'Starter',price:ui.common.free,color:'#666',features:ui.pricing.starterFeatures.slice(0, 3)},
              {name:'Basic',price:`CHF 19${ui.common.month}`,color:'#185FA5',features:ui.pricing.basicFeatures.slice(0, 3)},
              {name:'Premium',price:`CHF 39${ui.common.month}`,color:'#E24B4A',features:ui.pricing.premiumFeatures.slice(0, 4),highlight:true},
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

      <div style={{
  position:'fixed',
  left:'50%',
  bottom:0,
  transform:'translateX(-50%)',
  width:'100%',
  maxWidth:430,
  borderTop:'1px solid #f0f0f0',
  display:'flex',
  background:'white',
  paddingBottom:'env(safe-area-inset-bottom)',
  flexShrink:0,
  zIndex:9999
}}>
        {[
          {id:'swipe',label:ui.nav.swipe,icon:'💼'},
          {id:'map',label:ui.nav.map,icon:'🗺️'},
          {id:'messages',label:ui.nav.messages,icon:'💬'},
          {id:'pricing',label:ui.nav.pricing,icon:'💳'},
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
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [directMessageCompanyId, setDirectMessageCompanyId] = useState(null)
  const ui = getUiText(lang)

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
  if (tab !== 'messages') setDirectMessageCompanyId(null)
}

  const tabStyle = (tab) => ({
    flex:1, padding:'8px 0 4px', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#999',
    fontWeight: activeTab === tab ? 600 : 400,
    borderTop: activeTab === tab ? '2px solid #E24B4A' : '2px solid transparent',
    fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  })

  return (
    <Suspense fallback={<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100dvh'}}>{ui.common.loading}</div>}>
    <div style={{
  height:'100dvh',
  display:'flex',
  flexDirection:'column',
  overflow:'hidden',
  background:'white'
}}>
      <div style={{
  padding:'calc(env(safe-area-inset-top) + 0.55rem) 1rem 0.55rem',
  borderBottom:'1px solid #f0f0f0',
  display:'flex',
  alignItems:'center',
  justifyContent:'space-between',
  flexShrink:0,
  background:'white',
  zIndex:20
}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div onClick={() => handleTabChange('home')} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
  <img src="/LOGO-HUBBING.svg" alt="Hubbing" style={{width:32,height:32,borderRadius:'50%'}} />
  <span style={{fontWeight:700,fontSize:16}}>Hubbing</span>
</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{position:'relative'}}>
  <button onClick={() => setShowLangMenu(!showLangMenu)}
    style={{background:'#f5f5f5',border:'1px solid #eee',borderRadius:20,padding:'5px 10px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'}}>
    {lang.toUpperCase()} ▾
  </button>
  {showLangMenu && (
    <div style={{position:'absolute',right:0,top:'110%',background:'white',border:'1px solid #eee',borderRadius:12,boxShadow:'0 4px 20px rgba(0,0,0,0.1)',overflow:'hidden',zIndex:100,minWidth:120}}>
      {[{code:'fr',label:'Français'},{code:'de',label:'Deutsch'},{code:'it',label:'Italiano'},{code:'en',label:'English'}].map(l => (
        <button key={l.code} onClick={() => { setLang(l.code); setShowLangMenu(false) }}
          style={{display:'block',width:'100%',padding:'8px 16px',background: lang === l.code ? '#FFF5F5' : 'white',border:'none',cursor:'pointer',fontSize:13,textAlign:'left',color: lang === l.code ? '#E24B4A' : '#333',fontWeight: lang === l.code ? 600 : 400}}>
          {l.label}
        </button>
      ))}
    </div>
  )}
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

      <div style={{
  flex:1,
  minHeight:0,
  display:'flex',
  flexDirection:'column',
  overflowY:'auto',
  overflowX:'hidden',
  WebkitOverflowScrolling:'touch',
  position:'relative',
  paddingBottom:'calc(60px + env(safe-area-inset-bottom))'
}}>
  {selectedCompanyId ? (
    <CompanyProfileScreen
  companyId={selectedCompanyId}
  plan={userPlan}
  lang={lang}
  onBack={() => setSelectedCompanyId(null)}
  setActiveTab={setActiveTab}
  setSelectedCompanyId={setSelectedCompanyId}
  setDirectMessageCompanyId={setDirectMessageCompanyId}
/>
  ) : (
    <>
      {activeTab === 'home' && <HomeScreen user={user} setActiveTab={setActiveTab} setSelectedCompanyId={setSelectedCompanyId} lang={lang} />}
      {activeTab === 'swipe' && <SwipeScreen user={user} lang={lang} />}
      {activeTab === 'map' && <MapScreen user={user} setSelectedCompanyId={setSelectedCompanyId} setActiveTab={setActiveTab} lang={lang} />}
      {activeTab === 'messages' && <MessagesScreen user={user} plan={userPlan} setSelectedCompanyId={setSelectedCompanyId} setActiveTab={setActiveTab} openMatchWithCompanyId={directMessageCompanyId} onDirectOpenHandled={() => setDirectMessageCompanyId(null)} lang={lang} />}
      {activeTab === 'pricing' && <PricingScreen user={user} setActiveTab={setActiveTab} lang={lang} />}
      {activeTab === 'profile' && <ProfileScreen user={user} setActiveTab={setActiveTab} lang={lang} />}
    </>
  )}
</div>

      <div style={{
  position:'fixed',
  left:'50%',
  bottom:0,
  transform:'translateX(-50%)',
  width:'100%',
  maxWidth:430,
  borderTop:'1px solid #f0f0f0',
  display:'flex',
  background:'white',
  paddingBottom:'env(safe-area-inset-bottom)',
  flexShrink:0,
  zIndex:9999
}}>
  {[
    {id:'home',label:ui.nav.home,icon:'🏠'},
    {id:'swipe',label:ui.nav.swipe,icon:'💼'},
    {id:'map',label:ui.nav.map,icon:'🗺️'},
    {id:'messages',label:ui.nav.messages,icon:'💬'},
    {id:'profile',label:ui.nav.profile,icon:'👤'},
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
    </Suspense>
  )
}
