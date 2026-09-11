import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
    loadHistoricalCwlSeasons: vi.fn(),
    loadHistoricalCwlSeason: vi.fn(),
    loadHistoricalCwlOverview: vi.fn()
}));
const clanApi = vi.hoisted(() => ({ getClanInfoRequest: vi.fn() }));

vi.mock(
    '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive',
    () => client
);
vi.mock(
    '../../src/assets/js/API/API-Clan.js?v=20260910-cwl-history-progressive',
    () => clanApi
);

describe('Operation Board history synchronization races', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '<select id="op-season-select"></select>';
        clanApi.getClanInfoRequest.mockResolvedValue({
            warLeague: { name: 'Crystal League I' }
        });
    });

    it('clears the season busy state when a clan reset aborts loading', async () => {
        const pending = deferred();
        client.loadHistoricalCwlSeasons.mockReturnValueOnce(pending.promise);
        const select = document.querySelector('select');
        const controller = await createController(() => ({ tag: '#PQL' }));

        const sync = controller.syncForCurrentReport(null);
        await Promise.resolve();
        expect(select.getAttribute('aria-busy')).toBe('true');

        controller.resetForClan();
        expect(select.hasAttribute('aria-busy')).toBe(false);
        expect(select.disabled).toBe(true);
        pending.resolve([]);
        await sync;
    });

    it('does not let an older index sync overwrite the current clan', async () => {
        const oldIndex = deferred();
        client.loadHistoricalCwlSeasons
            .mockReturnValueOnce(oldIndex.promise)
            .mockResolvedValueOnce([{ season: '2026-08' }]);
        let clan = { tag: '#OLD' };
        const controller = await createController(() => clan);

        const staleSync = controller.syncForCurrentReport(null);
        clan = { tag: '#NEW' };
        await controller.syncForCurrentReport(null);
        oldIndex.resolve([{ season: '2026-07' }]);
        await staleSync;

        expect(controller.getSeasonIndex().map(item => item.season))
            .toEqual(['2026-08']);
    });
});

async function createController(getClan) {
    const { createOperationBoardHistoryController } = await import(
        '../../src/assets/js/operation-board/operation-board-history-controller.js?v=20260910-cwl-history-progressive'
    );
    return createOperationBoardHistoryController({
        refs: { seasonSelect: document.querySelector('select') },
        getClan,
        getCurrentReport: () => null,
        onCurrent: vi.fn(),
        onHistorical: vi.fn(),
        onOverview: vi.fn(),
        onLoading: vi.fn(),
        onError: vi.fn()
    });
}

function deferred() {
    let resolve;
    const promise = new Promise(nextResolve => {
        resolve = nextResolve;
    });
    return { promise, resolve };
}
