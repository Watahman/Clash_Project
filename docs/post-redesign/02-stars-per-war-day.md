# Onderdeel 8 — sterren per war day

Datum: 18 juli 2026

Branch: `feature/post-redesign-functions`

## Goedkeuring en keuze

De gebruiker gaf toestemming om de volgende meest cruciale of moeilijke functie te kiezen. Sterren per war day is gekozen omdat deze grafiek een belangrijke zichtbare lacune in Operation Board oplost en volledig kan steunen op reeds geladen echte CWL-rondedata. De technisch moeilijkere positiecurve is niet gekozen, omdat de volledigheid van historische dagstanden daarvoor nog niet betrouwbaar is bewezen.

## Gebouwde scope

- zeven vaste dagen op de x-as;
- één lijn voor de geselecteerde clan;
- uitsluitend punten voor rondes met status `live` of `completed`;
- echte nul sterren blijft zichtbaar wanneer een live of afgeronde dag werkelijk nul heeft;
- voorbereiding, toekomstige en ontbrekende dagen blijven leeg en tonen `—`;
- een ontbrekende dag onderbreekt de lijn;
- hover-, focus- en taptooltips met sterren, destruction en tegenstander;
- toetsenbordbediening en `Escape` om een geopende tooltip te sluiten;
- een tekstuele schermlezersamenvatting en toegankelijke labels per datapunt;
- responsieve desktop- en mobiele layout;
- vertalingen voor Nederlands, Engels, Frans, Duits en Spaans.

## Databron en grenzen

De grafiek gebruikt uitsluitend `report.rounds`, dat Operation Board al opbouwt uit de geladen CWL-wars. Er zijn geen extra API-calls, tabellen, migraties, snapshots of verzonnen waarden toegevoegd.

De grafiek toont de rondes die in de actuele API-respons of geïmporteerde echte rapportdata beschikbaar zijn. Er wordt geen langdurige historische bewaring geclaimd. Voor de aparte positie-per-daggrafiek blijft eerst bewijs van een volledige leaguegroep of afzonderlijk goedgekeurde snapshotopslag nodig.

## Controles

- Gerichte Vitest-dekking voor echte nulwaarden, lege toekomstige dagen, zeven daglabels, toegankelijke tooltips en onderbroken lijnen.
- Bestaande Operation Board-regressietest uitgebreid met de grafiek.
- Vertaalpariteit voor vijf talen gecontroleerd.
- Visueel gecontroleerd op 1600×1150 en 390×844 met een tijdelijke lokale rondedatafixture; die fixture is niet bewaard.
- Tooltip gecontroleerd met sterren, destruction en tegenstander.
- Mobiele paginakop gecorrigeerd van een oude sticky positie naar normale documentflow zodat de grafiek niet wordt bedekt.
- Geen documentbrede horizontale overflow en geen browserconsolewaarschuwingen of -fouten.

Na deze functie wordt gestopt totdat de gebruiker één volgende functie afzonderlijk goedkeurt.
