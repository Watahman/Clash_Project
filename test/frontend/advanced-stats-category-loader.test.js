import { describe, expect, it, vi } from 'vitest';
import { loadCategoryStatistics } from '../../src/assets/js/pages/advanced-stats-data-loader.js?v=20260913-advanced-dashboard-v2';

function callbacks() {
    return { setBusy: vi.fn(), setDataStatus: vi.fn(), renderPage: vi.fn() };
}

function state() {
    return {
        api: {
            getOverview: vi.fn().mockResolvedValue({ data: { summary: { attacks: 4 } } }),
            getTrends: vi.fn().mockResolvedValue({ points: [{ date: '2026-09-01', attacks: 4 }] })
        },
        playerTag: '#PLAYER', period: '30d', attackCategory: 'COMPETITIVE', requestVersion: 3,
        overview: { data: { summary: { attacks: 2 } } }, trends: [{ date: '2026-08-01', attacks: 2 }],
        sectionStates: { overview: 'ready', trends: 'ready' }
    };
}

describe('Advanced Stats attack category loader', () => {
    it('reloads overview and trend only with the selected category', async () => {
        const current = state();
        await loadCategoryStatistics({ state: current, requestVersion: 3, ...callbacks() });
        expect(current.api.getOverview).toHaveBeenCalledWith('#PLAYER', '30d', 'COMPETITIVE');
        expect(current.api.getTrends).toHaveBeenCalledWith('#PLAYER', '30d', 'COMPETITIVE');
        expect(current.overview.data.summary.attacks).toBe(4);
        expect(current.trends).toEqual([{ date: '2026-09-01', attacks: 4 }]);
    });

    it('retains scoped data and marks only failed sections stale', async () => {
        const current = state();
        current.api.getTrends.mockRejectedValue(new Error('temporary'));
        await loadCategoryStatistics({ state: current, requestVersion: 3, ...callbacks() });
        expect(current.overview.data.summary.attacks).toBe(4);
        expect(current.trends).toEqual([{ date: '2026-08-01', attacks: 2 }]);
        expect(current.sectionStates).toMatchObject({ overview: 'ready', trends: 'stale' });
    });

    it('does not apply a response for an obsolete request version', async () => {
        const current = state();
        current.requestVersion = 4;
        await loadCategoryStatistics({ state: current, requestVersion: 3, ...callbacks() });
        expect(current.overview.data.summary.attacks).toBe(2);
        expect(current.trends).toEqual([{ date: '2026-08-01', attacks: 2 }]);
    });
});
