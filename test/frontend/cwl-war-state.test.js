import { describe, expect, it } from 'vitest';
import {
    decideWarResult,
    isAttackCountingState,
    isMissedCountingState,
    normalizeWarState
} from '../../src/assets/js/cwl/cwl-war-state.js';

describe('CWL war state accounting', () => {
    it.each([
        ['preparation', 'preparation'],
        ['inWar', 'live'],
        ['warEnded', 'completed'],
        ['notInWar', 'notAvailable'],
        ['notStarted', 'notStarted'],
        ['unexpected', 'unknown']
    ])('maps %s to %s', (source, expected) => {
        expect(normalizeWarState({ state: source })).toBe(expected);
    });

    it('derives completed state from an elapsed end time', () => {
        expect(normalizeWarState(
            { startTime: '20260715T100000.000Z', endTime: '20260715T110000.000Z' },
            Date.parse('2026-07-15T12:00:00Z')
        )).toBe('completed');
    });

    it('counts live attacks but only counts missed attacks after completion', () => {
        expect(isAttackCountingState('live')).toBe(true);
        expect(isMissedCountingState('live')).toBe(false);
        expect(isAttackCountingState('preparation')).toBe(false);
        expect(isMissedCountingState('completed')).toBe(true);
    });

    it('only assigns final win/loss/draw results to completed wars', () => {
        expect(decideWarResult(10, 90, 9, 99, 'live')).toBe('pending');
        expect(decideWarResult(10, 90, 9, 99, 'completed')).toBe('win');
        expect(decideWarResult(10, 90, 10, 91, 'completed')).toBe('loss');
        expect(decideWarResult(10, 90, 10, 90, 'completed')).toBe('draw');
        expect(decideWarResult(0, 0, 0, 0, 'preparation')).toBe('notStarted');
    });
});
