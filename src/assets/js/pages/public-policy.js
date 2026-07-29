import { getLanguage, initI18n } from '../i18n/i18n.js';

const SUPPORT_EMAIL = 'support.clashpanel@gmail.com';
const LAST_UPDATED_EN = '25 July 2026';
const LAST_UPDATED_NL = '25 juli 2026';

const content = {
    about: {
        showUpdated: false,
        en: {
            title: 'About ClashPanel',
            description: 'Why ClashPanel exists and how it helps Clash of Clans leaders plan and run Clan War League.',
            summary: 'ClashPanel is a focused workspace for clan leaders and CWL organisers who want clear decisions without rebuilding the same information in spreadsheets and chat.',
            sections: [
                ['Why it exists', [
                    'Clan War League planning brings together player accounts, availability, clan sizes, daily lineups and live results. ClashPanel keeps those parts connected so organisers can spend less time maintaining the process.',
                    'The goal is not to automate every clan decision. It is to provide a reliable starting point, visible context and tools that keep leaders in control.'
                ]],
                ['One connected workflow', [
                    'CWL Planner turns a player pool into multi-clan rosters and seven-day lineups. Operation Board follows the active league, participation and season history. Clan Families connect the members, accounts, clans and availability behind both tools.'
                ]],
                ['Built for clarity', [
                    'ClashPanel separates live facts from projections, keeps advisory recommendations visible as advice and treats unknown data as unknown.',
                    'The interface is designed for desktop and mobile use with familiar controls, visible states and a calm visual hierarchy.'
                ]],
                ['Independent project', [
                    'ClashPanel is an unofficial Clash of Clans fan project. It is not affiliated with, endorsed by or sponsored by Supercell.'
                ]]
            ],
            links: [
                ['Explore CWL Planner', '/cwl-planner'],
                ['Contact ClashPanel', '/subpages/contact']
            ]
        },
        nl: {
            title: 'Over ClashPanel',
            description: 'Waarom ClashPanel bestaat en hoe het Clash of Clans-leiders helpt om Clan War League te plannen en op te volgen.',
            summary: 'ClashPanel is een gerichte werkruimte voor clanleiders en CWL-organisatoren die duidelijke beslissingen willen nemen zonder dezelfde informatie telkens opnieuw in spreadsheets en chat te bouwen.',
            sections: [
                ['Waarom het bestaat', [
                    'Clan War League-planning brengt spelersaccounts, beschikbaarheid, clanguottes, dagelijkse line-ups en live resultaten samen. ClashPanel houdt die onderdelen verbonden zodat organisatoren minder tijd verliezen aan het onderhouden van hun proces.',
                    'Het doel is niet om elke clanbeslissing te automatiseren. ClashPanel biedt een betrouwbaar startpunt, zichtbare context en hulpmiddelen waarbij leiders de controle behouden.'
                ]],
                ['Eén verbonden workflow', [
                    'CWL Planner zet een spelerspool om in rosters voor meerdere clans en line-ups voor zeven dagen. Operation Board volgt de actieve league, deelname en seizoenshistoriek. Clan Families verbinden de leden, accounts, clans en beschikbaarheid achter beide tools.'
                ]],
                ['Gebouwd voor duidelijkheid', [
                    'ClashPanel houdt live feiten gescheiden van voorspellingen, toont aanbevelingen duidelijk als advies en behandelt onbekende data als onbekend.',
                    'De interface is ontworpen voor desktop en mobiel met herkenbare controls, zichtbare statussen en een rustige visuele hiërarchie.'
                ]],
                ['Onafhankelijk project', [
                    'ClashPanel is een onofficieel Clash of Clans-fanproject. Het is niet verbonden met, goedgekeurd door of gesponsord door Supercell.'
                ]]
            ],
            links: [
                ['Bekijk CWL Planner', '/cwl-planner'],
                ['Contacteer ClashPanel', '/subpages/contact']
            ]
        }
    },
    privacy: {
        en: {
            title: 'Privacy policy',
            description: 'How ClashPanel processes account, planner, Clan Family, advertising and technical data.',
            summary: 'This policy explains what personal data ClashPanel processes, why it is used, who may receive it and what choices and rights you have.',
            sections: [
                ['Who is responsible', [
                    `ClashPanel operates this website and determines how personal data is used for the ClashPanel service. Privacy requests can be sent to ${SUPPORT_EMAIL}.`,
                    'ClashPanel is an unofficial Clash of Clans fan project and is not affiliated with, endorsed by or sponsored by Supercell.'
                ]],
                ['Data we may process', [
                    'Account and authentication data, including your email address, display name, internal user identifiers and information required to maintain an authenticated session.',
                    'Clash of Clans data you provide or link, such as player tags and clan tags, together with public game information returned for those tags by the official Clash of Clans API.',
                    'Content and settings you create in ClashPanel, such as CWL plans, Clan Families, memberships, polls, reminders, planner drafts and related configuration.',
                    'Device and technical information generated when you use the service, such as IP address, browser or device information, request metadata, security events and diagnostic logs produced by hosting or infrastructure providers.',
                    'Cookie, local-storage and similar-technology data used for authentication, preferences, caching, consent choices and, where advertising is enabled, ad delivery and measurement.'
                ]],
                ['How we obtain data', [
                    'We receive information directly from you when you create an account, sign in, link a player, create content or contact support.',
                    'Public player and clan information is obtained from the official Clash of Clans API after a relevant tag is submitted through ClashPanel.',
                    'Technical information may be collected automatically by your browser, ClashPanel infrastructure and service providers when you access the website.'
                ]],
                ['Why we use data and legal bases', [
                    'We process account, planner and Clan Family data to provide the functions you request, maintain your account and deliver the ClashPanel service.',
                    'We may process limited technical and security data where necessary for legitimate interests such as protecting accounts, preventing abuse, troubleshooting failures and maintaining service reliability, while considering the rights and interests of users.',
                    'Where consent is legally required, consent is used for optional advertising cookies, local storage or related advertising purposes. You may withdraw consent through the available consent controls without affecting processing that occurred before withdrawal.',
                    'We may also process information where necessary to comply with applicable legal obligations or to establish, exercise or defend legal claims.'
                ]],
                ['Service providers and data sharing', [
                    'ClashPanel does not sell personal data. Information is shared only when needed to provide the service, comply with law, protect the service or when you direct us to do so.',
                    'Infrastructure and application providers may include Supabase for authentication and application data, Google Cloud for backend hosting, Cloudflare for website delivery and security, Google for sign-in or fonts, and Supercell services for Clash of Clans API data.',
                    'ClashPanel uses or may use Google AdSense on selected pages. Google and its advertising partners may receive information such as IP address, page URL, browser or device information, cookies, local-storage identifiers and ad interaction data when advertising services are used.'
                ]],
                ['Google advertising', [
                    'Third-party vendors, including Google, may use cookies or similar technologies to serve, limit, measure and protect ads. Google advertising cookies can also be used to show ads based on visits to ClashPanel and/or other websites when personalised advertising is permitted.',
                    'Google explains how it uses information from sites that use Google services in its partner-sites privacy information. You can also control personalised advertising through Google Ads Settings.',
                    'For visitors in the EEA, United Kingdom and Switzerland, advertising consent is handled according to the consent choices presented by the configured consent-management solution and applicable Google requirements.'
                ]],
                ['International processing', [
                    'Some service providers may process information outside Belgium or the European Economic Area. Where required, those providers and transfers are subject to applicable transfer mechanisms and safeguards described in the providers’ terms and privacy documentation.',
                    'Because ClashPanel relies on third-party infrastructure, the exact processing location can depend on the provider and service involved.'
                ]],
                ['Retention', [
                    'Account and application data is kept for as long as needed to provide the service or until it is deleted, subject to security, backup, dispute-resolution and legal requirements.',
                    'Technical logs, cached data and authentication information may have shorter retention periods determined by operational needs and the relevant service provider. Data that is no longer needed should be deleted or anonymised where reasonably possible.'
                ]],
                ['Your privacy rights', [
                    `Depending on applicable law, you may have rights to access, correct, erase, restrict or object to processing of your personal data, request portability, and withdraw consent. Send requests to ${SUPPORT_EMAIL}. We may need to verify that a request relates to your account before acting on it.`,
                    'You also have the right to lodge a complaint with the competent data-protection authority. For users in Belgium, this is the Belgian Data Protection Authority. Mandatory legal rights are not limited by this policy.'
                ]],
                ['Security', [
                    'ClashPanel uses measures such as server-side credentials, authenticated sessions, access checks and database security controls. However, no website, network or storage system can guarantee absolute security.',
                    'Do not send passwords, access tokens, verification codes or other authentication secrets by email.'
                ]],
                ['Changes to this policy', [
                    'This policy may be updated when ClashPanel features, advertising, providers, legal requirements or data practices change. The date shown at the top identifies the latest published version.'
                ]]
            ],
            links: [
                ['Privacy contact', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20privacy%20request`],
                ['How Google uses partner data', 'https://policies.google.com/technologies/partner-sites'],
                ['Google Ads Settings', 'https://adssettings.google.com/']
            ]
        },
        nl: {
            title: 'Privacybeleid',
            description: 'Hoe ClashPanel account-, planner-, Clan Family-, advertentie- en technische gegevens verwerkt.',
            summary: 'Dit beleid legt uit welke persoonsgegevens ClashPanel verwerkt, waarom dat gebeurt, met wie gegevens kunnen worden gedeeld en welke keuzes en rechten je hebt.',
            sections: [
                ['Wie verantwoordelijk is', [
                    `ClashPanel beheert deze website en bepaalt hoe persoonsgegevens voor de ClashPanel-dienst worden gebruikt. Privacyverzoeken kun je sturen naar ${SUPPORT_EMAIL}.`,
                    'ClashPanel is een onofficieel Clash of Clans-fanproject en is niet verbonden met, goedgekeurd door of gesponsord door Supercell.'
                ]],
                ['Gegevens die we kunnen verwerken', [
                    'Account- en authenticatiegegevens, waaronder je e-mailadres, weergavenaam, interne gebruikersidentificatoren en informatie die nodig is om een aangemelde sessie te onderhouden.',
                    'Clash of Clans-gegevens die je opgeeft of koppelt, zoals speler- en clantags, samen met openbare spelinformatie die voor die tags via de officiële Clash of Clans API wordt opgehaald.',
                    'Inhoud en instellingen die je in ClashPanel maakt, zoals CWL-plannen, Clan Families, lidmaatschappen, polls, reminders, planner-drafts en bijhorende configuratie.',
                    'Apparaat- en technische gegevens die bij gebruik van de dienst ontstaan, zoals IP-adres, browser- of apparaatinformatie, requestmetadata, beveiligingsgebeurtenissen en diagnostische logs van hosting- of infrastructuurproviders.',
                    'Cookie-, local-storage- en vergelijkbare gegevens voor authenticatie, voorkeuren, caching, toestemmingskeuzes en, waar advertenties actief zijn, advertentieweergave en -meting.'
                ]],
                ['Hoe we gegevens verkrijgen', [
                    'We ontvangen gegevens rechtstreeks van jou wanneer je een account maakt, inlogt, een speler koppelt, inhoud maakt of support contacteert.',
                    'Openbare speler- en claninfo wordt via de officiële Clash of Clans API opgehaald nadat een relevante tag via ClashPanel is ingediend.',
                    'Technische informatie kan automatisch worden verwerkt door je browser, de ClashPanel-infrastructuur en dienstverleners wanneer je de website gebruikt.'
                ]],
                ['Waarom we gegevens gebruiken en rechtsgronden', [
                    'We verwerken account-, planner- en Clan Family-gegevens om de functies te leveren die je vraagt, je account te beheren en de ClashPanel-dienst uit te voeren.',
                    'Beperkte technische en beveiligingsgegevens kunnen worden verwerkt op basis van gerechtvaardigde belangen, bijvoorbeeld om accounts te beschermen, misbruik te voorkomen, fouten te onderzoeken en de betrouwbaarheid van de dienst te behouden, met aandacht voor de rechten en belangen van gebruikers.',
                    'Waar toestemming wettelijk vereist is, gebruiken we toestemming voor optionele advertentiecookies, lokale opslag of bijhorende advertentiedoeleinden. Je kunt toestemming via de beschikbare toestemmingsinstellingen intrekken zonder dat dit eerdere rechtmatige verwerking ongeldig maakt.',
                    'Gegevens kunnen ook worden verwerkt wanneer dit nodig is om aan wettelijke verplichtingen te voldoen of om rechtsvorderingen vast te stellen, uit te oefenen of te verdedigen.'
                ]],
                ['Dienstverleners en delen van gegevens', [
                    'ClashPanel verkoopt geen persoonsgegevens. Gegevens worden alleen gedeeld wanneer dit nodig is om de dienst te leveren, aan de wet te voldoen, de dienst te beschermen of wanneer jij daar opdracht toe geeft.',
                    'Infrastructuur- en applicatieproviders kunnen onder meer Supabase omvatten voor authenticatie en applicatiegegevens, Google Cloud voor backendhosting, Cloudflare voor levering en beveiliging van de website, Google voor login of lettertypes en Supercell-diensten voor Clash of Clans API-gegevens.',
                    'ClashPanel gebruikt of kan Google AdSense gebruiken op geselecteerde pagina’s. Google en advertentiepartners kunnen bij advertentiediensten gegevens ontvangen zoals IP-adres, pagina-URL, browser- of apparaatinformatie, cookies, lokale identificatoren en informatie over interacties met advertenties.'
                ]],
                ['Google-advertenties', [
                    'Externe leveranciers, waaronder Google, kunnen cookies of vergelijkbare technologieën gebruiken om advertenties te tonen, te beperken, te meten en tegen fraude te beschermen. Wanneer gepersonaliseerde advertenties zijn toegestaan, kunnen Google-advertentiecookies ook worden gebruikt om advertenties te tonen op basis van bezoeken aan ClashPanel en/of andere websites.',
                    'Google legt in de informatie over partnerwebsites uit hoe gegevens van websites die Google-diensten gebruiken worden verwerkt. Via Google Ads Settings kun je ook gepersonaliseerde advertenties beheren.',
                    'Voor bezoekers in de EER, het Verenigd Koninkrijk en Zwitserland wordt advertentietoestemming behandeld volgens de keuzes die via de ingestelde consent-managementoplossing worden aangeboden en de toepasselijke Google-vereisten.'
                ]],
                ['Internationale verwerking', [
                    'Sommige dienstverleners kunnen gegevens buiten België of de Europese Economische Ruimte verwerken. Waar dit vereist is, vallen zulke verwerkingen en doorgiften onder toepasselijke doorgiftemechanismen en waarborgen die in de voorwaarden en privacydocumentatie van de betrokken providers worden beschreven.',
                    'Omdat ClashPanel infrastructuur van derden gebruikt, kan de exacte verwerkingslocatie afhangen van de provider en de gebruikte dienst.'
                ]],
                ['Bewaartermijnen', [
                    'Account- en applicatiegegevens worden bewaard zolang dat nodig is om de dienst te leveren of totdat ze worden verwijderd, rekening houdend met beveiliging, back-ups, geschillen en wettelijke verplichtingen.',
                    'Technische logs, cachedata en authenticatiegegevens kunnen kortere bewaartermijnen hebben op basis van operationele noodzaak en instellingen van de betrokken provider. Gegevens die niet langer nodig zijn, worden waar redelijk mogelijk verwijderd of geanonimiseerd.'
                ]],
                ['Je privacyrechten', [
                    `Afhankelijk van de toepasselijke wetgeving kun je recht hebben op inzage, correctie, verwijdering, beperking of bezwaar, overdraagbaarheid van persoonsgegevens en het intrekken van toestemming. Stuur verzoeken naar ${SUPPORT_EMAIL}. We kunnen eerst moeten controleren of een verzoek bij jouw account hoort.`,
                    'Je hebt ook het recht een klacht in te dienen bij de bevoegde toezichthoudende autoriteit. Voor gebruikers in België is dat de Gegevensbeschermingsautoriteit. Wettelijke rechten worden door dit beleid niet beperkt.'
                ]],
                ['Beveiliging', [
                    'ClashPanel gebruikt maatregelen zoals server-side credentials, geauthenticeerde sessies, toegangscontroles en databasebeveiliging. Geen enkele website, netwerkverbinding of opslagmethode kan echter absolute beveiliging garanderen.',
                    'Stuur nooit wachtwoorden, access tokens, verificatiecodes of andere authenticatiegeheimen per e-mail.'
                ]],
                ['Wijzigingen aan dit beleid', [
                    'Dit beleid kan worden bijgewerkt wanneer functies, advertenties, providers, wettelijke vereisten of gegevenspraktijken veranderen. De datum bovenaan geeft de laatst gepubliceerde versie aan.'
                ]]
            ],
            links: [
                ['Privacy contacteren', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20privacyverzoek`],
                ['Hoe Google partnergegevens gebruikt', 'https://policies.google.com/technologies/partner-sites'],
                ['Google Ads Settings', 'https://adssettings.google.com/']
            ]
        }
    },
    cookies: {
        en: {
            title: 'Cookie policy',
            description: 'Cookies, local storage, advertising technologies and consent choices used by ClashPanel.',
            summary: 'ClashPanel uses essential browser technologies for the service and may use Google advertising technologies on pages where ads are enabled.',
            sections: [
                ['What this policy covers', [
                    'This policy covers cookies, local storage, IndexedDB and similar browser technologies used directly by ClashPanel or by third-party services loaded through ClashPanel.',
                    'Some technologies are necessary for requested functions. Others, especially advertising technologies, may require consent depending on your location and the purpose for which they are used.'
                ]],
                ['Essential authentication cookies', [
                    'ClashPanel uses HttpOnly authentication cookies such as ct_access and ct_refresh to keep signed-in sessions working. Temporary cookies may also be used during the Google sign-in flow.',
                    'Authentication cookies are necessary to provide account functions. Signing out or clearing relevant browser data can remove or invalidate session information.'
                ]],
                ['Local storage and IndexedDB', [
                    'Local storage may remember interface preferences such as language, theme and selected ClashPanel context. IndexedDB may cache recent application responses to improve loading and reduce repeated requests.',
                    'You can clear browser storage through your browser settings. Doing so can reset preferences or cached data but does not by itself delete server-side account records.'
                ]],
                ['Google AdSense and advertising technologies', [
                    'Selected ClashPanel pages include or may include Google AdSense. Third-party vendors, including Google, may place or read cookies or use similar technologies, IP addresses and other identifiers to deliver ads, control ad frequency, measure performance and help detect fraud or abuse.',
                    'When personalised advertising is permitted, advertising cookies may be used to select ads based on prior visits to ClashPanel and/or other websites. If personalised advertising is not permitted, ads may still be contextual or otherwise non-personalised while limited storage or identifiers may be used where allowed.',
                    'Google provides information about how it uses data from partner sites and provides Ads Settings where users can control personalised advertising.'
                ]],
                ['Consent and changing your choice', [
                    'Where consent is required by applicable law, the advertising consent interface or consent-management platform determines whether optional advertising storage and purposes are allowed.',
                    'You may refuse or withdraw optional consent without losing access to the core ClashPanel service. You can also use browser controls to delete or block cookies, although blocking essential storage may prevent account functions from working correctly.'
                ]],
                ['Other third-party resources', [
                    'ClashPanel may load services such as Google Fonts or Google sign-in. Requests to third-party services can disclose technical connection information such as IP address, browser information and the requested resource to that provider.',
                    'Third-party providers process information under their own privacy terms in addition to the choices and protections described here.'
                ]],
                ['Changes', [
                    'The technologies used by ClashPanel can change as features, advertising and providers change. This policy will be updated when material cookie or storage practices change.'
                ]]
            ],
            links: [
                ['How Google uses partner data', 'https://policies.google.com/technologies/partner-sites'],
                ['Google Ads Settings', 'https://adssettings.google.com/'],
                ['Privacy contact', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20cookie%20or%20privacy%20question`]
            ]
        },
        nl: {
            title: 'Cookiebeleid',
            description: 'Cookies, lokale opslag, advertentietechnologieën en toestemmingskeuzes die ClashPanel gebruikt.',
            summary: 'ClashPanel gebruikt noodzakelijke browsertechnologieën voor de dienst en kan Google-advertentietechnologie gebruiken op pagina’s waar advertenties actief zijn.',
            sections: [
                ['Wat dit beleid omvat', [
                    'Dit beleid gaat over cookies, local storage, IndexedDB en vergelijkbare browsertechnologie die rechtstreeks door ClashPanel of via externe diensten op ClashPanel wordt gebruikt.',
                    'Sommige technologie is noodzakelijk voor gevraagde functies. Andere technologie, vooral voor advertenties, kan afhankelijk van je locatie en het doel toestemming vereisen.'
                ]],
                ['Essentiële authenticatiecookies', [
                    'ClashPanel gebruikt HttpOnly-authenticatiecookies zoals ct_access en ct_refresh om aangemelde sessies te laten werken. Tijdens de Google-loginflow kunnen ook tijdelijke cookies worden gebruikt.',
                    'Authenticatiecookies zijn nodig voor accountfuncties. Uitloggen of relevante browsergegevens wissen kan sessiegegevens verwijderen of ongeldig maken.'
                ]],
                ['Local storage en IndexedDB', [
                    'Local storage kan interfacevoorkeuren zoals taal, thema en geselecteerde ClashPanel-context onthouden. IndexedDB kan recente applicatie-antwoorden cachen om sneller te laden en dubbele requests te beperken.',
                    'Je kunt browseropslag via je browserinstellingen wissen. Daardoor kunnen voorkeuren of cachegegevens verdwijnen, maar server-side accountrecords worden daardoor niet automatisch verwijderd.'
                ]],
                ['Google AdSense en advertentietechnologie', [
                    'Geselecteerde ClashPanel-pagina’s bevatten of kunnen Google AdSense bevatten. Externe leveranciers, waaronder Google, kunnen cookies plaatsen of lezen of vergelijkbare technologie, IP-adressen en andere identificatoren gebruiken om advertenties te leveren, frequentie te beperken, prestaties te meten en fraude of misbruik tegen te gaan.',
                    'Wanneer gepersonaliseerde advertenties zijn toegestaan, kunnen advertentiecookies worden gebruikt om advertenties te selecteren op basis van eerdere bezoeken aan ClashPanel en/of andere websites. Als gepersonaliseerde advertenties niet zijn toegestaan, kunnen nog contextuele of andere niet-gepersonaliseerde advertenties worden getoond en kunnen beperkte opslag of identificatoren worden gebruikt waar dit is toegestaan.',
                    'Google biedt informatie over het gebruik van gegevens van partnerwebsites en Ads Settings waarmee gebruikers gepersonaliseerde advertenties kunnen beheren.'
                ]],
                ['Toestemming en je keuze wijzigen', [
                    'Waar de toepasselijke wet toestemming vereist, bepaalt de advertentie-consentinterface of consent-managementplatform of optionele advertentieopslag en advertentiedoeleinden zijn toegestaan.',
                    'Je kunt optionele toestemming weigeren of intrekken zonder de kernfuncties van ClashPanel te verliezen. Je kunt ook via je browser cookies verwijderen of blokkeren, maar het blokkeren van essentiële opslag kan accountfuncties verstoren.'
                ]],
                ['Andere externe bronnen', [
                    'ClashPanel kan diensten laden zoals Google Fonts of Google-login. Requests naar externe diensten kunnen technische verbindingsinformatie zoals IP-adres, browserinformatie en de opgevraagde resource aan die provider doorgeven.',
                    'Externe providers verwerken informatie volgens hun eigen privacyvoorwaarden, naast de keuzes en bescherming die hier worden beschreven.'
                ]],
                ['Wijzigingen', [
                    'De technologie die ClashPanel gebruikt kan wijzigen wanneer functies, advertenties of providers veranderen. Dit beleid wordt bijgewerkt wanneer de cookie- of opslagpraktijken wezenlijk veranderen.'
                ]]
            ],
            links: [
                ['Hoe Google partnergegevens gebruikt', 'https://policies.google.com/technologies/partner-sites'],
                ['Google Ads Settings', 'https://adssettings.google.com/'],
                ['Privacy contacteren', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20cookie-%20of%20privacyvraag`]
            ]
        }
    },
    terms: {
        en: {
            title: 'Terms of use',
            description: 'Terms governing access to and responsible use of ClashPanel.',
            summary: 'By using ClashPanel you agree to use the service responsibly and in accordance with these terms and applicable law.',
            sections: [
                ['About ClashPanel', [
                    'ClashPanel is an unofficial fan-made tool for organising and planning Clash of Clans activities. ClashPanel is not affiliated with, endorsed by or sponsored by Supercell.',
                    'References to Clash of Clans, Supercell and related game content remain the property of their respective owners and use of fan content is subject to applicable Supercell policies.'
                ]],
                ['Using the service', [
                    'You may use ClashPanel for lawful personal or clan-organisation purposes. You are responsible for activity performed through your account and for keeping your sign-in methods secure.',
                    'Do not attempt to access data you are not authorised to access, bypass security or rate limits, interfere with service operation, create abusive automated traffic, scrape the service in a harmful way, distribute malware, impersonate others or use ClashPanel to facilitate cheating, account trading or unlawful conduct.',
                    'You must not use the service in a way that violates applicable law, third-party rights, Supercell rules or policies that apply to the underlying game or API.'
                ]],
                ['Accounts and access', [
                    'You are responsible for providing accurate information where the service requires it and for maintaining control of your account. Never share authentication tokens or verification codes with other people.',
                    'ClashPanel may restrict, suspend or terminate access when reasonably necessary to protect users or infrastructure, investigate abuse, comply with law or address a serious breach of these terms.'
                ]],
                ['Your content and Clan Family data', [
                    'You remain responsible for plan names, Clan Family content, polls, imported spreadsheet data and other information you submit. Do not submit confidential information you are not authorised to share, unlawful material or content that infringes another person’s rights.',
                    'You grant ClashPanel only the permission reasonably necessary to store, process, copy and display submitted content for operating, securing and improving the functions you choose to use.'
                ]],
                ['Game and third-party data', [
                    'Player, clan, war and related game information can depend on data returned by external services, including the official Clash of Clans API. External data may be delayed, incomplete, unavailable or changed by its provider.',
                    'Planner suggestions, predictions, status information or imported data should be reviewed before relying on them for clan decisions.'
                ]],
                ['Advertising and external services', [
                    'ClashPanel may display third-party advertising, including Google AdSense. An advertisement does not mean ClashPanel endorses the advertiser, product or external website.',
                    'External services and links are governed by their own terms and privacy practices. ClashPanel is not responsible for content or transactions provided solely by an unrelated third party.'
                ]],
                ['Availability and changes', [
                    'ClashPanel may add, modify or remove features and may temporarily limit availability for maintenance, security, capacity, legal or third-party-service reasons.',
                    'The service is provided without a promise of uninterrupted or error-free availability. Nothing in these terms excludes guarantees or rights that cannot legally be excluded.'
                ]],
                ['Liability', [
                    'To the extent permitted by applicable law, ClashPanel is not responsible for indirect losses resulting solely from unavailable third-party APIs, inaccurate game data, user-created content or decisions made using planner output. This does not limit liability where applicable law does not allow that limitation.',
                    'You remain responsible for maintaining your own copies of information that is important to you and for checking game actions before carrying them out.'
                ]],
                ['Privacy', [
                    'Use of ClashPanel is also subject to the Privacy Policy and Cookie Policy, which explain data processing, advertising technologies and user choices.'
                ]],
                ['Changes and applicable law', [
                    'These terms may be updated when the service or legal requirements change. Material changes will apply from the updated version’s publication or from any later date stated with the update.',
                    'These terms are governed by Belgian law to the extent permitted by applicable law. If you are a consumer, mandatory consumer protections and rights available under the law of your country of residence remain unaffected.'
                ]],
                ['Contact', [
                    `Questions about these terms can be sent to ${SUPPORT_EMAIL}.`
                ]]
            ],
            links: [
                ['Contact ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20terms%20question`],
                ['Supercell Fan Content Policy', 'https://supercell.com/en/fan-content-policy/']
            ]
        },
        nl: {
            title: 'Gebruiksvoorwaarden',
            description: 'Voorwaarden voor toegang tot en verantwoord gebruik van ClashPanel.',
            summary: 'Door ClashPanel te gebruiken ga je ermee akkoord de dienst verantwoord en volgens deze voorwaarden en de toepasselijke wetgeving te gebruiken.',
            sections: [
                ['Over ClashPanel', [
                    'ClashPanel is een onofficiële, door fans gemaakte tool voor het organiseren en plannen van Clash of Clans-activiteiten. ClashPanel is niet verbonden met, goedgekeurd door of gesponsord door Supercell.',
                    'Verwijzingen naar Clash of Clans, Supercell en bijhorende gamecontent blijven eigendom van hun respectieve rechthebbenden en het gebruik van fancontent valt onder de toepasselijke Supercell-regels.'
                ]],
                ['De dienst gebruiken', [
                    'Je mag ClashPanel gebruiken voor rechtmatige persoonlijke doeleinden of clanorganisatie. Je bent verantwoordelijk voor activiteit via je account en voor het beveiligen van je inlogmethode.',
                    'Probeer geen gegevens te openen waarvoor je geen toestemming hebt, omzeil geen beveiliging of rate limits, verstoor de werking niet, genereer geen misbruikende geautomatiseerde traffic, scrape de dienst niet op een schadelijke manier, verspreid geen malware, doe je niet voor als iemand anders en gebruik ClashPanel niet om cheats, account trading of onwettig gedrag mogelijk te maken.',
                    'Je mag de dienst niet gebruiken in strijd met toepasselijke wetgeving, rechten van derden, regels van Supercell of beleid dat op de onderliggende game of API van toepassing is.'
                ]],
                ['Accounts en toegang', [
                    'Je bent verantwoordelijk voor correcte informatie waar de dienst die nodig heeft en voor het behouden van controle over je account. Deel nooit authenticatietokens of verificatiecodes met anderen.',
                    'ClashPanel kan toegang redelijkerwijs beperken, opschorten of beëindigen om gebruikers of infrastructuur te beschermen, misbruik te onderzoeken, aan de wet te voldoen of een ernstige schending van deze voorwaarden aan te pakken.'
                ]],
                ['Jouw inhoud en Clan Family-gegevens', [
                    'Je blijft verantwoordelijk voor plannamen, Clan Family-inhoud, polls, geïmporteerde spreadsheetgegevens en andere informatie die je indient. Deel geen vertrouwelijke informatie waarvoor je geen toestemming hebt, onwettige inhoud of materiaal dat rechten van anderen schendt.',
                    'Je geeft ClashPanel alleen de toestemming die redelijkerwijs nodig is om ingediende inhoud op te slaan, te verwerken, te kopiëren en te tonen voor het uitvoeren, beveiligen en verbeteren van de functies die je gebruikt.'
                ]],
                ['Gamegegevens en externe data', [
                    'Speler-, clan-, war- en andere gamegegevens kunnen afhangen van externe diensten, waaronder de officiële Clash of Clans API. Externe data kan vertraagd, onvolledig, tijdelijk niet beschikbaar of door de provider gewijzigd zijn.',
                    'Controleer plannersuggesties, voorspellingen, statusinformatie en geïmporteerde data voordat je er belangrijke clanbeslissingen op baseert.'
                ]],
                ['Advertenties en externe diensten', [
                    'ClashPanel kan advertenties van derden tonen, waaronder Google AdSense. Een advertentie betekent niet dat ClashPanel de adverteerder, het product of de externe website aanbeveelt.',
                    'Externe diensten en links vallen onder hun eigen voorwaarden en privacypraktijken. ClashPanel is niet verantwoordelijk voor inhoud of transacties die uitsluitend door een onafhankelijke derde partij worden aangeboden.'
                ]],
                ['Beschikbaarheid en wijzigingen', [
                    'ClashPanel kan functies toevoegen, wijzigen of verwijderen en de beschikbaarheid tijdelijk beperken voor onderhoud, beveiliging, capaciteit, wettelijke redenen of problemen met externe diensten.',
                    'De dienst wordt aangeboden zonder garantie op ononderbroken of foutloze beschikbaarheid. Niets in deze voorwaarden sluit garanties of rechten uit die wettelijk niet kunnen worden uitgesloten.'
                ]],
                ['Aansprakelijkheid', [
                    'Voor zover de toepasselijke wet dit toelaat, is ClashPanel niet verantwoordelijk voor indirecte schade die uitsluitend voortvloeit uit onbeschikbare externe API’s, foutieve gamegegevens, inhoud van gebruikers of beslissingen op basis van planneroutput. Dit beperkt geen aansprakelijkheid wanneer de wet zo’n beperking niet toestaat.',
                    'Je blijft zelf verantwoordelijk voor kopieën van informatie die voor jou belangrijk is en voor het controleren van acties voordat je ze in de game uitvoert.'
                ]],
                ['Privacy', [
                    'Het gebruik van ClashPanel valt ook onder het Privacybeleid en Cookiebeleid, waarin gegevensverwerking, advertentietechnologie en gebruikerskeuzes worden uitgelegd.'
                ]],
                ['Wijzigingen en toepasselijk recht', [
                    'Deze voorwaarden kunnen worden bijgewerkt wanneer de dienst of wettelijke vereisten veranderen. Belangrijke wijzigingen gelden vanaf publicatie van de nieuwe versie of vanaf een latere datum die bij de wijziging wordt vermeld.',
                    'Deze voorwaarden vallen onder Belgisch recht voor zover de toepasselijke wet dit toelaat. Als je consument bent, blijven dwingende consumentenrechten en bescherming volgens het recht van je woonland behouden.'
                ]],
                ['Contact', [
                    `Vragen over deze voorwaarden kun je sturen naar ${SUPPORT_EMAIL}.`
                ]]
            ],
            links: [
                ['ClashPanel contacteren', `mailto:${SUPPORT_EMAIL}?subject=Vraag%20over%20ClashPanel%20voorwaarden`],
                ['Supercell Fan Content Policy', 'https://supercell.com/en/fan-content-policy/']
            ]
        }
    },
    contact: {
        showUpdated: false,
        en: {
            title: 'Contact',
            description: 'Contact ClashPanel by email for support, privacy, security and general questions.',
            summary: `The official contact method for ClashPanel is email: ${SUPPORT_EMAIL}.`,
            sections: [
                ['Email support', [
                    `For bugs, feature requests, account questions, privacy requests, AdSense or advertising questions and general project enquiries, email ${SUPPORT_EMAIL}.`,
                    'For a bug report, include the affected page, what you expected, what happened and any useful browser error message. Remove private information from screenshots before sending them.'
                ]],
                ['Privacy and account requests', [
                    'For access, correction, deletion or other privacy requests, explain what you are requesting and which account email is affected. Additional verification may be required before account-related data is changed or disclosed.',
                    'Never email passwords, access tokens, refresh tokens, verification codes or other authentication secrets.'
                ]],
                ['Security reports', [
                    'If you believe you found a security issue, describe the issue and the minimum steps needed to reproduce it. Do not access, change or publish other users’ data to prove a vulnerability.'
                ]]
            ],
            links: [
                ['Email ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20contact`]
            ]
        },
        nl: {
            title: 'Contact',
            description: 'Contacteer ClashPanel per e-mail voor support, privacy, beveiliging en algemene vragen.',
            summary: `De officiële contactmethode voor ClashPanel is e-mail: ${SUPPORT_EMAIL}.`,
            sections: [
                ['Support via e-mail', [
                    `Voor bugs, feature requests, accountvragen, privacyverzoeken, AdSense- of advertentievragen en algemene vragen kun je mailen naar ${SUPPORT_EMAIL}.`,
                    'Vermeld bij een bug de betrokken pagina, wat je verwachtte, wat er gebeurde en eventuele nuttige foutmeldingen uit de browser. Verwijder privégegevens uit screenshots voordat je ze verstuurt.'
                ]],
                ['Privacy- en accountverzoeken', [
                    'Voor inzage, correctie, verwijdering of andere privacyverzoeken leg je uit wat je vraagt en welk account-e-mailadres betrokken is. Voor we accountgegevens wijzigen of vrijgeven kan extra verificatie nodig zijn.',
                    'Mail nooit wachtwoorden, access tokens, refresh tokens, verificatiecodes of andere authenticatiegeheimen.'
                ]],
                ['Beveiligingsmeldingen', [
                    'Denk je een beveiligingsprobleem gevonden te hebben, beschrijf dan het probleem en de minimale stappen om het te reproduceren. Open, wijzig of publiceer geen gegevens van andere gebruikers om een kwetsbaarheid te bewijzen.'
                ]]
            ],
            links: [
                ['E-mail ClashPanel', `mailto:${SUPPORT_EMAIL}?subject=ClashPanel%20contact`]
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
    header.append(title, summary);
    if (documentContent.showUpdated !== false) {
        const updated = document.createElement('p');
        updated.textContent = language === 'nl'
            ? `Laatst bijgewerkt: ${LAST_UPDATED_NL}`
            : `Last updated: ${LAST_UPDATED_EN}`;
        header.append(updated);
    }
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
