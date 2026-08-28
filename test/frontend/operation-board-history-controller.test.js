import { beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
    loadHistoricalCwlSeasons: vi.fn(),
    loadHistoricalCwlSeason: vi.fn(),
    loadHistoricalCwlOverview: vi.fn()
}));

const clanApi = vi.hoisted(() => ({
    getClanInfoRequest: vi.fn()
}));

vi.mock(
    '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260826-cwl-cache-reset',
    () => client
);

vi.mock(
    '../../src/assets/js/API/API-Clan.js?v=20260826-live-refresh',
    () => clanApi
);

describe('Operation Board history controller', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clanApi.getClanInfoRequest.mockResolvedValue({
            warLeague: { id: 48000014, name: 'Master League II' }
        });
        document.body.innerHTML = '<select id="op-season-select"></select>';
        client.loadHistoricalCwlSeasons.mockResolvedValue([
            {
                season: '2026-06',
                league: { name: 'Master League II' }
            }
        ]);
        client.loadHistoricalCwlSeason.mockResolvedValue({
            season: '2026-06',
            clan: { tag: '#PQL', name: 'ClashPanel' },
            league: { name: '' },
            record: { wins: 1, losses: 0, draws: 0 },
            roster: [],
            standings: [],
            wars: [],
            dataQuality: 'Partial history'
        });
        client.loadHistoricalCwlOverview.mockResolvedValue([]);
    });

    it('loads only the season index until a historical season is selected', async () => {
        const { createOperationBoardHistoryController } = await import(
            '../../src/assets/js/operation-board/operation-board-history-controller.js'
        );
        const current = {
            leagueGroup: { season: '2026-07' },
            clan: { tag: '#PQL' }
        };
        const onHistorical = vi.fn();
        const controller = createOperationBoardHistoryController({
            refs: { seasonSelect: document.querySelector('select') },
            getClan: () => ({ tag: '#PQL', name: 'ClashPanel' }),
            getCurrentReport: () => current,
            onCurrent: vi.fn(),
            onHistorical,
            onOverview: vi.fn(),
            onLoading: vi.fn(),
            onError: vi.fn()
        });

        await controller.syncForCurrentReport(current);

        expect(client.loadHistoricalCwlSeasons).toHaveBeenCalledTimes(1);
        expect(client.loadHistoricalCwlSeason).not.toHaveBeenCalled();
        expect(client.loadHistoricalCwlOverview).not.toHaveBeenCalled();
        expect(Array.from(document.querySelector('select').options).map(
            option => option.value
        )).toEqual(['overview', 'current', '2026-06']);

        await controller.selectSeason('2026-06');

        expect(client.loadHistoricalCwlSeason).toHaveBeenCalledWith(
            '#PQL',
            '2026-06',
            expect.objectContaining({ forceRefresh: false })
        );
        expect(onHistorical).toHaveBeenCalledTimes(1);
        expect(onHistorical.mock.calls[0][0].league.name)
            .toBe('Master League II');
        expect(controller.getMode()).toBe('historical');
    });

    it('loads the multi-season batch only when Overview is selected', async () => {
        const { createOperationBoardHistoryController } = await import(
            '../../src/assets/js/operation-board/operation-board-history-controller.js'
        );
        const onOverview = vi.fn();
        const controller = createOperationBoardHistoryController({
            refs: { seasonSelect: document.querySelector('select') },
            getClan: () => ({ tag: '#PQL' }),
            getCurrentReport: () => null,
            onCurrent: vi.fn(),
            onHistorical: vi.fn(),
            onOverview,
            onLoading: vi.fn(),
            onError: vi.fn()
        });

        await controller.syncForCurrentReport(null);
        expect(client.loadHistoricalCwlOverview).not.toHaveBeenCalled();

        await controller.selectSeason('overview');

        expect(client.loadHistoricalCwlOverview).toHaveBeenCalledTimes(1);
        expect(client.loadHistoricalCwlOverview).toHaveBeenCalledWith(
            '#PQL',
            expect.objectContaining({ limit: 24 })
        );
        expect(onOverview).toHaveBeenCalledTimes(1);
    });

    it('selects Overview when no current CWL exists', async () => {
        const { createOperationBoardHistoryController } = await import(
            '../../src/assets/js/operation-board/operation-board-history-controller.js'
        );
        const select = document.querySelector('select');
        const onOverview = vi.fn();
        const controller = createOperationBoardHistoryController({
            refs: { seasonSelect: select },
            getClan: () => ({ tag: '#PQL' }),
            getCurrentReport: () => null,
            onCurrent: vi.fn(),
            onHistorical: vi.fn(),
            onOverview,
            onLoading: vi.fn(),
            onError: vi.fn()
        });

        await controller.syncForCurrentReport(
            null,
            { defaultToOverview: true }
        );

        expect(client.loadHistoricalCwlOverview).toHaveBeenCalledWith(
            '#PQL',
            expect.objectContaining({ forceRefresh: false })
        );
        expect(client.loadHistoricalCwlSeason).not.toHaveBeenCalled();
        expect(controller.getMode()).toBe('overview');
        expect(select.value).toBe('overview');
        expect(select.disabled).toBe(false);
        expect(select.hasAttribute('aria-busy')).toBe(false);
        expect(onOverview).toHaveBeenCalledTimes(1);
    });
});
