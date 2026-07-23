# ClashPanel pre-launch audit

Datum: 23 juli 2026
Auditbranch: `fix/prelaunch-readiness`
Gekozen bronbranch: `origin/feature/post-redesign-functions`
Broncommit: `e5ebbfefa149a5edfed79bb572d2fd6f6072e55e` (`style: anonymize planner preview names`)

## Releasebeslissing

**CONDITIONAL GO**

De gecontroleerde code, tests en builds zijn klaar voor een stagingrelease. Er staan geen bevestigde kritieke codeproblemen meer open. Publieke productiepublicatie blijft geblokkeerd totdat de handmatige Supabase-, hosting-, secrets-, authenticatie- en juridische controles onderaan zijn afgerond.

Er is niets gepusht, gemerged, gedeployed of op een productieomgeving gemigreerd.

## Bronselectie

De lokale en remote branches zijn na `git fetch` vergeleken op commitdatum en volledige projectinhoud. `origin/feature/post-redesign-functions` bevatte de recentste volledige versie van frontend, Java-backend, migraties, tests en redesignfunctionaliteit. Daarvan is lokaal `fix/prelaunch-readiness` gemaakt.

## Kritieke problemen

Geen bevestigde open kritieke problemen.

## Hoge problemen

### Opgelost

1. **Autorisatielek bij gebruikersprofielen**
   - Een ingelogde gebruiker kon via een zelf gekozen `userId` beperkte profielgegevens van een andere gebruiker opvragen.
   - De endpoint accepteert nu uitsluitend de gebruikers-ID uit de eigen geverifieerde sessie; een afwijkende ID geeft `403`.

2. **Ruwe upstream-fouten zichtbaar aan clients**
   - Clash API- en Supabase-foutbody's konden rechtstreeks naar de browser terugkeren en interne details bevatten.
   - Upstream-fouten worden nu gemarkeerd als niet-publiceerbaar en vertaald naar veilige statuscodes en foutcodes. Bewuste applicatiefouten, zoals revisieconflicten, blijven intact.
   - De backend logt geen ruwe Supabase-authenticatiefoutbody meer.

3. **Fout plancontext na mislukte CWL-planwissel**
   - De bescherming tegen een trage response van plan A in plan B bestond al via een laadtoken en `AbortController`.
   - Bij een mislukte wissel kon de geselecteerde context echter op het niet-geladen doelplan blijven staan. Daardoor kon een volgende actie of autosave aan de verkeerde context worden gekoppeld.
   - De vorige plan-ID, selectie en autosavestatus worden nu hersteld; het `plan-loaded`-event wordt alleen na een geslaagde load verstuurd.

4. **Ontbrekende publieke release- en policybasis**
   - Privacy, cookies, gebruiksvoorwaarden, contact, footer, fancontentdisclaimer, 404, robots en sitemap ontbraken.
   - Er zijn duidelijke Nederlands/Engelse conceptpagina's en releasebestanden toegevoegd. Ze doen geen juridische garanties.

### Nog handmatig af te sluiten

1. **Supabase-functierechten en productie-RLS**
   - De migraties schakelen RLS in en bevatten eigendoms-/lidmaatschapsbeleid.
   - Enkele `SECURITY DEFINER`-hulpfuncties waren door PostgreSQL-standaardrechten potentieel breder uitvoerbaar dan nodig. Migratie `20260723_006_restrict_security_definer_helpers.sql` trekt die rechten in en geeft alleen de noodzakelijke rol toegang.
   - De migratie is bewust niet uitgevoerd. Dit blijft een launchvoorwaarde totdat ze in staging is beoordeeld, getest en daarna volgens het normale productieproces is toegepast.

2. **Juridische en contactgegevens**
   - `support.clashpanel@gmail.com` is als private route voor support, feature requests, account-, privacy- en beveiligingsvragen ingesteld.
   - De policyteksten blijven technische concepten. Operator/verwerkingsverantwoordelijke, bewaartermijnen en toepasselijk recht moeten nog definitief worden ingevuld en juridisch worden beoordeeld.

## Uitgevoerde wijzigingen

### Security en backend

- Hoge-confidence secretscan op 215 actuele repositorytekstbestanden en de volledige Git-history: geen AWS-, Google-, Stripe-, Supabase secret-, JWT-, private-key- of vergelijkbare patronen gevonden.
- Bestaande CI bevat een Gitleaks-stap; lokaal was geen Gitleaks-binary beschikbaar.
- Sessiegebaseerde gebruikersautorisatie aangescherpt voor profielgegevens.
- Strikte Clash-speler-, clan- en war-tagvalidatie toegevoegd vóór URL-encoding of databaseopslag.
- Verificatietokens begrensd op 128 tekens.
- JSON-body's moeten nu geldige JSON-objecten zijn; verkeerde typen en ongeldige JSON geven veilig `400` in plaats van `500`.
- Bestaande request-bodylimiet, exacte CORS-allowlist, per-route rate limiting, backend connect/read-time-outs en beveiligingsheaders gecontroleerd en behouden.
- Bestaande sessiecookies zijn `HttpOnly`, `SameSite=Lax` en configureerbaar `Secure`; productieconfiguratie blijft een handmatige controle.
- Browserrequests krijgen standaard een time-out van 20 seconden en een herkenbare `REQUEST_TIMEOUT`-fout.

### Supabase

- Alle tabellen in de gecontroleerde migraties hebben RLS en expliciete policies/grants.
- Group-, poll-, reminder-, plan- en accountpaden gebruiken sessie-identiteit plus ownership/lidmaatschapschecks.
- Service-only transactionele RPC's hadden al expliciete revokes/grants; helperfunctierechten zijn nu in een aparte forward-only migratie aangescherpt.
- De actuele Supabase-richtlijnen zijn gecontroleerd: functies zijn standaard uitvoerbaar tenzij rechten expliciet worden ingetrokken, en `SECURITY DEFINER` vereist een vaste `search_path`. De bestaande functies zetten hun `search_path`; de nieuwe migratie beperkt `EXECUTE`.
- Relevante bronnen:
  - [Supabase - Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
  - [Supabase - Database functions](https://supabase.com/docs/guides/database/functions)
  - [Supabase advisor 0029](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable)

### Cache

- Backend L1-geheugencache, L2 SQLite-cache, TTL/stalevensters en single-flight requestdeduplicatie gecontroleerd.
- Een **verse** cachehit doet geen externe request.
- Een **stale maar nog bruikbare** hit geeft onmiddellijk de gecachte data terug en start bewust één achtergrondrefresh. Dat verklaart waarom een cachehit soms toch door een API- of databaseaanvraag wordt gevolgd; dit is correcte stale-while-revalidatewerking.
- Gelijktijdige refreshes met dezelfde cachekey delen één in-flight request.
- Frontend IndexedDB-cache gebruikt dezelfde fresh/stale/expired-logica en dedupliceert refreshes.
- Cachekeys normaliseren en valideren tags. Ontbrekende cachedata wordt als een miss behandeld, zonder consolefout.
- Geen defect gevonden dat correcte stale-vernieuwing moest verwijderen.

### CWL Planner

- Bescherming tegen late A/B-responses, aborts en plancontexttokens gecontroleerd.
- Autosave staat uit tijdens eerste load en gebruikt een vastgelegde `planId` en revisie.
- Een mislukte planwissel herstelt nu het vorige actieve plan en activeert autosave niet voor een onvolledig geladen plan.
- Revisieconflicten blijven zichtbaar en overschrijven geen nieuwere data stil.
- Regressietests toegevoegd voor mislukte planwissel en de bestaande late-responsebescherming.

### Frontend, zichtbare functies en responsive gedrag

- Home, policy's, registratie, login, 404 en beschermde-route-redirect gecontroleerd op 390 × 844, 1024 × 768 en 1440 × 900.
- Geen horizontale pagina-overflow, oneindige loading gate of zichtbare consolefout gevonden.
- Tablet-/mobiele navigatie hersteld: taalkeuze was verborgen en staat nu in het menu.
- Nederlands en Engels werken voor footer, policy's en releasepagina's; i18n-pariteit blijft groen.
- Polls en reminders hebben werkende handlers en bleven zichtbaar.
- Bracket generator blijft expliciet als “coming soon” gemarkeerd en wordt niet als werkende actie aangeboden.
- Cookievoorkeuren blijven verborgen zolang geen CMP aanwezig is. Als `window.ClashToolsCMP.openPreferences` wordt aangeboden en `clashtools:cmp-ready` wordt verstuurd, wordt de knop zichtbaar en kan de voorkeurendialoog opnieuw worden geopend.
- De zichtbare productnaam is gewijzigd naar ClashPanel; bestaande interne opslagkeys, events en cacheheaders met `clashtools` blijven voor compatibiliteit behouden.
- De publieke navigatie bevat nu een directe ingang voor bugmeldingen en feature requests.

### Privacy, policies en releasebestanden

- Conceptpagina's toegevoegd voor privacy, cookies, gebruiksvoorwaarden en contact in Nederlands en Engels.
- Homefooter toegevoegd met interne links, officiële Supercell-link en fancontentdisclaimer.
- Externe links openen met `target="_blank"` en `rel="noopener noreferrer"`.
- De officiële [Supercell Fan Content Policy](https://supercell.com/en/fan-content-policy/) is gebruikt.
- Registratie linkt naar privacy en gebruiksvoorwaarden.
- Favicon bestond al en is behouden.
- 404, `robots.txt`, `sitemap.xml`, paginatitels, meta descriptions en Open Graph/Twitter-basismetadata toegevoegd of aangevuld.
- `PUBLIC_SITE_URL` vult bij de productiebuild het domein in robots en sitemap in. Zonder waarde blijft bewust een ongeldig placeholderdomein staan, zodat dit niet ongemerkt als productieconfiguratie kan worden gepubliceerd.
- `.env.example` bevat alleen placeholders; README bevat productie-instructies voor domein, build en custom 404.

## Tests en build

Alle hieronder genoemde eindchecks zijn na de laatste relevante codewijziging uitgevoerd.

| Controle | Resultaat |
| --- | --- |
| `npm.cmd run check` met testdomein voor `PUBLIC_SITE_URL` | Geslaagd |
| Migratievolgorde | 9 SQL-migraties gevalideerd |
| Frontend/backend-endpointpariteit | 71 data- en 7 authroutes gevalideerd |
| Vitest | 21 bestanden, 68 tests geslaagd |
| JavaScript-syntaxcontrole | 113 bestanden geslaagd |
| Maven/JUnit | 7 suites, 18 tests, 0 fouten |
| Maven productiepackage | Geslaagd; dependency-inclusive JAR gemaakt |
| `npm audit --audit-level=high` | 0 kwetsbaarheden |
| `npm audit --omit=dev --audit-level=high` | 0 kwetsbaarheden |
| `git diff --check` | Geslaagd |
| Responsieve browsercontrole | Geslaagd op mobiel, laptop en desktop |
| Browserconsole op gecontroleerde publieke flows | Geen errors/warnings |

Maven toont op de gebruikte IntelliJ Java 25-runtime waarschuwingen over toekomstige native-accessbeperkingen in Maven Guice en SQLite JDBC. De applicatie compileert voor Java 21 en tests/package slagen. Gebruik voor productie de gedocumenteerde Java 21-runtime.

## HANDMATIGE CONTROLE vóór publicatie

1. **Supabase**
   - Beoordeel en voer migratie `20260723_006_restrict_security_definer_helpers.sql` eerst in staging uit.
   - Draai Security Advisor en Performance Advisor.
   - Controleer grants op alle exposed tabellen, views en functies en bevestig dat alleen bedoelde schema's via de Data API zijn exposed.
   - Test met twee echte testaccounts dat gebruiker A geen records, profielen, plannen, groepen, polls, reminders of accounts van gebruiker B kan lezen of wijzigen.
   - Controleer Auth URL Configuration, toegestane redirect-URL's, e-mailbevestiging, resetlink en Google OAuth-callbacks.

2. **Secrets en backendproductieconfiguratie**
   - Zet Supabase service role, Clash API-key en eventuele OAuth-secrets uitsluitend in de backend-secretstore; nooit in de statische host of browserruntime.
   - Roteer een secret als niet aantoonbaar is dat die nooit publiek is geweest.
   - Voer Gitleaks/CI op de uiteindelijke commit uit.
   - Bevestig `COOKIE_SECURE=true`, de exacte HTTPS-originallowlist, trusted-proxy-instelling en rate-limitgedrag achter de echte reverse proxy.

3. **Hosting, domein en releaseoutput**
   - Bouw met het echte HTTPS-domein in `PUBLIC_SITE_URL`.
   - Controleer dat hosting de meegeleverde `404.html` voor onbekende routes gebruikt.
   - Controleer HTTPS, DNS, redirects, cacheheaders, `robots.txt`, sitemap en de canonical/absolute social metadata na domeinkeuze.
   - Voer een staging-smoketest uit met echte Supabase- en Clash API-configuratie, inclusief 400/403/404/429/5xx-paden.

4. **Policy en support**
   - Vul operator/verwerkingsverantwoordelijke, bewaartermijnen en toepasselijk recht in.
   - Laat privacy-, cookie- en gebruiksvoorwaarden juridisch beoordelen.
   - Overweeg Google Fonts lokaal te hosten; werk cookiebeleid en CMP bij vóór analytics, advertenties of andere niet-essentiële opslag worden toegevoegd.

5. **Eindacceptatie**
   - Test registratie, login, logout, reset, Google login, twee-planwissel met trage/mislukte response, autosaveconflict en recovery op staging.
   - Geef pas productie-vrijgave wanneer alle bovenstaande controles bewijsbaar groen zijn.

## Minimale acties voor productiepublicatie

1. Supabase-migratie en RLS/granttests in staging en productieproces afronden.
2. Definitieve secrets-, cookie-, CORS-, proxy- en authconfiguratie vastleggen.
3. Echt domein instellen, productiebuild maken en hosting/404/HTTPS controleren.
4. Juridische beheerdersgegevens invullen en de policyteksten reviewen.
5. Gitleaks/CI plus de live staging-smoketest groen afronden.

Na deze vijf acties kan de beslissing van **CONDITIONAL GO** naar **GO**.

## Gewijzigde bestanden

### Configuratie, documentatie en build

- `.env.example`
- `AUDIT_RELEASE_READINESS.md`
- `package.json`
- `package-lock.json`
- `pom.xml`
- `README.md`
- `scripts/build-static.mjs`
- `database/migrations/20260723_006_restrict_security_definer_helpers.sql`
- `docs/REDESIGN_FINAL_REPORT.md`
- `docs/prelaunch-audit.md`

### Java-backend

- `src/Java/API_Clan.java`
- `src/Java/API_Player.java`
- `src/Java/API_Utils.java`
- `src/Java/AuthService.java`
- `src/Java/HttpException.java`
- `src/Java/SUPABASE_Client.java`
- `src/Java/SUPABASE_Group.java`
- `src/Java/SUPABASE_User.java`
- `src/Java/cache/CacheKeys.java`

### Frontendlogica en styling

- `src/assets/css/workspace-system.css`
- `src/assets/js/cwl/cwl-plan-io.js`
- `src/assets/js/i18n/workspace-locales.js`
- `src/assets/js/pages/public-policy.js`
- `src/assets/js/pages/public-site.js`
- `src/assets/js/pages/cwl-operation-board.js`
- `src/assets/js/shell/workspace-shell.js`
- `src/assets/js/utils/request-json.js`

### Publieke en applicatiepagina's

- `src/404.html`
- `src/index.html`
- `src/robots.txt`
- `src/sitemap.xml`
- `src/subPages/bracket-generator.html`
- `src/subPages/contact.html`
- `src/subPages/cookies.html`
- `src/subPages/cwl-operation-board.html`
- `src/subPages/cwl-planner-drafts.html`
- `src/subPages/cwl-planner.html`
- `src/subPages/dashboard.html`
- `src/subPages/groups.html`
- `src/subPages/login.html`
- `src/subPages/privacy.html`
- `src/subPages/register.html`
- `src/subPages/terms.html`

### Tests

- `test/Java/ApiValidationTest.java`
- `test/Java/HttpExceptionTest.java`
- `test/Java/cache/CacheKeysTest.java`
- `test/frontend/cwl-plan-switching.test.js`
- `test/frontend/request-json.test.js`

## Niet gewijzigd of gepubliceerd

- Geen productiegegevens of Supabase-project zijn gewijzigd.
- Geen remote branch, merge, PR, release of deployment is gemaakt.
- Reeds aanwezige, niet-getrackte redesignbewijsbestanden en `skills-lock.json` zijn ongemoeid gelaten en horen niet bij deze auditwijzigingen.
