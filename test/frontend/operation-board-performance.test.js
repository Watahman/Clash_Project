import { beforeEach, describe, expect, it, vi } from 'vitest';

const performanceMocks = vi.hoisted(() => ({
    applyCwlPredictions: vi.fn(report => ({ ...report, predictionState: 'ready' })),
    collectPredictionPlayerTags: vi.fn(() => ['#SELF', '#ENEMY']),
    loadPlayerPerformanceBatch: vi.fn()
}));

vi.mock('../../src/assets/js/cwl/cwl-performance-prediction.js', () => ({
    applyCwlPredictions: performanceMocks.applyCwlPredictions,
    collectPredictionPlayerTags: performanceMocks.collectPredictionPlayerTags
}));
vi.mock('../../src/assets/js/cwl/player-performance-client.js', () => ({
    loadPlayerPerformanceBatch: performanceMocks.loadPlayerPerformanceBatch
}));

import {
    enrichWithHistoricalPerformance
} from '../../src/assets/js/operation-board/operation-board-performance.js';

describe('Operation Board shared historical performance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('keeps the single batched result for both live rosters on the report', async () => {
        const results = {
            '#SELF': { status: 'ready', avgStars: 2.6 },
            '#ENEMY': { status: 'ready', avgStars: 2.3 }
        };
        performanceMocks.loadPlayerPerformanceBatch.mockResolvedValue(results);

        const enriched = await enrichWithHistoricalPerformance({
            clan: { tag: '#CLAN' },
            roster: [],
            wars: []
        });

        expect(performanceMocks.loadPlayerPerformanceBatch)
            .toHaveBeenCalledWith(['#SELF', '#ENEMY']);
        expect(enriched.historicalPerformance).toBe(results);
        expect(performanceMocks.applyCwlPredictions).toHaveBeenCalledTimes(1);
    });
});
