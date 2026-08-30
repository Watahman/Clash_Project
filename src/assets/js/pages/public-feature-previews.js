import { getLanguage } from '../i18n/i18n.js?v=20260829-public-auth-v1';

const COPY = {
    en: {
        'common.controlled': 'Controlled sample', 'common.notLive': 'Fixture-shaped UI · not live data',
        'common.day1': 'D1', 'common.day4': 'D4', 'common.day7': 'D7', 'common.live': 'Live',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Day 4 of 7', 'tracker.liveStep': 'Live', 'tracker.leagueStep': 'League', 'tracker.historyStep': 'History',
        'tracker.score': 'Score', 'tracker.destruction': 'Destruction', 'tracker.attacks': 'Attacks', 'tracker.standings': 'Standings',
        'tracker.roster': 'Roster', 'tracker.bonuses': 'Bonuses', 'tracker.currentPosition': 'Current position', 'tracker.projectedFinish': 'Projected finish',
        'tracker.rounds': 'Rounds complete', 'tracker.record': 'Record', 'tracker.chart': 'Stars per war day', 'tracker.remaining': '2 attacks remaining'
    },
    nl: {
        'common.controlled': 'Gecontroleerd voorbeeld', 'common.notLive': 'UI-vorm uit fixture · geen live data',
        'common.day1': 'D1', 'common.day4': 'D4', 'common.day7': 'D7', 'common.live': 'Live',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Dag 4 van 7', 'tracker.liveStep': 'Live', 'tracker.leagueStep': 'Competitie', 'tracker.historyStep': 'Historie',
        'tracker.score': 'Score', 'tracker.destruction': 'Vernietiging', 'tracker.attacks': 'Aanvallen', 'tracker.standings': 'Stand',
        'tracker.roster': 'Selectie', 'tracker.bonuses': 'Bonussen', 'tracker.currentPosition': 'Huidige positie', 'tracker.projectedFinish': 'Verwachte eindpositie',
        'tracker.rounds': 'Rondes klaar', 'tracker.record': 'Record', 'tracker.chart': 'Sterren per oorlogsdag', 'tracker.remaining': '2 aanvallen over'
    },
    fr: {
        'common.controlled': 'Exemple contrôlé', 'common.notLive': 'Interface de fixture · données non réelles',
        'common.day1': 'J1', 'common.day4': 'J4', 'common.day7': 'J7', 'common.live': 'En direct',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Jour 4 sur 7', 'tracker.liveStep': 'En direct', 'tracker.leagueStep': 'Ligue', 'tracker.historyStep': 'Historique',
        'tracker.score': 'Score', 'tracker.destruction': 'Destruction', 'tracker.attacks': 'Attaques', 'tracker.standings': 'Classement',
        'tracker.roster': 'Équipe', 'tracker.bonuses': 'Bonus', 'tracker.currentPosition': 'Position actuelle', 'tracker.projectedFinish': 'Position finale projetée',
        'tracker.rounds': 'Rounds terminés', 'tracker.record': 'Bilan', 'tracker.chart': 'Étoiles par jour de guerre', 'tracker.remaining': '2 attaques restantes'
    },
    de: {
        'common.controlled': 'Kontrolliertes Beispiel', 'common.notLive': 'Fixture-Ansicht · keine Live-Daten',
        'common.day1': 'T1', 'common.day4': 'T4', 'common.day7': 'T7', 'common.live': 'Live',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Tag 4 von 7', 'tracker.liveStep': 'Live', 'tracker.leagueStep': 'Liga', 'tracker.historyStep': 'Verlauf',
        'tracker.score': 'Punktestand', 'tracker.destruction': 'Zerstörung', 'tracker.attacks': 'Angriffe', 'tracker.standings': 'Tabelle',
        'tracker.roster': 'Aufstellung', 'tracker.bonuses': 'Boni', 'tracker.currentPosition': 'Aktuelle Position', 'tracker.projectedFinish': 'Prognose',
        'tracker.rounds': 'Runden abgeschlossen', 'tracker.record': 'Bilanz', 'tracker.chart': 'Sterne pro Kriegstag', 'tracker.remaining': '2 Angriffe übrig'
    },
    es: {
        'common.controlled': 'Ejemplo controlado', 'common.notLive': 'Interfaz de fixture · no son datos en directo',
        'common.day1': 'D1', 'common.day4': 'D4', 'common.day7': 'D7', 'common.live': 'En directo',
        'tracker.chrome': 'CWL Tracker', 'tracker.clan': 'Ember Legion', 'tracker.opponent': 'North Star', 'tracker.warDay': 'Día 4 de 7', 'tracker.liveStep': 'En directo', 'tracker.leagueStep': 'Liga', 'tracker.historyStep': 'Historial',
        'tracker.score': 'Puntuación', 'tracker.destruction': 'Destrucción', 'tracker.attacks': 'Ataques', 'tracker.standings': 'Clasificación',
        'tracker.roster': 'Plantilla', 'tracker.bonuses': 'Bonos', 'tracker.currentPosition': 'Posición actual', 'tracker.projectedFinish': 'Final proyectado',
        'tracker.rounds': 'Rondas completadas', 'tracker.record': 'Balance', 'tracker.chart': 'Estrellas por día de guerra', 'tracker.remaining': '2 ataques restantes'
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
