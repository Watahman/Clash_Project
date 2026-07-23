import { getLanguage, initI18n } from '../i18n/i18n.js';

const content = {
    privacy: {
        en: {
            title: 'Privacy policy',
            description: 'How ClashTools handles account, planner, group and technical data.',
            summary: 'This draft explains the data flows visible in the current ClashTools codebase. It is not a legal guarantee and should be reviewed against the final hosting and Supabase configuration before publication.',
            sections: [
                ['Data we process', [
                    'Account data such as your email address, display name and authentication identifiers.',
                    'Clash of Clans player tags, verified linked accounts and the plan, group, poll and reminder data you choose to create.',
                    'Essential session cookies, local preferences and cached responses used to keep the application working.',
                    'Limited technical records produced by the hosting platform and backend, such as request status, timing and security events.'
                ]],
                ['Why we use it', [
                    'To authenticate users, enforce access to the correct records, save CWL plans, operate groups and polls, and protect the service against abuse.',
                    'Player and clan tags are sent through the ClashTools backend to the official Clash of Clans API. Authentication and application records are handled through Supabase.'
                ]],
                ['Storage and sharing', [
                    'Supabase stores account and application records. The browser stores language, theme, selected context and short-lived cached responses in local storage or IndexedDB.',
                    'ClashTools does not sell personal data. Data is shared only with service providers needed to operate the application, subject to their own terms and the final production configuration.'
                ]],
                ['Retention and your choices', [
                    'Records should be kept only while needed for the service, security, backup and legal obligations. Exact production retention periods still require operator review.',
                    'You may request access, correction or deletion through the contact route. Applicable rights depend on your location. Do not publish passwords, tokens or other private data in a public issue.'
                ]],
                ['Security and changes', [
                    'ClashTools uses server-side credentials, authenticated sessions, ownership checks and database row-level policies. No online service can promise absolute security.',
                    'This draft should be updated when hosting, analytics, advertising, contact details or data processors change.'
                ]]
            ]
        },
        nl: {
            title: 'Privacybeleid',
            description: 'Hoe ClashTools omgaat met account-, planner-, groeps- en technische gegevens.',
            summary: 'Dit concept beschrijft de gegevensstromen die in de huidige ClashTools-code zichtbaar zijn. Het is geen juridische garantie en moet vóór publicatie worden gecontroleerd tegen de definitieve hosting- en Supabase-configuratie.',
            sections: [
                ['Gegevens die we verwerken', [
                    'Accountgegevens zoals je e-mailadres, weergavenaam en authenticatie-identificatoren.',
                    'Clash of Clans-spelertags, geverifieerde gekoppelde accounts en de plan-, groeps-, poll- en remindergegevens die je zelf aanmaakt.',
                    'Essentiële sessiecookies, lokale voorkeuren en gecachte antwoorden die nodig zijn om de applicatie te laten werken.',
                    'Beperkte technische registraties van hosting en backend, zoals requeststatus, doorlooptijd en beveiligingsgebeurtenissen.'
                ]],
                ['Waarom we deze gegevens gebruiken', [
                    'Om gebruikers te authenticeren, toegang tot de juiste records af te dwingen, CWL-plannen te bewaren, groepen en polls te gebruiken en misbruik te beperken.',
                    'Speler- en clantags worden via de ClashTools-backend naar de officiële Clash of Clans API gestuurd. Authenticatie en applicatiegegevens lopen via Supabase.'
                ]],
                ['Opslag en delen', [
                    'Supabase bewaart account- en applicatierecords. De browser bewaart taal, thema, geselecteerde context en tijdelijke cachedata in local storage of IndexedDB.',
                    'ClashTools verkoopt geen persoonsgegevens. Gegevens worden alleen gedeeld met dienstverleners die nodig zijn voor de werking, volgens hun eigen voorwaarden en de definitieve productieconfiguratie.'
                ]],
                ['Bewaartermijnen en je keuzes', [
                    'Records horen alleen bewaard te blijven zolang dat nodig is voor de dienst, beveiliging, back-ups en wettelijke verplichtingen. Exacte productietermijnen moeten nog door de beheerder worden vastgelegd.',
                    'Je kunt via de contactroute inzage, correctie of verwijdering vragen. Welke rechten gelden hangt af van je locatie. Plaats nooit wachtwoorden, tokens of andere privégegevens in een publiek issue.'
                ]],
                ['Beveiliging en wijzigingen', [
                    'ClashTools gebruikt server-side credentials, geauthenticeerde sessies, eigendomscontroles en row-level databasebeleid. Geen enkele onlinedienst kan absolute beveiliging garanderen.',
                    'Dit concept moet worden bijgewerkt wanneer hosting, analytics, advertenties, contactgegevens of verwerkers wijzigen.'
                ]]
            ]
        }
    },
    cookies: {
        en: {
            title: 'Cookie policy',
            description: 'Essential cookies and browser storage used by ClashTools.',
            summary: 'ClashTools currently uses essential authentication cookies and browser storage. The reviewed code does not include advertising or analytics cookies.',
            sections: [
                ['Essential session cookies', [
                    'The HttpOnly cookies ct_access and ct_refresh keep you signed in. Temporary HttpOnly cookies support the Google sign-in flow. Secure and SameSite settings must be enabled correctly for the production domain.',
                    'These cookies are necessary for requested account functions and cannot be disabled inside ClashTools without signing out.'
                ]],
                ['Browser storage', [
                    'Local storage remembers language, theme and the selected plan or group. IndexedDB caches recent responses so pages can load reliably and reduce repeated requests.',
                    'You can clear this data through browser settings. Clearing it can reset preferences and remove offline fallback data, but does not delete server-side account records.'
                ]],
                ['Third-party resources', [
                    'The current interface loads fonts from Google Fonts. That request can expose technical connection data such as an IP address and user agent to the provider.',
                    'No consent-management platform is present in the reviewed code. If non-essential cookies or tracking are added, ClashTools must request consent where required and expose a footer control to reopen preferences.'
                ]]
            ]
        },
        nl: {
            title: 'Cookiebeleid',
            description: 'Essentiële cookies en browseropslag die ClashTools gebruikt.',
            summary: 'ClashTools gebruikt momenteel essentiële authenticatiecookies en browseropslag. De gecontroleerde code bevat geen advertentie- of analyticscookies.',
            sections: [
                ['Essentiële sessiecookies', [
                    'De HttpOnly-cookies ct_access en ct_refresh houden je aangemeld. Tijdelijke HttpOnly-cookies ondersteunen de Google-loginflow. Secure- en SameSite-instellingen moeten correct staan voor het productiedomein.',
                    'Deze cookies zijn nodig voor de gevraagde accountfuncties en kunnen binnen ClashTools niet worden uitgeschakeld zonder uit te loggen.'
                ]],
                ['Browseropslag', [
                    'Local storage onthoudt taal, thema en het geselecteerde plan of de geselecteerde groep. IndexedDB cachet recente antwoorden zodat pagina’s betrouwbaar laden en minder dubbele requests uitvoeren.',
                    'Je kunt deze gegevens via je browserinstellingen wissen. Dat kan voorkeuren resetten en offline fallbackdata verwijderen, maar verwijdert geen server-side accountrecords.'
                ]],
                ['Externe bronnen', [
                    'De huidige interface laadt lettertypes via Google Fonts. Die aanvraag kan technische verbindingsgegevens zoals een IP-adres en user agent met de provider delen.',
                    'In de gecontroleerde code is geen consent management platform aanwezig. Als later niet-essentiële cookies of tracking worden toegevoegd, moet ClashTools waar nodig toestemming vragen en in de footer een knop tonen waarmee voorkeuren opnieuw geopend kunnen worden.'
                ]]
            ]
        }
    },
    terms: {
        en: {
            title: 'Terms of use',
            description: 'Draft rules for responsible use of ClashTools.',
            summary: 'These draft terms describe the intended use of ClashTools. They should be legally reviewed and completed with operator details and governing-law choices before publication.',
            sections: [
                ['Using ClashTools', [
                    'Use the service only for lawful clan organisation and fan-content purposes. Keep your account credentials secure and provide accurate information where the workflow depends on it.',
                    'Do not attempt to access another user’s records, bypass rate limits, disrupt the service, automate abusive traffic or use ClashTools for account trading, cheats or other conduct prohibited by Supercell.'
                ]],
                ['Availability and changes', [
                    'Features can be changed, limited or temporarily unavailable for maintenance, security or upstream API reasons. ClashTools does not promise uninterrupted availability or specific game results.',
                    'Draft, live-war and prediction information should be checked before making important clan decisions.'
                ]],
                ['Your content', [
                    'You remain responsible for plan names, group content and other information you submit. Do not upload confidential, unlawful or infringing content.',
                    'You grant the service only the access needed to store, process and display that content for the requested ClashTools functions.'
                ]],
                ['Unofficial fan content', [
                    'ClashTools is unofficial and is not endorsed by Supercell. Use of Supercell game names and assets remains subject to Supercell’s Fan Content Policy.'
                ]]
            ]
        },
        nl: {
            title: 'Gebruiksvoorwaarden',
            description: 'Conceptregels voor verantwoord gebruik van ClashTools.',
            summary: 'Deze conceptvoorwaarden beschrijven het bedoelde gebruik van ClashTools. Laat ze juridisch controleren en vul beheerdersgegevens en rechtskeuze aan vóór publicatie.',
            sections: [
                ['ClashTools gebruiken', [
                    'Gebruik de dienst alleen voor rechtmatige clanorganisatie en fancontent. Beveilig je accountgegevens en geef correcte informatie wanneer de workflow daarvan afhangt.',
                    'Probeer geen records van andere gebruikers te openen, omzeil geen rate limits, verstoor de dienst niet, automatiseer geen misbruik en gebruik ClashTools niet voor account trading, cheats of ander gedrag dat Supercell verbiedt.'
                ]],
                ['Beschikbaarheid en wijzigingen', [
                    'Functies kunnen wijzigen, beperkt worden of tijdelijk niet beschikbaar zijn door onderhoud, beveiliging of externe API’s. ClashTools belooft geen ononderbroken beschikbaarheid of specifieke spelresultaten.',
                    'Controleer plan-, live-war- en voorspellingsinformatie voordat je belangrijke clanbeslissingen neemt.'
                ]],
                ['Jouw inhoud', [
                    'Je blijft verantwoordelijk voor plannamen, groepsinhoud en andere informatie die je indient. Upload geen vertrouwelijke, onrechtmatige of inbreukmakende inhoud.',
                    'Je geeft de dienst alleen de toegang die nodig is om die inhoud voor de gevraagde ClashTools-functies op te slaan, te verwerken en te tonen.'
                ]],
                ['Onofficiële fancontent', [
                    'ClashTools is onofficieel en wordt niet ondersteund door Supercell. Het gebruik van spel- en merknamen en assets van Supercell blijft onderworpen aan het Fan Content Policy van Supercell.'
                ]]
            ]
        }
    },
    contact: {
        en: {
            title: 'Contact',
            description: 'How to contact the ClashTools project.',
            summary: 'For bugs and general project questions, use the project issue tracker. It is public: never include passwords, access tokens, verification tokens or personal account data.',
            sections: [
                ['Project support', [
                    'Describe the affected page, what you expected and what happened. Screenshots are useful only after private names, tags and account details have been removed.',
                    'A private operator contact for privacy and account-deletion requests must be configured before public launch. Until then, do not submit personal data through the public issue tracker.'
                ]],
                ['Security reports', [
                    'Do not publish a security vulnerability or suspected secret in a public issue. The production operator must provide a private security-reporting route before launch.'
                ]]
            ],
            links: [['Open the public issue tracker', 'https://github.com/Watahman/Clash_Project/issues']]
        },
        nl: {
            title: 'Contact',
            description: 'Hoe je contact opneemt met het ClashTools-project.',
            summary: 'Gebruik voor bugs en algemene projectvragen de issue tracker van het project. Die is publiek: plaats er nooit wachtwoorden, access tokens, verificatietokens of persoonlijke accountgegevens.',
            sections: [
                ['Projectondersteuning', [
                    'Beschrijf om welke pagina het gaat, wat je verwachtte en wat er gebeurde. Screenshots zijn alleen bruikbaar nadat privénamen, tags en accountdetails verwijderd zijn.',
                    'Vóór publieke lancering moet een privécontactroute voor privacy- en accountverwijderingsverzoeken worden ingesteld. Deel tot dan geen persoonsgegevens via de publieke issue tracker.'
                ]],
                ['Beveiligingsmeldingen', [
                    'Publiceer geen beveiligingslek of vermoedelijk secret in een publiek issue. De productiebeheerder moet vóór lancering een private meldroute voorzien.'
                ]]
            ],
            links: [['Open de publieke issue tracker', 'https://github.com/Watahman/Clash_Project/issues']]
        }
    }
};

function languageFor(documentContent) {
    return getLanguage() === 'nl' ? 'nl' : 'en';
}

function render() {
    const root = document.querySelector('[data-policy-document]');
    if (!root) return;
    const documentContent = content[root.dataset.policyDocument];
    if (!documentContent) return;
    const language = languageFor(documentContent);
    const copy = documentContent[language];

    document.title = `${copy.title} · ClashTools`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.description);
    root.replaceChildren();

    const header = document.createElement('header');
    const concept = document.createElement('span');
    concept.className = 'policy-concept';
    concept.textContent = language === 'nl' ? 'Concept voor pre-launchcontrole' : 'Pre-launch draft';
    const title = document.createElement('h1');
    title.textContent = copy.title;
    const summary = document.createElement('p');
    summary.textContent = copy.summary;
    const updated = document.createElement('p');
    updated.textContent = language === 'nl' ? 'Laatst bijgewerkt: 23 juli 2026' : 'Last updated: 23 July 2026';
    header.append(concept, title, summary, updated);
    root.appendChild(header);

    copy.sections.forEach(([heading, paragraphs]) => {
        const section = document.createElement('section');
        const sectionTitle = document.createElement('h2');
        sectionTitle.textContent = heading;
        const list = document.createElement('ul');
        paragraphs.forEach(paragraph => {
            const item = document.createElement('li');
            item.textContent = paragraph;
            list.appendChild(item);
        });
        section.append(sectionTitle, list);
        root.appendChild(section);
    });

    (copy.links || []).forEach(([label, url]) => {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = label;
        root.appendChild(link);
    });
}

initI18n();
render();
window.addEventListener('clashtools:language-changed', render);
