# Onderdeel 8 — klassementspositie per war day

Datum: 18 juli 2026

Branch: `feature/post-redesign-functions`

## Goedkeuring en keuze

Na de sterren-per-daggrafiek gaf de gebruiker toestemming om verder te gaan en na afronding te pushen. De klassementspositie per war day is als volgende technisch moeilijke functie gekozen, omdat hiervoor eerst bewezen moest worden dat een historische dagstand niet uit onvolledige wars wordt afgeleid.

## Gebouwde scope

- zeven vaste CWL-dagen op de x-as;
- cumulatieve positie van de geselecteerde clan na iedere volledig afgeronde dag;
- positie 1 staat bovenaan en de onderste positie onderaan;
- toekomstige, ontbrekende of onvolledige dagen tonen `—`;
- hover-, focus- en taptooltips met positie, cumulatieve sterren en destruction;
- toetsenbordbediening en `Escape` om een geopende tooltip te sluiten;
- tekstuele schermlezersamenvatting en toegankelijke labels per datapunt;
- responsieve desktop- en mobiele layout;
- vertalingen voor Nederlands, Engels, Frans, Duits en Spaans.

## Betrouwbaarheidsregel

Voor iedere dag worden de verwachte war-tags uit `leagueGroup.rounds` vergeleken met de geladen `leagueWars`. Een positie wordt alleen berekend als:

- het aantal verwachte war-tags overeenkomt met het aantal wars voor de groepsgrootte;
- alle war-tags echt, uniek en geladen zijn;
- iedere war afgerond is en beide clans bevat;
- de wars samen alle clans uit de leaguegroep dekken;
- alle eerdere dagen eveneens compleet zijn;
- de bestaande standberekening exact één rij per groepsclan oplevert.

De grafiek hergebruikt daarna de bestaande `buildStandings`-functie op alle complete wars tot en met die dag. Er is geen nieuwe tiebreakregel toegevoegd. Zodra één controle faalt, blijft die dag en iedere latere dag leeg.

## Databron en grenzen

De functie gebruikt uitsluitend de reeds geladen leaguegroep, ronde-war-tags en afgeronde wars. Er zijn geen extra API-calls, tabellen, snapshots of migraties toegevoegd.

Dit bewijst een betrouwbare reconstructie binnen een complete actuele of geïmporteerde leaguegroeprespons. Het bewaart geen standen voor langdurige historische raadpleging nadat de bronrespons niet meer beschikbaar is. Zo’n retentiefunctie blijft optioneel en vereist later een afzonderlijk goedgekeurd datamodel.

## Controles

- Gerichte Vitest-dekking voor cumulatieve dagstanden, ontbrekende wars, gedeeltelijk live dagen, lijngeometrie en toegankelijke details.
- Bestaande Operation Board-regressietest uitgebreid met de positiecurve.
- Vertaalpariteit voor vijf talen gecontroleerd.
- Visueel gecontroleerd op 1600×1150 en 390×844 met een tijdelijke lokale fixture; die fixture is verwijderd.
- Gecontroleerd dat dag 1 op #2 en dag 2 cumulatief op #1 staat, dat #1 bovenaan wordt getekend en dagen 3–7 leeg blijven.
- Geen documentbrede horizontale overflow en geen browserconsolewaarschuwingen of -fouten.

Na deze functie wordt gestopt totdat de gebruiker één volgende functie afzonderlijk goedkeurt.
