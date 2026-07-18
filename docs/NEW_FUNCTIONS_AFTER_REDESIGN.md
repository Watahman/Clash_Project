# Nieuwe functies na het redesign

Auditdatum: 18 juli 2026

Basiscommit: `d86bb30`

Werkbranch: `redesign/exact-workspace-from-functional`

Dit document is een parkeerplaats, geen implementatieplan. Tijdens Onderdeel 1 tot en met 7 worden uitsluitend bestaande functies opnieuw gekoppeld aan het goedgekeurde prototype. Een functie in deze lijst mag pas na volledige redesigngoedkeuring én afzonderlijke toestemming worden gebouwd.

## Status na Onderdeel 7

De redesign is op 18 juli 2026 volledig visueel en functioneel gecontroleerd. Geen van de onderstaande nieuwe of optionele functies is tijdens Onderdeel 1 tot en met 7 gebouwd. De auditstatussen, databronvoorwaarden en goedkeuringsvereisten blijven ongewijzigd.

- Onderdeel 8 is gestart op branch `feature/post-redesign-functions`.
- Er zijn geen nieuwe databasevelden, tabellen of migraties voor deze functies toegevoegd.
- Er is geen fake live data of grafiekdata gebruikt om ontbrekende functies te simuleren.
- De grafiek voor klassementspositie per dag blijft afwezig totdat historische datavolledigheid is bewezen.
- Vrij-roster zoeken is als eerste afzonderlijk goedgekeurde functie van Onderdeel 8 geïmplementeerd en gecontroleerd.
- Sterren per war day is als tweede afzonderlijk goedgekeurde functie gebouwd op de reeds geladen echte rondedata.
- Mobiele bracketnavigatie, plannen zoeken/sorteren en Groups-ledenfilters blijven `NEW_NOT_IMPLEMENTED`.
- Onboarding, het aandachtfilter en historische snapshotopslag blijven `OPTIONAL_NOT_APPROVED`.

## Onderdeel 8 — functie 1

Vrij-roster zoeken op spelersnaam of tag is op 18 juli 2026 afzonderlijk goedgekeurd. De implementatie filtert uitsluitend de reeds gerenderde spelerskaarten in de browser, voert geen API-call per toetsaanslag uit en wijzigt geen plandata. Het gerichte rapport staat in [`post-redesign/01-free-roster-search.md`](post-redesign/01-free-roster-search.md).

## Onderdeel 8 — functie 2

De gebruiker gaf toestemming om de volgende meest cruciale of moeilijke functie te kiezen. Sterren per war day is gekozen omdat dit de grootste nog zichtbare Operation Board-lacune oplost met data die al betrouwbaar per geladen ronde aanwezig is. Alleen live en afgeronde dagen worden getekend; toekomstige of ontbrekende dagen blijven leeg. Het gerichte rapport staat in [`post-redesign/02-stars-per-war-day.md`](post-redesign/02-stars-per-war-day.md).

## Vastgestelde nieuwe functies

| Functie | Auditstatus | Huidige lacune | Benodigde echte databron | Goedkeuring | Vroegste fase |
|---|---|---|---|---|---|
| Vrij roster zoeken op spelersnaam of tag | `IMPLEMENTED_PART8` | Zichtbaar zoekveld met naam-/tagfilter, live resultaatteller en afzonderlijke geen-resultatenstatus | Reeds geladen `freePlayers`; volledig client-side, geen API-call per toetsaanslag | Goedgekeurd op 18 juli 2026 | Onderdeel 8, functie 1 |
| Plannen zoeken en sorteren | `NEW_NOT_IMPLEMENTED` | Draftspagina heeft geen zoekveld of sorteerbesturing | Reeds geladen planmetadata: naam en `updated_at` | Nog niet goedgekeurd | Onderdeel 8 |
| Plan exporteren vanuit Opgeslagen plannen | `NEW_NOT_IMPLEMENTED` | Drafts ondersteunt openen, hernoemen, kopiëren en verwijderen, maar geen export | Volledig bestaand plandocument via planservice | Nog niet goedgekeurd | Onderdeel 8 of afzonderlijk besluit na Onderdeel 2 |
| Sterren per war day als lijngrafiek | `IMPLEMENTED_PART8` | Toegankelijke responsieve grafiek met dag 1–7, echte datapunten, lege toekomstige dagen en detailtooltip | Reeds geladen rondedata met status, sterren, destruction en tegenstander; geen nieuwe opslag | Goedgekeurd via keuze voor de meest cruciale/moeilijke volgende functie op 18 juli 2026 | Onderdeel 8, functie 2 |
| Klassementspositie per war day als lijngrafiek | `NEW_NOT_IMPLEMENTED` | Alleen actuele/berekende stand aanwezig; geen betrouwbare snapshot per afgeronde dag | Historische standings per dag, reconstrueerbaar uit complete war-data of na apart goedgekeurd snapshotmodel | Nog niet goedgekeurd | Onderdeel 8, na dataonderzoek |
| Mobiele bracketnavigatie per ronde | `NEW_NOT_IMPLEMENTED` | Bracket rendert alle rondekolommen zonder mobiele rondepijlen/tabs | Bestaand client-side bracketmodel; geen nieuwe backenddata nodig | Nog niet goedgekeurd | Onderdeel 8 |
| Leden zoeken/filteren in Groups | `NEW_NOT_IMPLEMENTED` | Geen zoek- of filterlogica gevonden in de functionele Groups-pagina | Reeds geladen leden en accounts; client-side | Alleen bouwen indien goedgekeurd prototype dit functioneel vereist en gebruiker toestemt | Onderdeel 8 |

## Optionele functies zonder goedkeuring

| Functie | Auditstatus | Waarom geparkeerd | Benodigde beslissing/data | Vroegste fase |
|---|---|---|---|---|
| Onboarding na registratie | `OPTIONAL_NOT_APPROVED` | Er is geen bestaand onboardingmodel of goedgekeurde flow | Productbesluit over stappen, overslaan, opslag en eindbestemming | Onderdeel 8, aparte toestemming |
| Aandachtfilter in Operation Board | `OPTIONAL_NOT_APPROVED` | Er is geen bestaande detectielogica; fake problemen of waarschuwingen zijn verboden | Expliciete lijst van bestaande, objectief berekenbare signalen | Onderdeel 8, aparte toestemming |
| Historische standingssnapshots opslaan | `OPTIONAL_NOT_APPROVED` | Alleen nodig als positie per dag niet betrouwbaar uit bestaande API-responses kan worden gereconstrueerd | Datamodel, retentie, migratie, RLS en expliciete toestemming voor databasewijziging | Onderdeel 8, pas na dataonderzoek |

## Gecontroleerd en niet nieuw

| Functie | Status | Bewijs |
|---|---|---|
| Toegankelijke actie “Verplaats naar…” | `EXISTING_WORKING` | `src/assets/js/templates/CWLTemplates.js` bevat `attachMoveControl` en gebruikt dezelfde plannerverplaatsing voor een expliciete selectbesturing |
| War-daydetailfilter | `EXISTING_WORKING` | `src/assets/js/pages/cwl-operation-board.js` bouwt `day:N`-opties in `op-roster-view` en rendert rosterdetails voor de gekozen dag |
| Automatische voortgang naar volgende bracketronde | `EXISTING_WORKING` | `src/assets/js/bracket/bracket-engine.js` propageert de gekozen winnaar; een aparte knop is niet vereist voor de bestaande werking |
| Beschikbaarheid uit polls in de Planner | `EXISTING_WORKING` | De planner kan Group-pollresultaten importeren en bewaart pollmetadata/beschikbaarheid in het planmodel |

## Bestaande presentatie die tijdens het redesign mag worden gekoppeld

De volgende punten zijn geen nieuwe businessfuncties. Ze mogen in de relevante redesignfase worden opgebouwd als presentatie boven op reeds bestaande data, zonder nieuwe API's of opslaglogica:

- een echt Dashboard dat bestaande plannen, Groups en gekoppelde accounts rustig ontsluit;
- aantallen clans en vrije spelers tonen in planmetadata;
- de volledige reeds berekende actuele stand tonen in plaats van alleen de eigen clan en directe buren;
- bestaande auth-, loading-, empty- en errorstates consequent in de nieuwe shell plaatsen;
- de kapotte zichtbare Groups-knop “Uitnodigen” niet tonen zolang er geen bestaande werkende actie aan gekoppeld kan worden.

## Expliciet uitgesloten

Deze punten worden niet in Onderdeel 8 gebouwd tenzij de productregels later uitdrukkelijk worden gewijzigd:

- player readiness;
- gemiddelde Town Hall als plannerstatistiek;
- een planbrede league;
- een planbreed vast spelersdoel;
- automatisch berekende spelerskwaliteit;
- automatisch verzonnen spelerrollen;
- fake beschikbaarheid, fake live statistieken of fake grafiekdata;
- een groot algemeen “Problemen”-blok;
- dramatische waarschuwingen zonder echte detectielogica;
- lege toekomstige tabs zoals de huidige Groups-tab “Later”.

## Dataregel voor de twee grafieken

Geen grafiek wordt getoond met nullen die eigenlijk “nog niet gespeeld” betekenen. Toekomstige dagen moeten leeg blijven. Voor positie per war day moet eerst aantoonbaar zijn dat alle standen volgens de bestaande Clash-data en tiebreakregels betrouwbaar kunnen worden gereconstrueerd. Als dat niet kan, volgt eerst een voorstel voor een snapshotmodel en afzonderlijke toestemming; pas daarna mag een migratie worden gemaakt.

### Datacontrole tijdens Onderdeel 4

- **Sterren per war day:** de huidige Operation Board haalt de war-tags uit alle beschikbare CWL-rondes op en bewaart per geladen war de ronde, sterren, destruction en tegenstander. Dat lijkt voldoende om een sterrenlijn voor de op dat moment volledig beschikbare leaguegroep te berekenen, maar er is nog geen bewezen garantie dat de Clash API alle reeds gespeelde wars gedurende de volledige gewenste bewaartermijn blijft teruggeven. Daarom is nog geen grafiek gebouwd.
- **Positie per war day:** de huidige code berekent alleen de actuele stand uit alle afgeronde wars die in de huidige API-respons aanwezig zijn. Voor een betrouwbare historische positie moet de stand na iedere afzonderlijke dag opnieuw worden opgebouwd uit een aantoonbaar complete set wars, inclusief dezelfde tiebreakregels. Die volledigheid is nog niet bewezen en er bestaat geen snapshotopslag. Daarom is ook deze grafiek niet gebouwd.
- **Benodigde vervolgstap:** voeg eerst gerichte fixtures/tests toe voor complete en onvolledige leaguegroepen en beslis daarna of reconstructie volstaat of dat een apart, goedgekeurd snapshotmodel nodig is.
