import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderers = vi.hoisted(() => ({
    war: vi.fn(), progression: vi.fn(), league: vi.fn(), tabs: vi.fn()
}));
vi.mock('../../src/assets/js/pages/advanced-stats-insights-renderer.js?v=20260916-advanced-insights-v1', () => ({
    renderWarCwl: renderers.war,
    renderProgression: renderers.progression,
    renderLeague: renderers.league,
    syncInsightTabs: renderers.tabs
}));

import { createInsightsController } from '../../src/assets/js/pages/advanced-stats-insights-controller.js';

const markup = `<div id="advanced-stats-content"><nav id="advanced-stats-tabs">
    <button data-advanced-stats-tab="overview"></button>
    <button data-advanced-stats-tab="warCwl"></button>
    <button data-advanced-stats-tab="progression"></button>
    <button data-advanced-stats-tab="league"></button>
</nav><div id="advanced-stats-war-cwl-root"></div>
<div id="advanced-stats-progression-root"></div>
<div id="advanced-stats-league-root"></div>
<button data-insights-current-season aria-pressed="false"></button></div>`;

let period;
let playerTag;
let read;
let controller;

beforeEach(() => {
    document.body.innerHTML = markup;
    period = '30d';
    playerTag = '#2PYLQ';
    read = vi.fn().mockResolvedValue({ data: { rows: [{ attacks: 3 }] } });
    Object.values(renderers).forEach(mock => mock.mockClear());
    controller = createInsightsController({
        document,
        getPlayerTag: () => playerTag,
        getPeriod: () => period,
        getTracking: () => ({ trackingExists: true }),
        getReader: () => read
    });
    controller.bind();
});

describe('Advanced Stats insight loading', () => {
    it('loads only the selected section and reuses its result on revisit', async () => {
        document.querySelector('[data-advanced-stats-tab="warCwl"]').click();
        await vi.waitFor(() => expect(renderers.war).toHaveBeenCalledWith(
            expect.any(HTMLElement), { data: { rows: [{ attacks: 3 }] } }));
        expect(read).toHaveBeenCalledTimes(1);
        expect(read).toHaveBeenCalledWith('#2PYLQ', '30d', 'warCwl');
        document.querySelector('[data-advanced-stats-tab="overview"]').click();
        document.querySelector('[data-advanced-stats-tab="warCwl"]').click();
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('does not duplicate an in-flight read when a tab is selected twice', () => {
        read.mockReturnValueOnce(new Promise(() => {}));
        const tab = document.querySelector('[data-advanced-stats-tab="warCwl"]');
        tab.click();
        tab.click();
        expect(read).toHaveBeenCalledTimes(1);
    });

    it('discards an old response after account or period reset', async () => {
        let resolveOld;
        read.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
        document.querySelector('[data-advanced-stats-tab="progression"]').click();
        period = '90d';
        controller.reset();
        resolveOld({ data: { rows: [{ delta: 5 }] } });
        await Promise.resolve();
        expect(renderers.progression).not.toHaveBeenLastCalledWith(
            expect.any(HTMLElement), { data: { rows: [{ delta: 5 }] } });
        await controller.refreshActive();
        expect(read).toHaveBeenLastCalledWith('#2PYLQ', '90d', 'progression');
    });

    it('keeps raw request errors out of the rendered section', async () => {
        read.mockRejectedValueOnce(new Error('upstream secret detail'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        document.querySelector('[data-advanced-stats-tab="league"]').click();
        await vi.waitFor(() => expect(renderers.league).toHaveBeenCalledWith(
            expect.any(HTMLElement), { state: 'error' }));
        expect(JSON.stringify(renderers.league.mock.lastCall[1])).not.toContain('secret');
        vi.restoreAllMocks();
    });

    it('uses the latest season request only in the league tab', async () => {
        document.querySelector('[data-advanced-stats-tab="league"]').click();
        await vi.waitFor(() => expect(read).toHaveBeenCalledWith('#2PYLQ', '30d', 'league'));
        const button = document.querySelector('[data-insights-current-season]');
        button.click();
        await vi.waitFor(() => expect(read).toHaveBeenCalledWith('#2PYLQ', 'current-season', 'league'));
        expect(button.getAttribute('aria-pressed')).toBe('true');
        document.querySelector('[data-advanced-stats-tab="warCwl"]').click();
        await vi.waitFor(() => expect(read).toHaveBeenCalledWith('#2PYLQ', '30d', 'warCwl'));
    });
});
