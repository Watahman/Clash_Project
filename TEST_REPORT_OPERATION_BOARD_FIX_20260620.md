# Operation Board Fix Report - 2026-06-20

## Aangepast
- `src/subPages/cwl-operation-board.html`
- `src/assets/js/pages/cwl-operation-board.js`
- `src/assets/css/cwlPlanner.css`
- `src/assets/js/i18n/translations.js`

## Fixes
- CWL war states worden nu genormaliseerd naar `notStarted`, `preparation`, `live`, `completed`, `notAvailable` of `unknown`.
- Aanvallen, missed attacks, sterren, destruction en win/loss/draw tellen alleen mee voor wars die logisch meetellen.
- `preparation` en nog niet beschikbare/toekomstige rounds worden niet meer als afgeronde of actieve attack-data meegerekend.
- Win/loss/draw wordt alleen toegekend bij afgeronde wars.
- Roster-mapping is robuuster: geplande spelers worden op tag gematcht en aangevuld met cache, clan members en indien nodig player info via de Java proxy.
- Roster filter heeft dynamische dagopties op basis van de beschikbare CWL rounds.
- Roster teller toont enkel het aantal zichtbare spelers, niet meer `x/y`.
- Rosterhoogte is niet meer kunstmatig gelimiteerd; de pagina kan doorlopen naar bonusadvies.
- Planning- en clan-selectors gebruiken placeholders in plaats van gewone dummy-opties.
- Clan dropdown toont clan names waar mogelijk; ontbrekende namen worden via de Java proxy opgehaald.
- CWL status is nu een niet-klikbare status badge met leesbare tekst/styling.
- JSON import toegevoegd voor Operation Board exports en planning JSON.

## Tests
- `node --check src/assets/js/pages/cwl-operation-board.js`: OK
- `npm ci --ignore-scripts`: OK
- `npm run build`: OK
- Token check in frontend/subpages: geen Clash API token/Bearer/API URL hardcoded gevonden.

## Niet getest in deze omgeving
- Live API smoke test tegen `localhost:8080`, omdat de Java backend hier niet draait.
- Maven compile via `mvn`, omdat `mvn` niet beschikbaar is in deze Linux-container. Gebruik lokaal je IntelliJ Maven-pad.

## Aannames
- Clash API war states volgen de gekende values: `preparation`, `inWar`, `warEnded`, `notInWar`.
- Voor live wars telt de board actuele gebruikte/beschikbare attacks; voor preparation/not-started telt hij geen attacks/missed/result.
- JSON import accepteert vooral Operation Board exports of planning-objecten met `info`.
