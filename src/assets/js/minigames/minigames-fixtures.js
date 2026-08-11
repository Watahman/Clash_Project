import {
    ENTITY_GUESSER_DATA_VERSION,
    getEntities
} from './entity-guesser-catalog.js?v=20260809-3';
import {
    buildHint,
    calculateScore,
    getDailyCategory,
    getDailyEntity,
    utcDateKey
} from './entity-guesser-engine-v2.js?v=20260809-3';
import {
    advanceRun,
    applyChoice,
    buildDailyQuestions,
    createDailyRun
} from './higher-lower-engine.js?v=20260809-3';

const ENTITY_FIXTURES = new Set(['entity-fresh', 'entity-mid', 'entity-won', 'entity-lost']);
const HIGHER_LOWER_FIXTURES = new Set(['higher-lower-fresh', 'higher-lower-correct', 'higher-lower-final']);

function wrongEntityIds(category, answerId, count) {
    return getEntities(category.id)
        .filter(entity => entity.id !== answerId)
        .slice(0, count)
        .map(entity => entity.id);
}

function entityBase(dateKey, category, answer) {
    return {
        mode: 'daily',
        dateKey,
        dataVersion: ENTITY_GUESSER_DATA_VERSION,
        categoryId: category.id,
        answerId: answer.id,
        guesses: [],
        hints: [],
        completed: false,
        won: false,
        score: 0
    };
}

function buildEntityFixture(id, dateKey) {
    if (!ENTITY_FIXTURES.has(id)) return null;
    const category = getDailyCategory(dateKey);
    const answer = getDailyEntity(dateKey, category);
    const state = entityBase(dateKey, category, answer);

    if (id === 'entity-mid') {
        state.guesses = wrongEntityIds(category, answer.id, 3);
        state.hints = [buildHint(answer, category, 1)];
    }

    if (id === 'entity-won') {
        state.guesses = [...wrongEntityIds(category, answer.id, 2), answer.id];
        state.completed = true;
        state.won = true;
        state.score = calculateScore(state.guesses.length, 0, true, category.maxAttempts);
    }

    if (id === 'entity-lost') {
        state.guesses = wrongEntityIds(category, answer.id, category.maxAttempts);
        state.completed = true;
    }

    return state;
}

function answerDailyQuestions(id, dateKey) {
    const questions = buildDailyQuestions(dateKey);
    let run = createDailyRun(dateKey);
    const correctEveryTime = id === 'higher-lower-final';

    questions.forEach((question, index) => {
        const choice = correctEveryTime || index % 3 !== 1
            ? question.correctChoice
            : question.correctChoice === 'higher' ? 'lower' : 'higher';
        run = applyChoice(run, question, choice);
        if (index < questions.length - 1) run = advanceRun(run);
    });
    return run;
}

export function getEntityGameFixture(id, dateKey = utcDateKey()) {
    return buildEntityFixture(id, dateKey);
}

export function getHigherLowerGameFixture(id, dateKey = utcDateKey()) {
    if (!HIGHER_LOWER_FIXTURES.has(id)) return null;
    if (id === 'higher-lower-fresh') return createDailyRun(dateKey);

    const questions = buildDailyQuestions(dateKey);
    if (id === 'higher-lower-correct') {
        return applyChoice(createDailyRun(dateKey), questions[0], questions[0].correctChoice);
    }
    return answerDailyQuestions(id, dateKey);
}

export function isMinigameFixture(id) {
    return ENTITY_FIXTURES.has(id) || HIGHER_LOWER_FIXTURES.has(id);
}

export { ENTITY_FIXTURES, HIGHER_LOWER_FIXTURES };
