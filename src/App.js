import React, { useState, useEffect, useRef, Suspense } from 'react'
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
import { geocodeSwissAddress } from './geo'
import { isNativeApp } from './platform'
import { notifyTelegramActivity } from './telegramAlerts'
import { HubbingIcon } from './icons'
import { VerifiedBadge } from './VerifiedBadge'
import { clearAppBadge, showNativeNotification, syncUnreadAppBadge } from './appBadge'
import { registerPushNotifications } from './pushNotifications'
import UsageGuideModal from './UsageGuideModal'
import LoadingIndicator from './LoadingIndicator'

const MapScreen = React.lazy(() => import('./MapScreen'))
const APP_STORE_URL = 'https://apps.apple.com/ch/app/hubbing/id6762903411'
const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
const PRIVACY_POLICY_URL = 'https://app.hubbing.ch/privacy.html'
const SESSION_IDLE_LIMIT_MS = 30 * 60 * 1000
const SESSION_LOCK_TTL_MINUTES = 35
const ENFORCE_SINGLE_DEVICE_LOCK = false
const ENABLE_INACTIVITY_SIGNOUT = false
const PUBLIC_SCREENS = ['home', 'login', 'register', 'visitor', 'legal', 'privacy', 'forgot-password', 'reset-password', 'verification-result']
const URL_SCREEN_SCREENS = ['login', 'register', 'visitor', 'legal', 'privacy', 'forgot-password', 'reset-password', 'verification-result']
const sessionTokenFallbacks = new Map()
const REGISTRATION_DRAFT_KEY = 'hubbing_registration_draft'

const signOutCurrentBrowser = () => supabase.auth.signOut({ scope: 'local' })

const clearHubbingStorage = (storage) => {
  if (!storage) return
  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index)
      const normalizedKey = String(key || '').toLowerCase()
      if (
        normalizedKey.startsWith('sb-') ||
        normalizedKey.startsWith('hubbing_') ||
        normalizedKey.includes('supabase')
      ) {
        storage.removeItem(key)
      }
    }
  } catch (error) {
    console.warn('Unable to clear local storage:', error)
  }
}

const repairLocalBrowserSession = async () => {
  try {
    await signOutCurrentBrowser()
  } catch (error) {
    console.warn('Unable to sign out local browser session:', error)
  }

  clearHubbingStorage(window.localStorage)
  clearHubbingStorage(window.sessionStorage)

  if (window.caches?.keys) {
    try {
      const cacheNames = await window.caches.keys()
      await Promise.all(cacheNames.map(cacheName => window.caches.delete(cacheName)))
    } catch (error) {
      console.warn('Unable to clear browser caches:', error)
    }
  }

  if (window.navigator?.serviceWorker?.getRegistrations) {
    try {
      const registrations = await window.navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))
    } catch (error) {
      console.warn('Unable to unregister service workers:', error)
    }
  }
}

const readRegistrationDraft = () => {
  try {
    return JSON.parse(window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

const getPasswordResetRedirectUrl = () => {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('screen', 'reset-password')
  return url.toString()
}

const COMPANY_SECTORS = [
  'Fiduciaire & Comptabilité',
  'Design & Créatif',
  'Informatique & Tech',
  'BTP & Construction',
  'Marketing & Publicité',
  'Ressources Humaines',
  'Transport & Déménagement',
  'Services aux entreprises',
  'Architecture & Urbanisme',
  'Assurance & Prévoyance',
  'Automobile & Mobilité',
  'Banque & Finance',
  'Chimie & Pharmacie',
  'Commerce de détail',
  'Communication & PR',
  'Conseil & Stratégie',
  'Distribution & Logistique',
  'Droit & Juridique',
  'E-commerce',
  'Éducation & Formation',
  'Energie & Environnement',
  'Hôtellerie & Restauration',
  'Immobilier',
  'Import & Export',
  'Imprimerie & Édition',
  'Industrie & Manufacturing',
  'Luxe & Horlogerie',
  'Médias & Presse',
  'Médical & Clinique',
  'Nettoyage & Facility',
  'Optique & Lunetterie',
  'Santé & Bien-être',
  'Sanitaire & Plomberie',
  'Sécurité & Surveillance',
  'Sport & Loisirs',
  'Telecommunications',
  'Textile & Mode',
  'Tourisme & Voyages',
  'Agriculture & Viticulture',
  'Arts & Culture',
  'Autre',
]

const getStoredSessionToken = (userId) => {
  const key = `hubbing_session_token_${userId}`
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return existing
  } catch (error) {
    console.warn('Session token storage unavailable:', error)
  }

  const fallbackToken = sessionTokenFallbacks.get(userId)
  if (fallbackToken) return fallbackToken

  const token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  sessionTokenFallbacks.set(userId, token)
  try {
    window.localStorage.setItem(key, token)
  } catch (error) {
    console.warn('Unable to persist session token:', error)
  }
  return token
}

const getDeviceLabel = () => {
  const ua = window.navigator?.userAgent || ''
  const surface = isNativeApp() ? 'App iOS' : 'Web'
  if (/iPad/i.test(ua)) return `${surface} iPad`
  if (/iPhone/i.test(ua)) return `${surface} iPhone`
  if (/Macintosh|Mac OS/i.test(ua)) return `${surface} Mac`
  return surface
}

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
    createAccount: 'Créer un compte',
    login: 'Se connecter',
    visitorMode: 'Continuer en mode visiteur',
    usageGuide: "Mode d'emploi",
    usageGuideTitle: "Mode d'emploi Hubbing",
    usageGuideIntro: 'Un repère rapide pour comprendre les menus avant de créer votre compte.',
    usageGuideClose: "Fermer le mode d'emploi",
    usageGuideSteps: [
      { title: 'Accueil', body: 'Retrouvez votre résumé, votre profil et les prochaines actions importantes.' },
      { title: 'Swipe', body: 'Parcourez les entreprises, filtrez par secteur, canton, rayon ou besoin, puis matchez les bons partenaires.' },
      { title: 'Carte', body: 'Visualisez les entreprises suisses autour de vous et ouvrez leur profil depuis la carte.' },
      { title: 'Messages', body: 'Échangez avec vos connexions, suivez les messages lus et gardez vos conversations organisées.' },
      { title: 'Profil', body: 'Mettez à jour vos informations, vos besoins B2B, vos visuels et vos préférences.' },
      { title: 'Tarifs', body: 'Comparez Starter, Basic et Premium pour choisir le niveau adapté à votre visibilité.' },
    ],
    planPreviewCta: 'Voir les tarifs',
    planPreviews: [
      { id: 'starter', name: 'Starter', price: 'Gratuit', detail: 'Découvrir' },
      { id: 'basic', name: 'Basic', price: 'CHF 19.-/mois', detail: 'Messages illimités' },
      { id: 'premium', name: 'Premium', price: 'CHF 39.-/mois', detail: 'Coordonnées complètes' },
    ],
    legal: 'CGU · Confidentialité · Mentions légales',
    registerTitle: 'Créer un compte',
    registerSubtitle: 'Réservé aux entreprises enregistrées en Suisse',
    companyInfo: 'INFORMATIONS ENTREPRISE',
    companyName: "Nom de l'entreprise *",
    sector: "Secteur d'activité *",
    ideNumber: 'Numéro IDE (CHE-xxx.xxx.xxx) *',
    companyAddress: "Adresse de l'entreprise *",
    contactInfo: 'DÉCIDEUR / CONTACT PRINCIPAL',
    contactName: 'Nom et prénom du décideur *',
    contactTitle: 'Titre du poste (CEO, Directeur...) *',
    access: 'ACCÈS',
    email: 'Email professionnel *',
    password: 'Mot de passe (min. 6 caractères) *',
    showPassword: 'Afficher',
    hidePassword: 'Masquer',
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
    forgotPassword: 'Mot de passe oublié ?',
    repairLogin: 'Réparer la connexion sur cet appareil',
    repairingLogin: 'Nettoyage...',
    resetPasswordTitle: 'Réinitialiser le mot de passe',
    resetPasswordIntro: 'Entrez votre email professionnel. Si un compte existe, vous recevrez un lien sécurisé pour choisir un nouveau mot de passe.',
    resetPasswordEmailSent: 'Si un compte existe pour cette adresse, un email de réinitialisation vient d’être envoyé. Vérifiez aussi vos spams.',
    sendResetLink: 'Envoyer le lien',
    sendingResetLink: 'Envoi...',
    backToLogin: 'Retour à la connexion',
    newPasswordTitle: 'Nouveau mot de passe',
    newPasswordIntro: 'Choisissez un nouveau mot de passe pour sécuriser votre compte Hubbing.',
    newPassword: 'Nouveau mot de passe (min. 8 caractères)',
    confirmPassword: 'Confirmer le mot de passe',
    passwordMismatch: 'Les mots de passe ne correspondent pas.',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
    updatePassword: 'Mettre à jour le mot de passe',
    updatingPassword: 'Mise à jour...',
    passwordUpdated: 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.',
    resetLinkInvalid: 'Lien de réinitialisation invalide ou expiré. Demandez un nouveau lien.',
    successTitle: 'Compte créé !',
    successMsg: 'Un email de confirmation vous a été envoyé. Cliquez sur le lien pour activer votre compte.',
    successBtn: 'Se connecter',
    errorFields: 'Veuillez remplir tous les champs obligatoires',
    errorCGU: 'Veuillez accepter les CGU pour continuer',
    errorEmail: 'Veuillez utiliser votre email professionnel (ex: vous@votreentreprise.ch)',
    errorEmailAlreadyUsed: 'Cet email est déjà utilisé. Connectez-vous ou utilisez la réinitialisation du mot de passe.',
    errorZefix: 'Numéro IDE introuvable. Vérifiez que votre entreprise est enregistrée en Suisse.',
    errorIdeAlreadyUsed: 'Ce numéro IDE est déjà utilisé sur Hubbing. Si cette entreprise vous appartient, connectez-vous ou contactez Hubbing.',
    errorZefixNotFound: 'Entreprise non trouvée dans le registre suisse (Zefix).',
    errorZefixInactive: "Cette entreprise n'est pas active dans Zefix. Contactez Hubbing si c'est une erreur.",
    errorZefixMismatch: "Les informations saisies ne correspondent pas aux données Zefix. Utilisez le nom et l'adresse officiels de l'entreprise ou contactez Hubbing.",
    errorEmailCompanyMismatch: "L'email professionnel ne semble pas correspondre à l'entreprise indiquée dans Zefix. Utilisez une adresse email de l'entreprise ou contactez Hubbing.",
    errorZefixRetry: 'Impossible de vérifier le numéro IDE. Réessayez.',
    zefixValidFormat: "Numéro IDE au bon format — vérification Zefix au moment de l'inscription",
    zefixChecking: 'Vérification Zefix en cours...',
    zefixVerified: (name) => `Entreprise vérifiée via Zefix${name ? ` : ${name}` : ''}`,
    zefixManualFallback: 'Vérification Zefix temporairement indisponible — contrôle manuel sous 24 à 48h ouvrables',
    sessionAlreadyOpen: 'Votre compte est déjà ouvert sur un autre appareil. Déconnectez-vous de cet appareil ou réessayez dans 30 minutes.',
    sessionExpired: 'Vous avez été déconnecté après 30 minutes d’inactivité.',
    notificationNewMessageTitle: 'Nouveau message Hubbing',
    notificationNewMessageBody: 'Vous avez reçu un nouveau message.',
    notificationNewMatchTitle: 'Nouveau match Hubbing',
    notificationNewMatchBody: 'Une entreprise vient de matcher avec vous.',
    demoMode: 'Mode visiteur',
    demoSwipe: 'Mode visiteur — connectez-vous pour matcher',
    demoMap: 'Mode visiteur — connectez-vous pour voir toutes les entreprises',
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
    changeLanguage: 'Langue',
  },
  de: {
    appTagline: 'Das B2B-Netzwerk für Schweizer Unternehmen',
    createAccount: 'Konto erstellen',
    login: 'Anmelden',
    visitorMode: 'Als Besucher fortfahren',
    usageGuide: 'Anleitung',
    usageGuideTitle: 'So nutzen Sie Hubbing',
    usageGuideIntro: 'Eine kurze Übersicht über die Menüs, bevor Sie ein Konto erstellen.',
    usageGuideClose: 'Anleitung schliessen',
    usageGuideSteps: [
      { title: 'Start', body: 'Sehen Sie Ihre Übersicht, Ihr Profil und die nächsten wichtigen Aktionen.' },
      { title: 'Swipe', body: 'Entdecken Sie Unternehmen, filtern Sie nach Branche, Kanton, Radius oder Bedarf und matchen Sie passende Partner.' },
      { title: 'Karte', body: 'Sehen Sie Schweizer Unternehmen auf der Karte und öffnen Sie deren Profil direkt.' },
      { title: 'Nachrichten', body: 'Tauschen Sie sich mit Ihren Kontakten aus und behalten Sie Unterhaltungen im Blick.' },
      { title: 'Profil', body: 'Aktualisieren Sie Unternehmensdaten, B2B-Bedarf, Bilder und Einstellungen.' },
      { title: 'Preise', body: 'Vergleichen Sie Starter, Basic und Premium für die passende Sichtbarkeit.' },
    ],
    planPreviewCta: 'Preise ansehen',
    planPreviews: [
      { id: 'starter', name: 'Starter', price: 'Gratis', detail: 'Entdecken' },
      { id: 'basic', name: 'Basic', price: 'CHF 19.-/Monat', detail: 'Unbegrenzte Nachrichten' },
      { id: 'premium', name: 'Premium', price: 'CHF 39.-/Monat', detail: 'Vollständige Kontakte' },
    ],
    legal: 'AGB · Datenschutz · Impressum',
    registerTitle: 'Konto erstellen',
    registerSubtitle: 'Nur für in der Schweiz registrierte Unternehmen',
    companyInfo: 'UNTERNEHMENSINFORMATIONEN',
    companyName: 'Unternehmensname *',
    sector: 'Branche *',
    ideNumber: 'UID-Nummer (CHE-xxx.xxx.xxx) *',
    companyAddress: 'Unternehmensadresse *',
    contactInfo: 'ENTSCHEIDUNGSTRÄGER / HAUPTKONTAKT',
    contactName: 'Vor- und Nachname *',
    contactTitle: 'Berufsbezeichnung (CEO, Direktor...) *',
    access: 'ZUGANG',
    email: 'Geschäftliche E-Mail *',
    password: 'Passwort (mind. 6 Zeichen) *',
    showPassword: 'Anzeigen',
    hidePassword: 'Verbergen',
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
    forgotPassword: 'Passwort vergessen?',
    repairLogin: 'Anmeldung auf diesem Gerät reparieren',
    repairingLogin: 'Bereinigung...',
    resetPasswordTitle: 'Passwort zurücksetzen',
    resetPasswordIntro: 'Geben Sie Ihre geschäftliche E-Mail ein. Falls ein Konto existiert, erhalten Sie einen sicheren Link.',
    resetPasswordEmailSent: 'Falls ein Konto für diese Adresse existiert, wurde ein Link zum Zurücksetzen gesendet. Prüfen Sie auch den Spam-Ordner.',
    sendResetLink: 'Link senden',
    sendingResetLink: 'Wird gesendet...',
    backToLogin: 'Zurück zur Anmeldung',
    newPasswordTitle: 'Neues Passwort',
    newPasswordIntro: 'Wählen Sie ein neues Passwort für Ihr Hubbing-Konto.',
    newPassword: 'Neues Passwort (mind. 8 Zeichen)',
    confirmPassword: 'Passwort bestätigen',
    passwordMismatch: 'Die Passwörter stimmen nicht überein.',
    passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen enthalten.',
    updatePassword: 'Passwort aktualisieren',
    updatingPassword: 'Aktualisierung...',
    passwordUpdated: 'Passwort aktualisiert. Sie können sich jetzt anmelden.',
    resetLinkInvalid: 'Ungültiger oder abgelaufener Link. Fordern Sie einen neuen Link an.',
    successTitle: 'Konto erstellt!',
    successMsg: 'Eine Bestätigungs-E-Mail wurde gesendet. Klicken Sie auf den Link, um Ihr Konto zu aktivieren.',
    successBtn: 'Anmelden',
    errorFields: 'Bitte füllen Sie alle Pflichtfelder aus',
    errorCGU: 'Bitte akzeptieren Sie die AGB',
    errorEmail: 'Bitte verwenden Sie Ihre geschäftliche E-Mail (z.B. sie@ihrfirma.ch)',
    errorEmailAlreadyUsed: 'Diese E-Mail wird bereits verwendet. Melden Sie sich an oder setzen Sie Ihr Passwort zurück.',
    errorZefix: 'UID-Nummer nicht gefunden. Prüfen Sie, ob Ihr Unternehmen in der Schweiz registriert ist.',
    errorIdeAlreadyUsed: 'Diese UID-Nummer wird bereits auf Hubbing verwendet. Melden Sie sich an oder kontaktieren Sie Hubbing.',
    errorZefixNotFound: 'Unternehmen nicht im Schweizer Register (Zefix) gefunden.',
    errorZefixInactive: 'Dieses Unternehmen ist in Zefix nicht aktiv. Kontaktieren Sie Hubbing, falls dies ein Fehler ist.',
    errorZefixMismatch: 'Die eingegebenen Angaben stimmen nicht mit den Zefix-Daten überein. Verwenden Sie den offiziellen Namen und die offizielle Adresse oder kontaktieren Sie Hubbing.',
    errorEmailCompanyMismatch: 'Die geschäftliche E-Mail scheint nicht zum in Zefix angegebenen Unternehmen zu passen. Verwenden Sie eine Firmen-E-Mail oder kontaktieren Sie Hubbing.',
    errorZefixRetry: 'UID-Nummer konnte nicht verifiziert werden. Versuchen Sie es erneut.',
    zefixValidFormat: 'UID-Nummer im richtigen Format — Zefix-Prüfung bei der Registrierung',
    zefixChecking: 'Zefix-Prüfung läuft...',
    zefixVerified: (name) => `Unternehmen via Zefix verifiziert${name ? `: ${name}` : ''}`,
    zefixManualFallback: 'Zefix-Prüfung vorübergehend nicht verfügbar — manuelle Prüfung innerhalb von 24 bis 48 Arbeitsstunden',
    sessionAlreadyOpen: 'Ihr Konto ist bereits auf einem anderen Gerät geöffnet. Melden Sie sich dort ab oder versuchen Sie es in 30 Minuten erneut.',
    sessionExpired: 'Sie wurden nach 30 Minuten Inaktivität abgemeldet.',
    notificationNewMessageTitle: 'Neue Hubbing-Nachricht',
    notificationNewMessageBody: 'Sie haben eine neue Nachricht erhalten.',
    notificationNewMatchTitle: 'Neues Hubbing-Match',
    notificationNewMatchBody: 'Ein Unternehmen hat gerade mit Ihnen gematcht.',
    demoMode: 'Besucher-Modus',
    demoSwipe: 'Besucher-Modus — anmelden zum Matchen',
    demoMap: 'Besucher-Modus — anmelden für alle Unternehmen',
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
    changeLanguage: 'Sprache',
  },
  it: {
    appTagline: 'La rete B2B per le aziende svizzere',
    createAccount: 'Crea un account',
    login: 'Accedi',
    visitorMode: 'Continua in modalità visitatore',
    usageGuide: "Guida all'uso",
    usageGuideTitle: 'Come usare Hubbing',
    usageGuideIntro: 'Una panoramica rapida dei menu prima di creare il tuo account.',
    usageGuideClose: 'Chiudi la guida',
    usageGuideSteps: [
      { title: 'Home', body: 'Trova il riepilogo, il profilo e le prossime azioni importanti.' },
      { title: 'Swipe', body: 'Scopri aziende, filtra per settore, cantone, raggio o bisogno e crea match utili.' },
      { title: 'Mappa', body: 'Visualizza le aziende svizzere sulla mappa e apri il loro profilo.' },
      { title: 'Messaggi', body: 'Scambia messaggi con le connessioni e tieni ordinate le conversazioni.' },
      { title: 'Profilo', body: 'Aggiorna dati aziendali, bisogni B2B, immagini e preferenze.' },
      { title: 'Tariffe', body: 'Confronta Starter, Basic e Premium per scegliere la visibilità giusta.' },
    ],
    planPreviewCta: 'Vedi tariffe',
    planPreviews: [
      { id: 'starter', name: 'Starter', price: 'Gratis', detail: 'Scoprire' },
      { id: 'basic', name: 'Basic', price: 'CHF 19.-/mese', detail: 'Messaggi illimitati' },
      { id: 'premium', name: 'Premium', price: 'CHF 39.-/mese', detail: 'Contatti completi' },
    ],
    legal: 'CGU · Privacy · Note legali',
    registerTitle: 'Crea un account',
    registerSubtitle: 'Riservato alle aziende registrate in Svizzera',
    companyInfo: 'INFORMAZIONI AZIENDALI',
    companyName: "Nome dell'azienda *",
    sector: 'Settore di attività *',
    ideNumber: 'Numero IDE (CHE-xxx.xxx.xxx) *',
    companyAddress: "Indirizzo dell'azienda *",
    contactInfo: 'RESPONSABILE / CONTATTO PRINCIPALE',
    contactName: 'Nome e cognome *',
    contactTitle: 'Titolo (CEO, Direttore...) *',
    access: 'ACCESSO',
    email: 'Email professionale *',
    password: 'Password (min. 6 caratteri) *',
    showPassword: 'Mostra',
    hidePassword: 'Nascondi',
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
    forgotPassword: 'Password dimenticata?',
    repairLogin: "Riparare l'accesso su questo dispositivo",
    repairingLogin: 'Pulizia...',
    resetPasswordTitle: 'Reimposta la password',
    resetPasswordIntro: "Inserisci l'email professionale. Se esiste un account, riceverai un link sicuro.",
    resetPasswordEmailSent: 'Se esiste un account per questo indirizzo, è stato inviato un link. Controlla anche lo spam.',
    sendResetLink: 'Invia il link',
    sendingResetLink: 'Invio...',
    backToLogin: "Torna all'accesso",
    newPasswordTitle: 'Nuova password',
    newPasswordIntro: 'Scegli una nuova password per il tuo account Hubbing.',
    newPassword: 'Nuova password (min. 8 caratteri)',
    confirmPassword: 'Conferma la password',
    passwordMismatch: 'Le password non corrispondono.',
    passwordTooShort: 'La password deve contenere almeno 8 caratteri.',
    updatePassword: 'Aggiorna password',
    updatingPassword: 'Aggiornamento...',
    passwordUpdated: 'Password aggiornata. Ora puoi accedere.',
    resetLinkInvalid: 'Link non valido o scaduto. Richiedi un nuovo link.',
    successTitle: 'Account creato!',
    successMsg: "Un'email di conferma è stata inviata. Clicca sul link per attivare il tuo account.",
    successBtn: 'Accedi',
    errorFields: 'Si prega di compilare tutti i campi obbligatori',
    errorCGU: 'Si prega di accettare i CGU per continuare',
    errorEmail: "Utilizzare l'email professionale (es: voi@vostraazienda.ch)",
    errorEmailAlreadyUsed: 'Questa email è già utilizzata. Accedi o reimposta la password.',
    errorZefix: 'Numero IDE non trovato. Verificare che la sua azienda sia registrata in Svizzera.',
    errorIdeAlreadyUsed: 'Questo numero IDE è già utilizzato su Hubbing. Accedi o contatta Hubbing.',
    errorZefixNotFound: 'Azienda non trovata nel registro svizzero (Zefix).',
    errorZefixInactive: 'Questa azienda non è attiva in Zefix. Contatta Hubbing se si tratta di un errore.',
    errorZefixMismatch: "Le informazioni inserite non corrispondono ai dati Zefix. Usa il nome e l'indirizzo ufficiali dell'azienda o contatta Hubbing.",
    errorEmailCompanyMismatch: "L'email professionale non sembra corrispondere all'azienda indicata in Zefix. Usa un indirizzo email aziendale o contatta Hubbing.",
    errorZefixRetry: 'Impossibile verificare il numero IDE. Riprovare.',
    zefixValidFormat: "Numero IDE nel formato corretto — verifica Zefix durante l'iscrizione",
    zefixChecking: 'Verifica Zefix in corso...',
    zefixVerified: (name) => `Azienda verificata tramite Zefix${name ? `: ${name}` : ''}`,
    zefixManualFallback: 'Verifica Zefix temporaneamente non disponibile — controllo manuale entro 24-48 ore lavorative',
    sessionAlreadyOpen: 'Il tuo account è già aperto su un altro dispositivo. Disconnettiti da quel dispositivo o riprova tra 30 minuti.',
    sessionExpired: 'Sei stato disconnesso dopo 30 minuti di inattività.',
    notificationNewMessageTitle: 'Nuovo messaggio Hubbing',
    notificationNewMessageBody: 'Hai ricevuto un nuovo messaggio.',
    notificationNewMatchTitle: 'Nuovo match Hubbing',
    notificationNewMatchBody: "Un'azienda ha appena fatto match con te.",
    demoMode: 'Modalità visitatore',
    demoSwipe: 'Modalità visitatore — accedi per fare match',
    demoMap: 'Modalità visitatore — accedi per vedere tutte le aziende',
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
    changeLanguage: 'Lingua',
  },
  en: {
    appTagline: 'The B2B network for Swiss companies',
    createAccount: 'Create an account',
    login: 'Log in',
    visitorMode: 'Continue as visitor',
    usageGuide: 'User guide',
    usageGuideTitle: 'How to use Hubbing',
    usageGuideIntro: 'A quick overview of the menus before creating your account.',
    usageGuideClose: 'Close guide',
    usageGuideSteps: [
      { title: 'Home', body: 'Find your summary, profile status and the next important actions.' },
      { title: 'Swipe', body: 'Browse companies, filter by sector, canton, radius or need, then match useful partners.' },
      { title: 'Map', body: 'See Swiss companies on the map and open their profile directly.' },
      { title: 'Messages', body: 'Exchange messages with your connections and keep conversations organized.' },
      { title: 'Profile', body: 'Update company details, B2B needs, visuals and preferences.' },
      { title: 'Pricing', body: 'Compare Starter, Basic and Premium to choose the right visibility level.' },
    ],
    planPreviewCta: 'View pricing',
    planPreviews: [
      { id: 'starter', name: 'Starter', price: 'Free', detail: 'Discover' },
      { id: 'basic', name: 'Basic', price: 'CHF 19.-/month', detail: 'Unlimited messages' },
      { id: 'premium', name: 'Premium', price: 'CHF 39.-/month', detail: 'Full contact details' },
    ],
    legal: 'T&C · Privacy · Legal notice',
    registerTitle: 'Create an account',
    registerSubtitle: 'Reserved for companies registered in Switzerland',
    companyInfo: 'COMPANY INFORMATION',
    companyName: 'Company name *',
    sector: 'Business sector *',
    ideNumber: 'IDE number (CHE-xxx.xxx.xxx) *',
    companyAddress: 'Company address *',
    contactInfo: 'DECISION MAKER / MAIN CONTACT',
    contactName: 'Full name *',
    contactTitle: 'Job title (CEO, Director...) *',
    access: 'ACCESS',
    email: 'Professional email *',
    password: 'Password (min. 6 characters) *',
    showPassword: 'Show',
    hidePassword: 'Hide',
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
    forgotPassword: 'Forgot password?',
    repairLogin: 'Repair login on this device',
    repairingLogin: 'Cleaning...',
    resetPasswordTitle: 'Reset password',
    resetPasswordIntro: 'Enter your professional email. If an account exists, you will receive a secure link.',
    resetPasswordEmailSent: 'If an account exists for this address, a reset email has been sent. Please also check spam.',
    sendResetLink: 'Send link',
    sendingResetLink: 'Sending...',
    backToLogin: 'Back to login',
    newPasswordTitle: 'New password',
    newPasswordIntro: 'Choose a new password for your Hubbing account.',
    newPassword: 'New password (min. 8 characters)',
    confirmPassword: 'Confirm password',
    passwordMismatch: 'Passwords do not match.',
    passwordTooShort: 'Password must contain at least 8 characters.',
    updatePassword: 'Update password',
    updatingPassword: 'Updating...',
    passwordUpdated: 'Password updated. You can now log in.',
    resetLinkInvalid: 'Invalid or expired reset link. Request a new link.',
    successTitle: 'Account created!',
    successMsg: 'A confirmation email has been sent. Click the link to activate your account.',
    successBtn: 'Log in',
    errorFields: 'Please fill in all required fields',
    errorCGU: 'Please accept the T&C to continue',
    errorEmail: 'Please use your professional email (e.g. you@yourcompany.ch)',
    errorEmailAlreadyUsed: 'This email is already used. Log in or reset your password.',
    errorZefix: 'IDE number not found. Check that your company is registered in Switzerland.',
    errorIdeAlreadyUsed: 'This IDE number is already used on Hubbing. Log in or contact Hubbing.',
    errorZefixNotFound: 'Company not found in the Swiss register (Zefix).',
    errorZefixInactive: 'This company is not active in Zefix. Contact Hubbing if this is an error.',
    errorZefixMismatch: 'The submitted details do not match the Zefix data. Use the official company name and address or contact Hubbing.',
    errorEmailCompanyMismatch: 'The professional email does not seem to match the company listed in Zefix. Use a company email address or contact Hubbing.',
    errorZefixRetry: 'Unable to verify IDE number. Please try again.',
    zefixValidFormat: 'IDE number format is valid — Zefix verification will run during registration',
    zefixChecking: 'Checking Zefix...',
    zefixVerified: (name) => `Company verified through Zefix${name ? `: ${name}` : ''}`,
    zefixManualFallback: 'Zefix verification temporarily unavailable — manual review within 24 to 48 business hours',
    sessionAlreadyOpen: 'Your account is already open on another device. Sign out there or try again in 30 minutes.',
    sessionExpired: 'You were signed out after 30 minutes of inactivity.',
    notificationNewMessageTitle: 'New Hubbing message',
    notificationNewMessageBody: 'You received a new message.',
    notificationNewMatchTitle: 'New Hubbing match',
    notificationNewMatchBody: 'A company just matched with you.',
    demoMode: 'Visitor mode',
    demoSwipe: 'Visitor mode — log in to match',
    demoMap: 'Visitor mode — log in to see all companies',
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
    changeLanguage: 'Language',
  }
}

export default function App() {
  const [screen, setScreenState] = useState(() => {
    const requestedScreen = new URLSearchParams(window.location.search).get('screen')
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (hashParams.get('type') === 'recovery') return 'reset-password'
    return PUBLIC_SCREENS.includes(requestedScreen) ? requestedScreen : 'home'
  })
  const [visitorInitialTab, setVisitorInitialTab] = useState('swipe')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState('fr')
  const hostname = window.location.hostname.toLowerCase()
  const isStandalonePwa = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator?.standalone === true
  const isMarketingSite = (hostname === 'hubbing.ch' || hostname === 'www.hubbing.ch') && !isStandalonePwa
  const t = translations[lang]
  const setScreen = (nextScreenOrUpdater) => {
    setScreenState(currentScreen => {
      const nextScreen = typeof nextScreenOrUpdater === 'function'
        ? nextScreenOrUpdater(currentScreen)
        : nextScreenOrUpdater

      if (PUBLIC_SCREENS.includes(nextScreen)) {
        const url = new URL(window.location.href)
        if (URL_SCREEN_SCREENS.includes(nextScreen)) {
          url.searchParams.set('screen', nextScreen)
        } else {
          url.searchParams.delete('screen')
        }
        if (nextScreen !== 'verification-result') {
          ;['tone', 'status', 'title', 'message'].forEach(param => url.searchParams.delete(param))
        }
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      }

      return nextScreen
    })
  }

  useEffect(() => {
    if (isNativeApp()) return
    notifyTelegramActivity('visit', {
      source: isMarketingSite ? 'marketing' : 'app',
    }, {
      cooldownMinutes: 15,
      cooldownKey: `visit_${hostname}_${window.location.pathname}`,
    })
  }, [hostname, isMarketingSite])

  useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  if (!isNativeApp() && params.get('repair') === '1') {
    repairLocalBrowserSession().finally(() => {
      window.history.replaceState({}, '', window.location.pathname)
      window.location.reload()
    })
    return undefined
  }

  supabase.auth.getSession().then(async ({ data: { session } }) => {
    setUser(currentUser => session?.user ?? currentUser)
    // Vérifier si retour de paiement web
    const paymentStatus = params.get('payment')
    const paymentPlan = params.get('plan')
    if (paymentStatus === 'success' && paymentPlan && session?.user) {
      await supabase.from('subscriptions').upsert({
        user_id: session.user.id,
        plan: paymentPlan,
        status: 'active',
        is_founder: false,
        current_period_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }, { onConflict: 'user_id' })
      alert(`✅ Abonnement ${paymentPlan} activé avec succès !`)
      window.history.replaceState({}, '', window.location.pathname)
    }
    
    setLoading(false)
  }).catch(error => {
    console.warn('Unable to restore auth session:', error)
    setLoading(false)
  })
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') setScreen('reset-password')
    if (session?.user) {
      setUser(session.user)
      return
    }
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      setUser(null)
      clearAppBadge()
    }
  })
  return () => subscription.unsubscribe()
}, [])
  if (loading) return <LoadingIndicator fullScreen background="white" />
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
) : screen === 'forgot-password' ? (
          <ForgotPasswordScreen setScreen={setScreen} t={t} />
) : screen === 'reset-password' ? (
          <ResetPasswordScreen setScreen={setScreen} t={t} />
) : screen === 'verification-result' ? (
          <VerificationResultScreen setScreen={setScreen} />
) : user ? (
  <Dashboard user={user} setUser={setUser} t={t} lang={lang} setLang={setLang} />
) : screen === 'home' ? (
          <LandingScreen setScreen={setScreen} setVisitorInitialTab={setVisitorInitialTab} t={t} lang={lang} setLang={setLang} />
        ) : screen === 'login' ? (
          <LoginScreen setScreen={setScreen} setUser={setUser} t={t} />
        ) : screen === 'register' ? (
          <RegisterScreen setScreen={setScreen} t={t} />
        ) : screen === 'visitor' ? (
          <VisitorMode setScreen={setScreen} initialTab={visitorInitialTab} t={t} lang={lang} setLang={setLang} />
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

function VerificationResultScreen({ setScreen }) {
  const params = new URLSearchParams(window.location.search)
  const title = params.get('title') || 'Validation Hubbing'
  const message = params.get('message') || 'La demande de validation a été traitée.'
  const tone = params.get('tone') === 'error' ? 'error' : 'success'
  const color = tone === 'error' ? '#E24B4A' : '#16a34a'
  const background = tone === 'error' ? '#FFF5F5' : '#F0FDF4'
  const border = tone === 'error' ? '#FECACA' : '#BBF7D0'

  const goHome = () => {
    window.history.replaceState({}, '', window.location.pathname)
    setScreen('home')
  }

  return (
    <div style={{height:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 1.5rem) 1.5rem calc(env(safe-area-inset-bottom) + 1.5rem)',background:'#f7f7f7'}}>
      <section style={{width:'100%',maxWidth:360,background:'white',border:'1px solid #eee',borderRadius:20,padding:'1.5rem',boxShadow:'0 18px 50px rgba(0,0,0,0.08)'}}>
        <img src="/logo192.png" alt="Hubbing" style={{width:64,height:64,borderRadius:16,display:'block',marginBottom:22}} />
        <h1 style={{fontSize:24,lineHeight:1.2,margin:'0 0 14px',fontWeight:800}}>{title}</h1>
        <div style={{background,border:`1px solid ${border}`,borderRadius:14,padding:'1rem',margin:'0 0 1rem'}}>
          <p style={{margin:0,fontSize:14,lineHeight:1.6,color,fontWeight:700}}>{message}</p>
        </div>
        <button onClick={goHome}
          style={{width:'100%',padding:'13px 18px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
          Ouvrir Hubbing
        </button>
      </section>
    </div>
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
  const variant = plan.toLowerCase()
  return (
    <span style={{color: colors[plan] || '#666', fontSize:12, fontWeight:600,display:'inline-flex',alignItems:'center',gap:4}}>
      <VerifiedBadge size={14} variant={variant} /> {plan} →
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

  if (isNativeApp()) return null

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
            Sur iPhone : ouvrez cette page dans Safari, touchez le bouton Partager, puis "Ajouter à l'écran d'accueil".
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
      <div style={{marginBottom:8}}>
        <HubbingIcon name={icon} size={28} />
      </div>
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

  const PlanPhone = ({ name, price, variant, color, features, recommended }) => (
    <div style={{background:'white',borderRadius:20,padding:'0.75rem',boxShadow:'0 8px 30px rgba(0,0,0,0.12)',width:104,minHeight:172,flexShrink:0,border:`1px solid ${color}33`,display:'flex',flexDirection:'column',gap:7,textAlign:'left'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:4}}>
        <span style={{fontSize:11,fontWeight:800,color,display:'inline-flex',alignItems:'center',gap:3}}>
          {name}
          <VerifiedBadge size={13} variant={variant} />
        </span>
        {recommended && (
          <span style={{fontSize:6,fontWeight:800,color:'white',background:'#E24B4A',borderRadius:999,padding:'3px 5px'}}>
            TOP
          </span>
        )}
      </div>
      <p style={{fontSize:13,fontWeight:900,color:'#111827',margin:0,lineHeight:1.1}}>{price}</p>
      <div style={{display:'flex',flexDirection:'column',gap:5,flex:1}}>
        {features.map((feature) => (
          <p key={feature} style={{fontSize:8.5,color:'#64748B',lineHeight:1.25,margin:0,display:'flex',gap:3}}>
            <span style={{color,fontWeight:900}}>✓</span>
            <span>{feature}</span>
          </p>
        ))}
      </div>
      <div style={{background:color,borderRadius:8,padding:'6px 5px',textAlign:'center',marginTop:'auto'}}>
        <span style={{fontSize:8,fontWeight:800,color:'white'}}>Voir le plan</span>
      </div>
    </div>
  )

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 10rem)',gap:'1.5rem',textAlign:'center',position:'relative',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>

      {/* Logo */}
      <div style={{animation:'fadeUp 0.6s ease 0.1s both',display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
        <img src="/LOGO-HUBBING-ICON.svg" alt="Hubbing" style={{width:112,height:112,borderRadius:'50%',boxShadow:'0 18px 45px rgba(226,75,74,0.22)'}} />
        <h1 style={{fontSize:38,fontWeight:800,fontFamily:'Nunito, sans-serif',letterSpacing:'-0.5px',margin:0}}>hubbing</h1>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.25s both'}}>
        {['Bienvenue', 'Willkommen', 'Benvenuti', 'Welcome'].map((word, index) => (
          <div key={word} style={{background:index === 0 ? '#E24B4A' : '#f9f9f9',color:index === 0 ? 'white' : '#1a1a1a',border:index === 0 ? 'none' : '1px solid #eee',borderRadius:14,padding:'0.8rem 0.65rem',fontSize:13,fontWeight:800}}>
            {word}
          </div>
        ))}
      </div>

      <div style={{display:'inline-flex',alignItems:'center',gap:8,background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:100,padding:'8px 18px',animation:'fadeUp 0.6s ease 0.3s both'}}>
        <div style={{width:7,height:7,borderRadius:'50%',background:'#16a34a',animation:'pulse 2s ease infinite'}}></div>
        <span style={{fontSize:13,fontWeight:700,color:'#15803d'}}>Application ouverte aux entreprises suisses</span>
      </div>

      <div style={{width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.35s both'}}>
        <button
          onClick={handleInstallApp}
          disabled={isStandalone}
          style={{width:'100%',padding:'13px 16px',background:isStandalone ? '#f0fdf4' : '#1a1a1a',color:isStandalone ? '#15803d' : 'white',border:isStandalone ? '1px solid #bbf7d0' : 'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:isStandalone ? 'default' : 'pointer',fontFamily:'Plus Jakarta Sans',boxShadow:isStandalone ? 'none' : '0 8px 24px rgba(0,0,0,0.12)'}}>
          {isStandalone ? 'Application installée' : "Installer l'application sur mon téléphone"}
        </button>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{width:'100%',marginTop:10,padding:'13px 16px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'Plus Jakarta Sans',boxShadow:'0 8px 24px rgba(226,75,74,0.18)',display:'flex',alignItems:'center',justifyContent:'center',gap:8,textDecoration:'none'}}>
          <HubbingIcon name="apple" size={18} color="white" />
          Télécharger l'app sur App Store
        </a>
        {showInstallHelp && !isStandalone && (
          <div style={{marginTop:10,background:'#f9f9f9',border:'1px solid #eee',borderRadius:12,padding:'0.85rem',textAlign:'left'}}>
            <p style={{fontSize:12,color:'#1a1a1a',fontWeight:700,margin:'0 0 6px'}}>Installation sur téléphone</p>
            <p style={{fontSize:12,color:'#666',lineHeight:1.5,margin:0}}>
              Sur iPhone : ouvrez cette page dans Safari, touchez le bouton Partager, puis "Ajouter à l'écran d'accueil".
            </p>
          </div>
        )}
      </div>

      {/* Headline forte */}
      <div style={{animation:'fadeUp 0.6s ease 0.4s both'}}>
        <h2 style={{fontSize:26,fontWeight:800,letterSpacing:'-0.5px',lineHeight:1.2,marginBottom:'0.75rem'}}>
          Le réseau B2B suisse<br />
          pour trouver les bons<br />
          <span style={{color:'#E24B4A'}}>partenaires locaux</span>
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
            <HubbingIcon name="building" size={28} color="white" />
          </div>
          <p style={{fontSize:9,fontWeight:700,margin:'0 0 2px',color:'#1a1a1a'}}>Fiduciaire Rochat</p>
          <p style={{fontSize:8,color:'#999',margin:'0 0 6px'}}>Lausanne, VD</p>
          <div style={{display:'flex',justifyContent:'center',gap:6}}>
            <div style={{width:24,height:24,borderRadius:'50%',border:'2px solid #E24B4A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10}}>✗</div>
            <div style={{width:28,height:28,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'white'}}>✓</div>
          </div>
          <p style={{fontSize:8,color:'#E24B4A',fontWeight:600,marginTop:6,textAlign:'center'}}>SWIPE</p>
        </div>

        {/* Screenshot 2 - Match */}
        <div style={{background:'white',borderRadius:20,padding:'0.75rem',boxShadow:'0 8px 30px rgba(0,0,0,0.12)',width:96,minHeight:160,flexShrink:0,border:'1px solid #f0f0f0',display:'flex',flexDirection:'column'}}>
          <div style={{background:'#22c55e',borderRadius:12,padding:'0.5rem',marginBottom:6,textAlign:'center'}}>
            <p style={{color:'white',fontWeight:800,fontSize:11,margin:0}}>MATCH !</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:6}}>
            <div style={{width:20,height:20,borderRadius:'50%',background:'#185FA5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'white',fontWeight:700}}>TE</div>
            <div style={{width:20,height:20,borderRadius:'50%',background:'#E24B4A',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,color:'white',fontWeight:700}}>HB</div>
          </div>
          <p style={{fontSize:8,color:'#666',margin:'0 0 6px',lineHeight:1.4}}>TechSoft Zürich AG vous a matché !</p>
          <div style={{background:'#E24B4A',borderRadius:8,padding:'4px',textAlign:'center'}}>
            <p style={{color:'white',fontSize:8,fontWeight:600,margin:0}}>Contacter</p>
          </div>
          <p style={{fontSize:8,color:'#185FA5',fontWeight:600,marginTop:6,textAlign:'center'}}>MESSAGES</p>
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
            <p style={{fontSize:7,color:'#666',margin:0}}>VD · Informatique</p>
          </div>
          <p style={{fontSize:8,color:'#22c55e',fontWeight:600,marginTop:6,textAlign:'center'}}>CARTE</p>
        </div>
      </div>

      {/* Plans */}
      <div style={{width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.6s both'}}>
        <div style={{textAlign:'center',marginBottom:12}}>
          <p style={{fontSize:12,color:'#E24B4A',fontWeight:800,margin:'0 0 4px',textTransform:'uppercase',letterSpacing:0.4}}>Abonnements</p>
          <h3 style={{fontSize:22,fontWeight:900,color:'#111827',letterSpacing:'-0.3px',lineHeight:1.2,margin:0}}>Choisissez le plan adapté</h3>
        </div>
        <div style={{display:'flex',gap:10,justifyContent:'center',alignItems:'stretch',overflow:'visible',width:'100%',minHeight:178}}>
          <PlanPhone
            name="Starter"
            price="Gratuit"
            variant="starter"
            color="#A16207"
            features={['Profil entreprise', '5 swipes par jour', '5 messages/jour']}
          />
          <PlanPhone
            name="Basic"
            price="CHF 19.-"
            variant="basic"
            color="#185FA5"
            features={['Swipes illimités', 'Messages illimités', 'Adresse visible']}
          />
          <PlanPhone
            name="Premium"
            price="CHF 39.-"
            variant="premium"
            color="#E24B4A"
            recommended
            features={['Tout Basic inclus', 'Coordonnées complètes', 'Pièces jointes']}
          />
        </div>
      </div>

      {/* Features */}
      <div style={{display:'flex',flexDirection:'column',gap:12,width:'100%',maxWidth:340,animation:'fadeUp 0.6s ease 0.75s both'}}>
        <Feature icon="briefcase" title="Swipe B2B" desc="Découvrez des entreprises locales et matchez avec celles qui correspondent à vos besoins en un seul geste." />
        <Feature icon="map" title="Carte interactive" desc="Visualisez toutes les entreprises autour de vous, filtrez par secteur et canton." />
        <Feature icon="message" title="Messagerie pro" desc="Échangez directement avec vos connexions B2B et partagez des documents en toute sécurité." />
      </div>

      <p style={{fontSize:13,color:'#bbb',animation:'fadeUp 0.6s ease 1s both'}}>
        Des questions ? <a href="mailto:contact@hubbing.ch" style={{color:'#E24B4A',textDecoration:'none',fontWeight:500}}>contact@hubbing.ch</a>
      </p>
      <p style={{fontSize:12,color:'#ccc',textAlign:'center'}}>🇨🇭 Made in Switzerland</p>
      <p style={{fontSize:11,color:'#ddd',textAlign:'center'}}>© {new Date().getFullYear()} Hubbing — Tous droits réservés</p>

      <div style={{position:'fixed',left:'50%',bottom:0,transform:'translateX(-50%)',width:'100%',maxWidth:430,background:'white',borderTop:'1px solid #f0f0f0',boxShadow:'0 -8px 30px rgba(0,0,0,0.08)',padding:'0.85rem 1rem calc(env(safe-area-inset-bottom) + 0.85rem)',zIndex:20}}>
        <div style={{display:'flex',flexDirection:'column',gap:'0.6rem'}}>
          <button
            onClick={() => { window.location.href = 'https://app.hubbing.ch' }}
            style={{width:'100%',padding:'13px 14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'Plus Jakarta Sans',boxShadow:'0 8px 24px rgba(226,75,74,0.18)'}}>
            Ouvrir l'application
          </button>
        </div>
      </div>
    </div>
  )
}
function LandingScreen({ setScreen, setVisitorInitialTab, t, lang, setLang }) {
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [showUsageGuide, setShowUsageGuide] = useState(false)
  const usageGuideText = getUiText(lang).usageGuide
  const langs = [
    { code: 'fr', label: '🇫🇷 Français' },
    { code: 'de', label: '🇩🇪 Deutsch' },
    { code: 'it', label: '🇮🇹 Italiano' },
    { code: 'en', label: '🇬🇧 English' },
  ]
  const openVisitorPricing = () => {
    setVisitorInitialTab && setVisitorInitialTab('pricing')
    setScreen('visitor')
  }

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 1.25rem) 1.5rem calc(env(safe-area-inset-bottom) + 1.5rem)',gap:'1rem',position:'relative',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>
      {showUsageGuide && <UsageGuideModal t={usageGuideText} onClose={() => setShowUsageGuide(false)} />}
      <div style={{position:'absolute',top:'calc(env(safe-area-inset-top) + 1rem)',right:'1rem'}}>
        <button onClick={() => setShowLangMenu(!showLangMenu)}
          style={{background:'#f5f5f5',border:'1px solid #eee',borderRadius:20,padding:'6px 14px',fontSize:13,cursor:'pointer',fontFamily:'Plus Jakarta Sans',fontWeight:500,display:'inline-flex',alignItems:'center',gap:6}}>
          <HubbingIcon name="globe" size={15} color="#3B82F6" />
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

      <img src="/LOGO-HUBBING.svg" alt="Hubbing" style={{width:116,height:116,borderRadius:'50%',boxShadow:'0 14px 32px rgba(226,75,74,0.18)'}} />
      <p style={{color:'#666',textAlign:'center',fontSize:16,lineHeight:1.55,margin:'0 0 0.25rem'}}>{t.appTagline}</p>
      <button onClick={() => setScreen('register')}
        style={{width:'100%',padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        {t.createAccount}
      </button>
      <button onClick={() => setScreen('login')}
        style={{width:'100%',padding:'14px',background:'white',color:'#E24B4A',border:'2px solid #E24B4A',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        {t.login}
      </button>
      <button onClick={() => { setVisitorInitialTab && setVisitorInitialTab('swipe'); setScreen('visitor') }}
        style={{width:'100%',padding:'14px',background:'#F8FAFC',color:'#475569',border:'1px solid #CBD5E1',borderRadius:12,fontSize:15,fontWeight:700,cursor:'pointer',boxShadow:'0 6px 18px rgba(71,85,105,0.08)'}}>
        {t.visitorMode}
      </button>
      <button onClick={() => setShowUsageGuide(true)}
        style={{width:'100%',padding:'13px 14px',background:'white',color:'#185FA5',border:'1px solid #BFDBFE',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer',fontFamily:'Plus Jakarta Sans',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
        <HubbingIcon name="sparkles" size={17} color="#185FA5" />
        {t.usageGuide}
      </button>
      <div style={{width:'100%',display:'grid',gridTemplateColumns:'repeat(3, minmax(0, 1fr))',gap:8}}>
        {t.planPreviews.map((plan, index) => {
          const colors = ['#64748B', '#185FA5', '#E24B4A']
          const color = colors[index] || '#E24B4A'
          return (
            <button key={plan.name} onClick={openVisitorPricing}
              style={{minWidth:0,minHeight:104,padding:'0.75rem 0.55rem',background:'white',border:`1px solid ${color}33`,borderRadius:12,boxShadow:'0 8px 20px rgba(15,23,42,0.06)',cursor:'pointer',fontFamily:'Plus Jakarta Sans',display:'flex',flexDirection:'column',alignItems:'flex-start',justifyContent:'space-between',textAlign:'left'}}>
              <span style={{fontSize:13,fontWeight:800,color,whiteSpace:'nowrap',display:'inline-flex',alignItems:'center',gap:4}}>
                {plan.name}
                <VerifiedBadge size={14} variant={plan.id} />
              </span>
              <span style={{fontSize:12,fontWeight:800,color:'#111827',lineHeight:1.25}}>{plan.price}</span>
              <span style={{fontSize:10,color:'#64748B',lineHeight:1.25,overflowWrap:'anywhere'}}>{plan.detail}</span>
            </button>
          )
        })}
      </div>
      <button onClick={openVisitorPricing}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#E24B4A',fontWeight:700,fontFamily:'Plus Jakarta Sans'}}>
        {t.planPreviewCta} →
      </button>
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline'}}>
        {t.legal}
      </button>
      <p style={{fontSize:11,color:'#ccc',textAlign:'center',margin:0}}>© {new Date().getFullYear()} Hubbing — Tous droits réservés</p>
    </div>
  )
}
function LoginScreen({ setScreen, setUser, t }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const showRepairLogin = !isNativeApp()

  const handleLogin = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    const normalizedEmail = email.trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    let session = data?.session
    if (!session?.user) {
      const { data: sessionData } = await supabase.auth.getSession()
      session = sessionData?.session
    }

    if (!session?.user) {
      setError("Connexion acceptée, mais Safari n'a pas pu enregistrer la session. Autorisez les cookies/données de site pour app.hubbing.ch puis réessayez.")
      setLoading(false)
      return
    }

    setUser(session.user)
    window.history.replaceState({}, '', window.location.pathname)
    setLoading(false)

    if (!isNativeApp() && session.user.id) {
      const userId = session.user.id
      Promise.all([
        supabase.from('companies').select('name, city, canton').eq('user_id', userId).maybeSingle(),
        supabase.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle(),
      ]).then(([{ data: companyData }, { data: subscriptionData }]) => {
        notifyTelegramActivity('login', {
          email: session.user.email || normalizedEmail,
          company: companyData?.name,
          city: companyData?.city,
          canton: companyData?.canton,
          plan: subscriptionData?.plan || 'Starter',
          status: subscriptionData?.status,
        }, { cooldownMinutes: 0 })
      }).catch(error => {
        console.warn('Login activity notification failed:', error)
      })
    }
  }

  const handleRepairLogin = async () => {
    if (repairing) return
    setRepairing(true)
    await repairLocalBrowserSession()
    window.history.replaceState({}, '', window.location.pathname)
    window.location.reload()
  }

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',gap:'1rem',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,alignSelf:'flex-start',padding:'0.25rem 0',marginBottom:'0.5rem'}}>
        {t.back}
      </button>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:'0.5rem'}}>{t.loginTitle}</h2>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} type="email" inputMode="email" autoComplete="username"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      <div style={{position:'relative'}}>
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} type={showPassword ? 'text' : 'password'} autoComplete="current-password"
          style={{width:'100%',padding:'14px 96px 14px 14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
        <button type="button" onClick={() => setShowPassword(value => !value)}
          aria-label={showPassword ? t.hidePassword : t.showPassword}
          style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',border:'none',background:'#f5f5f5',borderRadius:8,padding:'7px 10px',fontSize:12,fontWeight:700,color:'#666',cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
          {showPassword ? t.hidePassword : t.showPassword}
        </button>
      </div>
      {error && <p style={{color:'#E24B4A',fontSize:13}}>{error}</p>}
      <button onClick={handleLogin} disabled={loading}
        style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
        {loading ? t.connecting : t.loginBtn}
      </button>
      <button type="button" onClick={() => setScreen('forgot-password')}
        style={{background:'none',border:'none',cursor:'pointer',color:'#E24B4A',fontSize:14,fontWeight:700,fontFamily:'Plus Jakarta Sans',alignSelf:'center'}}>
        {t.forgotPassword}
      </button>
      {showRepairLogin && (
        <button type="button" onClick={handleRepairLogin} disabled={repairing}
          style={{background:'none',border:'none',cursor:'pointer',color:'#6B7280',fontSize:12,fontWeight:700,fontFamily:'Plus Jakarta Sans',alignSelf:'center'}}>
          {repairing ? t.repairingLogin : t.repairLogin}
        </button>
      )}
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

function ForgotPasswordScreen({ setScreen, t }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleResetRequest = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError(t.errorFields)
      return
    }

    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getPasswordResetRedirectUrl(),
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',gap:'1rem',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>
      <button onClick={() => setScreen('login')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,alignSelf:'flex-start',padding:'0.25rem 0',marginBottom:'0.5rem'}}>
        {t.back}
      </button>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:'0.25rem'}}>{t.resetPasswordTitle}</h2>
      <p style={{fontSize:14,lineHeight:1.55,color:'#777',marginBottom:'0.5rem'}}>{t.resetPasswordIntro}</p>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} type="email" inputMode="email" autoComplete="username"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      {error && <p style={{color:'#E24B4A',fontSize:13,lineHeight:1.4}}>{error}</p>}
      {sent && <p style={{color:'#3BA75C',fontSize:13,lineHeight:1.5,background:'#f0fff4',border:'1px solid #bce7c7',borderRadius:10,padding:'12px'}}>{t.resetPasswordEmailSent}</p>}
      <button onClick={handleResetRequest} disabled={loading || sent}
        style={{padding:'14px',background:sent ? '#9ad3aa' : '#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:sent ? 'default' : 'pointer'}}>
        {loading ? t.sendingResetLink : t.sendResetLink}
      </button>
      <button type="button" onClick={() => setScreen('login')}
        style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:14,fontWeight:700,fontFamily:'Plus Jakarta Sans',alignSelf:'center'}}>
        {t.backToLogin}
      </button>
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline',marginTop:'auto'}}>
        {t.legal}
      </button>
    </div>
  )
}

function ResetPasswordScreen({ setScreen, t }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      if (!session) setError(t.resetLinkInvalid)
      setCheckingSession(false)
    })
    return () => { mounted = false }
  }, [t.resetLinkInvalid])

  const handlePasswordUpdate = async () => {
    setError('')
    if (password.length < 8) {
      setError(t.passwordTooShort)
      return
    }
    if (password !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    await signOutCurrentBrowser()
    window.history.replaceState({}, '', window.location.pathname)
    setSuccess(true)
    setLoading(false)
  }

  return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',gap:'1rem',background:'white',overflowY:'auto',overflowX:'hidden',WebkitOverflowScrolling:'touch'}}>
      <button onClick={() => setScreen('login')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',textAlign:'left',fontSize:14,alignSelf:'flex-start',padding:'0.25rem 0',marginBottom:'0.5rem'}}>
        {t.back}
      </button>
      <h2 style={{fontSize:24,fontWeight:700,marginBottom:'0.25rem'}}>{t.newPasswordTitle}</h2>
      <p style={{fontSize:14,lineHeight:1.55,color:'#777',marginBottom:'0.5rem'}}>{t.newPasswordIntro}</p>
      <div style={{position:'relative'}}>
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder={t.newPassword} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
          disabled={success || checkingSession}
          style={{width:'100%',padding:'14px 96px 14px 14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
        <button type="button" onClick={() => setShowPassword(value => !value)}
          aria-label={showPassword ? t.hidePassword : t.showPassword}
          style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',border:'none',background:'#f5f5f5',borderRadius:8,padding:'7px 10px',fontSize:12,fontWeight:700,color:'#666',cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
          {showPassword ? t.hidePassword : t.showPassword}
        </button>
      </div>
      <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t.confirmPassword} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
        disabled={success || checkingSession}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      {error && <p style={{color:'#E24B4A',fontSize:13,lineHeight:1.4}}>{error}</p>}
      {success && <p style={{color:'#3BA75C',fontSize:13,lineHeight:1.5,background:'#f0fff4',border:'1px solid #bce7c7',borderRadius:10,padding:'12px'}}>{t.passwordUpdated}</p>}
      {!success ? (
        <button onClick={handlePasswordUpdate} disabled={loading || checkingSession || !!error && error === t.resetLinkInvalid}
          style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
          {loading || checkingSession ? t.updatingPassword : t.updatePassword}
        </button>
      ) : (
        <button onClick={() => setScreen('login')}
          style={{padding:'14px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:16,fontWeight:600,cursor:'pointer'}}>
          {t.backToLogin}
        </button>
      )}
      <button onClick={() => setScreen('legal')}
        style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'#bbb',textDecoration:'underline',marginTop:'auto'}}>
        {t.legal}
      </button>
    </div>
  )
}

function RegisterScreen({ setScreen, t }) {
  const [registrationDraft] = useState(readRegistrationDraft)
  const [email, setEmail] = useState(registrationDraft.email || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [company, setCompany] = useState(registrationDraft.company || '')
  const [sector, setSector] = useState(registrationDraft.sector || '')
  const [zefix, setZefix] = useState(registrationDraft.zefix || '')
  const [contactName, setContactName] = useState(registrationDraft.contactName || '')
  const [contactTitle, setContactTitle] = useState(registrationDraft.contactTitle || '')
  const [address, setAddress] = useState(registrationDraft.address || '')
  const [city, setCity] = useState(registrationDraft.city || '')
  const [canton, setCanton] = useState(registrationDraft.canton || '')
  const [npa, setNpa] = useState(registrationDraft.npa || '')
  const [accepted, setAccepted] = useState(Boolean(registrationDraft.accepted))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
 const [zefixStatus, setZefixStatus] = useState('idle') // idle, checking, valid, verified, manual, invalid
const [zefixCompanyName, setZefixCompanyName] = useState('')
const [zefixVerification, setZefixVerification] = useState(null)

useEffect(() => {
  try {
    window.sessionStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify({
      email,
      company,
      sector,
      zefix,
      contactName,
      contactTitle,
      address,
      city,
      canton,
      npa,
      accepted,
    }))
  } catch {
    // Safari private windows can block sessionStorage; the form still works without draft restore.
  }
}, [email, company, sector, zefix, contactName, contactTitle, address, city, canton, npa, accepted])

const handleZefixLookup = (ideNumber) => {
  setZefix(ideNumber)
  setZefixCompanyName('')
  setZefixVerification(null)
  const clean = ideNumber.replace(/[^0-9]/g, '').trim()
  if (clean.length === 9) {
    setZefixStatus('valid')
  } else if (ideNumber.length > 3) {
    setZefixStatus('invalid')
  } else {
    setZefixStatus('idle')
  }
}

const verifyZefixForRegistration = async (clean) => {
  setZefixStatus('checking')
  setZefixCompanyName('')
  setZefixVerification(null)

  try {
    const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/verify-zefix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        zefix: clean,
        company,
        sector,
        email: email.trim().toLowerCase(),
        address,
        npa,
        city,
        canton,
      })
    })

    const rawText = await response.text()
    let payload = null
    try {
      payload = rawText ? JSON.parse(rawText) : null
    } catch (parseError) {
      payload = null
    }

    if (response.status === 404 && payload?.reason === 'not_found') {
      setZefixStatus('invalid')
      return { blocked: true, message: t.errorZefixNotFound }
    }

    if (response.status === 422 && payload?.reason === 'inactive_company') {
      setZefixStatus('invalid')
      return { blocked: true, message: t.errorZefixInactive }
    }

    if (response.status === 409 && payload?.reason === 'company_identity_mismatch') {
      setZefixStatus('invalid')
      return { blocked: true, message: t.errorZefixMismatch }
    }

    if (response.status === 409 && payload?.reason === 'email_domain_mismatch') {
      setZefixStatus('invalid')
      return { blocked: true, message: t.errorEmailCompanyMismatch }
    }

    if (payload?.requiresManualReview) {
      setZefixStatus('invalid')
      return { blocked: true, message: t.errorZefixMismatch }
    }

    if (response.ok && payload?.verified) {
      const officialName = payload.company?.name || ''
      setZefixCompanyName(officialName)
      setZefixVerification(payload)
      setZefixStatus('verified')
      return { blocked: false, payload }
    }

    if (payload?.fallbackToManual || !response.ok) {
      setZefixStatus('manual')
      return {
        blocked: false,
        payload: {
          verified: false,
          source: 'manual_fallback',
          reason: payload?.reason || 'verify_zefix_unavailable',
        }
      }
    }

    setZefixStatus('manual')
    return {
      blocked: false,
      payload: {
        verified: false,
        source: 'manual_fallback',
        reason: payload?.reason || 'unknown_zefix_response',
      }
    }
  } catch (error) {
    console.error('Zefix verification failed:', error)
    setZefixStatus('manual')
    return {
      blocked: false,
      payload: {
        verified: false,
        source: 'manual_fallback',
        reason: 'verify_zefix_network_error',
      }
    }
  }
}

const handleRegister = async () => {
    setLoading(true)
    setError('')

    const normalizedEmail = email.trim().toLowerCase()
    const clean = zefix.replace(/[^0-9]/g, '').trim()
    const forbiddenDomains = ['gmail.com','hotmail.com','yahoo.com','outlook.com','icloud.com','live.com','msn.com','hotmail.fr','yahoo.fr','gmail.fr','bluewin.ch','gmx.ch','gmx.net','web.de']
    const emailDomain = normalizedEmail.split('@')[1]?.toLowerCase()
    if (forbiddenDomains.includes(emailDomain)) {
      setError(t.errorEmail)
      setLoading(false)
      return
    }

if (!normalizedEmail || !password || !company || !sector || !zefix || !contactName || !contactTitle || !address || !city || !canton || !npa) {      setError(t.errorFields)
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
    if (clean.length === 9) {
  setZefixStatus('valid')
} else {
  setZefixStatus('idle')
  setError(t.errorZefix)
  setLoading(false)
  return
}

    try {
      const { data: ideAvailable, error: ideCheckError } = await supabase.rpc('hubbing_company_ide_available', {
        p_zefix: clean
      })
      if (ideCheckError) throw ideCheckError
      if (ideAvailable === false) {
        setError(t.errorIdeAlreadyUsed)
        setLoading(false)
        return
      }
    } catch (ideCheckError) {
      console.error('IDE availability check failed:', ideCheckError)
      setError(t.errorZefixRetry)
      setLoading(false)
      return
    }

    const zefixCheck = await verifyZefixForRegistration(clean)
    if (zefixCheck.blocked) {
      setError(zefixCheck.message || t.errorZefix)
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password })
    if (error) {
      const alreadyUsed = /already|registered|exists|user/i.test(error.message || '')
      setError(alreadyUsed ? t.errorEmailAlreadyUsed : error.message)
      setLoading(false)
      return
    }
    if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
      setError(t.errorEmailAlreadyUsed)
      setLoading(false)
      return
    }
    
    const userId = data?.user?.id || data?.session?.user?.id
    const verificationPayload = zefixCheck.payload || zefixVerification
    const isZefixVerified = verificationPayload?.verified === true && verificationPayload?.source === 'zefix'

    if (userId) {
      let coords = null
      try {
        coords = await geocodeSwissAddress({ address, npa, city, canton })
      } catch (geoError) {
        console.log('Registration geocoding failed:', geoError)
      }
      const { error: insertError } = await supabase.from('companies').insert({
        user_id: userId,
      name: company,
      sector,
      zefix_uid: clean,
      contact_name: contactName,
      contact_title: contactTitle,
      address: `${address}, ${npa} ${city}`,
     city: city,
     canton: canton,
     lat: coords?.lat ?? null,
     lng: coords?.lng ?? null,
      zefix_verification_status: isZefixVerified ? 'verified' : 'manual_pending',
      zefix_verified_at: isZefixVerified ? new Date().toISOString() : null,
      zefix_verified_name: isZefixVerified ? (verificationPayload?.company?.name || company) : null,
      zefix_verified_source: verificationPayload?.source || null,
      zefix_verified_payload: verificationPayload || null,
      })
      if (insertError) {
        console.error('Insert error:', insertError)
        const duplicateIde = insertError.code === '23505' || /zefix|companies_zefix|duplicate/i.test(insertError.message || '')
        setError(duplicateIde ? t.errorIdeAlreadyUsed : insertError.message)
        setLoading(false)
        return
      }
    }
    try {
      const response = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/registration-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: normalizedEmail,
          company,
          sector,
          zefix: clean,
          contactName,
          contactTitle,
          address: `${address}, ${npa} ${city}`,
          city,
          canton,
          userId,
          zefixVerification: verificationPayload
        })
      })
      if (!response.ok) {
        const details = await response.text()
        throw new Error(details || 'Registration email failed')
      }
    } catch (emailError) {
      console.error('Registration email error:', emailError)
    }

    try {
      window.sessionStorage.removeItem(REGISTRATION_DRAFT_KEY)
    } catch {
      // Ignore storage cleanup failures.
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={{height:'100dvh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'calc(env(safe-area-inset-top) + 1rem) 2rem calc(env(safe-area-inset-bottom) + 2rem)',gap:'1rem',textAlign:'center',background:'white'}}>
      <HubbingIcon name="sparkles" size={48} color="#E24B4A" />
      <h2 style={{fontSize:22,fontWeight:700}}>{t.successTitle}</h2>
      <p style={{color:'#666',fontSize:15}}>{t.successMsg}</p>
      <button onClick={() => setScreen('login')}
        style={{padding:'14px 32px',background:'#E24B4A',color:'white',border:'none',borderRadius:12,fontSize:15,fontWeight:600,cursor:'pointer'}}>
        {t.successBtn}
      </button>
    </div>
  )

  const zefixBorderColor = zefixStatus === 'verified'
    ? '#22c55e'
    : zefixStatus === 'manual' || zefixStatus === 'checking' || zefixStatus === 'valid'
      ? '#F39C12'
      : zefixStatus === 'invalid'
        ? '#E24B4A'
        : '#ddd'

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
      <div style={{position:'relative',width:'100%',height:56,flexShrink:0}}>
        <div style={{
          position:'absolute',
          inset:0,
          padding:'0 44px 0 14px',
          border:'1px solid #ddd',
          borderRadius:10,
          background:'white',
          display:'flex',
          alignItems:'center',
          fontSize:16,
          lineHeight:1.2,
          fontFamily:'Plus Jakarta Sans',
          color:sector ? '#111' : '#999',
          pointerEvents:'none',
          overflow:'hidden',
          textOverflow:'ellipsis',
          whiteSpace:'nowrap'
        }}>
          {sector || t.sector}
        </div>
        <span style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',fontSize:18,color:'#111',pointerEvents:'none'}}>⌄</span>
        <select value={sector} onChange={e => setSector(e.target.value)} aria-label={t.sector}
          style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer',fontSize:16}}>
          <option value="">{t.sector}</option>
          {COMPANY_SECTORS.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <input value={zefix} onChange={e => handleZefixLookup(e.target.value)} placeholder={t.ideNumber}
  style={{padding:'14px',border:`1px solid ${zefixBorderColor}`,borderRadius:10,fontSize:16,outline:'none'}} />
{zefixStatus === 'valid' && <p style={{fontSize:12,color:'#F39C12'}}>{t.zefixValidFormat}</p>}
{zefixStatus === 'checking' && <p style={{fontSize:12,color:'#F39C12'}}>{t.zefixChecking}</p>}
{zefixStatus === 'verified' && <p style={{fontSize:12,color:'#16a34a'}}>{t.zefixVerified(zefixCompanyName)}</p>}
{zefixStatus === 'manual' && <p style={{fontSize:12,color:'#F39C12'}}>{t.zefixManualFallback}</p>}
{zefixStatus === 'invalid' && <p style={{fontSize:12,color:'#E24B4A'}}>Format invalide. Utilisez le format CHE-xxx.xxx.xxx (9 chiffres)</p>}
      <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Rue et numéro *"
  style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
<div style={{display:'flex',gap:8}}>
  <input value={npa} onChange={e => setNpa(e.target.value)} placeholder="NPA *"
    style={{width:100,padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Ville *"
    style={{flex:1,padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
</div>
<div style={{position:'relative',width:'100%',height:56,flexShrink:0}}>
  <div style={{position:'absolute',inset:0,padding:'0 44px 0 14px',border:'1px solid #ddd',borderRadius:10,background:'white',display:'flex',alignItems:'center',fontSize:16,lineHeight:1.2,fontFamily:'Plus Jakarta Sans',color:canton ? '#111' : '#999',pointerEvents:'none'}}>
    {canton || 'Canton *'}
  </div>
  <span style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',fontSize:18,color:'#111',pointerEvents:'none'}}>⌄</span>
  <select value={canton} onChange={e => setCanton(e.target.value)} aria-label="Canton"
    style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,cursor:'pointer',fontSize:16}}>
    <option value="">Canton *</option>
    {['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH'].map(c => (
      <option key={c} value={c}>{c}</option>
    ))}
  </select>
</div>

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{t.contactInfo}</p>
      <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder={t.contactName}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder={t.contactTitle}
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />

      <p style={{fontSize:12,color:'#E24B4A',fontWeight:600,marginTop:'0.25rem'}}>{t.access}</p>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t.email} type="email" inputMode="email" autoComplete="email"
        style={{padding:'14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
      <div style={{position:'relative'}}>
        <input value={password} onChange={e => setPassword(e.target.value)} placeholder={t.password} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
          style={{width:'100%',padding:'14px 96px 14px 14px',border:'1px solid #ddd',borderRadius:10,fontSize:16,outline:'none'}} />
        <button type="button" onClick={() => setShowPassword(value => !value)}
          aria-label={showPassword ? t.hidePassword : t.showPassword}
          style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',border:'none',background:'#f5f5f5',borderRadius:8,padding:'7px 10px',fontSize:12,fontWeight:700,color:'#666',cursor:'pointer',fontFamily:'Plus Jakarta Sans'}}>
          {showPassword ? t.hidePassword : t.showPassword}
        </button>
      </div>

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

function VisitorMode({ setScreen, initialTab = 'swipe', t, lang, setLang }) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showModal, setShowModal] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const ui = getUiText(lang)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  const tabStyle = (tab) => ({
    flex:1, padding:'8px 0 6px', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#6B7280',
    fontWeight: activeTab === tab ? 700 : 500,
    fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  })

  const Modal = () => (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100,padding:'1rem'}}>
      <div style={{background:'white',borderRadius:16,padding:'2rem',width:'100%',maxWidth:340,textAlign:'center'}}>
        <div style={{marginBottom:'0.75rem',display:'flex',justifyContent:'center'}}>
          <HubbingIcon name="lock" size={40} color="#E24B4A" />
        </div>
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
       {activeTab === 'map' && <Suspense fallback={<LoadingIndicator fill compact />}><MapScreen user={null} setScreen={setScreen} lang={lang} /></Suspense>}
        {activeTab === 'messages' && (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2rem',textAlign:'center',gap:'1rem'}}>
            <HubbingIcon name="messages" size={48} color="#E24B4A" />
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
              {id:'starter',name:'Starter',price:ui.common.free,color:'#666',features:ui.pricing.starterFeatures.slice(0, 4),limits:ui.pricing.starterLimits.slice(0, 2)},
              {id:'basic',name:'Basic',price:`CHF 19.-${ui.common.month}`,color:'#185FA5',features:ui.pricing.basicFeatures.slice(0, 4),limits:ui.pricing.basicLimits.slice(0, 2)},
              {id:'premium',name:'Premium',price:`CHF 39.-${ui.common.month}`,color:'#E24B4A',features:ui.pricing.premiumFeatures.slice(0, 6),limits:ui.pricing.premiumLimits,highlight:true},
            ].map(plan => (
              <div key={plan.name} onClick={() => setShowModal(true)}
                style={{border: plan.highlight ? `2px solid ${plan.color}` : '1px solid #eee',borderRadius:12,padding:'1rem',marginBottom:'0.75rem',cursor:'pointer',background:'white'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <h3 style={{fontSize:16,fontWeight:700,color:plan.color,margin:0,display:'flex',alignItems:'center',gap:6}}>
                    {plan.name}
                    <VerifiedBadge size={17} variant={plan.id} />
                  </h3>
                  <span style={{fontSize:14,fontWeight:600,color:'#1a1a1a'}}>{plan.price}</span>
                </div>
                {plan.features.map((f,i) => (
                  <p key={i} style={{fontSize:12,color:'#666',margin:'3px 0',display:'flex',alignItems:'center',gap:5}}>
                    <span>✓ {f}</span>
                  </p>
                ))}
                {(plan.limits || []).map((f,i) => (
                  <p key={`limit-${i}`} style={{fontSize:12,color:'#999',margin:'3px 0'}}>− {f}</p>
                ))}
              </div>
            ))}
            <div style={{marginTop:'0.85rem',padding:'0.9rem',background:'#F8FAFC',border:'1px solid #E2E8F0',borderRadius:12,textAlign:'center'}}>
              <p style={{fontSize:12,fontWeight:700,color:'#334155',margin:'0 0 0.6rem'}}>
                {ui.pricing.legalLinksTitle}
              </p>
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,flexWrap:'wrap'}}>
                <a href={TERMS_OF_USE_URL} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:12,color:'#185FA5',fontWeight:700,textDecoration:'underline'}}>
                  {ui.pricing.termsOfUseEula}
                </a>
                <span style={{fontSize:12,color:'#CBD5E1'}}>·</span>
                <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer"
                  style={{fontSize:12,color:'#185FA5',fontWeight:700,textDecoration:'underline'}}>
                  {ui.pricing.privacyPolicyLink}
                </a>
              </div>
            </div>
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
          {id:'swipe',label:ui.nav.swipe,icon:'swipe'},
          {id:'map',label:ui.nav.map,icon:'map'},
          {id:'messages',label:ui.nav.messages,icon:'messages'},
          {id:'pricing',label:ui.nav.pricing,icon:'pricing'},
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={tabStyle(tab.id)}>
            <div style={{height:26,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:2}}>
              <HubbingIcon name={tab.icon} active={activeTab === tab.id} />
            </div>
            <span style={{display:'block'}}>{tab.label}</span>
            <span style={{display:'block',width:4,height:4,borderRadius:'50%',background:activeTab === tab.id ? '#E24B4A' : 'transparent',margin:'4px auto 0'}} />
          </button>
        ))}
      </div>
    </div>
  )
}
 

function Dashboard({ user, setUser, t, lang, setLang }) {
  const [activeTab, setActiveTab] = useState('home')
  const [selectedCompanyId, setSelectedCompanyId] = useState(null)
  const [companyProfileReturn, setCompanyProfileReturn] = useState(null)
  const [userPlan, setUserPlan] = useState('Starter')
  const [unreadCount, setUnreadCount] = useState(0)
  const [sessionReady, setSessionReady] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [directMessageCompanyId, setDirectMessageCompanyId] = useState(null)
  const [directMessageDraft, setDirectMessageDraft] = useState(null)
  const unreadCountRef = useRef(0)
  const sessionTokenRef = useRef(null)
  const signingOutRef = useRef(false)
  const inactivityTimerRef = useRef(null)
  const ui = getUiText(lang)

const releaseSessionLock = async () => {
  const token = sessionTokenRef.current
  if (!token) return
  try {
    await supabase.rpc('hubbing_release_session_lock', { p_token: token })
  } catch (error) {
    console.warn('Unable to release session lock:', error)
  }
}

const forceSignOut = async (message) => {
  if (signingOutRef.current) return
  signingOutRef.current = true
  if (message) window.alert(message)
  await releaseSessionLock()
  await clearAppBadge()
  await signOutCurrentBrowser()
}

useEffect(() => {
  unreadCountRef.current = unreadCount
}, [unreadCount])

useEffect(() => {
  let cancelled = false
  const acquireSessionLock = async () => {
    const token = getStoredSessionToken(user.id)
    sessionTokenRef.current = token
    const { data, error } = await supabase.rpc('hubbing_acquire_session_lock', {
      p_token: token,
      p_device_label: getDeviceLabel(),
      p_ttl_minutes: SESSION_LOCK_TTL_MINUTES,
    })
    if (cancelled) return
    if (error) {
      console.warn('Session lock unavailable:', error)
      setSessionReady(true)
      return
    }
    if (data?.acquired === false) {
      console.warn('Session lock already active; allowing access to avoid blocking login:', data)
      if (ENFORCE_SINGLE_DEVICE_LOCK) {
        await forceSignOut(t.sessionAlreadyOpen)
        return
      }
      setSessionReady(true)
      return
    }
    setSessionReady(true)
  }

  acquireSessionLock()
  return () => {
    cancelled = true
  }
}, [user.id])

useEffect(() => {
  if (!sessionReady) return undefined

  const refreshSessionLock = async () => {
    const token = sessionTokenRef.current
    if (!token || signingOutRef.current) return
    const { data, error } = await supabase.rpc('hubbing_refresh_session_lock', {
      p_token: token,
      p_ttl_minutes: SESSION_LOCK_TTL_MINUTES,
    })
    if (error) {
      console.warn('Unable to refresh session lock:', error)
      return
    }
    if (data?.active === false) {
      console.warn('Session lock inactive; keeping current auth session active:', data)
      if (ENFORCE_SINGLE_DEVICE_LOCK) {
        await forceSignOut(t.sessionAlreadyOpen)
      }
    }
  }

  refreshSessionLock()
  const interval = window.setInterval(refreshSessionLock, 60 * 1000)
  const handleVisibilityChange = () => {
    if (!document.hidden) refreshSessionLock()
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [sessionReady, t.sessionAlreadyOpen])

useEffect(() => {
  if (!sessionReady || !ENABLE_INACTIVITY_SIGNOUT) return undefined

  const expireForInactivity = async () => {
    await forceSignOut(t.sessionExpired)
  }
  const resetInactivityTimer = () => {
    window.clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = window.setTimeout(expireForInactivity, SESSION_IDLE_LIMIT_MS)
  }
  const events = ['click', 'keydown', 'touchstart', 'scroll', 'pointerdown']
  events.forEach(eventName => window.addEventListener(eventName, resetInactivityTimer, { passive: true }))
  resetInactivityTimer()

  return () => {
    window.clearTimeout(inactivityTimerRef.current)
    events.forEach(eventName => window.removeEventListener(eventName, resetInactivityTimer))
  }
}, [sessionReady, t.sessionExpired])

useEffect(() => {
  if (!sessionReady) return undefined
  let cleanupPush = null
  let active = true
  registerPushNotifications().then(cleanup => {
    if (!active) {
      cleanup?.()
      return
    }
    cleanupPush = cleanup
  })
  return () => {
    active = false
    cleanupPush?.()
  }
}, [sessionReady, user.id])

useEffect(() => {
  if (!sessionReady) return undefined
  loadUnreadCount()
  const sub = supabase
    .channel('notifications-' + user.id)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${user.id}`
    }, async (payload) => {
      const nextUnreadCount = await loadUnreadCount()
      if (payload.new?.type === 'new_message') {
        await showNativeNotification({
          title: t.notificationNewMessageTitle,
          body: t.notificationNewMessageBody,
          count: nextUnreadCount,
          id: `message-${payload.new?.id || Date.now()}`,
        })
      } else if (payload.new?.type === 'new_match') {
        await showNativeNotification({
          title: t.notificationNewMatchTitle,
          body: t.notificationNewMatchBody,
          count: nextUnreadCount,
          id: `match-${payload.new?.id || Date.now()}`,
        })
      }
    })
    .subscribe()
  return () => supabase.removeChannel(sub)
}, [sessionReady, user.id, t.notificationNewMessageTitle, t.notificationNewMessageBody, t.notificationNewMatchTitle, t.notificationNewMatchBody])

const loadUnreadCount = async () => {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('type', ['new_message', 'new_match'])
    .eq('read', false)
  const nextCount = count || 0
  unreadCountRef.current = nextCount
  setUnreadCount(nextCount)
  return nextCount
}

  useEffect(() => {
    syncUnreadAppBadge(unreadCount)
  }, [unreadCount])

  useEffect(() => {
  supabase.from('subscriptions').select('plan').eq('user_id', user.id).single()
    .then(({ data }) => {
      if (data) setUserPlan(data.plan.charAt(0).toUpperCase() + data.plan.slice(1))
    })
  }, [user])
  const handleLogout = async () => {
    signingOutRef.current = true
    await releaseSessionLock()
    await clearAppBadge()
    await signOutCurrentBrowser()
  }

const handleTabChange = (tab) => {
  setActiveTab(tab)
  setSelectedCompanyId(null)
  setCompanyProfileReturn(null)
  if (tab !== 'messages') {
    setDirectMessageCompanyId(null)
    setDirectMessageDraft(null)
  }
}

const handleCompanyProfileBack = () => {
  const returnTarget = companyProfileReturn
  setSelectedCompanyId(null)
  setCompanyProfileReturn(null)
  if (returnTarget?.tab) setActiveTab(returnTarget.tab)
  if (returnTarget?.tab === 'messages' && returnTarget.companyId) {
    setDirectMessageCompanyId(returnTarget.companyId)
    setDirectMessageDraft(null)
  }
}

  const tabStyle = (tab) => ({
    flex:1, padding:'8px 0 6px', background:'none', border:'none', cursor:'pointer',
    fontSize:11, color: activeTab === tab ? '#E24B4A' : '#6B7280',
    fontWeight: activeTab === tab ? 700 : 500,
    fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  })

  if (!sessionReady) {
    return (
      <LoadingIndicator fullScreen background="white" />
    )
  }

  return (
    <Suspense fallback={<LoadingIndicator fullScreen background="white" />}>
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
  onBack={handleCompanyProfileBack}
  setActiveTab={setActiveTab}
  setSelectedCompanyId={setSelectedCompanyId}
  setCompanyProfileReturn={setCompanyProfileReturn}
  setDirectMessageCompanyId={setDirectMessageCompanyId}
  setDirectMessageDraft={setDirectMessageDraft}
/>
  ) : (
    <>
      {activeTab === 'home' && <HomeScreen user={user} setActiveTab={setActiveTab} setSelectedCompanyId={setSelectedCompanyId} plan={userPlan} lang={lang} />}
      {activeTab === 'swipe' && (
        <SwipeScreen
          user={user}
          plan={userPlan}
          setActiveTab={setActiveTab}
          setSelectedCompanyId={setSelectedCompanyId}
          setCompanyProfileReturn={setCompanyProfileReturn}
          setDirectMessageCompanyId={setDirectMessageCompanyId}
          setDirectMessageDraft={setDirectMessageDraft}
          lang={lang}
        />
      )}
      {activeTab === 'map' && <MapScreen user={user} plan={userPlan} setSelectedCompanyId={setSelectedCompanyId} setCompanyProfileReturn={setCompanyProfileReturn} setActiveTab={setActiveTab} lang={lang} />}
      {activeTab === 'messages' && <MessagesScreen user={user} plan={userPlan} setSelectedCompanyId={setSelectedCompanyId} setCompanyProfileReturn={setCompanyProfileReturn} setActiveTab={setActiveTab} openMatchWithCompanyId={directMessageCompanyId} openMessageDraft={directMessageDraft} onDirectOpenHandled={() => { setDirectMessageCompanyId(null); setDirectMessageDraft(null) }} onUnreadChange={loadUnreadCount} lang={lang} />}
      {activeTab === 'pricing' && <PricingScreen user={user} setActiveTab={setActiveTab} lang={lang} />}
      {activeTab === 'profile' && <ProfileScreen user={user} setActiveTab={setActiveTab} plan={userPlan} lang={lang} />}
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
    {id:'home',label:ui.nav.home,icon:'home'},
    {id:'swipe',label:ui.nav.swipe,icon:'swipe'},
    {id:'map',label:ui.nav.map,icon:'map'},
    {id:'messages',label:ui.nav.messages,icon:'messages'},
    {id:'profile',label:ui.nav.profile,icon:'profile'},
  ].map(tab => (
    <button key={tab.id} onClick={() => handleTabChange(tab.id)} style={tabStyle(tab.id)}>
      <div style={{position:'relative',height:26,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:2}}>
        <HubbingIcon name={tab.icon} active={activeTab === tab.id} />
        {tab.id === 'messages' && unreadCount > 0 && (
          <div style={{position:'absolute',top:-7,right:'calc(50% - 28px)',background:'#E24B4A',color:'white',borderRadius:999,minWidth:20,height:18,padding:'0 5px',fontSize:10,lineHeight:1,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white',boxShadow:'0 2px 5px rgba(0,0,0,0.18)',boxSizing:'border-box'}}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>
      <span style={{display:'block'}}>{tab.label}</span>
      <span style={{display:'block',width:4,height:4,borderRadius:'50%',background:activeTab === tab.id ? '#E24B4A' : 'transparent',margin:'4px auto 0'}} />
    </button>
  ))}
</div>
    </div>
    </Suspense>
  )
}
