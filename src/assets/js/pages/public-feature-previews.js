import { getLanguage } from '../i18n/i18n.js?v=20260829-public-auth-v1';

const COPY = {
    en: {
        'common.controlled': 'Controlled sample', 'common.notLive': 'Fixture-shaped UI · not live data', 'common.fixture': 'Fixture planning fixture',
        'common.saved': 'Saved locally', 'common.draft': 'Draft', 'common.search': 'Search players', 'common.review': 'Review',
        'common.apply': 'Apply plan', 'common.cancel': 'Cancel', 'common.complete': 'Complete', 'common.warning': 'Needs review',
        'common.day1': 'D1', 'common.day4': 'D4', 'common.day7': 'D7', 'common.live': 'Live', 'common.open': 'Open',
        'planner.chrome': 'CWL Planner', 'planner.plan': 'Plan', 'planner.planName': 'Fixture plan', 'planner.clansPlayers': '2 clans · 30 players',
        'planner.addClan': 'Add clan', 'planner.addPlayers': 'Add players', 'planner.playerPool': 'Player pool', 'planner.freeRoster': 'Free roster',
        'planner.board': 'Planning board', 'planner.north': 'North Guard', 'planner.south': 'South Watch', 'planner.player1': 'Aster',
        'planner.player2': 'Bramble', 'planner.player3': 'Cobalt', 'planner.core': 'TH17 · Core', 'planner.rotation': 'TH16 · Rotation',
        'planner.reserve': 'TH15 · Reserve', 'planner.reviewTitle': 'Review Auto Plan', 'planner.automatic': 'Automatic', 'planner.guided': 'Guided',
        'planner.day1Complete': 'Day 1 · lineup complete', 'planner.day4Reserve': 'Day 4 · reserve covers gap', 'planner.day7Missing': 'Day 7 · one player missing',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Day 4 of 7', 'tracker.liveStep': 'Live', 'tracker.leagueStep': 'League', 'tracker.historyStep': 'History',
        'tracker.score': 'Score', 'tracker.stars': 'Stars', 'tracker.destruction': 'Destruction', 'tracker.attacks': 'Attacks', 'tracker.standings': 'Standings',
        'tracker.roster': 'Roster', 'tracker.bonuses': 'Bonuses', 'tracker.currentPosition': 'Current position', 'tracker.projectedFinish': 'Projected finish',
        'tracker.rounds': 'Rounds complete', 'tracker.record': 'Record', 'tracker.chart': 'Stars per war day', 'tracker.remaining': '2 attacks remaining',
        'family.chrome': 'Clan Management', 'family.name': 'Northwind Family', 'family.role': 'Leader', 'family.invite': 'NW-240817',
        'family.members': 'Members', 'family.accounts': 'Accounts', 'family.clans': 'Linked clans', 'family.poll': 'Active poll', 'family.overview': 'Overview',
        'family.membersTab': 'Members', 'family.clansTab': 'Clans', 'family.pollsTab': 'Polls', 'family.settingsTab': 'Settings', 'family.network': 'Network',
        'family.readiness': 'Readiness', 'family.pollName': 'August CWL availability', 'family.planner': 'Planner handoff', 'family.member1': 'Mira North',
        'family.member2': 'Jon Vale', 'family.member3': 'Emile Stone', 'family.linked': '2 linked clans', 'family.audit': '1 account needs review'
    },
    nl: {
        'common.controlled': 'Gecontroleerd voorbeeld', 'common.notLive': 'UI-vorm uit fixture · geen live data', 'common.fixture': 'Fixture-planningsvoorbeeld',
        'common.saved': 'Lokaal opgeslagen', 'common.draft': 'Concept', 'common.search': 'Spelers zoeken', 'common.review': 'Controleren',
        'common.apply': 'Plan toepassen', 'common.cancel': 'Annuleren', 'common.complete': 'Compleet', 'common.warning': 'Controle nodig',
        'common.day1': 'D1', 'common.day4': 'D4', 'common.day7': 'D7', 'common.live': 'Live', 'common.open': 'Openen',
        'planner.chrome': 'CWL Planner', 'planner.plan': 'Plan', 'planner.planName': 'Fixtureplan', 'planner.clansPlayers': '2 clans · 30 spelers',
        'planner.addClan': 'Clan toevoegen', 'planner.addPlayers': 'Spelers toevoegen', 'planner.playerPool': 'Spelerspool', 'planner.freeRoster': 'Vrije selectie',
        'planner.board': 'Planbord', 'planner.north': 'North Guard', 'planner.south': 'South Watch', 'planner.player1': 'Aster',
        'planner.player2': 'Bramble', 'planner.player3': 'Cobalt', 'planner.core': 'TH17 · Kern', 'planner.rotation': 'TH16 · Rotatie',
        'planner.reserve': 'TH15 · Reserve', 'planner.reviewTitle': 'Auto Plan controleren', 'planner.automatic': 'Automatisch', 'planner.guided': 'Begeleid',
        'planner.day1Complete': 'Dag 1 · selectie compleet', 'planner.day4Reserve': 'Dag 4 · reserve vult gat', 'planner.day7Missing': 'Dag 7 · één speler ontbreekt',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Dag 4 van 7', 'tracker.liveStep': 'Live', 'tracker.leagueStep': 'Competitie', 'tracker.historyStep': 'Historie',
        'tracker.score': 'Score', 'tracker.stars': 'Sterren', 'tracker.destruction': 'Vernietiging', 'tracker.attacks': 'Aanvallen', 'tracker.standings': 'Stand',
        'tracker.roster': 'Selectie', 'tracker.bonuses': 'Bonussen', 'tracker.currentPosition': 'Huidige positie', 'tracker.projectedFinish': 'Verwachte eindpositie',
        'tracker.rounds': 'Rondes klaar', 'tracker.record': 'Record', 'tracker.chart': 'Sterren per oorlogsdag', 'tracker.remaining': '2 aanvallen over',
        'family.chrome': 'Clanbeheer', 'family.name': 'Northwind Family', 'family.role': 'Leider', 'family.invite': 'NW-240817',
        'family.members': 'Leden', 'family.accounts': 'Accounts', 'family.clans': 'Gekoppelde clans', 'family.poll': 'Actieve poll', 'family.overview': 'Overzicht',
        'family.membersTab': 'Leden', 'family.clansTab': 'Clans', 'family.pollsTab': 'Polls', 'family.settingsTab': 'Instellingen', 'family.network': 'Netwerk',
        'family.readiness': 'Gereedheid', 'family.pollName': 'CWL-beschikbaarheid augustus', 'family.planner': 'Overdracht naar Planner', 'family.member1': 'Mira North',
        'family.member2': 'Jon Vale', 'family.member3': 'Emile Stone', 'family.linked': '2 gekoppelde clans', 'family.audit': '1 account moet worden gecontroleerd'
    },
    fr: {
        'common.controlled': 'Exemple contrôlé', 'common.notLive': 'Interface de fixture · données non réelles', 'common.fixture': 'Exemple de planification fixture',
        'common.saved': 'Enregistré localement', 'common.draft': 'Brouillon', 'common.search': 'Rechercher des joueurs', 'common.review': 'Vérifier',
        'common.apply': 'Appliquer le plan', 'common.cancel': 'Annuler', 'common.complete': 'Complet', 'common.warning': 'À vérifier',
        'common.day1': 'J1', 'common.day4': 'J4', 'common.day7': 'J7', 'common.live': 'En direct', 'common.open': 'Ouvrir',
        'planner.chrome': 'CWL Planner', 'planner.plan': 'Plan', 'planner.planName': 'Plan fixture', 'planner.clansPlayers': '2 clans · 30 joueurs',
        'planner.addClan': 'Ajouter un clan', 'planner.addPlayers': 'Ajouter des joueurs', 'planner.playerPool': 'Liste de joueurs', 'planner.freeRoster': 'Liste libre',
        'planner.board': 'Tableau de planification', 'planner.north': 'North Guard', 'planner.south': 'South Watch', 'planner.player1': 'Aster',
        'planner.player2': 'Bramble', 'planner.player3': 'Cobalt', 'planner.core': 'HD17 · Titulaire', 'planner.rotation': 'HD16 · Rotation',
        'planner.reserve': 'HD15 · Réserve', 'planner.reviewTitle': 'Vérifier Auto Plan', 'planner.automatic': 'Automatique', 'planner.guided': 'Guidé',
        'planner.day1Complete': 'J1 · équipe complète', 'planner.day4Reserve': 'J4 · la réserve couvre le manque', 'planner.day7Missing': 'J7 · un joueur manque',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Jour 4 sur 7', 'tracker.liveStep': 'En direct', 'tracker.leagueStep': 'Ligue', 'tracker.historyStep': 'Historique',
        'tracker.score': 'Score', 'tracker.stars': 'Étoiles', 'tracker.destruction': 'Destruction', 'tracker.attacks': 'Attaques', 'tracker.standings': 'Classement',
        'tracker.roster': 'Équipe', 'tracker.bonuses': 'Bonus', 'tracker.currentPosition': 'Position actuelle', 'tracker.projectedFinish': 'Position finale projetée',
        'tracker.rounds': 'Rounds terminés', 'tracker.record': 'Bilan', 'tracker.chart': 'Étoiles par jour de guerre', 'tracker.remaining': '2 attaques restantes',
        'family.chrome': 'Gestion des clans', 'family.name': 'Northwind Family', 'family.role': 'Chef', 'family.invite': 'NW-240817',
        'family.members': 'Membres', 'family.accounts': 'Comptes', 'family.clans': 'Clans liés', 'family.poll': 'Sondage actif', 'family.overview': 'Vue d’ensemble',
        'family.membersTab': 'Membres', 'family.clansTab': 'Clans', 'family.pollsTab': 'Sondages', 'family.settingsTab': 'Réglages', 'family.network': 'Réseau',
        'family.readiness': 'Préparation', 'family.pollName': 'Disponibilité CWL d’août', 'family.planner': 'Transmission au Planner', 'family.member1': 'Mira North',
        'family.member2': 'Jon Vale', 'family.member3': 'Emile Stone', 'family.linked': '2 clans liés', 'family.audit': '1 compte à vérifier'
    },
    de: {
        'common.controlled': 'Kontrolliertes Beispiel', 'common.notLive': 'Fixture-Ansicht · keine Live-Daten', 'common.fixture': 'Fixture-Planungsbeispiel',
        'common.saved': 'Lokal gespeichert', 'common.draft': 'Entwurf', 'common.search': 'Spieler suchen', 'common.review': 'Prüfen',
        'common.apply': 'Plan anwenden', 'common.cancel': 'Abbrechen', 'common.complete': 'Vollständig', 'common.warning': 'Prüfung nötig',
        'common.day1': 'T1', 'common.day4': 'T4', 'common.day7': 'T7', 'common.live': 'Live', 'common.open': 'Öffnen',
        'planner.chrome': 'CWL Planner', 'planner.plan': 'Plan', 'planner.planName': 'Fixture-Plan', 'planner.clansPlayers': '2 Clans · 30 Spieler',
        'planner.addClan': 'Clan hinzufügen', 'planner.addPlayers': 'Spieler hinzufügen', 'planner.playerPool': 'Spielerpool', 'planner.freeRoster': 'Freie Auswahl',
        'planner.board': 'Planungsboard', 'planner.north': 'North Guard', 'planner.south': 'South Watch', 'planner.player1': 'Aster',
        'planner.player2': 'Bramble', 'planner.player3': 'Cobalt', 'planner.core': 'RH17 · Kern', 'planner.rotation': 'RH16 · Rotation',
        'planner.reserve': 'RH15 · Reserve', 'planner.reviewTitle': 'Auto Plan prüfen', 'planner.automatic': 'Automatisch', 'planner.guided': 'Geführt',
        'planner.day1Complete': 'Tag 1 · Aufstellung vollständig', 'planner.day4Reserve': 'Tag 4 · Reserve schließt Lücke', 'planner.day7Missing': 'Tag 7 · ein Spieler fehlt',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Tag 4 von 7', 'tracker.liveStep': 'Live', 'tracker.leagueStep': 'Liga', 'tracker.historyStep': 'Verlauf',
        'tracker.score': 'Punktestand', 'tracker.stars': 'Sterne', 'tracker.destruction': 'Zerstörung', 'tracker.attacks': 'Angriffe', 'tracker.standings': 'Tabelle',
        'tracker.roster': 'Aufstellung', 'tracker.bonuses': 'Boni', 'tracker.currentPosition': 'Aktuelle Position', 'tracker.projectedFinish': 'Prognose',
        'tracker.rounds': 'Runden abgeschlossen', 'tracker.record': 'Bilanz', 'tracker.chart': 'Sterne pro Kriegstag', 'tracker.remaining': '2 Angriffe übrig',
        'family.chrome': 'Clanverwaltung', 'family.name': 'Northwind Family', 'family.role': 'Anführer', 'family.invite': 'NW-240817',
        'family.members': 'Mitglieder', 'family.accounts': 'Konten', 'family.clans': 'Verknüpfte Clans', 'family.poll': 'Aktive Umfrage', 'family.overview': 'Übersicht',
        'family.membersTab': 'Mitglieder', 'family.clansTab': 'Clans', 'family.pollsTab': 'Umfragen', 'family.settingsTab': 'Einstellungen', 'family.network': 'Netzwerk',
        'family.readiness': 'Bereitschaft', 'family.pollName': 'CWL-Verfügbarkeit August', 'family.planner': 'Übergabe an Planner', 'family.member1': 'Mira North',
        'family.member2': 'Jon Vale', 'family.member3': 'Emile Stone', 'family.linked': '2 verknüpfte Clans', 'family.audit': '1 Konto muss geprüft werden'
    },
    es: {
        'common.controlled': 'Ejemplo controlado', 'common.notLive': 'Interfaz de fixture · no son datos en directo', 'common.fixture': 'Ejemplo de planificación fixture',
        'common.saved': 'Guardado localmente', 'common.draft': 'Borrador', 'common.search': 'Buscar jugadores', 'common.review': 'Revisar',
        'common.apply': 'Aplicar plan', 'common.cancel': 'Cancelar', 'common.complete': 'Completo', 'common.warning': 'Requiere revisión',
        'common.day1': 'D1', 'common.day4': 'D4', 'common.day7': 'D7', 'common.live': 'En directo', 'common.open': 'Abrir',
        'planner.chrome': 'CWL Planner', 'planner.plan': 'Plan', 'planner.planName': 'Plan fixture', 'planner.clansPlayers': '2 clanes · 30 jugadores',
        'planner.addClan': 'Añadir clan', 'planner.addPlayers': 'Añadir jugadores', 'planner.playerPool': 'Grupo de jugadores', 'planner.freeRoster': 'Plantilla libre',
        'planner.board': 'Panel de planificación', 'planner.north': 'North Guard', 'planner.south': 'South Watch', 'planner.player1': 'Aster',
        'planner.player2': 'Bramble', 'planner.player3': 'Cobalt', 'planner.core': 'TH17 · Núcleo', 'planner.rotation': 'TH16 · Rotación',
        'planner.reserve': 'TH15 · Reserva', 'planner.reviewTitle': 'Revisar Auto Plan', 'planner.automatic': 'Automático', 'planner.guided': 'Guiado',
        'planner.day1Complete': 'Día 1 · alineación completa', 'planner.day4Reserve': 'Día 4 · la reserva cubre el hueco', 'planner.day7Missing': 'Día 7 · falta un jugador',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Día 4 de 7', 'tracker.liveStep': 'En directo', 'tracker.leagueStep': 'Liga', 'tracker.historyStep': 'Historial',
        'tracker.score': 'Puntuación', 'tracker.stars': 'Estrellas', 'tracker.destruction': 'Destrucción', 'tracker.attacks': 'Ataques', 'tracker.standings': 'Clasificación',
        'tracker.roster': 'Plantilla', 'tracker.bonuses': 'Bonos', 'tracker.currentPosition': 'Posición actual', 'tracker.projectedFinish': 'Final proyectado',
        'tracker.rounds': 'Rondas completadas', 'tracker.record': 'Balance', 'tracker.chart': 'Estrellas por día de guerra', 'tracker.remaining': '2 ataques restantes',
        'family.chrome': 'Gestión de clanes', 'family.name': 'Northwind Family', 'family.role': 'Líder', 'family.invite': 'NW-240817',
        'family.members': 'Miembros', 'family.accounts': 'Cuentas', 'family.clans': 'Clanes vinculados', 'family.poll': 'Encuesta activa', 'family.overview': 'Resumen',
        'family.membersTab': 'Miembros', 'family.clansTab': 'Clanes', 'family.pollsTab': 'Encuestas', 'family.settingsTab': 'Ajustes', 'family.network': 'Red',
        'family.readiness': 'Preparación', 'family.pollName': 'Disponibilidad CWL de agosto', 'family.planner': 'Traspaso al Planner', 'family.member1': 'Mira North',
        'family.member2': 'Jon Vale', 'family.member3': 'Emile Stone', 'family.linked': '2 clanes vinculados', 'family.audit': '1 cuenta requiere revisión'
    }
};

function currentCopy() {
    const code = String(getLanguage?.() || document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    return COPY[code] || COPY.en;
}

function renderPreviewCopy(root = document) {
    const copy = currentCopy();
    root.querySelectorAll('[data-preview-copy]').forEach(node => {
        const value = copy[node.dataset.previewCopy] || COPY.en[node.dataset.previewCopy];
        if (value) node.textContent = value;
    });
}

renderPreviewCopy();
window.addEventListener('clashtools:language-changed', () => renderPreviewCopy());
