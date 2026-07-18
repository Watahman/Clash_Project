# Nieuwe functies na het redesign

Auditdatum: 18 juli 2026

Basiscommit: `d86bb30`

Werkbranch: `redesign/exact-workspace-from-functional`

Dit document is een parkeerplaats, geen implementatieplan. Tijdens Onderdeel 1 tot en met 7 worden uitsluitend bestaande functies opnieuw gekoppeld aan het goedgekeurde prototype. Een functie in deze lijst mag pas na volledige redesigngoedkeuring én afzonderlijke toestemming worden gebouwd.

## Vastgestelde nieuwe functies

| Functie | Auditstatus | Huidige lacune | Benodigde echte databron | Goedkeuring | Vroegste fase |
|---|---|---|---|---|---|
| Vrij roster zoeken op spelersnaam of tag | `NEW_NOT_IMPLEMENTED` | Alleen de accountselectie-overlay heeft een zoekveld; het geladen vrije roster heeft geen filter | Reeds geladen `freePlayers`; client-side, geen API-call per toetsaanslag | Nog niet goedgekeurd | Onderdeel 8 |
| Plannen zoeken en sorteren | `NEW_NOT_IMPLEMENTED` | Draftspagina heeft geen zoekveld of sorteerbesturing | Reeds geladen planmetadata: naam en `updated_at` | Nog niet goedgekeurd | Onderdeel 8 |
| Plan exporteren vanuit Opgeslagen plannen | `NEW_NOT_IMPLEMENTED` | Drafts ondersteunt openen, hernoemen, kopiëren en verwijderen, maar geen export | Volledig bestaand plandocument via planservice | Nog niet goedgekeurd | Onderdeel 8 of afzonderlijk besluit na Onderdeel 2 |
| Sterren per war day als lijngrafiek | `NEW_NOT_IMPLEMENTED` | Geen grafiekcomponent of tijdreeksmodel aanwezig | Echte sterren/destruction/tegenstander per dag uit reeds geladen CWL-rondes; eerst bewijzen dat verleden en toekomstige dagen correct te onderscheiden zijn | Nog niet goedgekeurd | Onderdeel 8 |
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
