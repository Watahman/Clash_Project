import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestJson = vi.hoisted(() => vi.fn());

vi.mock('../../src/assets/js/utils/request-json.js?v=20260829-public-auth-v1', () => ({ requestJson }));

describe('historical CWL live refresh', () => {
    beforeEach(() => {
        vi.resetModules();
        requestJson.mockReset();
        window.APP_CONFIG = { API_BASE_URL: '/api' };
    });

    it('forwards force refresh to the backend request', async () => {
        requestJson.mockResolvedValue({ seasons: [] });
        const { loadHistoricalCwlOverview } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260829-public-auth-v1'
        );

        await loadHistoricalCwlOverview('#PQL', {
            limit: 12,
            forceRefresh: true
        });

        expect(requestJson).toHaveBeenCalledWith(
            expect.stringContaining('/api/CWLHistoryOverview?'),
            expect.objectContaining({
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            })
        );
    });
});
