# Onderdeel 8 — vrij-roster zoeken

Datum: 18 juli 2026

Branch: `feature/post-redesign-functions`

## Goedkeuring en scope

De gebruiker heeft vrij-roster zoeken op spelersnaam of tag afzonderlijk goedgekeurd als eerste functie van Onderdeel 8.

Gebouwd:

- een zichtbaar zoekveld in het vrije roster van de CWL Planner;
- hoofdletterongevoelig zoeken op spelersnaam;
- zoeken op spelertag met of zonder `#`;
- een toegankelijke live teller met het aantal zichtbare en totale spelers;
- een afzonderlijke melding wanneer een gevuld roster geen overeenkomsten bevat;
- opnieuw filteren wanneer een plan laadt, een speler wordt verplaatst of later met echte Clash-data wordt verrijkt;
- vertalingen voor Nederlands, Engels, Frans, Duits en Spaans.

Niet gebouwd:

- server-side zoeken;
- een API-call per toetsaanslag;
- nieuwe opslag, tabellen of migraties;
- zoeken in clanrosters of andere pagina's;
- andere functies uit Onderdeel 8.

## Databron en gedrag

De functie gebruikt uitsluitend de spelerskaarten die al uit `freePlayers` in de browser zijn gerenderd. Filteren verbergt niet-overeenkomende kaarten tijdelijk en wijzigt het plandocument niet. Bestaande sortering, drag-and-drop, `Verplaats naar…`, autosave en spelersaantallen blijven daardoor hun bestaande databron en logica gebruiken.

## Controles

- Gerichte Vitest-dekking voor zoeken op naam en tag, geen resultaten en dynamisch toevoegen/verrijken.
- Bestaande Planner-clan- en planwisseltests opnieuw uitgevoerd.
- Vertaalpariteit voor vijf talen gecontroleerd.
- Visuele controle op 1600×1050 en 390×844.
- Geen documentbrede horizontale overflow op mobiel.
- Geen browserconsolewaarschuwingen of -fouten.

Na deze functie wordt gestopt totdat de gebruiker één volgende functie afzonderlijk goedkeurt.
