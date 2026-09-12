import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseRequestWithBody = vi.hoisted(() => vi.fn());

vi.mock('../../src/assets/js/Supabase/Supabase-Client.js?v=20260912-advanced-dashboard-v1', () => ({ databaseRequestWithBody }));

import {
    attackCategoryScope,
    getAdvancedStatsLifetime,
    getAdvancedStatsOverview,
    getAdvancedStatsTrends
} from '../../src/assets/js/Supabase/Supabase-AdvancedStats.js?v=20260912-advanced-dashboard-v1';

beforeEach(() => {
    databaseRequestWithBody.mockReset().mockResolvedValue({});
    window.APP_CONFIG = { API_BASE_URL: 'https://api.example.test' };
});

describe('Advanced Stats scoped API client', () => {
    it('maps only supported attack categories to backend scopes', () => {
        expect(attackCategoryScope('ALL')).toBeNull();
        expect(attackCategoryScope('regular')).toBe('regular');
        expect(attackCategoryScope('competitive')).toBe('competitive');
        expect(attackCategoryScope('unclassified')).toBeNull();
    });

    it('omits scope for All while forwarding period', async () => {
        await getAdvancedStatsOverview('#PLAYER', '90d', 'ALL');
        expect(databaseRequestWithBody).toHaveBeenCalledWith(
            '/AdvancedStatsOverview',
            { playerTag: '#PLAYER', period: '90d' },
            null,
            { loading: 'background' }
        );
    });

    it('uses regular and competitive scopes for overview and trend reads', async () => {
        await getAdvancedStatsOverview('#PLAYER', '30d', 'REGULAR');
        await getAdvancedStatsTrends('#PLAYER', '30d', 'COMPETITIVE');
        expect(databaseRequestWithBody.mock.calls[0][1]).toEqual({ playerTag: '#PLAYER', period: '30d', scope: 'regular' });
        expect(databaseRequestWithBody.mock.calls[1][1]).toEqual({ playerTag: '#PLAYER', period: '30d', scope: 'competitive' });
    });

    it('loads lifetime data with a player-only body', async () => {
        await getAdvancedStatsLifetime('#PLAYER');
        expect(databaseRequestWithBody.mock.calls[0][0]).toBe('/AdvancedStatsLifetime');
        expect(databaseRequestWithBody.mock.calls[0][1]).toEqual({ playerTag: '#PLAYER' });
    });
});
