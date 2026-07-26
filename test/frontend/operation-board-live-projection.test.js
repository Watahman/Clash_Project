import { describe, expect, it } from 'vitest';

import {
    buildProjectedOutcome
} from '../../src/assets/js/operation-board/operation-board-live-projection.js';
import {
    recommendationReport
} from './fixtures/operation-board-live-fixture.js';

describe('Operation Board projected outcome', () => {
    it('withholds win probability when historical coverage is insufficient', () => {
        const report = recommendationReport();
        report.historicalPerformance = {};

        const projection = buildProjectedOutcome(report, { simulations: 200 });

        expect(projection.probabilityState).toBe('insufficient');
        expect(projection.winProbability).toBeNull();
        expect(projection.own.stars).toBeGreaterThanOrEqual(3);
    });

    it('simulates a stable probability when both remaining rosters have coverage', () => {
        const report = recommendationReport();
        const first = buildProjectedOutcome(report, { simulations: 400 });
        const second = buildProjectedOutcome(report, { simulations: 400 });

        expect(first.probabilityState).toBe('ready');
        expect(first.winProbability).toBeGreaterThanOrEqual(0);
        expect(first.winProbability).toBeLessThanOrEqual(100);
        expect(second.winProbability).toBe(first.winProbability);
    });
});
