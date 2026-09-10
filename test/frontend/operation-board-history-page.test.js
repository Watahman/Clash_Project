import { describe, expect, it, vi } from 'vitest';

const historyController = vi.hoisted(() => ({
    options: null,
    controller: {
        refreshLabels: vi.fn(),
        getMode: vi.fn(() => 'historical')
    }
}));

vi.mock(
    '../../src/assets/js/operation-board/operation-board-history-controller.js?v=20260910-cwl-history-progressive',
    () => ({
        createOperationBoardHistoryController: options => {
            historyController.options = options;
            return historyController.controller;
        }
    })
);

describe('Operation Board history page', () => {
    it('restores the requested tab after detail rendering changes board identity', async () => {
        const { createOperationBoardHistoryPage } = await import(
            '../../src/assets/js/operation-board/operation-board-history-page.js?v=20260910-cwl-history-progressive'
        );
        const calls = [];
        createOperationBoardHistoryPage({
            refs: {},
            getClan: vi.fn(),
            getCurrentReport: vi.fn(),
            getLatestReport: vi.fn(),
            setLatestReport: report => calls.push(['report', report.season]),
            renderLatestReport: () => calls.push(['render']),
            setActiveTab: vi.fn(),
            selectBoardTab: tab => calls.push(['tab', tab]),
            setState: state => calls.push(['state', state]),
            setHelp: vi.fn(),
            clearBoard: vi.fn()
        });

        historyController.options.onHistoricalDetail(
            { season: '2026-06' },
            'league'
        );

        expect(calls).toEqual([
            ['report', '2026-06'],
            ['render'],
            ['tab', 'league'],
            ['state', 'ready']
        ]);
    });
});
