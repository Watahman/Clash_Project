# Eindrapport ClashPanel-redesign

Datum: 18 juli 2026

## Basis en branch

- Functionele basisbranch: `origin/fix/release-readiness-functional`
- Functioneel basispunt: `d86bb30` (`fix: support legacy json account migration`)
- Redesignbranch: `redesign/exact-workspace-from-functional`
- Prototypebron: `.reference/clashtools-workspace-v2/ClashTools_Workspace_Prototype_v2_GroupsV1/`
- Merge/deployment: niet uitgevoerd

De redesign is schoon boven op de functionele releasebranch opgebouwd. Er is geen oude redesign- of prototypebranch gemerged, gerebased of gecherry-pickt.

## Commitreeks

| Onderdeel | Commit | Inhoud |
|---|---|---|
| 0 | `7375b29` | Functionele basisaudit en inventaris |
| 1 | `0a9f697` | Publieke site, authenticatie-layout en app-shell |
| 2 | `6f06ac1` | Dashboard en Opgeslagen plannen |
| 3 | `30e4ada` | CWL Planner |
| 4 | `8bdf70d` | Operation Board |
| 5 | `10eb3b9` | Groups V1 |
| 6 | `dc6c68d` | Bracket, profiel en instellingen |
| 7 | `redesign: complete final visual audit` | Finale visuele correcties, screenshots en rapportage; dit is de commit die dit rapport bevat |

## Gewijzigde pagina's

- Publieke homepage
- Login en registratie
- Gedeelde desktop- en mobiele app-shell
- Dashboard
- Opgeslagen plannen
- CWL Planner
- Operation Board
- Groups
- Bracketgenerator
- Profiel, notificaties en instellingen

## Verbonden bestaande functies

| Oppervlak | Verbonden werking |
|---|---|
| Auth en shell | E-mail/wachtwoordauth, bestaande OAuth-knop, wachtwoordreset, taal, thema, routes, mobiele navigatie en profieltoegang |
| Dashboard | Echte plannen, Groups en gekoppelde accounts met loading-, lege en fouttoestanden |
| Opgeslagen plannen | Openen, hernoemen, kopiëren, verwijderen met bevestiging en nieuw plan |
| Planner | Plan laden/maken, naam, handmatig opslaan, autosave, clans, 15v15/30v30, spelersbronnen, polls, drag-and-drop en toegankelijke verplaatsbesturing |
| Operation Board | Plan/clan/losse tag, refresh, import/export, echte CWL-statistieken, war days, roster, filters, stand en bonusadvies |
| Groups | Laden, selecteren, maken, joincode, leden, rollen, polls, beschikbaarheid, reminders, gekoppelde clans en permissies |
| Bracket | Naam, deelnemers, seeded/shuffle, winnaarpropagatie, reset en JSON-import/export |
| Profiel | Gebruikersgegevens, accounts, vrienden en verzoeken, Groups, notificaties, instellingen, cachebeheer en uitloggen |

## Finale visuele vergelijking

De finale beelden zijn gemaakt op dezelfde pixelresoluties als de prototypes: 1440×1000, 1600×1050, 1600×1150 en 390×844. De vergelijking omvatte structuur, sidebar, topbar, paneelbreedtes, spacing, typografie, borders, tabellen, knoppen en mobiele stapeling.

Tijdens Onderdeel 7 zijn twee duidelijke afwijkingen gecorrigeerd:

1. De Planner- en Operation Board-koppen waren merkbaar kleiner dan in het prototype. Beide gebruiken nu een vaste product-UI-schaal van 3 rem op desktop en 2,25 rem op mobiel.
2. Operation Board forceerde op 1600 px horizontale scrollbalken voor war days en het roster. De minimumkolombreedtes zijn verkleind; beide secties passen nu zonder document- of paneeloverflow op de prototyperesolutie.

Alle gecontroleerde routes hadden na de correcties `scrollWidth === clientWidth`. De browserconsole bevatte geen waarschuwingen of fouten.

## Bewuste resterende visuele afwijkingen

- De Operation Board-grafieken uit het prototype zijn niet getoond. De benodigde historische databetrouwbaarheid is niet bewezen en fake lijnen zijn verboden.
- Screenshots van datagedreven pagina's tonen de echte uitgelogde/lege toestand wanneer geen actieve sessie beschikbaar was; prototypevoorbeelddata is niet als productdata overgenomen.
- De publieke header behoudt de bestaande taalkeuze. Die staat niet in de donkere prototypescreenshot, maar is bestaande productfunctionaliteit en daarom niet verwijderd.
- De Groups-inspector volgt de breakpointlogica uit de prototypebron en kan op een brede CSS-viewport als derde kolom verschijnen.
- De profielscreenshot gebruikt uitsluitend een tijdelijke, lokale visuele opening met generieke lege waarden; er is geen sessie of gebruikersdata gewijzigd.

## Bestaande onvolledigheden buiten de redesign

Deze punten waren al in de functionele basisaudit onvolledig en zijn geen door het redesign veroorzaakte regressies:

- Supabase RLS/security-definer-controle is nog niet tegen staging en de security advisor bewezen.
- OAuth-providerredirects, reset-e-mail en de registratietrigger zijn niet in een live productieomgeving gevalideerd.
- Een bewaarde terugkeerroute na login is niet uniform voor iedere beveiligde route.
- De echte API-tokencredentialflow en live wachtwoordwijziging zijn niet handmatig met productiecredentials bewezen.
- De oude niet-werkende Groups-knop `Uitnodigen` is niet opnieuw getoond; er is geen nieuwe uitnodigingsfunctie gebouwd.

## Bewust niet gebouwde nieuwe functies

- Vrij roster zoeken op naam of tag
- Plannen zoeken en sorteren
- Plan exporteren vanuit Opgeslagen plannen
- Sterren per war day als lijngrafiek
- Klassementspositie per war day als lijngrafiek
- Mobiele bracketnavigatie per ronde
- Leden zoeken/filteren in Groups
- Onboarding
- Aandachtfilter in Operation Board
- Historische standingssnapshots

Deze functies blijven geparkeerd in `docs/NEW_FUNCTIONS_AFTER_REDESIGN.md` en vereisen expliciete goedkeuring voor Onderdeel 8.

## Finale controles

Uitgevoerd via `npm run check`:

- Migraties: 7 geordende SQL-migraties gevalideerd
- Endpointcontract: 74 frontend/backend-constants gevalideerd
- Frontendtests: 15 testbestanden, 43 tests, alles geslaagd
- Productiebuild: Vite-build geslaagd, 133 modules verwerkt
- Browserconsole: geen warnings of errors op de finale routecontrole
- Horizontale documentoverflow: niet aangetroffen op de gecontroleerde desktop- en mobiele routes

Java/Maven:

- `pom.xml` bestaat, maar `mvn` en een Maven-wrapper zijn niet beschikbaar in de huidige omgeving.
- Daarom is `mvn test` niet opnieuw uitgevoerd en wordt er geen actueel Java-testresultaat geclaimd.

## Screenshots

| Oppervlak | Bestand | Resolutie |
|---|---|---:|
| Homepage desktop | [homepage-desktop.png](redesign/final/homepage-desktop.png) | 1440×1000 |
| Homepage mobiel | [homepage-mobile.png](redesign/final/homepage-mobile.png) | 390×844 |
| Dashboard | [dashboard-desktop.png](redesign/final/dashboard-desktop.png) | 1440×1000 |
| Planner desktop | [planner-desktop.png](redesign/final/planner-desktop.png) | 1600×1050 |
| Planner mobiel | [planner-mobile.png](redesign/final/planner-mobile.png) | 390×844 |
| Operation Board | [operation-desktop.png](redesign/final/operation-desktop.png) | 1600×1150 |
| Groups desktop | [groups-desktop.png](redesign/final/groups-desktop.png) | 1440×1000 |
| Groups mobiel | [groups-mobile.png](redesign/final/groups-mobile.png) | 390×844 |
| Bracket | [bracket-desktop.png](redesign/final/bracket-desktop.png) | 1440×1000 |
| Profiel | [profile-desktop.png](redesign/final/profile-desktop.png) | 1440×1000 |

## Conclusie

De volledige redesignscope van Onderdeel 1 tot en met 7 is geïmplementeerd, gecontroleerd en visueel vastgelegd. De branch kan nu door de gebruiker beoordeeld worden. Onderdeel 8 is niet gestart.
