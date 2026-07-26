import { describe, expect, it } from 'vitest';
import {
    attackQuality,
    compareMatchupStrength,
    matchupDifficultyMultiplier
} from '../../src/assets/js/cwl/cwl-matchup-difficulty.js';

describe('shared CWL matchup difficulty', () => {
    it('uses the documented attack quality weights', () => {
        expect(attackQuality(3, 100)).toBe(100);
        expect(attackQuality(3, 60)).toBe(90);
        expect(attackQuality(2, 99)).toBe(74.75);
    });

    it('rewards up-hits and discounts down-hits', () => {
        expect(matchupDifficultyMultiplier(
            { townHall: 16, progression: 0.5 },
            { townHall: 17, progression: 0.5 }
        )).toBeCloseTo(1.12);
        expect(compareMatchupStrength(
            { townHall: 17, progression: 0.5 },
            { townHall: 16, progression: 0.5 }
        ).difficultyMultiplier).toBeCloseTo(0.88);
    });
});
