import { describe, expect, it, vi } from 'vitest';
import {
    ActiveCwlWarError
} from '../../src/assets/js/war-operation-board/war-report-model.js?v=20260829-public-auth-v1';
import {
    createWarLoadController
} from '../../src/assets/js/war-operation-board/war-page-loader.js?v=20260829-public-auth-v1';

describe('War page load controller', () => {
    it('exposes loading state and commits a current-war response', async () => {
        const deferredWar = deferred();
        const harness = createHarness({
            fetchCurrentWar: () => deferredWar.promise
        });

        const load = harness.controller.load();
        expect(harness.refs.refresh.disabled).toBe(true);
        expect(harness.refs.content.hidden).toBe(true);
        expect(harness.refs.empty.hidden).toBe(false);
        expect(harness.status).toHaveBeenCalledWith('Loading current war…');

        deferredWar.resolve({ id: 'live-war' });
        await load;

        expect(harness.controller.getState().report.id).toBe('live-war');
        expect(harness.refs.content.hidden).toBe(false);
        expect(harness.refs.refresh.disabled).toBe(false);
        expect(harness.renderCurrent).toHaveBeenCalledTimes(2);
    });

    it('ignores a stale response after a newer request starts', async () => {
        const warResponses = [];
        const harness = createHarness({
            fetchCurrentWar: () => {
                const response = deferred();
                warResponses.push(response);
                return response.promise;
            }
        });

        const firstLoad = harness.controller.load();
        const secondLoad = harness.controller.load();
        warResponses[0].resolve({ id: 'stale-war' });
        await Promise.resolve();
        warResponses[1].resolve({ id: 'fresh-war' });
        await Promise.all([firstLoad, secondLoad]);

        expect(harness.controller.getState().report.id).toBe('fresh-war');
        expect(harness.renderCurrent).toHaveBeenCalledTimes(2);
        expect(harness.buildReport).toHaveBeenCalledTimes(1);
    });

    it('clears the board and preserves the CWL handoff for active league wars', async () => {
        const harness = createHarness({
            buildReport: () => {
                throw new ActiveCwlWarError();
            }
        });

        await harness.controller.load();

        expect(harness.controller.getState()).toEqual({
            report: null,
            historyData: null
        });
        expect(harness.refs.empty.hidden).toBe(false);
        expect(harness.refs.content.hidden).toBe(true);
        expect(harness.status).toHaveBeenCalledWith(
            expect.stringContaining('currently in a CWL war'),
            true,
            true
        );
        expect(harness.setEmpty).toHaveBeenLastCalledWith(
            harness.refs.empty,
            'This clan is in an active CWL war',
            expect.stringContaining('Continue in CWL Tracker'),
            true
        );
    });

    it('shows history when no current regular war is available', async () => {
        const harness = createHarness({
            buildReport: () => ({ id: 'empty', wars: [], clan: { tag: '#CLAN' } })
        });

        await harness.controller.load();

        expect(harness.selectHistoryTab).toHaveBeenCalledTimes(1);
        expect(harness.refs.content.hidden).toBe(false);
        expect(harness.status).toHaveBeenLastCalledWith(
            'This clan is not in a public regular Clan War. Recent history is still available.'
        );
    });

    it('keeps the live report visible when historical enrichment fails', async () => {
        const harness = createHarness({
            enrichReport: () => Promise.reject(new Error('History unavailable'))
        });

        await harness.controller.load();

        expect(harness.controller.getState().report.id).toBe('live-war');
        expect(harness.refs.content.hidden).toBe(false);
        expect(harness.refs.empty.hidden).toBe(true);
        expect(harness.status).toHaveBeenLastCalledWith(
            'Historical performance could not be loaded.',
            true
        );
    });
});

function createHarness(overrides = {}) {
    const refs = {
        refresh: document.createElement('button'),
        content: document.createElement('section'),
        empty: document.createElement('section')
    };
    const status = vi.fn();
    const setEmpty = vi.fn();
    const renderCurrent = vi.fn();
    const selectHistoryTab = vi.fn();
    const buildReport = vi.fn(
        raw => ({ id: raw.id, wars: [{}], clan: { tag: '#CLAN' } })
    );
    const controller = createWarLoadController({
        refs,
        getSelectedTag: () => '#CLAN',
        setStatus: status,
        setEmpty,
        renderCurrent,
        selectHistoryTab,
        fetchCurrentWar: () => Promise.resolve({ id: 'live-war' }),
        fetchWarLog: () => Promise.resolve([]),
        buildReport,
        buildHistory: () => ({ wars: [] }),
        enrichReport: report => Promise.resolve(report),
        ...overrides
    });
    return {
        buildReport,
        controller,
        refs,
        renderCurrent,
        selectHistoryTab,
        setEmpty,
        status
    };
}

function deferred() {
    let resolve;
    const promise = new Promise(nextResolve => {
        resolve = nextResolve;
    });
    return { promise, resolve };
}
