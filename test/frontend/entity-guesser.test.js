import { describe, expect, it } from 'vitest';
import { TROOP_CATEGORY, TROOPS } from '../../src/assets/js/minigames/entity-guesser-data.js';
import {
    availableHintCount,
    calculateScore,
    compareEntity,
    findEntity,
    getDailyEntity,
    normalizeGuess,
    resultSquares,
    updateStreak
} from '../../src/assets/js/minigames/entity-guesser-engine.js';

describe('Entity Guesser engine', () => {
    it('normalizes aliases and punctuation', () => {
        expect(normalizeGuess(' P.E.K.K.A. ')).toBe('pekka');
        expect(findEntity('e-drag')?.id).toBe('electro-dragon');
        expect(findEntity('WB')?.id).toBe('wall-breaker');
    });

    it('selects one deterministic daily answer', () => {
        const first = getDailyEntity('2026-08-06');
        const second = getDailyEntity('2026-08-06');
        expect(first.id).toBe(second.id);
        expect(TROOPS).toContain(first);
    });

    it('returns numeric direction and close feedback', () => {
        const barbarian = TROOPS.find(troop => troop.id === 'barbarian');
        const giant = TROOPS.find(troop => troop.id === 'giant');
        const comparison = compareEntity(barbarian, giant, TROOP_CATEGORY);
        const housing = comparison.find(cell => cell.key === 'housing');
        const townHall = comparison.find(cell => cell.key === 'unlockTh');
        expect(housing).toMatchObject({ state: 'wrong', direction: 'higher' });
        expect(townHall).toMatchObject({ state: 'wrong', direction: 'higher' });
    });

    it('uses the documented score table and hint penalties', () => {
        expect(calculateScore(1, 0, true)).toBe(1000);
        expect(calculateScore(4, 1, true)).toBe(450);
        expect(calculateScore(6, 2, true)).toBe(100);
        expect(calculateScore(2, 0, false)).toBe(0);
    });

    it('unlocks hints after attempts three and five', () => {
        expect(availableHintCount(2, 0)).toBe(0);
        expect(availableHintCount(3, 0)).toBe(1);
        expect(availableHintCount(5, 1)).toBe(1);
        expect(availableHintCount(6, 2)).toBe(0);
    });

    it('continues and resets completion streaks correctly', () => {
        const first = updateStreak({}, '2026-08-04', true);
        const second = updateStreak(first, '2026-08-05', false);
        const reset = updateStreak(second, '2026-08-07', true);
        expect(first.currentStreak).toBe(1);
        expect(second.currentStreak).toBe(2);
        expect(reset.currentStreak).toBe(1);
        expect(reset.bestStreak).toBe(2);
    });

    it('creates spoiler-free share rows', () => {
        const barbarian = TROOPS.find(troop => troop.id === 'barbarian');
        const giant = TROOPS.find(troop => troop.id === 'giant');
        const squares = resultSquares([compareEntity(barbarian, giant)]);
        expect(squares[0]).toMatch(/^[🟩🟨⬛]+$/u);
        expect(squares[0]).not.toContain('Giant');
    });
});
