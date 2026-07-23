import { getLanguage, initI18n } from '../i18n/i18n.js';

const content = {
    privacy: {
        en: {
            title: 'Privacy policy',
            description: 'How ClashPanel handles account, planner, group and technical data.',
            summary: 'This policy explains how ClashPanel handles the account, planner, group and technical data needed to provide the service.',
            sections: [
                ['Data we process', [
                    'Account data such as your email address, display name and authentication identifiers.',
                    'Clash of Clans player tags, verified linked accounts and the plan, group, poll and reminder data you choose to create.',
                    'Essential session cookies, local preferences and cached responses used to keep the application working.',
                    'Limited technical records produced by the hosting platform and backend, such as request status, timing and security events.'
                ]],
                ['Why we use it', [
                    'To authenticate users, enforce access to the correct records, save CWL plans, operate groups and polls, and protect the service against abuse.',
                    'Player and clan tags are sent through the ClashPanel backend to the official Clash of Clans API. Authentication and application records are handled through Supabase.'
                ]],
                ['Storage and sharing', [
                    'Supabase stores account and application records. The browser stores language, theme, selected context and short-lived cached responses in local storage or IndexedDB.',
                    'ClashPanel does not sell personal data. Data is shared only with service providers needed to operate the application, subject to their own terms.'
                ]],
                ['Retention and your choices', [
                    'Records are kept only while needed for the service, security, backups and legal obligations.',
                    'You may request access, correction or deletion through support.clashpanel@gmail.com. Applicable rights depend on your location. Never email passwords, access tokens or verification tokens.'
                ]],
                ['Security and changes', [
                    'ClashPanel uses server-side credentials, authenticated sessions, ownership checks and database row-level policies. No online service can promise absolute security.',
                    'This policy is updated when hosting, analytics, advertising, contact details or data processors change.'
                ]]
            ]
        },
        nl: {
            title: 'Privacybeleid',
            description: 'Hoe ClashPanel omgaat met account-, planner-, groeps- en technische gegevens.',
            summary: 'Dit beleid legt uit hoe ClashPanel omgaat met de account-, planner-, groeps- en technische gegevens die nodig zijn om de dienst aan te bieden.',
            sections: [
                ['Gegevens die we verwerken', [
                    'Accountgegevens zoals je e-mailadres, weergavenaam en authenticatie-identificatoren.',
                    'Clash of Clans-spelertags, geverifieerde gekoppelde accounts en de plan-, groeps-, poll- en remindergegevens die je zelf aanmaakt.',
                    'Essentiële sessiecookies, lokale voorkeuren en gecachte antwoorden die nodig zijn om de applicatie te laten werken.',
                    'Beperkte technische registraties van hosting en backend, zoals requeststatus, doorlooptijd en beveiligingsgebeurtenissen.'
                ]],
                ['Waarom we deze gegevens gebruiken', [
                    'Om gebruikers te authenticeren, toegang tot de juiste records af te dwingen, CWL-plannen te bewaren, groepen en polls te gebruiken en misbruik te beperken.',
                    'Speler- en clantags worden via de ClashPanel-backend naar de officiële Clash of Clans API gestuurd. Authenticatie en applicatiegegevens lopen via Supabase.'
                ]],
                ['Opslag en delen', [
                    'Supabase bewaart account- en applicatierecords. De browser bewaart taal, thema, geselecteerde context en tijdelijke cachedata in local storage of IndexedDB.',
                    'ClashPanel verkoopt geen persoonsgegevens. Gegevens worden alleen gedeeld met dienstverleners die nodig zijn voor de werking, volgens hun eigen voorwaarden.'
                ]],
                ['Bewaartermijnen en je keuzes', [
                    'Records worden alleen bewaard zolang dat nodig is voor de dienst, beveiliging, back-ups en wettelijke verplichtingen.',
                    'Je kunt via support.clashpanel@gmail.com inzage, correctie of verwijdering vragen. Welke rechten gelden hangt af van je locatie. Mail nooit wachtwoorden, access tokens of verificatietokens.'
                ]],
                ['Beveiliging en wijzigingen', [
                    'ClashPanel gebruikt server-side credentials, geauthenticeerde sessies, eigendomscontroles en row-level databasebeleid. Geen enkele onlinedienst kan absolute beveiliging garanderen.',
                    'Dit beleid wordt bijgewerkt wanneer hosting, analytics, advertenties, contactgegevens of verwerkers wijzigen.'
                ]]
            ]
        }
    },
    cookies: {
        en: {
            title: 'Cookie policy',
            description: 'Essential cookies and browser storage used by ClashPanel.',
            summary: 'ClashPanel uses essential authentication cookies and browser storage. It does not use advertising or analytics cookies.',
            sections: [
                ['Essential session cookies', [
                    'The HttpOnly cookies ct_access and ct_refresh keep you signed in. Temporary HttpOnly cookies support the Google sign-in flow. Secure and SameSite settings protect these cookies on the production domain.',
                    'These cookies are necessary for requested account functions and cannot be disabled inside ClashPanel without signing out.'
                ]],
                ['Browser storage', [
                    'Local storage remembers language, theme and the selected plan or group. IndexedDB caches recent responses so pages can load reliably and reduce repeated requests.',
                    'You can clear this data through browser settings. Clearing it can reset preferences and remove offline fallback data, but does not delete server-side account records.'
                ]],
                ['Third-party resources', [
                    'The current interface loads fonts from Google Fonts. That request can expose technical connection data such as an IP address and user agent to the provider.',
                    'ClashPanel does not currently use non-essential cookies or tracking. If this changes, consent will be requested where required and cookie preferences will remain accessible.'
                ]]
            ]
        },
        nl: {
            title: 'Cookiebeleid',
            description: 'Essentiële cookies en browseropslag die ClashPanel gebruikt.',
            summary: 'ClashPanel gebruikt essentiële authenticatiecookies en browseropslag. Er worden geen advertentie- of analyticscookies gebruikt.',
            sections: [
                ['Essentiële sessiecookies', [
                    'De HttpOnly-cookies ct_access en ct_refresh houden je aangemeld. Tijdelijke HttpOnly-cookies ondersteunen de Google-loginflow. Secure- en SameSite-instellingen beschermen deze cookies op het productiedomein.',
                    'Deze cookies zijn nodig voor de gevraagde accountfuncties en kunnen binnen ClashPanel niet worden uitgeschakeld zonder uit te loggen.'
                ]],
                ['Browseropslag', [
                    'Local storage onthoudt taal, thema en het geselecteerde plan of de geselecteerde groep. IndexedDB cachet recente antwoorden zodat pagina’s betrouwbaar laden en minder dubbele requests uitvoeren.',
                    'Je kunt deze gegevens via je browserinstellingen wissen. Dat kan voorkeuren resetten en offline fallbackdata verwijderen, maar verwijdert geen server-side accountrecords.'
                ]],
                ['Externe bronnen', [
                    'De huidige interface laadt lettertypes via Google Fonts. Die aanvraag kan technische verbindingsgegevens zoals een IP-adres en user agent met de provider delen.',
                    'ClashPanel gebruikt momenteel geen niet-essentiële cookies of tracking. Als dit verandert, wordt waar nodig toestemming gevraagd en blijven cookievoorkeuren toegankelijk.'
                ]]
            ]
        }
    },
    terms: {
        en: {
            title: 'Terms of use',
            description: 'Rules for responsible use of ClashPanel.',
            summary: 'These terms describe the responsible and permitted use of ClashPanel.',
            sections: [
                ['Using ClashPanel', [
                    'Use the service only for lawful clan organisation and fan-content purposes. Keep your account credentials secure and provide accurate information where the workflow depends on it.',
                    'Do not attempt to access another user’s records, bypass rate limits, disrupt the service, automate abusive traffic or use ClashPanel for account trading, cheats or other conduct prohibited by Supercell.'
                ]],
                ['Availability and changes', [
                    'Features can be changed, limited or temporarily unavailable for maintenance, security or upstream API reasons. ClashPanel does not promise uninterrupted availability or specific game results.',
                    'Plan, live-war and prediction information should be checked before making important clan decisions.'
                ]],
                ['Your content', [
                    'You remain responsible for plan names, group content and other information you submit. Do not upload confidential, unlawful or infringing content.',
                    'You grant the service only the access needed to store, process and display that content for the requested ClashPanel functions.'
                ]],
                ['Unofficial fan content', [
                    'ClashPanel is unofficial and is not endorsed by Supercell. Use of Supercell game names and assets remains subject to Supercell’s Fan Content Policy.'
                ]]
            ]
        },
        nl: {
            title: 'Gebruiksvoorwaarden',
            description: 'Regels voor verantwoord gebruik van ClashPanel.',
            summary: 'Deze voorwaarden beschrijven het verantwoorde en toegestane gebruik van ClashPanel.',
            sections: [
                ['ClashPanel gebruiken', [
                    'Gebruik de dienst alleen voor rechtmatige clanorganisatie en fancontent. Beveilig je accountgegevens en geef correcte informatie wanneer de workflow daarvan afhangt.',
                    'Probeer geen records van andere gebruikers te openen, omzeil geen rate limits, verstoor de dienst niet, automatiseer geen misbruik en gebruik ClashPanel niet voor account trading, cheats of ander gedrag dat Supercell verbiedt.'
                ]],
                ['Beschikbaarheid en wijzigingen', [
                    'Functies kunnen wijzigen, beperkt worden of tijdelijk niet beschikbaar zijn door onderhoud, beveiliging of externe API’s. ClashPanel belooft geen ononderbroken beschikbaarheid of specifieke spelresultaten.',
                    'Controleer plan-, live-war- en voorspellingsinformatie voordat je belangrijke clanbeslissingen neemt.'
                ]],
                ['Jouw inhoud', [
                    'Je blijft verantwoordelijk voor plannamen, groepsinhoud en andere informatie die je indient. Upload geen vertrouwelijke, onrechtmatige of inbreukmakende inhoud.',
                    'Je geeft de dienst alleen de toegang die nodig is om die inhoud voor de gevraagde ClashPanel-functies op te slaan, te verwerken en te tonen.'
                ]],
                ['Onofficiële fancontent', [
                    'ClashPanel is onofficieel en wordt niet ondersteund door Supercell. Het gebruik van spel- en merknamen en assets van Supercell blijft onderworpen aan het Fan Content Policy van Supercell.'
                ]]
            ]
        }
    },
    contact: {
        en: {
            title: 'Contact',
            description: 'Contact ClashPanel support for bugs, feature requests, privacy and account questions.',
            summary: 'Email support.clashpanel@gmail.com for bug reports, feature requests and general project questions.',
            sections: [
                ['Project support', [
                    'For a bug report, describe the affected page, what you expected and what happened. Screenshots are useful after private names, tags and account details have been removed.',
                    'For a feature request, explain the problem you want to solve, the result you expect and which ClashPanel workflow it affects.'
                ]],
                ['Privacy, accounts and security', [
                    'Use the support email for privacy questions, account-deletion requests and private security reports. Never email passwords, access tokens or verification tokens.'
                ]]
            ],
            links: [
                ['Report a bug', 'mailto:support.clashpanel@gmail.com?subject=ClashPanel%20bug%20report'],
                ['Request a feature', 'mailto:support.clashpanel@gmail.com?subject=ClashPanel%20feature%20request']
            ]
        },
        nl: {
            title: 'Contact',
            description: 'Neem contact op met ClashPanel voor bugs, feature requests, privacy- en accountvragen.',
            summary: 'Mail naar support.clashpanel@gmail.com voor bugmeldingen, feature requests en algemene projectvragen.',
            sections: [
                ['Projectondersteuning', [
                    'Beschrijf bij een bugmelding om welke pagina het gaat, wat je verwachtte en wat er gebeurde. Verwijder privénamen, tags en accountdetails uit screenshots.',
                    'Leg bij een feature request uit welk probleem je wilt oplossen, welk resultaat je verwacht en op welke ClashPanel-workflow het betrekking heeft.'
                ]],
                ['Privacy, accounts en beveiliging', [
                    'Gebruik het supportadres voor privacyvragen, accountverwijdering en private beveiligingsmeldingen. Mail nooit wachtwoorden, access tokens of verificatietokens.'
                ]]
            ],
            links: [
                ['Bug melden', 'mailto:support.clashpanel@gmail.com?subject=ClashPanel%20bugmelding'],
                ['Feature aanvragen', 'mailto:support.clashpanel@gmail.com?subject=ClashPanel%20feature%20request']
            ]
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

    document.title = `${copy.title} · ClashPanel`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.description);
    root.replaceChildren();

    const header = document.createElement('header');
    const title = document.createElement('h1');
    title.textContent = copy.title;
    const summary = document.createElement('p');
    summary.textContent = copy.summary;
    const updated = document.createElement('p');
    updated.textContent = language === 'nl' ? 'Laatst bijgewerkt: 23 juli 2026' : 'Last updated: 23 July 2026';
    header.append(title, summary, updated);
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

    const links = copy.links || [];
    const actions = document.createElement('div');
    actions.className = 'policy-actions';
    links.forEach(([label, url]) => {
        const link = document.createElement('a');
        link.href = url;
        if (/^https?:/i.test(url)) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }
        link.className = 'button button-secondary';
        link.textContent = label;
        actions.appendChild(link);
    });
    if (links.length) root.appendChild(actions);
}

initI18n();
render();
window.addEventListener('clashtools:language-changed', render);
