# Functionele status vóór redesign

Auditdatum: 18 juli 2026

Nieuwe werkbranch: `redesign/exact-workspace-from-functional`

Functionele basis: `origin/fix/release-readiness-functional`

Basispunt: `d86bb30673b06ce3523e22b85e3a30a74eb720b8` (`d86bb30`, `fix: support legacy json account migration`)

## Scope en betekenis van de statussen

Deze inventaris beschrijft de code die aanwezig is op het exacte startpunt van het redesign. Er zijn in Onderdeel 0 geen productfuncties, pagina's, API's of migraties gewijzigd.

- `EXISTING_WORKING`: bestaande implementatie is inhoudelijk gekoppeld en door code, bestaande tests of gerichte inspectie onderbouwd.
- `EXISTING_INCOMPLETE`: de kern bestaat, maar een deel ontbreekt, de route-ervaring is inconsistent of live integratie is nog niet bewezen.
- `EXISTING_BROKEN`: zichtbaar element of pad bestaat, maar heeft aantoonbaar geen werkende koppeling.
- `NEW_NOT_IMPLEMENTED`: gewenste of in het prototype zichtbare functie bestaat niet in de functionele basis.
- `OPTIONAL_NOT_APPROVED`: mogelijke nieuwe functie waarvoor nog geen productgoedkeuring bestaat.
- `EXCLUDED`: expliciet uitgesloten productgedrag; dit mag niet worden gebouwd.

`Bestaat` geeft aan of er op dit startpunt al echte code voor de functie aanwezig is. `Werkt` gebruikt uitsluitend de afgesproken auditstatussen. “Werkend” betekent niet automatisch dat een productieomgeving met echte Supabase- en Clash of Clans-credentials al handmatig is gevalideerd.

## Branchkeuze

### Gekozen functionele basisbranch

`origin/fix/release-readiness-functional`

### Reden

Deze branch bevat `origin/master` volledig en voegt daar de meest complete functionele release-laag aan toe: server-side validatie van Supabase bearer tokens, RLS- en grantsmigraties, genormaliseerde planopslag met revisies, autosave- en concurrencybescherming, polls, reminders, notificaties, persistente caching, een werkende drafts- en bracketflow, API-hardening, vijf talen en releasecontroles. De functionele feature-, fix- en codexbranches zijn er vrijwel volledig in samengebracht.

### Andere onderzochte branches

- `origin/master`: ancestor van de gekozen branch en mist de latere release-readiness-commits.
- `origin/prototype/strategy-command-ui`: bevat prototype/UI-werk boven op redesigncode en is daarom geen functionele basis.
- `origin/redesign/full-interface-overhaul`, `origin/redesign/neo-war-room` en `origin/redesign/workspace-v2-groups-v1`: visuele/redesignbranches; niet als basis toegestaan.
- `origin/codex/cwl-planner-layout-polish`: een oudere, niet-gemergede layoutbranch uit juni; geen completere functionele releasebasis.
- Overige `feature/*`, `fix/*`, `rework/*` en `codex/*` branches: functionele bijdragen zijn, op de oude layoutbranch na, ancestors van de gekozen branch.

### Waarom geen prototype- of redesignbranch

De redesign- en prototypebranches zijn descendants van de functionele releasebranch en wijzigen vooral HTML, CSS, shell en i18n. Ze bevatten dus visuele interpretaties boven op de functionele basis, niet een betrouwbaarder functioneel startpunt. Er is niets gemerged, gerebased of gecherry-pickt uit deze branches.

## Platform en gedeelde werking

| Pagina | Functie | Bestaat | Werkt | Belangrijkste bestanden | Databron | Nieuw of bestaand |
|---|---|---:|---:|---|---|---|
| Gedeeld | Supabase sessie synchroniseren en e-mail/wachtwoordauthenticatie | Ja | `EXISTING_WORKING` | `src/assets/js/auth/auth-client.js`, `src/Java/AuthTokenValidator.java` | Supabase Auth via Java-backend | Bestaand |
| Gedeeld | Server leidt actor af uit gevalideerde bearer token | Ja | `EXISTING_WORKING` | `src/Java/AuthTokenValidator.java`, `src/Java/Main.java` | Supabase Auth JWT | Bestaand |
| Gedeeld | RLS voor profielen, plannen, vrienden, Groups, polls en notificaties | Ja | `EXISTING_INCOMPLETE` | `database/migrations/20260716_001_auth_profiles_and_core_rls.sql`, `20260716_002_accounts_polls_notifications.sql`, `20260716_004_poll_transactions_and_reminders.sql` | Supabase/Postgres | Bestaand; staging- en security-advisorcontrole ontbreekt |
| Gedeeld | Expliciete tabelrechten voor Data/GraphQL API | Ja | `EXISTING_WORKING` | `database/migrations/20260716_001_auth_profiles_and_core_rls.sql`, `20260716_002_accounts_polls_notifications.sql` | Supabase/Postgres grants | Bestaand |
| Gedeeld | Security-definerfuncties minimaal uitvoerbaar maken | Deels | `EXISTING_INCOMPLETE` | `database/migrations/20260716_001_auth_profiles_and_core_rls.sql`, `20260716_004_poll_transactions_and_reminders.sql` | Supabase/Postgres | Bestaand; enkele publieke functies vragen nog een expliciete privilege-audit |
| Gedeeld | Browsercache met stale-while-revalidate en deduplicatie | Ja | `EXISTING_WORKING` | `src/assets/js/cache/local-cache.js`, `src/assets/js/cache/cache-policy.js` | IndexedDB | Bestaand |
| Gedeeld | Persistente API-cache en gecontroleerde cleanup | Ja | `EXISTING_WORKING` | `database/migrations/20260716_003_persistent_api_cache.sql`, `src/Java/` | Supabase/Postgres en Java | Bestaand |
| Gedeeld | Clash API-proxy, rate limiting en health/readiness | Ja | `EXISTING_WORKING` | `src/Java/Main.java`, `src/Java/RateLimiter.java` | Clash of Clans API | Bestaand |
| Gedeeld | Vijf talen met pariteitscontrole | Ja | `EXISTING_WORKING` | `src/assets/js/i18n/`, `test/frontend/i18n-parity.test.mjs` | Lokale locale-modules | Bestaand |
| Gedeeld | Thema wisselen en bewaren | Ja | `EXISTING_WORKING` | `src/assets/js/profile/profile_settings.js`, `src/assets/js/theme/` | Local storage/profielinstelling | Bestaand |
| Gedeeld | Consequente routebescherming en terugkeer na login | Deels | `EXISTING_INCOMPLETE` | `src/assets/js/pages/cwl-planner.js`, `groups.js`, `cwl-operation-board.js`, `cwl-planner-drafts.js`, `bracket-generator.js` | Authsessie | Bestaand; pagina's reageren niet uniform en een bewaarde doelroute ontbreekt |

## Pagina-inventaris

| Pagina | Functie | Bestaat | Werkt | Belangrijkste bestanden | Databron | Nieuw of bestaand |
|---|---|---:|---:|---|---|---|
| Homepage | Publieke landing met productuitleg en voorbeeldinhoud | Ja | `EXISTING_INCOMPLETE` | `src/index.html`, `src/assets/js/pages/index.js` | Statische inhoud | Bestaand; publieke en ingelogde ervaring zijn niet helder gescheiden |
| Dashboard | Rustige ingelogde ingang naar echte tools | Nee | `NEW_NOT_IMPLEMENTED` | `src/index.html`, `src/assets/js/pages/index.js` | Plannen, Groups en accounts zouden bestaande services gebruiken | Nieuw presentatie-/integratieoppervlak |
| Dashboard | Recente plannen, groepen en gekoppelde accounts met echte metadata | Nee | `NEW_NOT_IMPLEMENTED` | Geen dashboardcontroller aanwezig | Bestaande plan-, group- en accountservices | Nieuw presentatie-/integratieoppervlak |
| Login | E-mail/wachtwoord aanmelden, fouten en validatie | Ja | `EXISTING_WORKING` | `src/login.html`, `src/assets/js/pages/login.js`, `src/assets/js/auth/auth-client.js` | Supabase Auth | Bestaand |
| Login | Google-login indien provider geconfigureerd | Ja | `EXISTING_INCOMPLETE` | `src/assets/js/pages/login.js`, `src/assets/js/auth/auth-client.js` | Supabase OAuth | Bestaand; productieprovider en redirects niet handmatig bewezen |
| Login | Wachtwoord vergeten/reset | Ja | `EXISTING_INCOMPLETE` | `src/assets/js/pages/login.js`, `src/assets/js/auth/auth-client.js` | Supabase Auth/e-mail | Bestaand; live e-mailflow niet handmatig bewezen |
| Registratie | Account maken, validatie en profielkoppeling | Ja | `EXISTING_INCOMPLETE` | `src/register.html`, `src/assets/js/pages/register.js`, authmigratie | Supabase Auth en `public.users` | Bestaand; live trigger/redirect nog te valideren |
| Registratie | Onboarding na registratie | Nee | `OPTIONAL_NOT_APPROVED` | Geen implementatie aanwezig | Nog te bepalen | Optioneel nieuw; aparte toestemming vereist |
| CWL Planner | Nieuw plan, bestaand plan laden en veilig wisselen | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-plan-io.js`, `src/assets/js/pages/cwl-planner.js` | Plan-API/Supabase | Bestaand |
| CWL Planner | Plannaam wijzigen, handmatig opslaan, autosave en opslagstatus | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-plan-io.js` | Plan-API/Supabase | Bestaand |
| CWL Planner | Revisieconflicten, save queue en verouderde loads negeren/annuleren | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-plan-io.js`, `cwl-plan-schema.js` | Planrevisies | Bestaand |
| CWL Planner | Speler toevoegen via tag | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-overlay.js`, `src/assets/js/API/` | Clash API | Bestaand |
| CWL Planner | Clan en clanleden laden via clantag | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-overlay.js`, `src/assets/js/API/API-Clan.js` | Clash API | Bestaand |
| CWL Planner | Eigen accounts en vrienden toevoegen | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-overlay.js`, `src/assets/js/Supabase/` | Supabase en Clash API | Bestaand |
| CWL Planner | Accounts uit Groups en pollresultaten toevoegen | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-overlay.js`, `src/assets/js/Supabase/Supabase-Group.js` | Supabase Groups/polls | Bestaand |
| CWL Planner | Meerdere accounts selecteren | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-overlay.js` | Reeds geladen accounts | Bestaand |
| CWL Planner | Sorteren op Town Hall en naam | Ja | `EXISTING_WORKING` | `src/assets/js/templates/CWLTemplates.js`, plannercontroller | Client-side plandata | Bestaand |
| CWL Planner | Meerdere clans, 15v15/30v30 per clan en clan verwijderen | Ja | `EXISTING_WORKING` | `src/assets/js/templates/CWLTemplates.js`, `src/assets/js/cwl/` | Plandocument | Bestaand |
| CWL Planner | Drag-and-drop tussen vrij roster en clans | Ja | `EXISTING_WORKING` | `src/assets/js/templates/CWLTemplates.js`, `src/assets/js/cwl/` | Client-side plandata | Bestaand |
| CWL Planner | Toegankelijke actie “Verplaats naar…” | Ja | `EXISTING_WORKING` | `src/assets/js/templates/CWLTemplates.js` (`attachMoveControl`) | Dezelfde move-logica als drag-and-drop | Bestaand, dus niet nieuw |
| CWL Planner | Vrij roster zoeken op spelersnaam of tag | Nee | `NEW_NOT_IMPLEMENTED` | Alleen zoekveld binnen accountselectie bestaat; geen rosterfilter | Reeds geladen plandata | Nieuw |
| CWL Planner | Beschikbaarheid per account uit pollresultaat | Ja | `EXISTING_WORKING` | `src/assets/js/cwl/cwl-overlay.js`, `cwl-plan-schema.js` | Group-pollresultaten | Bestaand |
| CWL Planner | Automatisch verzonnen spelerrollen of spelerskwaliteit | Nee | `EXCLUDED` | Geen implementatie gewenst | Geen | Expliciet uitgesloten |
| CWL Planner | Player readiness, gemiddelde TH, planbrede league of planbreed spelersdoel | Nee | `EXCLUDED` | Geen implementatie gewenst | Geen | Expliciet uitgesloten |
| Opgeslagen plannen | Plannen laden en openen | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-planner-drafts.js` | Plan-API/Supabase | Bestaand |
| Opgeslagen plannen | Hernoemen, kopiëren en verwijderen met bevestiging | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-planner-drafts.js` | Plan-API/Supabase | Bestaand |
| Opgeslagen plannen | Nieuw plan starten | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-planner-drafts.js` | Plannerroute | Bestaand |
| Opgeslagen plannen | Plan exporteren vanuit drafts | Nee | `NEW_NOT_IMPLEMENTED` | Geen exportpad in `cwl-planner-drafts.js` | Bestaand plandocument | Nieuw; prototypeknop mag nog niet actief worden gemaakt |
| Opgeslagen plannen | Aantal clans en vrije spelers als metadata | Deels | `EXISTING_INCOMPLETE` | `src/assets/js/pages/cwl-planner-drafts.js`, planschema | Bestaand plandocument | Bestaande data, presentatie ontbreekt deels |
| Opgeslagen plannen | Plannen zoeken en sorteren | Nee | `NEW_NOT_IMPLEMENTED` | Geen zoek- of sorteerbesturing in draftscontroller | Reeds geladen plannen | Nieuw |
| Operation Board | Plan kiezen, clan kiezen en losse clantag laden | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` | Plan-API en Clash API | Bestaand |
| Operation Board | Live data vernieuwen, CWL-status en synchronisatiestatus | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js`, `src/assets/js/API/` | Clash API | Bestaand |
| Operation Board | JSON import en export | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` | Lokaal bestand/rapport | Bestaand |
| Operation Board | Sterren, destruction, aanvallen en gemiste aanvallen | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js`, `cwl-war-state.js` | Clash CWL/war-data | Bestaand |
| Operation Board | Town Hall-verdeling en zeven war days | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` | Clash API/rapport | Bestaand |
| Operation Board | Tegenstander, score en war-daykaarten | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` | Clash API/rapport | Bestaand |
| Operation Board | War-daydetailfilter | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` (`op-roster-view`, `day:N`) | Reeds geladen rondedata | Bestaand, dus niet nieuw |
| Operation Board | Roster zoeken/filteren en spelersdetails | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` | Reeds geladen rosterdata | Bestaand |
| Operation Board | Bench/rotatie-indicatie en bonusadvies | Ja | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` | Plan- en war-data | Bestaand |
| Operation Board | Volledige stand met eigen clan gemarkeerd | Deels | `EXISTING_INCOMPLETE` | `src/assets/js/pages/cwl-operation-board.js` (`renderStandings`) | Berekende CWL-stand | Bestaand; huidige UI toont slechts de eigen rij plus directe buren |
| Operation Board | Sterren per war day als lijngrafiek | Nee | `NEW_NOT_IMPLEMENTED` | Geen grafiekcomponent of tijdreeksmodel | Historische ronde-/wardata moet eerst worden bewezen | Nieuw na redesigngoedkeuring |
| Operation Board | Klassementspositie per war day als lijngrafiek | Nee | `NEW_NOT_IMPLEMENTED` | Geen grafiekcomponent of historische standingssnapshots | Betrouwbare historische stand per dag ontbreekt mogelijk | Nieuw na redesigngoedkeuring |
| Operation Board | Aandachtfilter | Nee | `OPTIONAL_NOT_APPROVED` | Geen detectie- of filterlogica | Alleen echte bestaande signalen zouden mogen dienen | Optioneel nieuw; aparte toestemming vereist |
| Operation Board | Groot algemeen problemenblok of dramatische fake waarschuwingen | Nee | `EXCLUDED` | Geen implementatie gewenst | Geen | Expliciet uitgesloten |
| Groups | Groepen laden, selecteren en selectie bewaren | Ja | `EXISTING_WORKING` | `src/assets/js/pages/groups.js` | Supabase/Groups-API | Bestaand |
| Groups | Groep maken met naam of vanuit clantag | Ja | `EXISTING_WORKING` | `src/assets/js/pages/groups.js`, `Supabase-Group.js` | Supabase en Clash API | Bestaand |
| Groups | Badge kiezen, joinen met code en code kopiëren | Ja | `EXISTING_WORKING` | `src/assets/js/pages/groups.js`, `src/assets/js/groups/groups-badges.js` | Supabase en clipboard | Bestaand |
| Groups | Zichtbare knop “Uitnodigen” | Ja | `EXISTING_BROKEN` | `src/subPages/groups.html`; geen handler voor `#groups-invite-btn` | Geen gekoppelde databron | Bestaand zichtbaar element zonder werking |
| Groups | Groep verlaten | Ja | `EXISTING_WORKING` | `src/assets/js/pages/groups.js` | Supabase/Groups-API | Bestaand |
| Groups | Leden en accounts per lid tonen | Ja | `EXISTING_WORKING` | `src/assets/js/templates/GroupTemplates.js`, `src/assets/js/groups/` | Supabase en Clash API | Bestaand |
| Groups | Bestaande ledenzoek- en filterfuncties | Nee | `NEW_NOT_IMPLEMENTED` | Geen ledenzoek- of filterlogica gevonden | Reeds geladen leden | Nieuw indien prototype dit vereist |
| Groups | Rollen beheren en leadership overdragen | Ja | `EXISTING_WORKING` | `src/assets/js/groups/groups-admin-members.js` | Supabase/Groups-API | Bestaand |
| Groups | Polls maken, beschikbaarheid per account en resultaten | Ja | `EXISTING_WORKING` | `src/assets/js/groups/groups-polls.js` | Supabase polls | Bestaand |
| Groups | Reminders versturen | Ja | `EXISTING_WORKING` | `src/assets/js/groups/groups-polls.js`, polltransactiemigratie | Supabase reminders/notifications | Bestaand |
| Groups | Gekoppelde clans beheren en accounts scannen | Ja | `EXISTING_WORKING` | `src/assets/js/groups/groups-admin-clans.js` | Supabase en Clash API | Bestaand |
| Groups | Beheeracties beperken volgens rol | Ja | `EXISTING_WORKING` | `src/assets/js/groups/groups-admin-panel.js`, `groups-admin-members.js` | Group-lidmaatschap en rol | Bestaand |
| Groups | Lege toekomstige tab “Later” | Ja | `EXCLUDED` | `src/subPages/groups.html` (`data-admin-tab="future"`) | Geen | Dode placeholder; verwijderen tijdens Groups-redesign, geen nieuwe functie bouwen |
| Bracket | Naam en deelnemers invoeren | Ja | `EXISTING_WORKING` | `src/assets/js/pages/bracket-generator.js`, `bracket-engine.js` | Client-side/localStorage | Bestaand |
| Bracket | Seeded genereren en shuffle | Ja | `EXISTING_WORKING` | `src/assets/js/pages/bracket-generator.js`, `bracket-engine.js` | Client-side | Bestaand |
| Bracket | Winnaar kiezen, bye verwerken en automatisch naar volgende ronde | Ja | `EXISTING_WORKING` | `src/assets/js/bracket/bracket-engine.js` | Bracketmodel | Bestaand |
| Bracket | Reset, JSON import/export en lokaal herstellen | Ja | `EXISTING_WORKING` | `src/assets/js/pages/bracket-generator.js` | Bestand en localStorage | Bestaand |
| Bracket | Mobiele bediening om tussen rondes te navigeren | Nee | `NEW_NOT_IMPLEMENTED` | Geen rondepijlen/tabs of mobiele navigatielogica | Reeds geladen bracketmodel | Nieuw |
| Profiel | Gebruikersnaam, vriendcode en eigen accounts | Ja | `EXISTING_WORKING` | `src/assets/js/profile/` | Supabase en Clash API | Bestaand |
| Profiel | API-token verifiëren | Ja | `EXISTING_INCOMPLETE` | `src/assets/js/profile/`, Java API-routes | Clash API | Bestaand; echte credentialflow niet handmatig bewezen |
| Profiel | Vrienden, inkomende en uitgaande verzoeken | Ja | `EXISTING_WORKING` | `src/assets/js/profile/`, `src/assets/js/Supabase/Supabase-Friend.js` | Supabase | Bestaand |
| Profiel | Groups en notificaties | Ja | `EXISTING_WORKING` | `src/assets/js/profile/`, Supabase-services | Supabase | Bestaand |
| Instellingen | Weergavenaam en wachtwoord wijzigen | Ja | `EXISTING_INCOMPLETE` | `src/assets/js/profile/profile_settings.js`, auth-client | Supabase Auth/profiel | Bestaand; live wachtwoordflow niet handmatig bewezen |
| Instellingen | Thema en taal wijzigen | Ja | `EXISTING_WORKING` | `src/assets/js/profile/profile_settings.js`, `src/assets/js/i18n/`, theme-modules | Lokale voorkeur/profiel | Bestaand |
| Instellingen | Profiel vernieuwen en cache wissen | Ja | `EXISTING_WORKING` | `src/assets/js/profile/profile_settings.js`, cachemodules | Supabase/IndexedDB | Bestaand |
| Instellingen | Uitloggen/sessie beëindigen | Ja | `EXISTING_WORKING` | `src/assets/js/profile/profile_settings.js`, `auth-client.js` | Supabase Auth | Bestaand |
| Profiel | Eenmalige instellingeninitialisatie en listenerbescherming | Ja | `EXISTING_WORKING` | `src/assets/js/profile/profile_settings.js` | DOM | Bestaand |

## Betrouwbaarheids- en migratienotities

- De functionele code bevat releasecontroles, maar `RELEASE_CHECKLIST.md` vermeldt nog open handmatige controles met echte Supabase-, OAuth-, e-mail- en Clash API-credentials. Daarom zijn live-afhankelijke stromen niet zonder meer als productiebewezen gemarkeerd.
- De Supabase-wijziging van 28 april 2026 scheidt tabelrechten nadrukkelijk van RLS voor Data/GraphQL API-exposure. De huidige kernmigraties bevatten expliciete `GRANT`-regels, wat correct aansluit op die wijziging. Nieuwe tabellen mogen later nooit alleen op RLS vertrouwen.
- Enkele `SECURITY DEFINER`-functies in de eerste auth/RLS-migratie verdienen vóór productie een expliciete `EXECUTE`-privilegecontrole. Onderdeel 0 wijzigt geen migratie.
- Geen enkele redesignstatus rechtvaardigt fake data. Een prototype-element zonder echte bron blijft afwezig of wordt als niet-geïmplementeerd getoond.

## Onderdeel-0-grens

Deze audit is uitsluitend documentatie. Het prototype is niet geïntegreerd, bestaande selectors zijn niet aangepast, er is geen UI-code overgenomen en er is geen nieuwe functie gebouwd.
