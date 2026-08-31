import { readJson, writeJson } from './minigames-storage.js';

export const SCENERY_SCOUT_STATS_KEY = 'clashpanel:minigames:scenery-scout:v1';

export function emptyScoutStats() {
    return {
        schemaVersion: 1,
        totalGames: 0,
        totalGuesses: 0,
        correctGuesses: 0,
        totalScore: 0,
        totalResponseMs: 0,
        bests: { normal: 0, hard: 0, expert: 0, daily: 0 },
        highestSuddenDeathStreak: 0,
        daily: { lastCompleted: null, streak: 0, completed: 0 },
        modes: {}
    };
}

export function loadScoutStats(storage = globalThis.localStorage) {
    return normalizeScoutStats(readJson(SCENERY_SCOUT_STATS_KEY, null, storage));
}

export function saveScoutStats(stats, storage = globalThis.localStorage) {
    return writeJson(SCENERY_SCOUT_STATS_KEY, normalizeScoutStats(stats), storage);
}

export function normalizeScoutStats(value) {
    const fallback = emptyScoutStats();
    if (!value || value.schemaVersion !== 1) return fallback;
    const stats = {
        ...fallback,
        totalGames: count(value.totalGames),
        totalGuesses: count(value.totalGuesses),
        correctGuesses: count(value.correctGuesses),
        totalScore: count(value.totalScore),
        totalResponseMs: count(value.totalResponseMs),
        highestSuddenDeathStreak: count(value.highestSuddenDeathStreak),
        bests: { ...fallback.bests },
        daily: { ...fallback.daily },
        modes: {}
    };
    for (const mode of Object.keys(stats.bests)) stats.bests[mode] = count(value.bests?.[mode]);
    stats.daily.lastCompleted = validDateKey(value.daily?.lastCompleted) ? value.daily.lastCompleted : null;
    stats.daily.streak = count(value.daily?.streak);
    stats.daily.completed = count(value.daily?.completed);
    for (const [mode, entry] of Object.entries(value.modes || {})) {
        stats.modes[mode] = { games: count(entry?.games), guesses: count(entry?.guesses), correct: count(entry?.correct) };
    }
    return stats;
}

export function recordCompletedRun(current, run, dateKey) {
    const stats = normalizeScoutStats(current);
    const answers = Array.isArray(run?.answers) ? run.answers : [];
    const correct = answers.filter(answer => answer?.correct).length;
    const responseMs = answers.reduce((sum, answer) => sum + count(answer?.responseMs), 0);
    const mode = String(run?.mode || 'normal');
    const score = count(run?.score);
    const modeStats = stats.modes[mode] || { games: 0, guesses: 0, correct: 0 };

    stats.totalGames += 1;
    stats.totalGuesses += answers.length;
    stats.correctGuesses += correct;
    stats.totalScore += score;
    stats.totalResponseMs += responseMs;
    stats.modes[mode] = { games: modeStats.games + 1, guesses: modeStats.guesses + answers.length, correct: modeStats.correct + correct };

    let newBest = false;
    if (mode === 'sudden-death') {
        const streak = count(run?.bestStreak);
        newBest = streak > stats.highestSuddenDeathStreak;
        stats.highestSuddenDeathStreak = Math.max(stats.highestSuddenDeathStreak, streak);
    } else if (Object.hasOwn(stats.bests, mode)) {
        newBest = score > stats.bests[mode];
        stats.bests[mode] = Math.max(stats.bests[mode], score);
    }

    if (mode === 'daily' && validDateKey(dateKey) && stats.daily.lastCompleted !== dateKey) {
        stats.daily.streak = isNextUtcDay(stats.daily.lastCompleted, dateKey) ? stats.daily.streak + 1 : 1;
        stats.daily.completed += 1;
        stats.daily.lastCompleted = dateKey;
    }
    return { stats, newBest };
}

export function scoutAccuracy(stats) {
    const normalized = normalizeScoutStats(stats);
    return normalized.totalGuesses ? normalized.correctGuesses / normalized.totalGuesses : 0;
}

function isNextUtcDay(previous, current) {
    if (!validDateKey(previous)) return false;
    const difference = Date.parse(`${current}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`);
    return difference === 86400000;
}

function validDateKey(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function count(value) {
    return Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : 0;
}
