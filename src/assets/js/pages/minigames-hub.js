import {
    HIGHER_LOWER_DAILY_KEY,
    utcDateKey
} from '../minigames/higher-lower-engine.js?v=20260809-3';
import {
    getLatestHigherLowerAnswer,
    isValidHigherLowerDailyRun
} from '../minigames/minigames-state.js?v=20260809-3';
import {
    DAILY_STORAGE_KEY,
    getDailyCategory
} from '../minigames/entity-guesser-engine-v2.js?v=20260809-3';
import { ENTITY_GUESSER_DATA_VERSION } from '../minigames/entity-guesser-catalog.js?v=20260809-3';
import { getRedesignFixture, isLocalFixtureHost, isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';

const COPY = {
    en: {
        entity: 'Entity Guesser', higherLower: 'Higher or Lower', kicker: 'ClashPanel Games',
        title: 'A different Clash challenge every day.', lead: 'Solve the Entity Guesser or test your stat knowledge in Higher or Lower, then switch to practice whenever you want.',
        today: "Today's daily", reset: 'Resets at 00:00 UTC', entityName: 'Entity Guesser', higherName: 'Higher or Lower',
        entityDescription: 'Use shared clues to identify a hidden Clash item in up to six attempts.', higherDescription: 'Read the shown metric, choose a direction, and build a combo across nine comparisons.',
        practiceNote: 'Practice is unlimited and never overwrites your Daily result.', entityCard: 'Identify the hidden item from fair comparisons.', higherCard: 'Compare nine values and build a combo.',
        helpTitle: 'What can I do here?', helpSubtitle: 'A quick guide to both games', helpEntityTitle: 'Find the hidden Clash entity.', helpEntityBody: 'Choose one of four broad categories, then search or tap an answer. Every attempt compares shared clues. You have six tries and two optional hints.',
        helpHigherTitle: 'Judge nine fair comparisons.', helpHigherBody: 'Use the shown value to decide whether the hidden value is higher or lower. Correct answers build your combo; equal-value pairs are excluded.',
        dailyLabel: 'Daily', dailyHelp: 'gives everyone the same challenge and resets at 00:00 UTC.', practiceLabel: 'Practice', practiceHelp: 'lets you choose a category and play freely without changing the daily result.', catalogKicker: 'The shared catalog',
        ready: 'Ready to play', inProgress: 'In progress', solved: 'Solved', complete: 'Complete'
    },
    nl: {
        entity: 'Entity Guesser', higherLower: 'Hoger of lager', kicker: 'ClashPanel Games',
        title: 'Elke dag een nieuwe Clash-uitdaging.', lead: 'Los de Entity Guesser op of test je kennis van statistieken in Hoger of lager. Schakel daarna wanneer je wilt naar oefenen.',
        today: 'Dagelijkse uitdaging', reset: 'Reset om 00:00 UTC', entityName: 'Entity Guesser', higherName: 'Hoger of lager',
        entityDescription: 'Gebruik gedeelde aanwijzingen om een verborgen Clash-item te vinden in maximaal zes pogingen.', higherDescription: 'Lees de getoonde waarde, kies een richting en bouw een combo in negen vergelijkingen.',
        practiceNote: 'Oefenen is onbeperkt en overschrijft je dagelijkse resultaat niet.', entityCard: 'Vind het verborgen item via eerlijke vergelijkingen.', higherCard: 'Vergelijk negen waarden en bouw een combo.',
        helpTitle: 'Wat kan ik hier doen?', helpSubtitle: 'Een korte gids voor beide games', helpEntityTitle: 'Vind het verborgen Clash-item.', helpEntityBody: 'Kies een van vier brede categorieën en zoek of tik een antwoord. Elke poging vergelijkt gedeelde aanwijzingen. Je hebt zes pogingen en twee optionele hints.',
        helpHigherTitle: 'Beoordeel negen eerlijke vergelijkingen.', helpHigherBody: 'Gebruik de getoonde waarde om te bepalen of de verborgen waarde hoger of lager is. Juiste antwoorden bouwen je combo; gelijke waarden worden uitgesloten.',
        dailyLabel: 'Dagelijks', dailyHelp: 'geeft iedereen dezelfde uitdaging en reset om 00:00 UTC.', practiceLabel: 'Oefenen', practiceHelp: 'laat je een categorie kiezen zonder het dagelijkse resultaat te wijzigen.', catalogKicker: 'De gedeelde catalogus',
        ready: 'Klaar om te spelen', inProgress: 'Bezig', solved: 'Opgelost', complete: 'Voltooid'
    },
    de: {
        entity: 'Entity Guesser', higherLower: 'Höher oder niedriger', kicker: 'ClashPanel Games',
        title: 'Jeden Tag eine neue Clash-Herausforderung.', lead: 'Löse den Entity Guesser oder teste dein Statistik-Wissen in Höher oder niedriger. Danach kannst du jederzeit üben.',
        today: 'Tägliche Aufgabe', reset: 'Reset um 00:00 UTC', entityName: 'Entity Guesser', higherName: 'Höher oder niedriger',
        entityDescription: 'Erkenne ein verborgenes Clash-Element anhand gemeinsamer Hinweise in bis zu sechs Versuchen.', higherDescription: 'Lies den angezeigten Wert, wähle eine Richtung und baue über neun Vergleiche eine Combo auf.',
        practiceNote: 'Üben ist unbegrenzt und überschreibt dein Daily-Ergebnis nicht.', entityCard: 'Erkenne das verborgene Element durch faire Vergleiche.', higherCard: 'Vergleiche neun Werte und baue eine Combo auf.',
        helpTitle: 'Was kann ich hier tun?', helpSubtitle: 'Ein kurzer Leitfaden für beide Spiele', helpEntityTitle: 'Finde das verborgene Clash-Element.', helpEntityBody: 'Wähle eine von vier breiten Kategorien und suche oder tippe eine Antwort. Jeder Versuch vergleicht gemeinsame Hinweise. Du hast sechs Versuche und zwei optionale Hinweise.',
        helpHigherTitle: 'Beurteile neun faire Vergleiche.', helpHigherBody: 'Nutze den angezeigten Wert, um zu entscheiden, ob der verborgene Wert höher oder niedriger ist. Richtige Antworten bauen deine Combo auf; gleiche Werte werden ausgeschlossen.',
        dailyLabel: 'Daily', dailyHelp: 'gibt allen dieselbe Aufgabe und wird um 00:00 UTC zurückgesetzt.', practiceLabel: 'Üben', practiceHelp: 'lässt dich eine Kategorie wählen, ohne das Daily-Ergebnis zu ändern.', catalogKicker: 'Die gemeinsame Katalog',
        ready: 'Bereit zum Spielen', inProgress: 'In Bearbeitung', solved: 'Gelöst', complete: 'Abgeschlossen'
    },
    fr: {
        entity: 'Entity Guesser', higherLower: 'Plus ou moins', kicker: 'Jeux ClashPanel',
        title: 'Un nouveau défi Clash chaque jour.', lead: 'Résolvez l’Entity Guesser ou testez vos connaissances des statistiques dans Plus ou moins, puis passez à l’entraînement quand vous le souhaitez.',
        today: 'Défi du jour', reset: 'Réinitialisation à 00:00 UTC', entityName: 'Entity Guesser', higherName: 'Plus ou moins',
        entityDescription: 'Identifiez un élément Clash caché grâce à des indices communs en six essais maximum.', higherDescription: 'Lisez la valeur affichée, choisissez une direction et construisez un combo sur neuf comparaisons.',
        practiceNote: 'L’entraînement est illimité et ne remplace pas votre résultat quotidien.', entityCard: 'Identifiez l’élément caché grâce à des comparaisons justes.', higherCard: 'Comparez neuf valeurs et construisez un combo.',
        helpTitle: 'Que puis-je faire ici ?', helpSubtitle: 'Un guide rapide des deux jeux', helpEntityTitle: 'Trouvez l’élément Clash caché.', helpEntityBody: 'Choisissez l’une des quatre grandes catégories, puis recherchez ou touchez une réponse. Chaque essai compare des indices communs. Vous avez six essais et deux indices optionnels.',
        helpHigherTitle: 'Jugez neuf comparaisons équitables.', helpHigherBody: 'Utilisez la valeur affichée pour décider si la valeur cachée est plus élevée ou plus basse. Les bonnes réponses construisent votre combo ; les valeurs égales sont exclues.',
        dailyLabel: 'Quotidien', dailyHelp: 'offre le même défi à tout le monde et se réinitialise à 00:00 UTC.', practiceLabel: 'Entraînement', practiceHelp: 'permet de choisir une catégorie sans modifier le résultat quotidien.', catalogKicker: 'Le catalogue commun',
        ready: 'Prêt à jouer', inProgress: 'En cours', solved: 'Résolu', complete: 'Terminé'
    },
    es: {
        entity: 'Entity Guesser', higherLower: 'Mayor o menor', kicker: 'Juegos de ClashPanel',
        title: 'Un desafío de Clash diferente cada día.', lead: 'Resuelve Entity Guesser o pon a prueba tus conocimientos de estadísticas en Mayor o menor; después cambia a práctica cuando quieras.',
        today: 'Desafío diario', reset: 'Se reinicia a las 00:00 UTC', entityName: 'Entity Guesser', higherName: 'Mayor o menor',
        entityDescription: 'Identifica un elemento oculto de Clash con pistas compartidas en un máximo de seis intentos.', higherDescription: 'Lee el valor mostrado, elige una dirección y crea un combo durante nueve comparaciones.',
        practiceNote: 'La práctica es ilimitada y no sobrescribe tu resultado diario.', entityCard: 'Identifica el elemento oculto mediante comparaciones justas.', higherCard: 'Compara nueve valores y crea un combo.',
        helpTitle: '¿Qué puedo hacer aquí?', helpSubtitle: 'Guía rápida de los dos juegos', helpEntityTitle: 'Encuentra el elemento oculto de Clash.', helpEntityBody: 'Elige una de cuatro categorías amplias y busca o toca una respuesta. Cada intento compara pistas compartidas. Tienes seis intentos y dos pistas opcionales.',
        helpHigherTitle: 'Juzga nueve comparaciones justas.', helpHigherBody: 'Usa el valor mostrado para decidir si el valor oculto es mayor o menor. Las respuestas correctas crean tu combo; se excluyen los valores iguales.',
        dailyLabel: 'Diario', dailyHelp: 'ofrece el mismo desafío a todos y se reinicia a las 00:00 UTC.', practiceLabel: 'Práctica', practiceHelp: 'te permite elegir una categoría sin cambiar el resultado diario.', catalogKicker: 'El catálogo compartido',
        ready: 'Listo para jugar', inProgress: 'En curso', solved: 'Resuelto', complete: 'Completado'
    }
};

const buttons = [...document.querySelectorAll('[data-minigame-select]')];
const views = [...document.querySelectorAll('[data-minigame-view]')];
let activeFixtureId = '';

function language() {
    const code = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return COPY[code] ? code : 'en';
}

function text(key) {
    return COPY[language()]?.[key] || COPY.en[key] || key;
}

function normalizeGame(value) {
    return value === 'higher-lower' ? 'higher-lower' : 'entity';
}

function selectedFromUrl() {
    return normalizeGame(new URLSearchParams(location.search).get('game'));
}

function readSaved(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
}

function validEntityDailyRun(run, dateKey, categoryId) {
    return Boolean(
        run?.mode === 'daily'
        && run.dateKey === dateKey
        && run.dataVersion === ENTITY_GUESSER_DATA_VERSION
        && run.categoryId === categoryId
        && Array.isArray(run.guesses)
        && Array.isArray(run.hints)
        && run.guesses.length <= 6
        && run.hints.length <= 2
    );
}

function statusLabel(kind, count = 0, total = 0) {
    if (kind === 'inProgress') return `${text('inProgress')} · ${count}/${total}`;
    if (kind === 'solved') return `${text('solved')} · ${count}/${total}`;
    if (kind === 'complete') return text('complete');
    return text('ready');
}

function entityStatus(dateKey) {
    const category = getDailyCategory(dateKey);
    const saved = readSaved(DAILY_STORAGE_KEY);
    if (!validEntityDailyRun(saved, dateKey, category.id)) return statusLabel('ready');
    if (saved.completed && saved.won) return statusLabel('solved', saved.guesses.length, category.maxAttempts);
    if (saved.completed) return statusLabel('complete');
    return statusLabel('inProgress', saved.guesses.length, category.maxAttempts);
}

function higherLowerStatus(dateKey) {
    const saved = readSaved(HIGHER_LOWER_DAILY_KEY);
    if (!isValidHigherLowerDailyRun(saved, dateKey)) return statusLabel('ready');
    if (saved.completed) return statusLabel('complete');
    if (saved.answers.length) return statusLabel('inProgress', saved.answers.length, 9);
    return statusLabel('ready');
}

function fixtureStatus(game) {
    if (!activeFixtureId.startsWith(game)) return '';
    const state = activeFixtureId.replace(`${game}-`, '').replace('-', ' ');
    return `Fixture · ${state}`;
}

function renderHub() {
    document.querySelectorAll('[data-hub-i18n]').forEach(node => {
        node.textContent = text(node.dataset.hubI18n);
    });
    const helpTitle = document.querySelector('[data-hub-help-title] strong');
    if (helpTitle) helpTitle.textContent = text('helpTitle');
    document.querySelectorAll('[data-minigame-label]').forEach(node => {
        node.textContent = node.closest('[data-minigame-select]')?.dataset.minigameSelect === 'higher-lower'
            ? text('higherLower')
            : text('entity');
    });

    const dateKey = utcDateKey();
    const category = getDailyCategory(dateKey);
    const dateNode = document.querySelector('[data-hub-date]');
    const summary = document.querySelector('[data-hub-daily-summary]');
    if (dateNode) dateNode.textContent = `${dateKey} UTC · ${category.shortLabel}`;
    if (summary) summary.textContent = `${text('entity')}: ${entityStatus(dateKey)} · ${text('higherLower')}: ${higherLowerStatus(dateKey)}`;

    const entityStatusNode = document.querySelector('[data-hub-game-status="entity"]');
    const higherStatusNode = document.querySelector('[data-hub-game-status="higher-lower"]');
    if (entityStatusNode) entityStatusNode.textContent = fixtureStatus('entity') || entityStatus(dateKey);
    if (higherStatusNode) higherStatusNode.textContent = fixtureStatus('higher-lower') || higherLowerStatus(dateKey);
}

function readSavedHigherLowerRun() {
    return readSaved(HIGHER_LOWER_DAILY_KEY);
}

function sanitizeSavedHigherLowerRun() {
    if (isRedesignFixtureRequested()) return;
    const saved = readSavedHigherLowerRun();
    if (saved && !isValidHigherLowerDailyRun(saved, utcDateKey())) {
        try {
            localStorage.removeItem(HIGHER_LOWER_DAILY_KEY);
        } catch {
            // Storage may be unavailable in strict privacy contexts.
        }
    }
}

function configureTabs() {
    views.forEach(view => {
        const game = normalizeGame(view.dataset.minigameView);
        view.id ||= `minigame-panel-${game}`;
        view.setAttribute('role', 'tabpanel');
        view.setAttribute('aria-labelledby', `minigame-tab-${game}`);
    });
    buttons.forEach(button => {
        const game = normalizeGame(button.dataset.minigameSelect);
        button.id ||= `minigame-tab-${game}`;
        button.setAttribute('aria-controls', `minigame-panel-${game}`);
    });
}

function selectGame(game, updateUrl = true) {
    const selected = normalizeGame(game);
    buttons.forEach(button => {
        const active = button.dataset.minigameSelect === selected;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
    });
    views.forEach(view => {
        const active = view.dataset.minigameView === selected;
        view.hidden = !active;
        view.setAttribute('aria-hidden', String(!active));
    });
    window.dispatchEvent(new CustomEvent('clashpanel:minigame-selected', { detail: { game: selected } }));
    document.body.dataset.gameFocus = String(updateUrl || Boolean(new URLSearchParams(location.search).get('game')));

    if (updateUrl) {
        const url = new URL(location.href);
        if (selected === 'entity') url.searchParams.delete('game');
        else url.searchParams.set('game', selected);
        history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
}

function moveTabFocus(currentButton, direction) {
    const index = buttons.indexOf(currentButton);
    if (index < 0 || !buttons.length) return;
    const nextIndex = (index + direction + buttons.length) % buttons.length;
    const next = buttons[nextIndex];
    next.focus();
    selectGame(next.dataset.minigameSelect);
}

function restoreHigherLowerChoice() {
    const saved = readSavedHigherLowerRun();
    if (!isValidHigherLowerDailyRun(saved, utcDateKey())) return;
    const latest = getLatestHigherLowerAnswer(saved);
    if (!latest) return;
    document.querySelectorAll('[data-hl-choice]').forEach(button => {
        const choice = button.dataset.hlChoice;
        const selected = choice === latest.choice;
        button.dataset.selected = String(selected);
        button.classList.toggle('is-correct-choice', choice === latest.correctChoice);
        button.classList.toggle('is-wrong-choice', selected && !latest.correct);
    });
}

function handleFixture(fixture) {
    if (!isLocalFixtureHost() || fixture?.module !== 'minigames') return;
    activeFixtureId = fixture.id || '';
    renderHub();
}

sanitizeSavedHigherLowerRun();
configureTabs();
buttons.forEach(button => {
    button.addEventListener('click', () => selectGame(button.dataset.minigameSelect));
    button.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            moveTabFocus(button, 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveTabFocus(button, -1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            buttons[0]?.focus();
            selectGame(buttons[0]?.dataset.minigameSelect);
        } else if (event.key === 'End') {
            event.preventDefault();
            buttons.at(-1)?.focus();
            selectGame(buttons.at(-1)?.dataset.minigameSelect);
        }
    });
});

window.addEventListener('load', restoreHigherLowerChoice, { once: true });
window.addEventListener('popstate', () => selectGame(selectedFromUrl(), false));
window.addEventListener('storage', renderHub);
window.addEventListener('clashpanel:minigame-state-changed', renderHub);
window.addEventListener('clashpanel:fixture-ready', event => handleFixture(event.detail));
window.addEventListener('clashtools:language-changed', renderHub);

getRedesignFixture().then(handleFixture).catch(() => {});
renderHub();
selectGame(selectedFromUrl(), false);
