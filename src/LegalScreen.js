import { useState } from 'react'

const legalContent = {
  fr: {
    title: 'Informations légales',
    tabs: ['CGU', 'Confidentialité', 'Responsabilité', 'Mentions légales'],
    cgu: {
      title: "Conditions Générales d'Utilisation",
      updated: 'Dernière mise à jour : mars 2026',
      sections: [
        { title: '1. Objet', content: "Hubbing est une plateforme de mise en relation B2B exclusivement réservée aux entreprises légalement enregistrées en Suisse. En créant un compte, vous acceptez les présentes CGU dans leur intégralité." },
        { title: '2. Conditions d\'accès', content: "L'accès à Hubbing est réservé aux entreprises disposant d'un numéro IDE valide (CHE-xxx.xxx.xxx) enregistré auprès du Registre du commerce suisse (Zefix). Toute inscription frauduleuse entraîne la suppression immédiate du compte sans remboursement." },
        { title: '3. Engagement comportemental', content: "En utilisant Hubbing, vous vous engagez à :\n• Respecter les autres utilisateurs en toutes circonstances\n• N'utiliser la plateforme qu'à des fins professionnelles et légitimes\n• Ne pas publier d'informations fausses, trompeuses ou diffamatoires\n• Ne pas harceler, insulter ou menacer d'autres utilisateurs\n• Ne pas usurper l'identité d'une autre entreprise\n\nTout manquement à ces règles peut entraîner des poursuites légales conformément au droit suisse." },
        { title: '4. Obligation d\'échange', content: "Après un match confirmé, les deux parties s'engagent à échanger au moins un message dans un délai de 7 jours. En l'absence de message, le match est annulé automatiquement. Un compte inactif depuis plus de 3 mois fera l'objet d'un avertissement, puis d'une suspension." },
        { title: '5. Abonnements et paiements', content: "Les abonnements Basic (CHF 19/mois) et Premium (CHF 39/mois) sont renouvelés automatiquement chaque mois.\n\nL'offre Fondateurs (2 mois offerts) est limitée aux 100 premiers abonnés Premium et non cumulable avec d'autres offres.\n\nRésiliation : possible à tout moment depuis votre profil, avec effet à la fin de la période en cours. Aucun remboursement pour la période déjà entamée.\n\nEn cas de bannissement pour non-respect des CGU, aucun remboursement ne sera effectué." },
        { title: '6. Sanctions et bannissement', content: "Hubbing se réserve le droit de suspendre ou bannir définitivement tout compte en cas de :\n• Non-respect des règles de comportement\n• Informations frauduleuses\n• Comportement abusif signalé par plusieurs utilisateurs\n• Inactivité prolongée après avertissement\n\nLes décisions de bannissement sont finales et sans appel. Aucun remboursement ne sera accordé." },
        { title: '7. Contenu interdit et modération', content: "Hubbing applique une politique stricte de tolérance zéro envers tout contenu inapproprié.\n\nSont formellement interdits sur la plateforme :\n• Tout contenu à caractère sexuel, pornographique ou obscène\n• Tout contenu raciste, xénophobe, antisémite ou discriminatoire\n• Tout propos haineux, menaçant ou harcelant\n• Toute photo de profil indécente ou inappropriée\n• Tout message abusif, insultant ou diffamatoire\n\nTout manquement à ces règles entraîne :\n1. Un avertissement immédiat\n2. En cas de récidive : suspension temporaire du compte\n3. En cas de manquement grave ou répété : bannissement définitif sans remboursement\n\nHubbing se réserve le droit de signaler tout contenu illicite aux autorités compétentes et d'engager des poursuites pénales conformément au droit suisse (CP art. 197, 261bis).\n\nPour signaler un abus : abuse@hubbing.ch" },
        { title: '8. Propriété intellectuelle', content: "L'ensemble du contenu de Hubbing (logo, design, code, textes) est la propriété exclusive de Hubbing. Toute reproduction non autorisée est interdite et passible de poursuites." },
        { title: '9. Droit applicable et juridiction', content: "Les présentes CGU sont soumises au droit suisse. Tout litige sera soumis aux tribunaux compétents du canton de Vaud, Suisse, à l'exclusion de tout autre tribunal." },
      ]
    },
    confidentialite: {
      title: 'Politique de Confidentialité',
      updated: 'Conforme au nLPD (nouvelle Loi sur la Protection des Données, Suisse)',
      sections: [
        { title: '1. Données collectées', content: "Hubbing collecte les données suivantes :\n• Informations d'entreprise (nom, numéro IDE, adresse, secteur)\n• Informations du décideur (nom, prénom, titre, photo, LinkedIn)\n• Adresse email professionnelle\n• Données d'utilisation (matchs, messages, connexions, avis)\n• Données de localisation (canton, coordonnées GPS si activées)" },
        { title: '2. Utilisation des données', content: "Vos données sont utilisées exclusivement pour :\n• Le fonctionnement de la plateforme\n• La mise en relation avec d'autres entreprises\n• L'envoi de notifications liées à votre activité\n• L'amélioration de nos services\n• La vérification de conformité" },
        { title: '3. Partage des données', content: "Hubbing ne vend jamais vos données à des tiers. Les informations de votre profil sont visibles par les autres entreprises inscrites dans le cadre normal d'utilisation de la plateforme." },
        { title: '4. Sécurité', content: "Vos données sont stockées sur des serveurs sécurisés (Supabase, AWS eu-west-1) avec chiffrement SSL. Les mots de passe sont chiffrés et jamais accessibles en clair." },
        { title: '5. Vos droits', content: "Conformément au nLPD, vous disposez du droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits : privacy@hubbing.ch" },
        { title: '6. Conservation', content: "Vos données sont conservées pendant la durée de votre abonnement et 12 mois après la résiliation, sauf demande de suppression explicite." },
        { title: '7. Cookies', content: "Hubbing utilise uniquement des cookies techniques nécessaires au fonctionnement de la plateforme. Aucun cookie publicitaire n'est utilisé." },
      ]
    },
    responsabilite: {
      title: 'Clause de Non-Responsabilité',
      updated: '',
      sections: [
        { title: '1. Exactitude des informations', content: "Hubbing ne peut être tenu responsable de l'exactitude des informations fournies par les entreprises inscrites. Chaque entreprise est seule responsable du contenu de son profil." },
        { title: '2. Relations commerciales', content: "Hubbing est une plateforme de mise en relation. Hubbing n'est pas partie prenante dans les transactions, accords ou contrats conclus entre les entreprises. Toute relation commerciale établie via Hubbing est sous la seule responsabilité des parties." },
        { title: '3. Disponibilité du service', content: "Hubbing s'efforce d'assurer une disponibilité maximale mais ne peut garantir un accès ininterrompu. Des maintenances peuvent occasionner des interruptions temporaires." },
        { title: '4. Contenu des messages', content: "Hubbing n'est pas responsable du contenu des messages échangés entre utilisateurs. Tout abus peut être signalé à abuse@hubbing.ch" },
        { title: '5. Vérification Zefix', content: "La vérification du numéro IDE via Zefix est effectuée à titre indicatif. Hubbing ne peut garantir la validité permanente d'une inscription au registre du commerce." },
        { title: '6. Avis et évaluations', content: "Les avis publiés sur la plateforme reflètent l'opinion de leurs auteurs. Hubbing modère les avis mais ne peut être tenu responsable de leur contenu. Tout avis abusif peut être signalé et sera examiné dans un délai de 48h." },
      ]
    },
    mentions: {
      title: 'Mentions Légales',
      updated: '',
      sections: [
        { title: 'Éditeur', content: "Hubbing\nPlateforme de mise en relation B2B\nSuisse\ncontact@hubbing.ch" },
        { title: 'Hébergement', content: "Vercel Inc.\n340 Pine Street, Suite 701\nSan Francisco, CA 94104, USA\n\nBase de données : Supabase (AWS eu-west-1)" },
        { title: 'Propriété intellectuelle', content: "© 2026 Hubbing. Tous droits réservés.\nLe contenu, le design et le code source de Hubbing sont protégés par le droit suisse de la propriété intellectuelle." },
        { title: 'Contact', content: "Questions légales : legal@hubbing.ch\nProtection des données : privacy@hubbing.ch\nAbus et signalements : abuse@hubbing.ch\nSupport : support@hubbing.ch" },
      ]
    }
  },
  de: {
    title: 'Rechtliche Informationen',
    tabs: ['AGB', 'Datenschutz', 'Haftung', 'Impressum'],
    cgu: {
      title: 'Allgemeine Geschäftsbedingungen',
      updated: 'Letzte Aktualisierung: März 2026',
      sections: [
        { title: '1. Gegenstand', content: "Hubbing ist eine B2B-Vernetzungsplattform, die ausschliesslich für in der Schweiz rechtmässig registrierte Unternehmen bestimmt ist. Mit der Erstellung eines Kontos akzeptieren Sie diese AGB vollständig." },
        { title: '2. Zugangsbedingungen', content: "Der Zugang zu Hubbing ist auf Unternehmen mit einer gültigen UID-Nummer (CHE-xxx.xxx.xxx) beschränkt, die beim Schweizer Handelsregister (Zefix) eingetragen sind. Jede betrügerische Registrierung führt zur sofortigen Löschung des Kontos ohne Rückerstattung." },
        { title: '3. Verhaltensregeln', content: "Durch die Nutzung von Hubbing verpflichten Sie sich:\n• Andere Nutzer jederzeit zu respektieren\n• Die Plattform nur für professionelle und legitime Zwecke zu nutzen\n• Keine falschen, irreführenden oder verleumderischen Informationen zu veröffentlichen\n• Andere Nutzer nicht zu belästigen, zu beleidigen oder zu bedrohen\n• Keine andere Unternehmensidentität anzunehmen\n\nVerstösse können nach Schweizer Recht strafrechtlich verfolgt werden." },
        { title: '4. Austauschpflicht', content: "Nach einem bestätigten Match verpflichten sich beide Parteien, innerhalb von 7 Tagen mindestens eine Nachricht auszutauschen. Bei Ausbleiben wird das Match automatisch aufgehoben. Ein seit mehr als 3 Monaten inaktives Konto wird verwarnt und anschliessend gesperrt." },
        { title: '5. Abonnements und Zahlungen', content: "Die Abonnements Basic (CHF 19/Monat) und Premium (CHF 39/Monat) werden monatlich automatisch verlängert.\n\nKündigung: jederzeit möglich, wirksam zum Ende der laufenden Periode. Keine Rückerstattung für bereits begonnene Perioden.\n\nBei Sperrung wegen Verstosses gegen die AGB erfolgt keine Rückerstattung." },
        { title: '6. Sanktionen und Sperrung', content: "Hubbing behält sich das Recht vor, Konten bei Verstoss gegen die AGB zu sperren oder dauerhaft zu löschen. Sperrentscheidungen sind endgültig und nicht anfechtbar." },
        { title: '7. Verbotene Inhalte und Moderation', content: "Hubbing verfolgt eine strikte Nulltoleranzpolitik gegenüber unangemessenen Inhalten.\n\nAuf der Plattform sind ausdrücklich verboten:\n• Inhalte sexueller, pornografischer oder obszöner Natur\n• Rassistische, fremdenfeindliche, antisemitische oder diskriminierende Inhalte\n• Hassreden, Drohungen oder Belästigungen\n• Unangemessene Profilbilder\n• Beleidigende oder verleumderische Nachrichten\n\nVerstösse haben folgende Konsequenzen:\n1. Sofortige Verwarnung\n2. Bei Wiederholung: vorübergehende Sperrung\n3. Bei schwerwiegendem Verstoss: dauerhafter Ausschluss ohne Rückerstattung\n\nHubbing behält sich vor, illegale Inhalte den zuständigen Behörden zu melden und strafrechtliche Schritte einzuleiten.\n\nMissbrauch melden: abuse@hubbing.ch" },
        { title: '8. Anwendbares Recht', content: "Diese AGB unterliegen dem Schweizer Recht. Alle Streitigkeiten werden den zuständigen Gerichten des Kantons Waadt, Schweiz, vorgelegt." },
      ]
    },
    confidentialite: {
      title: 'Datenschutzrichtlinie',
      updated: 'Konform mit dem revDSG (revidiertes Datenschutzgesetz, Schweiz)',
      sections: [
        { title: '1. Erhobene Daten', content: "Hubbing erhebt folgende Daten:\n• Unternehmensinformationen (Name, UID-Nummer, Adresse, Sektor)\n• Informationen des Entscheidungsträgers (Name, Vorname, Titel, Foto, LinkedIn)\n• Professionelle E-Mail-Adresse\n• Nutzungsdaten (Matches, Nachrichten, Verbindungen, Bewertungen)" },
        { title: '2. Datennutzung', content: "Ihre Daten werden ausschliesslich verwendet für:\n• Den Betrieb der Plattform\n• Die Vernetzung mit anderen Unternehmen\n• Das Versenden von Benachrichtigungen\n• Die Verbesserung unserer Dienste" },
        { title: '3. Datenweitergabe', content: "Hubbing verkauft Ihre Daten niemals an Dritte. Ihre Profilinformationen sind für andere registrierte Unternehmen im Rahmen der normalen Plattformnutzung sichtbar." },
        { title: '4. Ihre Rechte', content: "Gemäss revDSG haben Sie das Recht auf Auskunft, Berichtigung und Löschung Ihrer Daten. Kontakt: privacy@hubbing.ch" },
        { title: '5. Aufbewahrung', content: "Ihre Daten werden während der Abonnementlaufzeit und 12 Monate nach der Kündigung aufbewahrt, sofern keine ausdrückliche Löschungsanfrage vorliegt." },
      ]
    },
    responsabilite: {
      title: 'Haftungsausschluss',
      updated: '',
      sections: [
        { title: '1. Richtigkeit der Informationen', content: "Hubbing kann nicht für die Richtigkeit der von registrierten Unternehmen bereitgestellten Informationen verantwortlich gemacht werden." },
        { title: '2. Geschäftsbeziehungen', content: "Hubbing ist eine Vernetzungsplattform und nicht Partei von Transaktionen oder Verträgen zwischen Unternehmen. Jede über Hubbing hergestellte Geschäftsbeziehung liegt in der alleinigen Verantwortung der beteiligten Parteien." },
        { title: '3. Verfügbarkeit des Dienstes', content: "Hubbing bemüht sich um maximale Verfügbarkeit, kann jedoch keinen ununterbrochenen Zugang garantieren." },
        { title: '4. Nachrichteninhalte', content: "Hubbing ist nicht verantwortlich für den Inhalt der zwischen Nutzern ausgetauschten Nachrichten. Missbrauch kann an abuse@hubbing.ch gemeldet werden." },
      ]
    },
    mentions: {
      title: 'Impressum',
      updated: '',
      sections: [
        { title: 'Herausgeber', content: "Hubbing\nB2B-Vernetzungsplattform\nSchweiz\ncontact@hubbing.ch" },
        { title: 'Hosting', content: "Vercel Inc.\n340 Pine Street, Suite 701\nSan Francisco, CA 94104, USA\n\nDatenbank: Supabase (AWS eu-west-1)" },
        { title: 'Geistiges Eigentum', content: "© 2026 Hubbing. Alle Rechte vorbehalten." },
        { title: 'Kontakt', content: "Rechtliche Fragen: legal@hubbing.ch\nDatenschutz: privacy@hubbing.ch\nMissbrauch: abuse@hubbing.ch\nSupport: support@hubbing.ch" },
      ]
    }
  },
  it: {
    title: 'Informazioni legali',
    tabs: ['CGU', 'Privacy', 'Responsabilità', 'Note legali'],
    cgu: {
      title: 'Condizioni Generali di Utilizzo',
      updated: 'Ultimo aggiornamento: marzo 2026',
      sections: [
        { title: '1. Oggetto', content: "Hubbing è una piattaforma di networking B2B riservata esclusivamente alle aziende legalmente registrate in Svizzera. Creando un account, accettate integralmente le presenti CGU." },
        { title: '2. Condizioni di accesso', content: "L'accesso a Hubbing è riservato alle aziende con un numero IDE valido (CHE-xxx.xxx.xxx) registrato presso il Registro di commercio svizzero (Zefix). Qualsiasi registrazione fraudolenta comporta la cancellazione immediata dell'account senza rimborso." },
        { title: '3. Impegno comportamentale', content: "Utilizzando Hubbing, vi impegnate a:\n• Rispettare gli altri utenti in ogni circostanza\n• Utilizzare la piattaforma solo per scopi professionali e legittimi\n• Non pubblicare informazioni false, fuorvianti o diffamatorie\n• Non molestare, insultare o minacciare altri utenti\n• Non usurpare l'identità di un'altra azienda\n\nQualsiasi violazione può comportare procedimenti legali ai sensi del diritto svizzero." },
        { title: '4. Obbligo di scambio', content: "Dopo un match confermato, entrambe le parti si impegnano a scambiare almeno un messaggio entro 7 giorni. In assenza di messaggi, il match viene annullato automaticamente. Un account inattivo da più di 3 mesi riceverà un avviso e poi verrà sospeso." },
        { title: '5. Abbonamenti e pagamenti', content: "Gli abbonamenti Basic (CHF 19/mese) e Premium (CHF 39/mese) si rinnovano automaticamente ogni mese.\n\nDisdetta: possibile in qualsiasi momento, con effetto alla fine del periodo in corso. Nessun rimborso per il periodo già iniziato.\n\nIn caso di ban per violazione delle CGU, nessun rimborso verrà effettuato." },
        { title: '6. Sanzioni e ban', content: "Hubbing si riserva il diritto di sospendere o bannare definitivamente qualsiasi account in caso di violazione delle CGU. Le decisioni di ban sono definitive e inappellabili." },
        { title: '7. Contenuti vietati e moderazione', content: "Hubbing applica una politica di tolleranza zero nei confronti dei contenuti inappropriati.\n\nSono formalmente vietati sulla piattaforma:\n• Contenuti di natura sessuale, pornografica o oscena\n• Contenuti razzisti, xenofobi, antisemiti o discriminatori\n• Discorsi d'odio, minacce o molestie\n• Foto profilo indecenti o inappropriate\n• Messaggi abusivi, insultanti o diffamatori\n\nLe violazioni comportano:\n1. Avviso immediato\n2. In caso di recidiva: sospensione temporanea\n3. In caso di violazione grave: ban definitivo senza rimborso\n\nHubbing si riserva il diritto di segnalare contenuti illeciti alle autorità competenti.\n\nSegnalare abusi: abuse@hubbing.ch" },
        { title: '8. Diritto applicabile', content: "Le presenti CGU sono soggette al diritto svizzero. Qualsiasi controversia sarà sottoposta ai tribunali competenti del Canton Vaud, Svizzera." },
      ]
    },
    confidentialite: {
      title: 'Politica sulla Privacy',
      updated: 'Conforme alla nLPD (nuova Legge sulla Protezione dei Dati, Svizzera)',
      sections: [
        { title: '1. Dati raccolti', content: "Hubbing raccoglie i seguenti dati:\n• Informazioni aziendali (nome, numero IDE, indirizzo, settore)\n• Informazioni del responsabile (nome, cognome, titolo, foto, LinkedIn)\n• Indirizzo email professionale\n• Dati di utilizzo (match, messaggi, connessioni, recensioni)" },
        { title: '2. Utilizzo dei dati', content: "I vostri dati sono utilizzati esclusivamente per:\n• Il funzionamento della piattaforma\n• Il networking con altre aziende\n• L'invio di notifiche\n• Il miglioramento dei nostri servizi" },
        { title: '3. Condivisione dei dati', content: "Hubbing non vende mai i vostri dati a terzi. Le informazioni del vostro profilo sono visibili alle altre aziende registrate nell'ambito del normale utilizzo della piattaforma." },
        { title: '4. I vostri diritti', content: "In conformità con la nLPD, avete il diritto di accesso, rettifica e cancellazione dei vostri dati. Contatto: privacy@hubbing.ch" },
        { title: '5. Conservazione', content: "I vostri dati vengono conservati per la durata dell'abbonamento e 12 mesi dopo la cancellazione, salvo richiesta esplicita di eliminazione." },
      ]
    },
    responsabilite: {
      title: 'Clausola di Non Responsabilità',
      updated: '',
      sections: [
        { title: '1. Accuratezza delle informazioni', content: "Hubbing non può essere ritenuta responsabile dell'accuratezza delle informazioni fornite dalle aziende registrate." },
        { title: '2. Relazioni commerciali', content: "Hubbing è una piattaforma di networking e non è parte di transazioni o contratti tra aziende. Qualsiasi relazione commerciale stabilita tramite Hubbing è sotto la sola responsabilità delle parti." },
        { title: '3. Disponibilità del servizio', content: "Hubbing si impegna a garantire la massima disponibilità ma non può garantire un accesso ininterrotto." },
        { title: '4. Contenuto dei messaggi', content: "Hubbing non è responsabile del contenuto dei messaggi scambiati tra utenti. Gli abusi possono essere segnalati a abuse@hubbing.ch" },
      ]
    },
    mentions: {
      title: 'Note Legali',
      updated: '',
      sections: [
        { title: 'Editore', content: "Hubbing\nPiattaforma di networking B2B\nSvizzera\ncontact@hubbing.ch" },
        { title: 'Hosting', content: "Vercel Inc.\n340 Pine Street, Suite 701\nSan Francisco, CA 94104, USA\n\nDatabase: Supabase (AWS eu-west-1)" },
        { title: 'Proprietà intellettuale', content: "© 2026 Hubbing. Tutti i diritti riservati." },
        { title: 'Contatto', content: "Questioni legali: legal@hubbing.ch\nPrivacy: privacy@hubbing.ch\nAbusi: abuse@hubbing.ch\nSupporto: support@hubbing.ch" },
      ]
    }
  },
  en: {
    title: 'Legal Information',
    tabs: ['T&C', 'Privacy', 'Liability', 'Legal Notice'],
    cgu: {
      title: 'Terms and Conditions',
      updated: 'Last updated: March 2026',
      sections: [
        { title: '1. Purpose', content: "Hubbing is a B2B networking platform exclusively reserved for companies legally registered in Switzerland. By creating an account, you fully accept these Terms and Conditions." },
        { title: '2. Access conditions', content: "Access to Hubbing is restricted to companies with a valid IDE number (CHE-xxx.xxx.xxx) registered with the Swiss Commercial Register (Zefix). Any fraudulent registration results in immediate account deletion without refund." },
        { title: '3. Behavioral commitment', content: "By using Hubbing, you agree to:\n• Respect other users at all times\n• Use the platform only for professional and legitimate purposes\n• Not publish false, misleading or defamatory information\n• Not harass, insult or threaten other users\n• Not impersonate another company\n\nAny breach may result in legal proceedings under Swiss law." },
        { title: '4. Exchange obligation', content: "After a confirmed match, both parties agree to exchange at least one message within 7 days. If no message is sent, the match is automatically cancelled. An account inactive for more than 3 months will receive a warning, then be suspended." },
        { title: '5. Subscriptions and payments', content: "Basic (CHF 19/month) and Premium (CHF 39/month) subscriptions are automatically renewed monthly.\n\nCancellation: possible at any time, effective at the end of the current period. No refund for the period already started.\n\nIn case of ban for violating T&C, no refund will be made." },
        { title: '6. Sanctions and banning', content: "Hubbing reserves the right to suspend or permanently ban any account for violating the T&C. Banning decisions are final and cannot be appealed." },
        { title: '7. Prohibited content and moderation', content: "Hubbing enforces a strict zero-tolerance policy against inappropriate content.\n\nThe following are strictly prohibited on the platform:\n• Sexual, pornographic or obscene content\n• Racist, xenophobic, antisemitic or discriminatory content\n• Hate speech, threats or harassment\n• Indecent or inappropriate profile pictures\n• Abusive, insulting or defamatory messages\n\nViolations result in:\n1. Immediate warning\n2. In case of repeat offense: temporary account suspension\n3. In case of serious or repeated violation: permanent ban without refund\n\nHubbing reserves the right to report illegal content to the competent authorities and to initiate criminal proceedings under Swiss law.\n\nReport abuse: abuse@hubbing.ch" },
        { title: '8. Applicable law', content: "These T&C are governed by Swiss law. Any dispute will be submitted to the competent courts of the Canton of Vaud, Switzerland." },
      ]
    },
    confidentialite: {
      title: 'Privacy Policy',
      updated: 'Compliant with the revFADP (revised Federal Act on Data Protection, Switzerland)',
      sections: [
        { title: '1. Data collected', content: "Hubbing collects the following data:\n• Company information (name, IDE number, address, sector)\n• Decision-maker information (name, title, photo, LinkedIn)\n• Professional email address\n• Usage data (matches, messages, connections, reviews)" },
        { title: '2. Data use', content: "Your data is used exclusively for:\n• Platform operation\n• Networking with other companies\n• Sending notifications\n• Improving our services" },
        { title: '3. Data sharing', content: "Hubbing never sells your data to third parties. Your profile information is visible to other registered companies as part of normal platform use." },
        { title: '4. Your rights', content: "In accordance with the revFADP, you have the right of access, rectification and deletion of your data. Contact: privacy@hubbing.ch" },
        { title: '5. Retention', content: "Your data is kept for the duration of your subscription and 12 months after cancellation, unless an explicit deletion request is made." },
      ]
    },
    responsabilite: {
      title: 'Disclaimer',
      updated: '',
      sections: [
        { title: '1. Accuracy of information', content: "Hubbing cannot be held responsible for the accuracy of information provided by registered companies." },
        { title: '2. Business relationships', content: "Hubbing is a networking platform and is not party to transactions or contracts between companies. Any business relationship established through Hubbing is under the sole responsibility of the parties involved." },
        { title: '3. Service availability', content: "Hubbing strives to ensure maximum availability but cannot guarantee uninterrupted access." },
        { title: '4. Message content', content: "Hubbing is not responsible for the content of messages exchanged between users. Abuse can be reported to abuse@hubbing.ch" },
      ]
    },
    mentions: {
      title: 'Legal Notice',
      updated: '',
      sections: [
        { title: 'Publisher', content: "Hubbing\nB2B Networking Platform\nSwitzerland\ncontact@hubbing.ch" },
        { title: 'Hosting', content: "Vercel Inc.\n340 Pine Street, Suite 701\nSan Francisco, CA 94104, USA\n\nDatabase: Supabase (AWS eu-west-1)" },
        { title: 'Intellectual property', content: "© 2026 Hubbing. All rights reserved." },
        { title: 'Contact', content: "Legal questions: legal@hubbing.ch\nData protection: privacy@hubbing.ch\nAbuse: abuse@hubbing.ch\nSupport: support@hubbing.ch" },
      ]
    }
  }
}
export default function LegalScreen({ setScreen, lang = 'fr' }) {
  const [section, setSection] = useState('cgu')
  const content = legalContent[lang] || legalContent.fr
  const sectionKeys = ['cgu', 'confidentialite', 'responsabilite', 'mentions']

  const getCurrentContent = () => {
    switch(section) {
      case 'cgu': return content.cgu
      case 'confidentialite': return content.confidentialite
      case 'responsabilite': return content.responsabilite
      case 'mentions': return content.mentions
      default: return content.cgu
    }
  }

  const current = getCurrentContent()

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <div style={{padding:'1rem 1.5rem',borderBottom:'1px solid #f0f0f0',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={() => setScreen('home')} style={{background:'none',border:'none',cursor:'pointer',color:'#666',fontSize:20}}>←</button>
        <h2 style={{fontSize:18,fontWeight:700}}>{content.title}</h2>
      </div>

      {/* Onglets */}
      <div style={{display:'flex',borderBottom:'1px solid #f0f0f0',overflowX:'auto'}}>
        {sectionKeys.map((key, i) => (
          <button key={key} onClick={() => setSection(key)}
            style={{padding:'12px 16px',background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight: section===key ? 600 : 400,color: section===key ? '#E24B4A' : '#666',borderBottom: section===key ? '2px solid #E24B4A' : '2px solid transparent',whiteSpace:'nowrap'}}>
            {content.tabs[i]}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'1.5rem'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
          <h3 style={{fontSize:16,fontWeight:700,color:'#E24B4A'}}>{current.title}</h3>
          {current.updated ? <p style={{fontSize:12,color:'#999'}}>{current.updated}</p> : null}

          {current.sections.map((s, i) => (
            <div key={i} style={{background:'#f9f9f9',borderRadius:10,padding:'1rem'}}>
              <p style={{fontWeight:700,fontSize:14,marginBottom:6,color:'#1a1a1a'}}>{s.title}</p>
              <p style={{fontSize:13,color:'#555',lineHeight:1.7,whiteSpace:'pre-line'}}>{s.content}</p>
            </div>
          ))}
        </div>
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