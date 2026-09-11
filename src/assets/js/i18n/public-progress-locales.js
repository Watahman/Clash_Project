import { getLanguage } from './i18n.js?v=20260829-public-auth-v1';

/* Copy that remains on public feature pages after the product previews are
   removed. Private progress values never belong in this source map. */
const COPY = Object.freeze({
    en: Object.freeze({
        'common.comingSoon': '(Coming soon)',
        'stats.title': 'A clearer attack history is coming.',
        'ach.title': 'A clearer view of every milestone is coming.',
        'demo.dashboardOutput': 'Read-only dashboard example',
        'demo.dataBoundary': 'Data boundary',
        'demo.familySource': 'To create a real family, bring the invitation code, member list, account tags and poll answers from your private workspace. The names here are fixture values.',
        'demo.familySourceLabel': 'Use your own source data',
        'demo.league': 'League',
        'demo.leagueText': 'Standings and projected finish show where the result can still move.',
        'demo.live': 'Live',
        'demo.liveText': 'Score, destruction and attacks left stay together for the active round.',
        'demo.loginBoundary': 'Login boundary',
        'demo.loginText': 'Anyone can inspect this example; only signed-in users can save a real plan.',
        'demo.multiClanContext': 'Multi-clan context',
        'demo.output': 'Controlled example output',
        'demo.plannerOutputText': 'Planner previews are intentionally static. They demonstrate the review decision without exposing a clan tag, API response or private roster.',
        'demo.plannerOutputTitle': 'One shared pool, two accountable rosters.',
        'demo.plannerSource': 'Use your existing player and clan tags or spreadsheet as the source. ClashPanel does not invent roster membership from this public fixture.',
        'demo.rosterBonuses': 'Roster and bonuses',
        'demo.rosterBonusesText': 'Participation and medal advice are visible without changing the source war data.',
        'demo.rosterGap': 'South Watch is 14/15 until an available player is assigned.',
        'demo.sharedPool': 'North Guard and South Watch draw from the same 30-player fixture pool.',
        'demo.trackerOutputText': 'The tracker separates current war facts from projections and historical comparisons, so a missing attack detail is not silently treated as a zero.',
        'demo.trackerOutputTitle': 'Facts now, context later.',
        'demo.trackerSource': 'Connect a clan tag or saved plan in the private app for current data. This page contains no live game response and no personal player history.',
        'demo.warnings': 'Warnings stay visible',
        'demo.whatToBring': 'What to bring'
    }),
    nl: Object.freeze({
        'common.comingSoon': '(Binnenkort beschikbaar)',
        'stats.title': 'Een duidelijkere aanvalsgeschiedenis komt eraan.',
        'ach.title': 'Een duidelijker overzicht van elke mijlpaal komt eraan.',
        'demo.dashboardOutput': 'Dashboardvoorbeeld in alleen-lezen modus',
        'demo.dataBoundary': 'Datagrens',
        'demo.familySource': 'Gebruik voor een echte familie de uitnodigingscode, ledenlijst, accounttags en pollantwoorden uit je privéworkspace. De namen hier zijn fixturewaarden.',
        'demo.familySourceLabel': 'Gebruik je eigen brondata',
        'demo.league': 'League',
        'demo.leagueText': 'Standen en verwachte eindpositie tonen waar het resultaat nog kan verschuiven.',
        'demo.live': 'Live',
        'demo.liveText': 'Score, vernietiging en resterende aanvallen blijven samen voor de actieve ronde.',
        'demo.loginBoundary': 'Aanmeldgrens',
        'demo.loginText': 'Iedereen kan dit voorbeeld bekijken; alleen aangemelde gebruikers kunnen een echt plan opslaan.',
        'demo.multiClanContext': 'Context voor meerdere clans',
        'demo.output': 'Gecontroleerde voorbeelduitvoer',
        'demo.plannerOutputText': 'Planner-voorbeelden zijn bewust statisch. Ze tonen de beoordelingsbeslissing zonder clantag, API-response of privéroster bloot te geven.',
        'demo.plannerOutputTitle': 'Eén gedeelde pool, twee verantwoorde rosters.',
        'demo.plannerSource': 'Gebruik je bestaande spelers- en clantags of spreadsheet als bron. ClashPanel verzint geen rosterlidmaatschap op basis van deze openbare fixture.',
        'demo.rosterBonuses': 'Roster en bonussen',
        'demo.rosterBonusesText': 'Deelname en medailleadvies zijn zichtbaar zonder de bron van de oorlog te wijzigen.',
        'demo.rosterGap': 'South Watch is 14/15 totdat een beschikbare speler is toegewezen.',
        'demo.sharedPool': 'North Guard en South Watch putten uit dezelfde fixturepool van 30 spelers.',
        'demo.trackerOutputText': 'De tracker scheidt huidige warfeiten van voorspellingen en historische vergelijkingen, zodat ontbrekende aanvalsdetails niet stil als nul worden behandeld.',
        'demo.trackerOutputTitle': 'Feiten nu, context later.',
        'demo.trackerSource': 'Verbind een clantag of opgeslagen plan in de privé-app voor actuele data. Deze pagina bevat geen live game-response en geen persoonlijke spelershistoriek.',
        'demo.warnings': 'Waarschuwingen blijven zichtbaar',
        'demo.whatToBring': 'Wat je moet meenemen'
    }),
    fr: Object.freeze({
        'common.comingSoon': '(Bientôt disponible)',
        'stats.title': 'Un historique d’attaques plus clair arrive bientôt.',
        'ach.title': 'Une vue plus claire de chaque étape arrive bientôt.',
        'demo.dashboardOutput': 'Exemple de tableau de bord en lecture seule',
        'demo.dataBoundary': 'Limite des données',
        'demo.familySource': 'Pour créer une vraie famille, apportez le code d’invitation, la liste des membres, les tags de compte et les réponses au sondage depuis votre espace privé. Les noms sont des valeurs de fixture.',
        'demo.familySourceLabel': 'Utiliser vos propres données source',
        'demo.league': 'Ligue',
        'demo.leagueText': 'Le classement et la position finale projetée montrent où le résultat peut encore évoluer.',
        'demo.live': 'En direct',
        'demo.liveText': 'Le score, la destruction et les attaques restantes restent réunis pour le tour actif.',
        'demo.loginBoundary': 'Limite de connexion',
        'demo.loginText': 'Tout le monde peut consulter cet exemple ; seuls les utilisateurs connectés peuvent enregistrer un vrai plan.',
        'demo.multiClanContext': 'Contexte multi-clans',
        'demo.output': 'Résultat d’exemple contrôlé',
        'demo.plannerOutputText': 'Les aperçus du Planner sont volontairement statiques. Ils montrent la décision d’évaluation sans exposer de tag de clan, de réponse API ou de roster privé.',
        'demo.plannerOutputTitle': 'Une liste partagée, deux rosters responsables.',
        'demo.plannerSource': 'Utilisez vos tags de joueurs et de clans ou votre feuille de calcul comme source. ClashPanel n’invente pas la composition du roster à partir de cette fixture publique.',
        'demo.rosterBonuses': 'Roster et bonus',
        'demo.rosterBonusesText': 'La participation et les conseils de médailles restent visibles sans modifier les données de guerre source.',
        'demo.rosterGap': 'South Watch est à 14/15 tant qu’un joueur disponible n’est pas attribué.',
        'demo.sharedPool': 'North Guard et South Watch utilisent la même liste contrôlée de 30 joueurs.',
        'demo.trackerOutputText': 'Le tracker sépare les faits de la guerre actuelle des projections et comparaisons historiques ; un détail manquant n’est pas traité comme zéro.',
        'demo.trackerOutputTitle': 'Les faits maintenant, le contexte ensuite.',
        'demo.trackerSource': 'Connectez un tag de clan ou un plan enregistré dans l’application privée pour les données actuelles. Cette page ne contient aucune réponse de jeu en direct ni historique personnel.',
        'demo.warnings': 'Les alertes restent visibles',
        'demo.whatToBring': 'À fournir'
    }),
    de: Object.freeze({
        'common.comingSoon': '(Demnächst verfügbar)',
        'stats.title': 'Eine klarere Angriffshistorie kommt bald.',
        'ach.title': 'Eine klarere Sicht auf jeden Meilenstein kommt bald.',
        'demo.dashboardOutput': 'Schreibgeschütztes Dashboard-Beispiel',
        'demo.dataBoundary': 'Datengrenze',
        'demo.familySource': 'Für eine echte Familie bringe Einladungscode, Mitgliederliste, Account-Tags und Umfrageantworten aus deinem privaten Workspace mit. Die Namen hier sind Fixture-Werte.',
        'demo.familySourceLabel': 'Eigene Quelldaten verwenden',
        'demo.league': 'Liga',
        'demo.leagueText': 'Tabelle und prognostizierter Abschluss zeigen, wo sich das Ergebnis noch bewegen kann.',
        'demo.live': 'Live',
        'demo.liveText': 'Punktestand, Zerstörung und verbleibende Angriffe bleiben für die laufende Runde zusammen.',
        'demo.loginBoundary': 'Anmeldegrenze',
        'demo.loginText': 'Jeder kann dieses Beispiel ansehen; nur angemeldete Nutzer können einen echten Plan speichern.',
        'demo.multiClanContext': 'Multi-Clan-Kontext',
        'demo.output': 'Kontrollierte Beispielausgabe',
        'demo.plannerOutputText': 'Planner-Vorschauen sind bewusst statisch. Sie zeigen die Prüfentscheidung, ohne Clantag, API-Antwort oder privates Roster offenzulegen.',
        'demo.plannerOutputTitle': 'Eine gemeinsame Auswahl, zwei verantwortbare Roster.',
        'demo.plannerSource': 'Verwende deine vorhandenen Spieler- und Clantags oder eine Tabelle als Quelle. ClashPanel erfindet keine Rosterzuordnung aus dieser öffentlichen Fixture.',
        'demo.rosterBonuses': 'Roster und Boni',
        'demo.rosterBonusesText': 'Teilnahme und Medaillenempfehlung bleiben sichtbar, ohne die Quelldaten des Kriegs zu ändern.',
        'demo.rosterGap': 'South Watch steht bei 14/15, bis ein verfügbarer Spieler zugewiesen ist.',
        'demo.sharedPool': 'North Guard und South Watch greifen auf denselben kontrollierten Pool aus 30 Spielern zu.',
        'demo.trackerOutputText': 'Der Tracker trennt aktuelle Kriegsfakten von Prognosen und historischen Vergleichen, damit ein fehlendes Angriffdetail nicht still als null gilt.',
        'demo.trackerOutputTitle': 'Fakten jetzt, Kontext später.',
        'demo.trackerSource': 'Verbinde einen Clantag oder gespeicherten Plan in der privaten App mit aktuellen Daten. Diese Seite enthält keine Live-Spielantwort und keine persönliche Spielerhistorie.',
        'demo.warnings': 'Warnungen bleiben sichtbar',
        'demo.whatToBring': 'Was du mitbringen solltest'
    }),
    es: Object.freeze({
        'common.comingSoon': '(Próximamente)',
        'stats.title': 'Pronto tendrás un historial de ataques más claro.',
        'ach.title': 'Pronto tendrás una visión más clara de cada hito.',
        'demo.dashboardOutput': 'Ejemplo de panel de solo lectura',
        'demo.dataBoundary': 'Límite de datos',
        'demo.familySource': 'Para crear una familia real, trae el código de invitación, la lista de miembros, las etiquetas de cuenta y las respuestas de la encuesta desde tu espacio privado. Los nombres son valores de fixture.',
        'demo.familySourceLabel': 'Usa tus propios datos de origen',
        'demo.league': 'Liga',
        'demo.leagueText': 'La clasificación y el final proyectado muestran dónde puede cambiar aún el resultado.',
        'demo.live': 'En directo',
        'demo.liveText': 'El marcador, la destrucción y los ataques restantes permanecen juntos para la ronda activa.',
        'demo.loginBoundary': 'Límite de inicio de sesión',
        'demo.loginText': 'Cualquiera puede consultar este ejemplo; solo los usuarios que han iniciado sesión pueden guardar un plan real.',
        'demo.multiClanContext': 'Contexto multiclán',
        'demo.output': 'Resultado de ejemplo controlado',
        'demo.plannerOutputText': 'Las vistas del Planner son intencionadamente estáticas. Muestran la decisión de revisión sin exponer una etiqueta de clan, una respuesta de API ni una plantilla privada.',
        'demo.plannerOutputTitle': 'Un grupo compartido, dos plantillas responsables.',
        'demo.plannerSource': 'Usa tus etiquetas de jugador y clan o tu hoja de cálculo como fuente. ClashPanel no inventa miembros de plantilla a partir de esta fixture pública.',
        'demo.rosterBonuses': 'Plantilla y bonus',
        'demo.rosterBonusesText': 'La participación y el consejo de medallas permanecen visibles sin cambiar los datos de guerra de origen.',
        'demo.rosterGap': 'South Watch está en 14/15 hasta asignar un jugador disponible.',
        'demo.sharedPool': 'North Guard y South Watch usan el mismo grupo controlado de 30 jugadores.',
        'demo.trackerOutputText': 'El tracker separa los hechos de la guerra actual de las proyecciones y comparaciones históricas, para que un detalle ausente no se trate silenciosamente como cero.',
        'demo.trackerOutputTitle': 'Hechos ahora, contexto después.',
        'demo.trackerSource': 'Conecta una etiqueta de clan o un plan guardado en la aplicación privada para obtener datos actuales. Esta página no contiene respuestas de juego en directo ni historial personal.',
        'demo.warnings': 'Las advertencias siguen visibles',
        'demo.whatToBring': 'Qué aportar'
    })
});

const sourceKeys = new Map(Object.entries(COPY.en).map(([key, value]) => [value, key]));
const originalText = new WeakMap();
const originalTitle = document.title;

function language() {
    const current = String(getLanguage() || document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    return COPY[current] ? current : 'en';
}

function render(root = document) {
    const copy = COPY[language()];
    root.querySelectorAll('body *').forEach(element => {
        if (element.children.length || element.matches('script, style, svg, [data-i18n]')) return;
        const source = originalText.get(element) ?? element.textContent.trim();
        if (!originalText.has(element)) originalText.set(element, source);
        const key = element.dataset.publicCopy || sourceKeys.get(source);
        if (key && copy[key]) element.textContent = copy[key];
    });
    const titleKey = sourceKeys.get(originalTitle);
    if (titleKey && copy[titleKey]) document.title = copy[titleKey];
}

render();
window.addEventListener('clashtools:public-progress-updated', () => render());
window.addEventListener('clashtools:language-changed', () => render());
