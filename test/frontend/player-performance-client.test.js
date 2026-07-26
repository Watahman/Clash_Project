import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestMocks = vi.hoisted(() => ({
    requestJson: vi.fn()
}));

vi.mock('../../src/assets/js/utils/request-json.js', () => requestMocks);

describe('player performance batch client', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <main class="workspace-planner">
                <article class="cwl-player-article" data-planner-card="true" data-player-tag="#P0L"></article>
                <article class="cwl-player-article" data-planner-card="true" data-player-tag="#P2Y"></article>
            </main>`;
        const module = await import('../../src/assets/js/cwl/player-performance-client.js');
        module.clearPlayerPerformanceCache();
    });

    it('loads all missing planner players in one request and reuses the result', async () => {
        requestMocks.requestJson.mockResolvedValue({
            results: {
                '#P0L': { playerTag: '#P0L', status: 'ready', performance: 101 },
                '#P2Y': { playerTag: '#P2Y', status: 'ready', performance: 98 }
            }
        });
        const client = await import('../../src/assets/js/cwl/player-performance-client.js');

        client.schedulePlayerPerformanceBatch(client.collectPlannerPlayerTags());
        await client.flushPlayerPerformanceBatch();

        expect(requestMocks.requestJson).toHaveBeenCalledTimes(1);
        expect(requestMocks.requestJson.mock.calls[0][1].body).toEqual({
            playerTags: ['#P0L', '#P2Y']
        });
        expect(client.getPlayerPerformance('#P0L').performance).toBe(101);

        client.schedulePlayerPerformanceBatch(['#P0L', '#P2Y']);
        await client.flushPlayerPerformanceBatch();
        expect(requestMocks.requestJson).toHaveBeenCalledTimes(1);
    });

    it('stores neutral unavailable results when the batch fails', async () => {
        requestMocks.requestJson.mockRejectedValue(Object.assign(
            new Error('offline'),
            { code: 'NETWORK_ERROR' }
        ));
        const client = await import('../../src/assets/js/cwl/player-performance-client.js');

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
        const client = await import('../../src/assets/js/cwl/player-performance-client.js');

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
        expect(client.getPlayerPerformance('#P0L').performance).toBe(103);
    });
});
