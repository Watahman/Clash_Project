import {
    HIGHER_LOWER_DAILY_KEY,
    utcDateKey
} from '../minigames/higher-lower-engine.js';
import {
    getLatestHigherLowerAnswer,
    isValidHigherLowerDailyRun
} from '../minigames/minigames-state.js';

const COPY = {
    en: { entity: 'Entity Guesser', higherLower: 'Higher or Lower' },
    nl: { entity: 'Entity Guesser', higherLower: 'Hoger of lager' },
    de: { entity: 'Entity Guesser', higherLower: 'Höher oder niedriger' },
    fr: { entity: 'Entity Guesser', higherLower: 'Plus ou moins' },
    es: { entity: 'Entity Guesser', higherLower: 'Mayor o menor' }
};

const buttons = [...document.querySelectorAll('[data-minigame-select]')];
const views = [...document.querySelectorAll('[data-minigame-view]')];

function language() {
    const code = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return COPY[code] ? code : 'en';
}

function normalizeGame(value) {
    return value === 'higher-lower' ? 'higher-lower' : 'entity';
}

function selectedFromUrl() {
    return normalizeGame(new URLSearchParams(location.search).get('game'));
}

function readSavedHigherLowerRun() {
    try {
        return JSON.parse(localStorage.getItem(HIGHER_LOWER_DAILY_KEY));
    } catch {
        return null;
    }
}

function sanitizeSavedHigherLowerRun() {
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
    });

    buttons.forEach(button => {
        const game = normalizeGame(button.dataset.minigameSelect);
        button.setAttribute('aria-controls', `minigame-panel-${game}`);
    });
}

function translate() {
    buttons.forEach(button => {
        const key = button.dataset.minigameSelect === 'higher-lower' ? 'higherLower' : 'entity';
        const label = button.querySelector('[data-minigame-label]');
        if (label) label.textContent = COPY[language()][key];
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
window.addEventListener('clashtools:language-changed', translate);

translate();
selectGame(selectedFromUrl(), false);
