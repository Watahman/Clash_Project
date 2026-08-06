import { TROOP_CATEGORY, TROOPS } from './entity-guesser-data.js';

export const DAILY_STORAGE_KEY = 'clashpanel:minigames:entity-guesser:daily:v1';
export const STATS_STORAGE_KEY = 'clashpanel:minigames:entity-guesser:stats:v1';

export function normalizeGuess(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[.']/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
}

export function findEntity(value, entities = TROOPS) {
    const normalized = normalizeGuess(value);
    if (!normalized) return null;
    return entities.find(entity => {
        const candidates = [entity.name, ...(entity.aliases || [])];
        return candidates.some(candidate => normalizeGuess(candidate) === normalized);
    }) || null;
}

export function searchEntities(value, entities = TROOPS, limit = 8) {
    const normalized = normalizeGuess(value);
    if (!normalized) return entities.slice(0, limit);
    return entities
        .filter(entity => [entity.name, ...(entity.aliases || [])]
            .some(candidate => normalizeGuess(candidate).includes(normalized)))
        .slice(0, limit);
}

export function utcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

export function previousUtcDateKey(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return utcDateKey(date);
}

export function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function getDailyEntity(dateKey = utcDateKey(), entities = TROOPS) {
    if (!entities.length) throw new Error('Entity Guesser requires at least one entity.');
    return entities[stableHash(`clashpanel:${dateKey}:troops`) % entities.length];
}

export function getPracticeEntity(entities = TROOPS, random = Math.random) {
    if (!entities.length) throw new Error('Entity Guesser requires at least one entity.');
    return entities[Math.floor(random() * entities.length) % entities.length];
}

export function compareValue(guessValue, answerValue, column) {
    if (column.kind === 'number') {
        const difference = Number(guessValue) - Number(answerValue);
        if (difference === 0) return { state: 'correct', direction: null };
        const close = Math.abs(difference) <= Number(column.closeWithin || 0);
        return {
            state: close ? 'close' : 'wrong',
            direction: difference < 0 ? 'higher' : 'lower'
        };
    }
    return {
        state: guessValue === answerValue ? 'correct' : 'wrong',
        direction: null
    };
}

export function compareEntity(guess, answer, category = TROOP_CATEGORY) {
    return category.columns.map(column => ({
        key: column.key,
        value: guess[column.key],
        ...compareValue(guess[column.key], answer[column.key], column)
    }));
}

export function isWinningGuess(guess, answer) {
    return Boolean(guess && answer && guess.id === answer.id);
}

export function calculateScore(attemptNumber, hintsUsed = 0, won = true) {
    if (!won) return 0;
    const baseByAttempt = [1000, 850, 700, 550, 400, 250];
    const base = baseByAttempt[Math.max(0, Math.min(baseByAttempt.length - 1, attemptNumber - 1))];
    const hintPenalty = hintsUsed === 0 ? 0 : hintsUsed === 1 ? 100 : 250;
    return Math.max(100, base - hintPenalty);
}

export function availableHintCount(attempts, usedHints) {
    const unlocked = attempts >= 5 ? 2 : attempts >= 3 ? 1 : 0;
    return Math.max(0, unlocked - usedHints);
}

export function buildHint(answer, hintNumber) {
    if (hintNumber === 1) {
        return `${answer.movement} troop · targets ${answer.targets.toLowerCase()}.`;
    }
    return `${answer.resource} · ${answer.role.toLowerCase()} role · unlocked at Town Hall ${answer.unlockTh}.`;
}

export function updateStreak(stats, completedDateKey, won) {
    const current = Number(stats?.currentStreak || 0);
    const best = Number(stats?.bestStreak || 0);
    const last = stats?.lastCompletedDate || null;
    let nextCurrent = current;

    if (last !== completedDateKey) {
        nextCurrent = last === previousUtcDateKey(completedDateKey) ? current + 1 : 1;
    }

    return {
        gamesPlayed: Number(stats?.gamesPlayed || 0) + (last === completedDateKey ? 0 : 1),
        gamesWon: Number(stats?.gamesWon || 0) + (last === completedDateKey || !won ? 0 : 1),
        currentStreak: nextCurrent,
        bestStreak: Math.max(best, nextCurrent),
        lastCompletedDate: completedDateKey
    };
}

export function resultSquares(comparisonRows) {
    return comparisonRows.map(row => row.map(cell => {
        if (cell.state === 'correct') return '🟩';
        if (cell.state === 'close') return '🟨';
        return '⬛';
    }).join(''));
}
