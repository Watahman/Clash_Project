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
    '../../src/assets/js/operation-board/historical-cwl-client.js?v=20260910-cwl-history-progressive',
    () => client
);

vi.mock(
    '../../src/assets/js/API/API-Clan.js?v=20260910-cwl-history-progressive',
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

    it('renders a season preview before requesting historical details', async () => {
        const { createOperationBoardHistoryController } = await import(
            '../../src/assets/js/operation-board/operation-board-history-controller.js?v=20260910-cwl-history-progressive'
        );
        const current = {
            leagueGroup: { season: '2026-07' },
            clan: { tag: '#PQL' }
        };
        const onHistorical = vi.fn();
        const onHistoricalDetail = vi.fn();
        const controller = createOperationBoardHistoryController({
            refs: { seasonSelect: document.querySelector('select') },
            getClan: () => ({ tag: '#PQL', name: 'ClashPanel' }),
            getCurrentReport: () => current,
            onCurrent: vi.fn(),
            onHistorical,
            onHistoricalDetail,
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

        expect(client.loadHistoricalCwlSeason).not.toHaveBeenCalled();
        expect(onHistorical).toHaveBeenCalledTimes(1);
        expect(onHistorical.mock.calls[0][0].league.name)
            .toBe('Master League II');
        expect(onHistorical.mock.calls[0][0].historyPreview).toBe(true);
        expect(controller.getMode()).toBe('historical');

        await controller.ensureDetailForTab('league');
        expect(client.loadHistoricalCwlSeason).toHaveBeenCalledWith(
            '#PQL',
            '2026-06',
            expect.objectContaining({ forceRefresh: false })
        );
        expect(onHistoricalDetail).toHaveBeenCalledTimes(1);
        await controller.ensureDetailForTab('roster');
        expect(client.loadHistoricalCwlSeason).toHaveBeenCalledTimes(1);
    });

    it('loads the multi-season batch only when Overview is selected', async () => {
        const { createOperationBoardHistoryController } = await import(
            '../../src/assets/js/operation-board/operation-board-history-controller.js?v=20260910-cwl-history-progressive'
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
            '../../src/assets/js/operation-board/operation-board-history-controller.js?v=20260910-cwl-history-progressive'
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

        expect(client.loadHistoricalCwlSeasons).toHaveBeenCalledTimes(1);
        expect(client.loadHistoricalCwlOverview).not.toHaveBeenCalled();
        expect(client.loadHistoricalCwlSeason).not.toHaveBeenCalled();
        expect(controller.getMode()).toBe('overview');
        expect(select.value).toBe('overview');
        expect(select.disabled).toBe(false);
        expect(select.hasAttribute('aria-busy')).toBe(false);
        expect(onOverview).toHaveBeenCalledTimes(1);
    });

    it('aborts stale detail work when seasons switch rapidly', async () => {
        const { createOperationBoardHistoryController } = await import(
            '../../src/assets/js/operation-board/operation-board-history-controller.js?v=20260910-cwl-history-progressive'
        );
        const first = deferred();
        const second = deferred();
        client.loadHistoricalCwlSeasons.mockResolvedValue([
            { season: '2026-06', league: { name: 'Master League II' } },
            { season: '2026-05', league: { name: 'Master League III' } }
        ]);
        document.body.innerHTML = `
            <select id="op-season-select"></select>
            <button data-op-tab="league"></button>
            <button data-op-tab="roster"></button>
        `;
        const signals = [];
        client.loadHistoricalCwlSeason.mockImplementation((tag, season, options) => {
            signals.push(options.signal);
            return season === '2026-06' ? first.promise : second.promise;
        });
        const onHistoricalDetail = vi.fn();
        const controller = createOperationBoardHistoryController({
            refs: {
                seasonSelect: document.querySelector('select'),
                tabButtons: document.querySelectorAll('[data-op-tab]')
            },
            getClan: () => ({ tag: '#PQL' }),
            getCurrentReport: () => null,
            onCurrent: vi.fn(),
            onHistorical: vi.fn(),
            onHistoricalDetail,
            onOverview: vi.fn(),
            onLoading: vi.fn(),
            onError: vi.fn()
        });

        await controller.syncForCurrentReport(null);
        await controller.selectSeason('2026-06');
        const staleLoad = controller.ensureDetailForTab('league');
        expect(document.querySelector('[data-op-tab="league"]')
            .getAttribute('aria-busy')).toBe('true');
        await controller.selectSeason('2026-05');
        expect(document.querySelector('[data-op-tab="league"]')
            .getAttribute('aria-busy')).toBe('false');
        first.resolve(detail('2026-06'));
        await staleLoad;

        expect(signals[0].aborted).toBe(true);
        expect(onHistoricalDetail).not.toHaveBeenCalled();

        const currentLoad = controller.ensureDetailForTab('roster');
        second.resolve(detail('2026-05'));
        await currentLoad;
        expect(onHistoricalDetail).toHaveBeenCalledTimes(1);
        expect(onHistoricalDetail.mock.calls[0][0].season).toBe('2026-05');
    });

    it('keeps the summary preview visible when detail loading fails', async () => {
        const { createOperationBoardHistoryController } = await import(
            '../../src/assets/js/operation-board/operation-board-history-controller.js?v=20260910-cwl-history-progressive'
        );
        const onHistorical = vi.fn();
        const onDetailError = vi.fn();
        client.loadHistoricalCwlSeason.mockRejectedValueOnce(
            Object.assign(new Error('gateway timeout'), { status: 504 })
        );
        const controller = createOperationBoardHistoryController({
            refs: { seasonSelect: document.querySelector('select') },
            getClan: () => ({ tag: '#PQL' }),
            getCurrentReport: () => null,
            onCurrent: vi.fn(),
            onHistorical,
            onOverview: vi.fn(),
            onLoading: vi.fn(),
            onDetailError,
            onError: vi.fn()
        });

        await controller.syncForCurrentReport(null);
        await controller.selectSeason('2026-06');
        await controller.ensureDetailForTab('league');

        expect(onHistorical).toHaveBeenCalledTimes(1);
        expect(onHistorical.mock.calls[0][0].historyPreview).toBe(true);
        expect(onDetailError).toHaveBeenCalledWith(
            expect.objectContaining({ status: 504 }),
            'league'
        );
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

function detail(season) {
    return {
        season,
        clan: { tag: '#PQL', name: 'ClashPanel' },
        league: { name: 'Master League II' },
        record: { wins: 1, losses: 0, draws: 0 },
        roster: [],
        standings: [],
        wars: [],
        dataQuality: 'Partial history'
    };
}
