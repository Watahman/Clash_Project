import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const modulePath = '../../src/assets/js/analytics/product-analytics.js';

beforeEach(() => {
    vi.resetModules();
    window.history.replaceState({}, '', '/');
    delete window.navigator.sendBeacon;
    window.APP_CONFIG = { API_BASE_URL: '/api' };
    window.sessionStorage.clear();
    window.localStorage.clear();
    delete window.__clashpanel_product_analytics_opened_tools;
    delete window.__clashpanel_product_analytics_pageview_sent;
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}'))));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('central product analytics', () => {
    it('sends a sanitized pageview once and keeps product events allowlisted', async () => {
        window.history.replaceState({}, '', '/?token=secret#private');
        const analytics = await import(modulePath);

        expect(fetch).toHaveBeenCalledTimes(1);
        const pageview = JSON.parse(fetch.mock.calls[0][1].body);
        expect(pageview.event).toBe('$pageview');
        expect(pageview.properties).toEqual({
            $current_url: 'http://localhost:3000/'
        });
        expect(pageview.anonymous_id).toEqual(expect.any(String));
        expect(pageview.anonymous_internal).toBe(false);
        expect(analytics.trackPageView()).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);

        fetch.mockClear();
        expect(analytics.captureProductEvent('button_clicked', { tool: 'cwl_planner' }))
            .toBe(false);
        expect(fetch).not.toHaveBeenCalled();

        expect(analytics.captureProductEvent('core_action_completed', {
            tool: 'cwl_planner',
            action: 'plan_created',
            mode: 'manual',
            source: 'ui',
            email: 'tester@example.com',
            tag: '#ABC123',
            response: { secret: true },
            user_id: 'must-not-be-sent'
        })).toBe(true);

        const [url, options] = fetch.mock.calls[0];
        const payload = JSON.parse(options.body);
        expect(url).toBe('/api/ProductAnalytics');
        expect(options.keepalive).toBe(true);
        expect(payload.event).toBe('core_action_completed');
        expect(payload.properties).toEqual({
            tool: 'cwl_planner',
            action: 'plan_created',
            mode: 'manual',
            source: 'ui'
        });
        expect(payload).not.toHaveProperty('user_id');
        expect(payload.anonymous_id).toBe(pageview.anonymous_id);
        expect(payload.anonymous_internal).toBe(false);
    });

    it('keeps one anonymous id in memory and respects the internal flag', async () => {
        window.localStorage.setItem('clashpanel_analytics_internal', 'true');
        const analytics = await import(modulePath);
        fetch.mockClear();

        analytics.trackLoadSucceeded({ entity_type: 'clan', result_status: 'ready' });
        analytics.trackLoadFailed({ entity_type: 'clan', result_status: 'error' });

        const first = JSON.parse(fetch.mock.calls[0][1].body);
        const second = JSON.parse(fetch.mock.calls[1][1].body);
        expect(first.anonymous_id).toBe(second.anonymous_id);
        expect(window.sessionStorage).toHaveLength(0);
        expect(first.anonymous_internal).toBe(true);
        expect(second.anonymous_internal).toBe(true);
    });

    it('prefers sendBeacon and falls back to keepalive fetch', async () => {
        const beacon = vi.fn(() => true);
        Object.defineProperty(window.navigator, 'sendBeacon', {
            configurable: true,
            value: beacon
        });
        const analytics = await import(modulePath);
        expect(beacon).toHaveBeenCalledTimes(1);
        beacon.mockClear();
        fetch.mockClear();

        analytics.trackDataSaved({ tool: 'cwl_planner', outcome: 'saved' });
        expect(beacon).toHaveBeenCalledTimes(1);
        expect(fetch).not.toHaveBeenCalled();

        beacon.mockReturnValue(false);
        analytics.trackDataSaved({ tool: 'cwl_planner', outcome: 'saved' });
        expect(beacon).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('maps canonical tools and aliases and opens a tool only once per page', async () => {
        expect((await import(modulePath)).getToolForPath('/cwl-planner.html'))
            .toBe('cwl_planner');
        const analytics = await import(modulePath);
        expect(analytics.getToolForPath('/app/cwl-tracker')).toBe('cwl_tracker');
        expect(analytics.getToolForPath('/subpages/groups.html')).toBe('clan_family');
        expect(analytics.getToolForPath('/advanced-stats')).toBe('advanced_stats');
        expect(analytics.getToolForPath('/subpages/achievements')).toBe('achievements');
        expect(analytics.getToolForPath('/bracket-generator')).toBe('bracket_generator');
        expect(analytics.getToolForPath('/app/minigames')).toBe('minigames');
        fetch.mockClear();

        window.history.replaceState({}, '', '/app/cwl-planner');
        expect(analytics.initializeProductAnalytics()).toBe(true);
        expect(analytics.initializeProductAnalytics()).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetch.mock.calls[0][1].body).properties.tool).toBe('cwl_planner');
    });

    it('swallows transport failures and rejects non-primitive properties', async () => {
        fetch.mockImplementation(() => { throw new Error('offline'); });
        const analytics = await import(modulePath);

        expect(() => analytics.trackTagSubmitted({
            entity_type: { type: 'player' },
            action: ['submit'],
            source: 'ui'
        })).not.toThrow();
        expect(analytics.trackTagSubmitted({ source: 'ui' })).toBe(false);
    });
});
