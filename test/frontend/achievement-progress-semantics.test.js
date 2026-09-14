import { describe, expect, it } from 'vitest';
import {
    evaluateThreshold,
    isFamilyComplete,
    isTierUnlocked,
    stateForValue
} from '../../src/assets/js/achievements/achievement-progress-semantics.js';

describe('Achievement progress source semantics', () => {
    it.each([
        ['GTE', { progress: 10, target: 10 }],
        ['LTE', { progress: 5, target: 10 }],
        ['BOOLEAN', { progress: 1 }]
    ])('does not evaluate %s as met when sourceAvailable is false', (comparison, values) => {
        const value = { ...values, comparison, sourceAvailable: false, unlocked: true, state: 'complete' };
        const evaluation = evaluateThreshold(value);

        expect(evaluation.known).toBe(false);
        expect(evaluation.meets).toBeNull();
        expect(isTierUnlocked(value)).toBe(false);
        expect(stateForValue(value)).toBe('unknown');
    });

    it.each([
        ['GTE', { progress: 10, target: 10 }],
        ['LTE', { progress: 5, target: 10 }],
        ['BOOLEAN', { progress: 1 }]
    ])('does not evaluate %s as met when source_available is false', (comparison, values) => {
        const value = { ...values, comparison, source_available: false, unlocked: true };

        expect(evaluateThreshold(value).meets).toBeNull();
        expect(isTierUnlocked(value)).toBe(false);
        expect(stateForValue(value)).toBe('unknown');
    });

    it('keeps a family incomplete when stale completion conflicts with an unavailable source', () => {
        const value = {
            sourceAvailable: false,
            state: 'complete',
            complete: true,
            tiers: [{ progress: 10, target: 10, comparison: 'GTE', unlocked: true }]
        };

        expect(isFamilyComplete(value)).toBe(false);
        expect(stateForValue(value)).toBe('unknown');
    });
});
