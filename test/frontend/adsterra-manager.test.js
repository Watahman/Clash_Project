import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

let manager;
let dom;

function publicDocument(path = '/', origin = 'https://clashpanel.com') {
    const main = 'Publisher content '.repeat(100);
    dom = new JSDOM(`<!doctype html><html lang="en"><head>
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="https://clashpanel.com${path}">
    </head><body><main>${main}</main></body></html>`, {
        url: `${origin}${path}`
    });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
}

beforeAll(async () => {
    publicDocument('/');
    manager = await import('../../src/assets/js/Data/adsterra-manager.js');
});

describe('Adsterra manager contracts', () => {
    it('keeps the exact public allowlist and hard exclusions', () => {
        expect(manager.AD_ELIGIBLE_ROUTES.has('/')).toBe(true);
        expect(manager.AD_ELIGIBLE_ROUTES.has('/guides/cwl-rotation')).toBe(true);
        expect(manager.AD_ELIGIBLE_ROUTES.has('/advanced-stats')).toBe(false);
        expect([...manager.APP_AD_ELIGIBLE_ROUTES]).toEqual([
            '/dashboard', '/app/advanced-stats', '/app/achievements',
            '/app/cwl-planner-drafts', '/app/cwl-planner', '/app/cwl-tracker',
            '/app/war-board', '/app/clan-management', '/app/explore',
            '/app/brackets', '/app/minigames'
        ]);
        expect(manager.HARD_EXCLUDED_PREFIXES).toEqual(['/api', '/subpages']);
        expect(manager.isAdRouteEligible('/', document)).toBe(true);
        expect(manager.isAdRouteEligible('/app', document)).toBe(false);
        expect(manager.AD_ELIGIBLE_ROUTES.has('/app/profile')).toBe(false);
        expect(manager.AD_ELIGIBLE_ROUTES.has('/api')).toBe(false);
        expect(manager.AD_ELIGIBLE_ROUTES.has('/subpages/login')).toBe(false);
    });

    it('does not monetize noindex workers.dev preview hosts', () => {
        publicDocument('/', 'https://clashpanel-phase8-preview.example.workers.dev');
        expect(manager.isAdRouteEligible('/', document)).toBe(false);
    });

    it('selects one horizontal unit from the real slot width', () => {
        expect(manager.chooseHorizontalUnit(728).key).toBe('674c1dce68ef2c0985ffc5aa5ff5ee07');
        expect(manager.chooseHorizontalUnit(727).key).toBe('fb56e6640ae77dbed5cc52a16d8531a4');
        expect(manager.chooseHorizontalUnit(319)).toBeNull();
    });

    it('does not inject a provider script while consent is unavailable', () => {
        window.ClashToolsCMP = { hasAdvertisingConsent: () => false };
        const slot = manager.createAdSlot('responsive-horizontal', 'test-horizontal');
        document.querySelector('main').append(slot);
        manager.mountAdSlot(slot);
        expect(slot.querySelector('script[src*="highrevenueformat.com"]')).toBeNull();
    });

    it('keeps the ad wrapper accessible and collapses blocked provider loads', async () => {
        window.ClashToolsCMP = { hasAdvertisingConsent: () => true };
        document.querySelectorAll('[data-adsterra-slot]').forEach(existing => existing.remove());
        const slot = manager.createAdSlot('responsive-horizontal', 'consented-horizontal');
        Object.defineProperty(slot, 'clientWidth', { configurable: true, value: 728 });
        document.querySelector('main').append(slot);
        window.dispatchEvent(new window.CustomEvent('clashtools:ad-consent-changed', {
            detail: { advertisingConsent: true }
        }));
        manager.mountAdSlot(slot);
        await Promise.resolve();
        await Promise.resolve();
        const script = slot.querySelector('script[src*="highrevenueformat.com"]');
        expect(script).not.toBeNull();
        script.dispatchEvent(new window.Event('error'));
        await Promise.resolve();
        await Promise.resolve();
        expect(slot.querySelector('.cp-ad-label').textContent).toBe('Advertisement');
        expect(slot.dataset.adsterraState).toBe('failed');
        expect(slot.hidden).toBe(true);
    });

    it('claims the supplied native container only once per page', () => {
        publicDocument('/');
        window.ClashToolsCMP = { hasAdvertisingConsent: () => true };
        manager.initAdsterraAds();
        const first = manager.createAdSlot('native', 'native-one');
        const second = manager.createAdSlot('native', 'native-two');
        document.querySelector('main').append(first, second);
        manager.mountAdSlot(first);
        manager.mountAdSlot(second);
        expect(document.querySelectorAll('#container-b6ef4e968b1f1a4390ef24f608b1a36e').length).toBeLessThanOrEqual(1);
        expect(document.querySelectorAll('script[data-cfasync="false"]').length).toBeLessThanOrEqual(1);
    });

    it('can restore the single native unit after consent is withdrawn and granted again', () => {
        const first = document.querySelector('[data-adsterra-placement="native-one"]');
        window.ClashToolsCMP = { hasAdvertisingConsent: () => false };
        window.dispatchEvent(new window.CustomEvent('clashtools:ad-consent-changed', {
            detail: { advertisingConsent: false }
        }));
        expect(first.querySelector(`#container-${manager.AD_UNITS.native.key}`)).toBeNull();

        window.ClashToolsCMP = { hasAdvertisingConsent: () => true };
        window.dispatchEvent(new window.CustomEvent('clashtools:ad-consent-changed', {
            detail: { advertisingConsent: true }
        }));
        expect(document.querySelectorAll(`#container-${manager.AD_UNITS.native.key}`)).toHaveLength(1);
    });

    it('keeps bootstrap ownership central and serializes provider completion', () => {
        const adsSource = readFileSync('src/assets/js/Data/ads.js', 'utf8');
        const managerSource = readFileSync('src/assets/js/Data/adsterra-manager.js', 'utf8');
        expect(adsSource).toContain("import(AD_MANAGER_URL)");
        expect(adsSource).not.toContain('const AD_ELIGIBLE_ROUTES');
        expect(managerSource).toContain('STYLE_URL');
        expect(managerSource).toContain('queueAtOptionsBanner');
        expect(managerSource).toContain('APP_AD_ELIGIBLE_ROUTES');
        expect(managerSource).toContain('waitForStandardCreative');
        expect(managerSource).toContain('waitForNativeCreative');
        expect(managerSource).not.toContain("setAttribute('sandbox'");
        expect(managerSource).not.toContain('srcdoc');
        expect(managerSource).not.toContain("setAttribute('loading', 'lazy')");
        expect(managerSource).toContain("script.setAttribute('data-cfasync', 'false')");
    });

    it('injects the versioned stylesheet once for an eligible page', () => {
        publicDocument('/');
        window.ClashToolsCMP = { hasAdvertisingConsent: () => false };
        manager.initAdsterraAds();
        manager.initAdsterraAds();
        expect(document.querySelectorAll('#clashpanel-adsterra-css').length).toBe(1);
        expect(document.querySelector('#clashpanel-adsterra-css').href).toContain('/assets/css/adsterra.css?v=20260910-adsterra-v3');
    });
});
