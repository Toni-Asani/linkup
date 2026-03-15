import { useState } from 'react'
export default function LegalScreen({ setScreen }) {
  const [section, setSection] = useState('cgu')

  const sections = [
    { id: 'cgu', label: 'CGU' },
    { id: 'confidentialite', label: 'Confidentialité' },
    { id: 'responsabilite', label: 'Responsabilité' },
    { id: 'mentions', label: 'Mentions légales' },
  ]

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:20}}>←</button>
        <h2 style={{fontSize:18,fontWeight:700}}>Informations légales</h2>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',borderBottom:'1px solid #f0f0f0',overflowX:'auto'}}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{padding:'12px 16px',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight: section===s.id ? 600 : 400,color: section===s.id ? '#E24B4A' : '#666',borderBottom: section===s.id ? '2px solid #E24B4A' : '2px solid transparent',whiteSpace:'nowrap'}}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'1.5rem'}}>

        {section === 'cgu' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#E24B4A'}}>Conditions Générales d'Utilisation</h3>
            <p style={{fontSize:12,color:'#999'}}>Dernière mise à jour : mars 2026</p>

            <Section title="1. Objet">
              LinkUp est une plateforme de mise en relation B2B exclusivement réservée aux entreprises légalement enregistrées en Suisse. En créant un compte, vous acceptez les présentes CGU dans leur intégralité.
            </Section>

            <Section title="2. Conditions d'accès">
              L'accès à LinkUp est réservé aux entreprises disposant d'un numéro IDE valide (CHE-xxx.xxx.xxx) enregistré auprès du Registre du commerce suisse (Zefix). Toute inscription frauduleuse entraîne la suppression immédiate du compte.
            </Section>

            <Section title="3. Utilisation de la plateforme">
              Les utilisateurs s'engagent à utiliser LinkUp uniquement à des fins professionnelles et légitimes. Il est strictement interdit de publier des informations fausses, trompeuses ou diffamatoires. LinkUp se réserve le droit de supprimer tout contenu inapproprié.
            </Section>

            <Section title="4. Abonnements et paiements">
              Les abonnements Basic (CHF 19/mois) et Premium (CHF 39/mois) sont renouvelés automatiquement. L'offre Fondateurs (2 mois offerts) est limitée aux 100 premiers abonnés Premium et non cumulable. La résiliation est possible à tout moment avec effet à la fin de la période en cours.
            </Section>

            <Section title="5. Propriété intellectuelle">
              L'ensemble du contenu de LinkUp (logo, design, code, textes) est la propriété exclusive de LinkUp. Toute reproduction non autorisée est interdite.
            </Section>

            <Section title="6. Droit applicable">
              Les présentes CGU sont soumises au droit suisse. Tout litige sera soumis aux tribunaux compétents du canton de Vaud, Suisse.
            </Section>
          </div>
        )}

        {section === 'confidentialite' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#E24B4A'}}>Politique de Confidentialité</h3>
            <p style={{fontSize:12,color:'#999'}}>Conforme au nLPD (nouvelle Loi sur la Protection des Données, Suisse)</p>

            <Section title="1. Données collectées">
              LinkUp collecte les données suivantes : informations d'entreprise (nom, numéro IDE, adresse), informations du décideur (nom, prénom, titre), adresse email, données d'utilisation (matchs, messages, connexions).
            </Section>

            <Section title="2. Utilisation des données">
              Vos données sont utilisées exclusivement pour : le fonctionnement de la plateforme, la mise en relation avec d'autres entreprises, l'envoi de notifications liées à votre activité sur LinkUp, et l'amélioration de nos services.
            </Section>

            <Section title="3. Partage des données">
              LinkUp ne vend jamais vos données à des tiers. Les informations de votre profil sont visibles par les autres entreprises inscrites sur la plateforme dans le cadre normal d'utilisation.
            </Section>

            <Section title="4. Sécurité">
              Vos données sont stockées sur des serveurs sécurisés (Supabase) avec chiffrement SSL. Les mots de passe sont chiffrés et jamais accessibles en clair.
            </Section>

            <Section title="5. Vos droits">
              Conformément au nLPD, vous disposez du droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez-nous à : privacy@linkup.ch
            </Section>

            <Section title="6. Conservation">
              Vos données sont conservées pendant la durée de votre abonnement et 12 mois après la résiliation, sauf demande de suppression explicite.
            </Section>
          </div>
        )}

        {section === 'responsabilite' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#E24B4A'}}>Clause de Non-Responsabilité</h3>

            <Section title="1. Exactitude des informations">
              LinkUp ne peut être tenu responsable de l'exactitude des informations fournies par les entreprises inscrites. Chaque entreprise est seule responsable du contenu de son profil.
            </Section>

            <Section title="2. Relations commerciales">
              LinkUp est une plateforme de mise en relation. LinkUp n'est pas partie prenante dans les transactions, accords ou contrats conclus entre les entreprises. Toute relation commerciale établie via LinkUp est sous la seule responsabilité des parties concernées.
            </Section>

            <Section title="3. Disponibilité du service">
              LinkUp s'efforce d'assurer une disponibilité maximale de la plateforme mais ne peut garantir un accès ininterrompu. Des maintenances peuvent occasionner des interruptions temporaires.
            </Section>

            <Section title="4. Contenu des messages">
              LinkUp n'est pas responsable du contenu des messages échangés entre utilisateurs. Tout abus peut être signalé à abuse@linkup.ch.
            </Section>

            <Section title="5. Vérification Zefix">
              La vérification du numéro IDE via Zefix est effectuée à titre indicatif. LinkUp ne peut garantir la validité permanente d'une inscription au registre du commerce.
            </Section>
          </div>
        )}

        {section === 'mentions' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h3 style={{fontSize:16,fontWeight:700,color:'#E24B4A'}}>Mentions Légales</h3>

            <Section title="Éditeur">
              LinkUp{'\n'}
              Plateforme de mise en relation B2B{'\n'}
              Suisse{'\n'}
              contact@linkup.ch
            </Section>

            <Section title="Hébergement">
              Vercel Inc.{'\n'}
              340 Pine Street, Suite 701{'\n'}
              San Francisco, CA 94104, USA{'\n'}
              {'\n'}
              Base de données : Supabase (AWS eu-west-1)
            </Section>

            <Section title="Propriété intellectuelle">
              © 2026 LinkUp. Tous droits réservés.{'\n'}
              Le contenu, le design et le code source de LinkUp sont protégés par le droit suisse de la propriété intellectuelle.
            </Section>

            <Section title="Contact">
              Pour toute question légale : legal@linkup.ch{'\n'}
              Pour la protection des données : privacy@linkup.ch{'\n'}
              Pour les abus : abuse@linkup.ch
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{background:'#f9f9f9',borderRadius:10,padding:'1rem'}}>
      <p style={{fontWeight:700,fontSize:14,marginBottom:6,color:'#1a1a1a'}}>{title}</p>
      <p style={{fontSize:13,color:'#555',lineHeight:1.7,whiteSpace:'pre-line'}}>{children}</p>
    </div>
  )
}