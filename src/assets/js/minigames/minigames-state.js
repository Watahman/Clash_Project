import {
    DAILY_QUESTION_COUNT,
    HIGHER_LOWER_DATA_VERSION,
    utcDateKey
} from './higher-lower-engine.js';

const CHOICES = new Set(['higher', 'lower']);

function isNonNegativeNumber(value) {
    return Number.isFinite(value) && value >= 0;
}

function isValidAnswer(answer) {
    return Boolean(
        answer
        && typeof answer.questionId === 'string'
        && answer.questionId.length > 0
        && CHOICES.has(answer.choice)
        && CHOICES.has(answer.correctChoice)
        && typeof answer.correct === 'boolean'
        && answer.correct === (answer.choice === answer.correctChoice)
    );
}

export function isValidHigherLowerDailyRun(run, dateKey = utcDateKey()) {
    if (!run || typeof run !== 'object') return false;
    if (run.mode !== 'daily') return false;
    if (run.dateKey !== dateKey || run.dataVersion !== HIGHER_LOWER_DATA_VERSION) return false;
    if (!Array.isArray(run.answers) || run.answers.length > DAILY_QUESTION_COUNT) return false;
    if (!run.answers.every(isValidAnswer)) return false;
    if (!Number.isInteger(run.currentIndex) || run.currentIndex < 0 || run.currentIndex >= DAILY_QUESTION_COUNT) return false;
    if (![run.revealed, run.completed].every(value => typeof value === 'boolean')) return false;
    if (![run.score, run.correctCount, run.combo, run.bestCombo, run.lastBonus].every(isNonNegativeNumber)) return false;

    const expectedCorrect = run.answers.filter(answer => answer.correct).length;
    if (run.correctCount !== expectedCorrect) return false;
    if (run.combo > run.bestCombo || run.combo > DAILY_QUESTION_COUNT) return false;
    if (run.completed !== (run.answers.length === DAILY_QUESTION_COUNT)) return false;
    if (run.completed && (!run.revealed || run.currentIndex !== DAILY_QUESTION_COUNT - 1)) return false;

    const expectedAnswers = run.currentIndex + (run.revealed ? 1 : 0);
    if (!run.completed && run.answers.length !== expectedAnswers) return false;

    const expectedLastCorrect = run.revealed
        ? run.answers.at(-1)?.correct
        : null;
    if (run.lastCorrect !== expectedLastCorrect) return false;

    return true;
}

export function getLatestHigherLowerAnswer(run) {
    if (!run?.revealed || !Array.isArray(run.answers)) return null;
    return run.answers.at(-1) || null;
}
