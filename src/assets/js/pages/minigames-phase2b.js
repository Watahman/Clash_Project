import {
    ENTITY_CATEGORIES,
    ENTITY_GUESSER_DATA_VERSION,
    getCategory,
    getEntities
} from '../minigames/entity-guesser-catalog.js?v=20260809-3';
import {
    DAILY_STORAGE_KEY,
    PRACTICE_CATEGORY_KEY,
    STATS_STORAGE_KEY,
    availableHintCount,
    buildHint,
    calculateScore,
    compareEntity,
    findEntity,
    getDailyCategory,
    getDailyEntity,
    getPracticeEntity,
    isWinningGuess,
    resultSquares,
    searchEntities,
    updateStreak,
    utcDateKey
} from '../minigames/entity-guesser-engine-v2.js?v=20260811-2';
import { getEntityAsset, installImageFallback } from '../assets/entity-assets.js';
import {
    getRedesignFixture,
    isLocalFixtureHost,
    isRedesignFixtureRequested
} from '../fixtures/redesign-fixture-mode.js';
import { getEntityGameFixture } from '../minigames/minigames-fixtures.js?v=20260811-2';
import {
    ENTITY_CATEGORY_LABELS,
    ENTITY_GUESSER_COPY
} from '../minigames/entity-guesser-copy.js?v=20260811-1';
import { ENTITY_GUESSER_COLUMN_COPY } from '../minigames/entity-guesser-column-copy.js?v=20260811-1';
import { createEntityAnswerPicker } from '../minigames/entity-guesser-picker.js?v=20260811-1';
import { createEntityGuessBoard } from '../minigames/entity-guesser-board.js?v=20260811-1';
import { createEntityGuesserRenderer } from '../minigames/entity-guesser-renderer.js?v=20260811-1';
import { createEntityGuesserStateManager } from '../minigames/entity-guesser-state.js?v=20260811-1';
import { createEntityImageRenderer } from '../minigames/entity-guesser-images.js?v=20260811-1';
import { shareEntityResult } from '../minigames/entity-guesser-sharing.js?v=20260811-1';
import { createEntityGuesserActions } from '../minigames/entity-guesser-actions.js?v=20260811-1';
import {
    readJson,
    readString,
    shouldPersistDailyState,
    writeJson,
    writeString
} from '../minigames/minigames-storage.js?v=20260811-1';
const result = document.querySelector('[data-result]');
const elements = {
    root: document.querySelector('.game-shell[data-minigame-view="entity"]'),
    board: document.querySelector('[data-entity-board]')
        || document.querySelector('.game-shell[data-minigame-view="entity"] .game-board'),
    form: document.querySelector('[data-guess-form]'),
    picker: document.querySelector('[data-answer-picker]'),
    input: document.querySelector('[data-guess-input]'),
    inputLabel: document.querySelector('[data-guess-input-label]'),
    suggestions: document.querySelector('[data-guess-suggestions]'),
    pickerHelp: document.querySelector('[data-picker-help]'),
    message: document.querySelector('[data-game-message]'),
    rows: document.querySelector('[data-guess-rows]'),
    header: document.querySelector('[data-guess-header]'),
    hint: document.querySelector('[data-hint-button]'),
    hints: document.querySelector('[data-hints]'),
    result,
    resultImage: document.querySelector('[data-result-image]') || result?.querySelector('img'),
    modes: [...document.querySelectorAll('[data-game-mode]')],
    attempts: document.querySelector('[data-attempts-value]'),
    score: document.querySelector('[data-score-value]'),
    streak: document.querySelector('[data-streak-value]'),
    best: document.querySelector('[data-best-value]'),
    newPractice: document.querySelector('[data-new-practice]'),
    share: document.querySelector('[data-share-result]'),
    modeNote: document.querySelector('[data-mode-note]'),
    categoryTitle: document.querySelector('[data-category-title]'),
    categorySelect: document.querySelector('[data-category-select]'),
    categoryPicker: document.querySelector('[data-category-picker]'),
    gameTitle: document.querySelector('[data-game-title]')
};

let state;
let category;
let entities;
let answer;
let fixtureActive = isRedesignFixtureRequested();
function language() {
    const code = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return ENTITY_GUESSER_COPY[code] ? code : 'en';
}
function text(key) {
    return ENTITY_GUESSER_COPY[language()]?.[key]
        || ENTITY_GUESSER_COPY.en[key]
        || ENTITY_GUESSER_COLUMN_COPY[language()]?.[key]
        || ENTITY_GUESSER_COLUMN_COPY.en[key]
        || key;
}
function categoryLabel(id) {
    return ENTITY_CATEGORY_LABELS[language()]?.[id]
        || ENTITY_CATEGORY_LABELS.en[id]
        || id;
}
function message(value, type = 'neutral') {
    elements.message.textContent = value;
    elements.message.dataset.type = type;
}
function saveDailyState() {
    if (!shouldPersistDailyState(state.mode, fixtureActive)) return;
    writeJson(DAILY_STORAGE_KEY, state);
}

function announce() {
    window.dispatchEvent(new CustomEvent('clashpanel:minigame-state-changed', {
        detail: { game: 'entity' }
    }));
}

const stateManager = createEntityGuesserStateManager({
    entityCategories: ENTITY_CATEGORIES,
    dataVersion: ENTITY_GUESSER_DATA_VERSION,
    dailyStorageKey: DAILY_STORAGE_KEY,
    practiceCategoryKey: PRACTICE_CATEGORY_KEY,
    getCategory,
    getEntities,
    getDailyCategory,
    getDailyEntity,
    getPracticeEntity,
    readJson,
    readString,
    writeString,
    isFixtureActive: () => fixtureActive
});

const { appendImage, setImage } = createEntityImageRenderer({
    getEntityAsset,
    installImageFallback
});

const picker = createEntityAnswerPicker({
    elements,
    getEntities: () => entities,
    searchEntities,
    appendImage,
    text,
    setMessage: message,
    isComplete: () => state.completed
});

const board = createEntityGuessBoard({
    elements,
    getCategory: () => category,
    getState: () => state,
    getEntities: () => entities,
    getAnswer: () => answer,
    compareEntity: (guess, answer, currentCategory) => (
        compareEntity(guess, answer, currentCategory, language())
    ),
    text,
    appendImage
});

function createState(mode, requestedCategory) {
    return stateManager.create(mode, requestedCategory, utcDateKey());
}

function hydrate(next) {
    const resolved = stateManager.hydrate(next);
    state = resolved.state;
    category = resolved.category;
    entities = resolved.entities;
    answer = resolved.answer;
    picker.clearSelection();
    elements.input.value = '';
}

const renderer = createEntityGuesserRenderer({
    elements,
    entityCategories: ENTITY_CATEGORIES,
    text,
    categoryLabel,
    getState: () => state,
    getCategory: () => category,
    getAnswer: () => answer,
    getStats: () => readJson(STATS_STORAGE_KEY, { currentStreak: 0, bestStreak: 0 }),
    availableHintCount,
    buildHint,
    getLocale: language,
    message,
    picker,
    board,
    setImage
});

function render() {
    renderer.render();
}

const actions = createEntityGuesserActions({
    getState: () => state,
    getCategory: () => category,
    getAnswer: () => answer,
    isFixtureActive: () => fixtureActive,
    availableHintCount,
    buildHint,
    getLocale: language,
    calculateScore,
    readJson,
    writeJson,
    updateStreak,
    statsStorageKey: STATS_STORAGE_KEY,
    saveDailyState,
    shouldPersistDailyState,
    announce
});

function submit(event) {
    event.preventDefault();
    if (state.completed) return;
    const guess = findEntity(elements.input.value, entities);
    if (!guess) {
        picker.clearSelection();
        message(text('invalid'), 'error');
        picker.render(true);
        elements.input.focus();
        return;
    }
    if (state.guesses.includes(guess.id)) {
        message(text('duplicate'), 'error');
        return;
    }

    picker.clearSelection();
    picker.setOpen(false);
    state.guesses.push(guess.id);
    elements.input.value = '';
    if (isWinningGuess(guess, answer)) actions.complete(true);
    else if (state.guesses.length >= category.maxAttempts) actions.complete(false);
    saveDailyState();
    render();
}

function setMode(mode, categoryId = state?.categoryId) {
    elements.modes.forEach(button => {
        button.tabIndex = button.dataset.gameMode === mode ? 0 : -1;
    });
    hydrate(createState(mode, categoryId));
    render();
}

async function share() {
    const resultLabel = state.won
        ? `${state.guesses.length}/${category.maxAttempts}`
        : `X/${category.maxAttempts}`;
    const value = [
        `ClashPanel Daily Entity Guesser · ${category.shortLabel}`,
        `${state.dateKey} · ${resultLabel} · ${state.score} points`,
        ...resultSquares(board.getComparisonRows()),
        `Streak: ${readJson(STATS_STORAGE_KEY, {})?.currentStreak || 0}`,
        'https://clashpanel.com/minigames'
    ].join('\n');
    const result = await shareEntityResult(value);
    if (result.copied) message(text('copied'), 'success');
    else if (!result.aborted) message(result.value);
}

function handleFixture(fixture) {
    if (!isLocalFixtureHost() || fixture?.module !== 'minigames') return;
    if (!fixture.id?.startsWith('entity-')) return;
    const fixtureState = getEntityGameFixture(fixture.id, utcDateKey(), language());
    if (!fixtureState) return;
    fixtureActive = true;
    hydrate(fixtureState);
    render();
}

picker.bind();
elements.form.addEventListener('submit', submit);
elements.hint.addEventListener('click', () => {
    actions.revealHint();
    render();
});
elements.newPractice.addEventListener('click', () => setMode('practice'));
elements.share.addEventListener('click', share);
elements.categorySelect.addEventListener('change', () => (
    setMode('practice', elements.categorySelect.value)
));
elements.modes.forEach(button => button.addEventListener('click', () => {
    setMode(button.dataset.gameMode);
}));
window.addEventListener('clashpanel:fixture-ready', event => handleFixture(event.detail));
window.addEventListener('clashpanel:minigame-selected', event => {
    if (event.detail?.game === 'entity') render();
});
window.addEventListener('clashtools:language-changed', render);

getRedesignFixture().then(handleFixture).catch(() => {});
hydrate(new URLSearchParams(location.search).get('mode') === 'practice' ? 'practice' : 'daily');
render();
