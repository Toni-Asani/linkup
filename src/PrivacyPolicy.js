import React from 'react';

export default function PrivacyPolicy({ setScreen }) {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', fontFamily: 'Plus Jakarta Sans, sans-serif', color: '#333', lineHeight: 1.7 }}>
      <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:14,marginBottom:30}}>← Retour</button>
      
      <img src="/LOGO-HUBBING-ICON.svg" alt="Hubbing" style={{width:60,marginBottom:20,borderRadius:'50%'}} />
      <h1 style={{fontSize:28,fontWeight:700,marginBottom:8}}>Politique de confidentialité</h1>
      <p style={{color:'#999',fontSize:13,marginBottom:32}}>Dernière mise à jour : 22 avril 2026</p>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>1. Introduction</h2>
      <p>Hubbing attache une grande importance à la protection de vos données personnelles. La présente politique décrit comment nous collectons, utilisons et protégeons vos données dans le cadre de l'utilisation de notre plateforme accessible sur app.hubbing.ch et l'application mobile Hubbing.</p>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>2. Responsable du traitement</h2>
      <p>Hubbing — Suisse<br />Contact : contact@hubbing.ch</p>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>3. Données collectées</h2>
      <ul style={{paddingLeft:20,lineHeight:2}}>
        <li>Informations de profil entreprise : nom, secteur, canton, description, logo, photo de couverture</li>
        <li>Coordonnées : adresse email</li>
        <li>Données de connexion : identifiants de session</li>
        <li>Données d'utilisation : swipes, matchs, messages échangés</li>
        <li>Données de paiement : traitées par Stripe (aucune donnée bancaire stockée)</li>
        <li>Pièces jointes envoyées via la messagerie</li>
      </ul>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>4. Finalités du traitement</h2>
      <ul style={{paddingLeft:20,lineHeight:2}}>
        <li>Créer et gérer votre compte entreprise</li>
        <li>Afficher votre profil aux autres membres</li>
        <li>Permettre le système de matching et la messagerie B2B</li>
        <li>Traiter vos paiements via Stripe</li>
        <li>Envoyer des notifications transactionnelles par email</li>
        <li>Améliorer nos services</li>
      </ul>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>5. Base légale</h2>
      <ul style={{paddingLeft:20,lineHeight:2}}>
        <li>Exécution du contrat (utilisation de la plateforme)</li>
        <li>Votre consentement (communications marketing)</li>
        <li>Notre intérêt légitime (amélioration du service)</li>
      </ul>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>6. Partage des données</h2>
      <p>Nous ne vendons jamais vos données. Elles peuvent être partagées uniquement avec :</p>
      <ul style={{paddingLeft:20,lineHeight:2}}>
        <li>Supabase (hébergement et base de données)</li>
        <li>Stripe (paiements)</li>
        <li>Resend (emails transactionnels)</li>
        <li>Vercel (hébergement de l'application)</li>
      </ul>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>7. Conservation des données</h2>
      <p>Vos données sont conservées tant que votre compte est actif. En cas de suppression de compte, vos données sont effacées dans un délai de 30 jours.</p>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>8. Vos droits</h2>
      <p>Conformément à la loi suisse sur la protection des données (LPD) et au RGPD, vous disposez des droits suivants :</p>
      <ul style={{paddingLeft:20,lineHeight:2}}>
        <li>Droit d'accès à vos données</li>
        <li>Droit de rectification</li>
        <li>Droit à l'effacement (suppression de compte disponible dans l'application)</li>
        <li>Droit d'opposition au traitement</li>
        <li>Droit à la portabilité des données</li>
      </ul>
      <p>Pour exercer vos droits : <a href="mailto:contact@hubbing.ch" style={{color:'#E24B4A'}}>contact@hubbing.ch</a></p>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>9. Sécurité</h2>
      <p>Nous mettons en œuvre des mesures techniques appropriées pour protéger vos données, notamment le chiffrement des données en transit et au repos.</p>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>10. Modifications</h2>
      <p>Nous nous réservons le droit de modifier cette politique à tout moment. Vous serez informé par email en cas de modification substantielle.</p>

      <h2 style={{fontSize:18,fontWeight:700,marginTop:32,marginBottom:8}}>11. Contact</h2>
      <p><a href="mailto:contact@hubbing.ch" style={{color:'#E24B4A'}}>contact@hubbing.ch</a><br />hubbing.ch</p>

      <p style={{marginTop:48,fontSize:12,color:'#ccc',textAlign:'center'}}>© 2026 Hubbing — Tous droits réservés 🇨🇭</p>
    </div>
  )
}