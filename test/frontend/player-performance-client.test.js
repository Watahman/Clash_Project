import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMocks = vi.hoisted(() => ({
    requestJson: vi.fn()
}));

vi.mock('../../src/assets/js/utils/request-json.js?v=20260829-public-auth-v1', () => requestMocks);

describe('player performance batch client', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <main class="workspace-planner">
                <article class="cwl-player-article" data-planner-card="true" data-player-tag="#P0L"></article>
                <article class="cwl-player-article" data-planner-card="true" data-player-tag="#P2Y"></article>
            </main>`;
        const module = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');
        module.clearPlayerPerformanceCache();
    });

    it('loads all missing planner players in one request and reuses the result', async () => {
        requestMocks.requestJson.mockResolvedValue({
            results: {
                '#P0L': { playerTag: '#P0L', status: 'ready', performance: 101 },
                '#P2Y': { playerTag: '#P2Y', status: 'ready', performance: 98 }
            }
        });
        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');

        client.schedulePlayerPerformanceBatch(client.collectPlannerPlayerTags());
        await client.flushPlayerPerformanceBatch();

        expect(requestMocks.requestJson).toHaveBeenCalledTimes(1);
        expect(requestMocks.requestJson.mock.calls[0][1].body).toEqual({
            playerTags: ['#P0L', '#P2Y']
        });
        expect(client.getPlayerPerformance('#P0L').performance).toBe(100);

        client.schedulePlayerPerformanceBatch(['#P0L', '#P2Y']);
        await client.flushPlayerPerformanceBatch();
        expect(requestMocks.requestJson).toHaveBeenCalledTimes(1);
    });

    it('keeps planner initialization lazy until performance is requested', async () => {
        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');

        client.initPlayerPerformanceClient();

        await Promise.resolve();
        expect(requestMocks.requestJson).not.toHaveBeenCalled();
    });

    it('loads the complete roster only for an explicit Auto Plan request', async () => {
        requestMocks.requestJson.mockResolvedValue({
            results: {
                '#P0L': { playerTag: '#P0L', status: 'ready', performance: 101 },
                '#P2Y': { playerTag: '#P2Y', status: 'ready', performance: 98 }
            }
        });
        const planner = document.querySelector('.workspace-planner');
        planner.replaceChildren();
        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');
        client.initPlayerPerformanceClient();
        planner.innerHTML = `
            <article class="cwl-player-article" data-planner-card="true"
                     data-player-tag="#P0L"></article>
            <article class="cwl-player-article" data-planner-card="true"
                     data-player-tag="#P2Y"></article>`;

        window.dispatchEvent(new CustomEvent('clashtools:cwl-plan-loaded'));

        await Promise.resolve();
        expect(requestMocks.requestJson).not.toHaveBeenCalled();

        await client.loadPlayerPerformanceBatch(['#P0L', '#P2Y']);
        await vi.waitFor(() => expect(requestMocks.requestJson).toHaveBeenCalledTimes(1));
        expect(requestMocks.requestJson.mock.calls[0][1].body.playerTags).toEqual([
            '#P0L',
            '#P2Y'
        ]);
    });

    it('sends large explicit batches sequentially in bounded chunks', async () => {
        const tags = Array.from({ length: 45 }, (_, index) => `#P${index.toString(36)}L`);
        let activeRequests = 0;
        let maximumActiveRequests = 0;
        requestMocks.requestJson.mockImplementation(async (_url, options) => {
            activeRequests += 1;
            maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
            const results = Object.fromEntries(options.body.playerTags.map(tag => [
                tag,
                { playerTag: tag, status: 'ready', performance: 90 }
            ]));
            activeRequests -= 1;
            return { results };
        });

        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');
        await client.loadPlayerPerformanceBatch(tags);

        expect(requestMocks.requestJson).toHaveBeenCalledTimes(3);
        expect(requestMocks.requestJson.mock.calls.map(call => call[1].body.playerTags.length))
            .toEqual([20, 20, 5]);
        expect(maximumActiveRequests).toBe(1);
    });

    it('keeps successful chunks when a later chunk fails', async () => {
        const tags = Array.from({ length: 21 }, (_, index) => `#P${index.toString(36)}L`);
        requestMocks.requestJson
            .mockResolvedValueOnce({
                results: Object.fromEntries(tags.slice(0, 20).map(tag => [
                    tag,
                    { playerTag: tag, status: 'ready', performance: 90 }
                ]))
            })
            .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'NETWORK_ERROR' }));

        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');
        const result = await client.loadPlayerPerformanceBatch(tags);

        expect(result[tags[0]].status).toBe('ready');
        expect(result[tags[20].toUpperCase()]).toMatchObject({ status: 'unavailable' });
    });

    it('stores neutral unavailable results when the batch fails', async () => {
        requestMocks.requestJson.mockRejectedValue(Object.assign(
            new Error('offline'),
            { code: 'NETWORK_ERROR' }
        ));
        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');

        client.schedulePlayerPerformanceBatch(['#P0L']);
        await client.flushPlayerPerformanceBatch();

        expect(client.getPlayerPerformance('#P0L')).toMatchObject({
            status: 'unavailable',
            reliabilityMessage: 'insufficient_tracked_participation'
        });
    });

    it('does not enqueue a player again while its batch is still running', async () => {
        let resolveRequest;
        requestMocks.requestJson.mockReturnValue(new Promise(resolve => {
            resolveRequest = resolve;
        }));
        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');

        client.schedulePlayerPerformanceBatch(['#P0L']);
        const runningBatch = client.flushPlayerPerformanceBatch();
        client.schedulePlayerPerformanceBatch(['#P0L']);
        await client.flushPlayerPerformanceBatch();

        expect(requestMocks.requestJson).toHaveBeenCalledTimes(1);
        resolveRequest({
            results: {
                '#P0L': { playerTag: '#P0L', status: 'ready', performance: 103 }
            }
        });
        await runningBatch;
        expect(client.getPlayerPerformance('#P0L').performance).toBe(100);
    });

    it('shares one request between concurrent batch consumers', async () => {
        let resolveRequest;
        requestMocks.requestJson.mockReturnValue(new Promise(resolve => {
            resolveRequest = resolve;
        }));
        const client = await import('../../src/assets/js/cwl/player-performance-client.js?v=20260829-public-auth-v1');

        const firstConsumer = client.loadPlayerPerformanceBatch(['#P0L']);
        await vi.waitFor(() => expect(requestMocks.requestJson).toHaveBeenCalledTimes(1));
        const secondConsumer = client.loadPlayerPerformanceBatch(['#P0L']);

        resolveRequest({
            results: {
                '#P0L': { playerTag: '#P0L', status: 'ready', performance: 104 }
            }
        });

        const [firstResult, secondResult] = await Promise.all([firstConsumer, secondConsumer]);
        expect(firstResult['#P0L'].performance).toBe(100);
        expect(secondResult['#P0L'].performance).toBe(100);
        expect(requestMocks.requestJson).toHaveBeenCalledTimes(1);
    });
});
