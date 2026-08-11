import { ENTITY_CATEGORIES } from '../minigames/entity-guesser-catalog.js?v=20260809-3';
import {
    DAILY_CATEGORY_IDS,
    DAILY_QUESTION_COUNT,
    HIGHER_LOWER_DAILY_KEY,
    HIGHER_LOWER_PRACTICE_FILTER_KEY,
    HIGHER_LOWER_STATS_KEY,
    advanceRun,
    applyChoice,
    buildDailyQuestions,
    buildPracticeQuestion,
    createDailyRun,
    createPracticeRun,
    resultSymbols,
    updateLifetimeStats,
    utcDateKey
} from '../minigames/higher-lower-engine.js?v=20260809-3';
import {
    getLatestHigherLowerAnswer,
    isValidHigherLowerDailyRun
} from '../minigames/minigames-state.js?v=20260809-3';
import { getEntityAsset, installImageFallback } from '../assets/entity-assets.js';
import {
    getRedesignFixture,
    isLocalFixtureHost,
    isRedesignFixtureRequested
} from '../fixtures/redesign-fixture-mode.js';
import { getHigherLowerGameFixture } from '../minigames/minigames-fixtures.js?v=20260811-2';
import { HIGHER_LOWER_COPY } from '../minigames/higher-lower-copy.js?v=20260811-1';
import { createHigherLowerRenderer } from '../minigames/higher-lower-renderer.js?v=20260811-1';
import {
    readJson,
    readString,
    removeStoredValue,
    shouldPersistDailyState,
    writeJson,
    writeString
} from '../minigames/minigames-storage.js?v=20260811-1';

const root = document.querySelector('[data-higher-lower-game]');
if (!root) throw new Error('Higher or Lower root is missing.');

const elements = {
    modes: [...root.querySelectorAll('[data-hl-mode]')],
    modeNote: root.querySelector('[data-hl-mode-note]'),
    filterWrap: root.querySelector('[data-hl-filter-wrap]'),
    filter: root.querySelector('[data-hl-filter]'),
    sidebarTitle: root.querySelector('[data-hl-sidebar-title]'),
    question: root.querySelector('[data-hl-question]'),
    score: root.querySelector('[data-hl-score]'),
    correct: root.querySelector('[data-hl-correct]'),
    combo: root.querySelector('[data-hl-combo]'),
    metric: root.querySelector('[data-hl-metric]'),
    prompt: root.querySelector('[data-hl-prompt]'),
    leftName: root.querySelector('[data-hl-left-name]'),
    leftValue: root.querySelector('[data-hl-left-value]'),
    rightName: root.querySelector('[data-hl-right-name]'),
    rightValue: root.querySelector('[data-hl-right-value]'),
    leftImage: root.querySelector('[data-hl-left-image]'),
    rightImage: root.querySelector('[data-hl-right-image]'),
    choices: [...root.querySelectorAll('[data-hl-choice]')],
    feedback: root.querySelector('[data-hl-feedback]'),
    next: root.querySelector('[data-hl-next]'),
    reset: root.querySelector('[data-hl-reset]'),
    result: root.querySelector('[data-hl-result]'),
    resultTitle: root.querySelector('[data-hl-result-title]'),
    resultBody: root.querySelector('[data-hl-result-body]'),
    share: root.querySelector('[data-hl-share]')
};

function language() {
    const code = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return HIGHER_LOWER_COPY[code] ? code : 'en';
}

function text(key) {
    return HIGHER_LOWER_COPY[language()]?.[key] || HIGHER_LOWER_COPY.en[key] || key;
}

const renderer = createHigherLowerRenderer({
    root,
    elements,
    text,
    entityCategories: ENTITY_CATEGORIES,
    dailyCategoryIds: DAILY_CATEGORY_IDS,
    dailyQuestionCount: DAILY_QUESTION_COUNT,
    getLatestAnswer: getLatestHigherLowerAnswer,
    getEntityAsset,
    installImageFallback
});

let run;
let dailyQuestions = [];
let practiceQuestion = null;
let fixtureActive = isRedesignFixtureRequested();

function announce() {
    window.dispatchEvent(new CustomEvent('clashpanel:minigame-state-changed', {
        detail: { game: 'higher-lower' }
    }));
}

function saveDaily() {
    if (!shouldPersistDailyState(run.mode, fixtureActive)) return;
    writeJson(HIGHER_LOWER_DAILY_KEY, run);
}

function validPracticeFilter(value) {
    return value === 'all' || DAILY_CATEGORY_IDS.includes(value) ? value : 'all';
}

function loadDailyRun() {
    const dateKey = utcDateKey();
    dailyQuestions = buildDailyQuestions(dateKey);
    const saved = readJson(HIGHER_LOWER_DAILY_KEY);
    if (isValidHigherLowerDailyRun(saved, dateKey)) {
        run = saved;
        return;
    }
    if (!fixtureActive) removeStoredValue(HIGHER_LOWER_DAILY_KEY);
    run = createDailyRun(dateKey);
    saveDaily();
}

function loadPracticeRun(filter = readString(HIGHER_LOWER_PRACTICE_FILTER_KEY, 'all')) {
    const categoryId = validPracticeFilter(filter);
    if (!fixtureActive) writeString(HIGHER_LOWER_PRACTICE_FILTER_KEY, categoryId);
    run = createPracticeRun(categoryId);
    practiceQuestion = buildPracticeQuestion(categoryId);
}

function currentQuestion() {
    return run.mode === 'daily'
        ? dailyQuestions[Math.min(run.currentIndex, DAILY_QUESTION_COUNT - 1)]
        : practiceQuestion;
}

function render() {
    const question = currentQuestion();
    if (question) renderer.render(run, question);
}

function choose(choice, button) {
    if (run.revealed || run.completed) return;
    elements.choices.forEach(item => {
        item.dataset.selected = String(item === button);
    });
    run = applyChoice(run, currentQuestion(), choice);
    if (run.mode === 'daily') {
        saveDaily();
        if (run.completed && !fixtureActive) {
            writeJson(
                HIGHER_LOWER_STATS_KEY,
                updateLifetimeStats(readJson(HIGHER_LOWER_STATS_KEY, {}), run)
            );
        }
    }
    announce();
    render();
}

function nextQuestion() {
    if (!run.revealed || run.completed) return;
    run = advanceRun(run);
    elements.choices.forEach(item => {
        delete item.dataset.selected;
        item.setAttribute('aria-pressed', 'false');
    });
    if (run.mode === 'practice') {
        practiceQuestion = buildPracticeQuestion(run.categoryId, practiceQuestion?.id);
    } else {
        saveDaily();
    }
    announce();
    render();
}

function setMode(mode) {
    elements.choices.forEach(item => delete item.dataset.selected);
    if (mode === 'practice') loadPracticeRun();
    else loadDailyRun();
    render();
}

function resetPractice() {
    loadPracticeRun(elements.filter.value);
    elements.choices.forEach(item => delete item.dataset.selected);
    render();
}

async function shareResult() {
    const value = [
        'ClashPanel Daily Higher or Lower',
        `${run.dateKey} · ${run.correctCount}/${DAILY_QUESTION_COUNT} · ${run.score} ${text('points')}`,
        resultSymbols(run.answers),
        `${text('bestCombo')}: ${run.bestCombo}`,
        'https://clashpanel.com/minigames?game=higher-lower'
    ].join('\n');
    try {
        if (navigator.share) await navigator.share({ text: value });
        else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
        elements.feedback.textContent = text('copied');
        elements.feedback.dataset.state = 'correct';
    } catch (error) {
        if (error?.name !== 'AbortError') elements.feedback.textContent = value;
    }
}

function moveModeFocus(button, direction) {
    const index = elements.modes.indexOf(button);
    if (index < 0) return;
    const next = elements.modes[(index + direction + elements.modes.length) % elements.modes.length];
    next.focus();
    setMode(next.dataset.hlMode);
}

function handleFixture(fixture) {
    if (!isLocalFixtureHost() || fixture?.module !== 'minigames') return;
    if (!fixture.id?.startsWith('higher-lower-')) return;
    const fixtureRun = getHigherLowerGameFixture(fixture.id, utcDateKey());
    if (!fixtureRun) return;
    fixtureActive = true;
    dailyQuestions = buildDailyQuestions(fixtureRun.dateKey);
    run = fixtureRun;
    render();
}

elements.choices.forEach(button => {
    button.addEventListener('click', () => choose(button.dataset.hlChoice, button));
});
elements.next.addEventListener('click', nextQuestion);
elements.reset.addEventListener('click', resetPractice);
elements.share.addEventListener('click', shareResult);
elements.filter.addEventListener('change', () => {
    loadPracticeRun(elements.filter.value);
    render();
});
elements.modes.forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.hlMode));
    button.addEventListener('keydown', event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            moveModeFocus(button, 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveModeFocus(button, -1);
        }
    });
});
window.addEventListener('clashpanel:fixture-ready', event => handleFixture(event.detail));
window.addEventListener('clashpanel:minigame-selected', event => {
    if (event.detail?.game === 'higher-lower') render();
});
window.addEventListener('classtools:language-changed', render);

getRedesignFixture().then(handleFixture).catch(() => {});
loadDailyRun();
render();
