import { describe, expect, it } from 'vitest';

import {
    buildImportantAttacks
} from '../../src/assets/js/operation-board/operation-board-live-recommendations.js';
import {
    recommendationReport
} from './fixtures/operation-board-live-fixture.js';

describe('Operation Board important attacks', () => {
    it('uses remaining attackers and ignores bases that are already tripled', () => {
        const report = recommendationReport();
        const recommendations = buildImportantAttacks(report);

        expect(recommendations).toHaveLength(1);
        expect(recommendations[0]).toMatchObject({
            attacker: { tag: '#THOMAS', name: 'Thomas' },
            confidence: 'High',
            probabilityEligible: true
        });
        expect(recommendations[0].target.tag).not.toBe('#CLOSED');
        expect(recommendations[0].target.bestStars).toBeLessThan(3);
        expect(recommendations[0].expectedNetStars).toBeGreaterThan(0);
    });

    it('labels TH/map-position fallback advice as low confidence', () => {
        const report = recommendationReport();
        report.historicalPerformance = {};

        const [recommendation] = buildImportantAttacks(report);

        expect(recommendation.confidence).toBe('Low');
        expect(recommendation.probabilityEligible).toBe(false);
        expect(recommendation.expectedStars).toBeGreaterThan(0);
    });
});
