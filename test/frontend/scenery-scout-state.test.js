import { describe, expect, it } from 'vitest';
import {
    emptyScoutStats,
    loadScoutStats,
    recordCompletedRun,
    saveScoutStats,
    scoutAccuracy
} from '../../src/assets/js/minigames/scenery-scout-state.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key)
    };
}

const run = (mode, score = 2400) => ({
    mode,
    score,
    bestStreak: 2,
    answers: [
        { correct: true, responseMs: 1200 },
        { correct: false, responseMs: 3000 },
        { correct: true, responseMs: 1800 }
    ]
});

describe('Scenery Scout local progress', () => {
    it('rejects malformed or obsolete state', () => {
        const storage = memoryStorage({ 'clashpanel:minigames:scenery-scout:v1': '{"schemaVersion":99,"totalGames":999}' });
        expect(loadScoutStats(storage)).toEqual(emptyScoutStats());
    });

    it('records totals and only reports a genuinely new personal best', () => {
        const first = recordCompletedRun(emptyScoutStats(), run('normal'), '2026-08-31');
        const second = recordCompletedRun(first.stats, run('normal', 2000), '2026-08-31');
        expect(first.newBest).toBe(true);
        expect(second.newBest).toBe(false);
        expect(second.stats.totalGames).toBe(2);
        expect(second.stats.totalGuesses).toBe(6);
        expect(second.stats.bests.normal).toBe(2400);
        expect(scoutAccuracy(second.stats)).toBeCloseTo(2 / 3);
    });

    it('increments, preserves and resets the daily completion streak', () => {
        const dayOne = recordCompletedRun(emptyScoutStats(), run('daily'), '2026-08-29').stats;
        const duplicate = recordCompletedRun(dayOne, run('daily'), '2026-08-29').stats;
        const dayTwo = recordCompletedRun(duplicate, run('daily'), '2026-08-30').stats;
        const gap = recordCompletedRun(dayTwo, run('daily'), '2026-09-02').stats;
        expect(dayOne.daily).toMatchObject({ streak: 1, completed: 1 });
        expect(duplicate.daily).toMatchObject({ streak: 1, completed: 1 });
        expect(dayTwo.daily).toMatchObject({ streak: 2, completed: 2 });
        expect(gap.daily).toMatchObject({ streak: 1, completed: 3 });
    });

    it('round-trips normalized state through safe storage wrappers', () => {
        const storage = memoryStorage();
        const completed = recordCompletedRun(emptyScoutStats(), run('sudden-death'), '2026-08-31').stats;
        expect(saveScoutStats(completed, storage)).toBe(true);
        expect(loadScoutStats(storage)).toEqual(completed);
        expect(completed.highestSuddenDeathStreak).toBe(2);
    });
});
