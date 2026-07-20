# Onderdeel 8 — opgeslagen plannen zoeken en sorteren

Datum: 18 juli 2026

Branch: `feature/post-redesign-functions`

## Goedkeuring en keuze

De gebruiker gaf toestemming om nog één open functie te bouwen. Zoeken en sorteren in Opgeslagen plannen is gekozen omdat dit bij een groeiende lijst de meeste dagelijkse efficiëntiewinst biedt en volledig op reeds geladen planmetadata kan werken.

## Gebouwde scope

- zoeken op plannaam zonder onderscheid tussen hoofdletters of accenten;
- sorteren op recent bijgewerkt, oudst bijgewerkt, naam A–Z en naam Z–A;
- natuurlijke naamsortering, zodat `Plan 2` vóór `Plan 10` staat;
- plannen zonder geldige wijzigingsdatum blijven onderaan bij beide datumsorteringen;
- live resultaatmelding, bijvoorbeeld `2 van 5 plannen zichtbaar`;
- een afzonderlijke geen-resultatenstatus zonder de echte lege-plannenstatus te verwarren;
- bediening wordt uitgeschakeld tijdens laden en wanneer er geen plannen zijn;
- zoek- en sorteerkeuze blijven behouden na hernoemen, kopiëren of verwijderen;
- vertalingen voor Nederlands, Engels, Frans, Duits en Spaans.

## Databron en grenzen

De functie gebruikt uitsluitend de samengevatte plannen die `getAllPlansFromDatabase` al één keer voor de pagina laadt. Zoeken en sorteren veroorzaken geen extra API-call en wijzigen geen plandata. Er zijn geen databasevelden, migraties of nieuwe endpoints toegevoegd.

## Controles

- Gerichte Vitest-dekking voor accentongevoelig zoeken, datumsortering, onbekende datums, natuurlijke naamsortering en niet-muteren van de bronlijst.
- Bestaande drafts-integratietest uitgebreid met echte zoek-, sorteer- en geen-resultateninteracties.
- Vertaalpariteit voor vijf talen gecontroleerd.
- Visueel gecontroleerd op 1440×900 en 390×844 met een tijdelijke lokale fixture; de fixturecode is verwijderd.
- Gecontroleerd dat de bediening op mobiel direct onder de kop staat en geen horizontale overflow veroorzaakt.
- Een bestaande, drafts-specifieke mobiele flexbasisfout hersteld die de bediening bijna een volledig scherm omlaag duwde.
- Geen browserconsolewaarschuwingen of -fouten.

Na deze functie wordt gestopt totdat de gebruiker een volgende functie afzonderlijk goedkeurt.
