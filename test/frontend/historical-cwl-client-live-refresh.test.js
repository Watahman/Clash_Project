import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestJson = vi.hoisted(() => vi.fn());

vi.mock('../../src/assets/js/utils/request-json.js?v=20260910-cwl-history-progressive', () => ({ requestJson }));

describe('historical CWL live refresh', () => {
    beforeEach(() => {
        vi.resetModules();
        requestJson.mockReset();
        window.APP_CONFIG = { API_BASE_URL: '/api' };
    });

    it('forwards force refresh to the backend request', async () => {
        requestJson.mockResolvedValue({ seasons: [] });
        const { loadHistoricalCwlOverview } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive'
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

    it('requests selected-season detail from CWLHistory', async () => {
        requestJson.mockResolvedValue({
            season: { season: '2026-06', wars: [] }
        });
        const { loadHistoricalCwlSeason } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive'
        );

        await loadHistoricalCwlSeason('#PQL', '2026-06');

        expect(requestJson).toHaveBeenCalledWith(
            expect.stringContaining(
                '/api/CWLHistory?clanTag=%23PQL&season=2026-06'
            ),
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('retries season detail after a failed request', async () => {
        requestJson
            .mockRejectedValueOnce(
                Object.assign(new Error('timeout'), { status: 504 })
            )
            .mockResolvedValueOnce({
                season: { season: '2026-06', wars: [{ id: '#WAR' }] }
            });
        const { loadHistoricalCwlSeason } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive'
        );

        await expect(loadHistoricalCwlSeason('#PQL', '2026-06'))
            .rejects.toMatchObject({ status: 504 });
        await expect(loadHistoricalCwlSeason('#PQL', '2026-06'))
            .resolves.toMatchObject({ wars: [{ id: '#WAR' }] });
        expect(requestJson).toHaveBeenCalledTimes(2);
    });

    it('deduplicates identical simultaneous overview requests', async () => {
        const pending = deferred();
        requestJson.mockReturnValue(pending.promise);
        const { loadHistoricalCwlOverview } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive'
        );

        const first = loadHistoricalCwlOverview('#PQL', { limit: 12 });
        const second = loadHistoricalCwlOverview('#PQL', { limit: 12 });
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(requestJson).toHaveBeenCalledTimes(1);
        pending.resolve({ seasons: [] });
        await expect(Promise.all([first, second])).resolves.toEqual([[], []]);
    });

    it('lets a stale caller abort without cancelling the shared request', async () => {
        const pending = deferred();
        requestJson.mockReturnValue(pending.promise);
        const { loadHistoricalCwlSeason } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive'
        );
        const abortController = new AbortController();
        const stale = loadHistoricalCwlSeason('#PQL', '2026-06', {
            signal: abortController.signal
        });
        abortController.abort();
        await expect(stale).rejects.toMatchObject({ name: 'AbortError' });
        expect(requestJson).toHaveBeenCalledTimes(1);
        pending.resolve({ season: { season: '2026-06', wars: [] } });
    });

    it('does not promote an overview response into the detail cache', async () => {
        requestJson
            .mockResolvedValueOnce({
                seasons: [{
                    season: '2026-06',
                    league: { name: 'Master League II' },
                    wars: [{ day: 1 }]
                }]
            })
            .mockResolvedValueOnce({
                season: { season: '2026-06', wars: [] }
            });
        const {
            loadHistoricalCwlOverview,
            loadHistoricalCwlSeason
        } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive'
        );

        await loadHistoricalCwlOverview('#PQL', { limit: 12 });
        await loadHistoricalCwlSeason('#PQL', '2026-06');
        expect(requestJson).toHaveBeenCalledTimes(2);
        expect(requestJson.mock.calls[1][0]).toContain('/CWLHistory?');
    });

    it('does not let an older overview response overwrite a refresh', async () => {
        const stale = deferred();
        const fresh = deferred();
        requestJson.mockImplementation((url, options) =>
            options?.headers?.['Cache-Control'] === 'no-cache'
                ? fresh.promise
                : stale.promise
        );
        const { loadHistoricalCwlOverview } = await import(
            '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive'
        );
        const oldLoad = loadHistoricalCwlOverview('#PQL', { limit: 12 });
        await new Promise(resolve => setTimeout(resolve, 0));
        const refresh = loadHistoricalCwlOverview('#PQL', {
            limit: 12,
            forceRefresh: true
        });
        await new Promise(resolve => setTimeout(resolve, 0));
        fresh.resolve({ seasons: [{ season: '2026-06' }] });
        stale.resolve({ seasons: [{ season: '2026-05' }] });
        await Promise.all([oldLoad, refresh]);

        await expect(loadHistoricalCwlOverview('#PQL', { limit: 12 }))
            .resolves.toEqual([{ season: '2026-06' }]);
        expect(requestJson).toHaveBeenCalledTimes(2);
    });
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });
    return { promise, resolve, reject };
}
