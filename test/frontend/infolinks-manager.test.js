import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';

const configModule = '../../src/assets/js/Data/infolinks-config.js';
const managerModule = '../../src/assets/js/Data/infolinks-manager.js';
const publicRoutes = Object.freeze([
    '/', '/cwl-planner', '/cwl-tracker', '/clan-management', '/methodology',
    '/guides', '/guides/fair-cwl-roster', '/guides/cwl-rotation',
    '/guides/cwl-availability', '/guides/missed-attacks',
    '/guides/cwl-attack-defense', '/guides/cwl-season-history',
    '/guides/cwl-bonus-medals', '/guides/spreadsheet-vs-cwl-planner',
    '/about', '/bracket-generator'
]);
const scriptSource = 'https://ads.example.test/infolinks.js';

let dom;
let manager;

beforeEach(() => {
    vi.resetModules();
    dom = createDocument('/');
});

afterEach(() => {
    dom?.window.close();
    vi.resetModules();
});

describe('Infolinks manager contracts', () => {
    it('allows only the configured public content routes', async () => {
        manager = await loadManager();
        setConsent(true);

        expect(manager.isAdRouteEligible('/', document)).toBe(true);
        for (const path of ['/guides/cwl-rotation', '/cwl-planner', '/bracket-generator']) {
            createDocument(path);
            expect(manager.isAdRouteEligible(path, document)).toBe(true);
        }
        for (const path of ['/minigames', '/changelog', '/app/minigames', '/subpages/privacy', '/api/ads-context']) {
            createDocument(path);
            expect(manager.isAdRouteEligible(path, document)).toBe(false);
        }
    });

    it('does not append a provider script without advertising consent', async () => {
        manager = await loadManager(enabledConfig());
        setConsent(false);

        await Promise.resolve(manager.initInfolinksAds());

        expect(providerScripts()).toHaveLength(0);
    });

    it('loads one configured provider script at most once after consent', async () => {
        manager = await loadManager(enabledConfig());
        setConsent(true);

        await Promise.resolve(manager.initInfolinksAds());
        await Promise.resolve(manager.initInfolinksAds());

        expect(providerScripts()).toHaveLength(1);
        expect(providerScripts()[0].async).toBe(true);
        expect(providerScripts()[0].defer).toBe(true);
    });

    it('sets the supplied account globals before appending the script to the body', async () => {
        const config = enabledConfig();
        config.initialization.globals = { infolinks_pid: 3447886, infolinks_wsid: 0 };
        manager = await loadManager(config);
        setConsent(true);

        manager.initInfolinksAds();

        expect(window.infolinks_pid).toBe(3447886);
        expect(window.infolinks_wsid).toBe(0);
        expect(document.body.lastElementChild).toBe(providerScripts()[0]);
    });

    it('fails closed when account configuration is missing', async () => {
        manager = await loadManager();
        setConsent(true);

        expect(manager.hasConfiguredIntegration()).toBe(false);
        let thrown;
        try { await Promise.resolve(manager.initInfolinksAds()); } catch (error) { thrown = error; }
        expect(thrown).toBeUndefined();
        expect(providerScripts()).toHaveLength(0);
    });

    it('swallows blocked-provider script errors without an uncaught window error', async () => {
        manager = await loadManager(enabledConfig());
        setConsent(true);
        const uncaught = [];
        window.addEventListener('error', event => uncaught.push(event));

        await Promise.resolve(manager.initInfolinksAds());
        const script = providerScripts()[0];
        expect(script).toBeDefined();
        expect(() => script.dispatchEvent(new window.Event('error'))).not.toThrow();
        await Promise.resolve();

        expect(uncaught).toHaveLength(0);
    });

    it('never creates ad slots or placeholders', async () => {
        manager = await loadManager(enabledConfig());
        setConsent(true);

        await Promise.resolve(manager.initInfolinksAds());

        expect(document.querySelector('[data-infolinks-slot]')).toBeNull();
        expect(document.querySelector('[data-ad-slot]')).toBeNull();
        expect(document.querySelector('.cp-ad-slot, .cp-ad-content')).toBeNull();
    });
});

async function loadManager(config = disabledConfig()) {
    vi.doMock(configModule, () => ({
        AD_ELIGIBLE_ROUTES: new Set(publicRoutes),
        GUIDE_ROUTES: new Set(publicRoutes.filter(route => route.startsWith('/guides/'))),
        HARD_EXCLUDED_PREFIXES: Object.freeze(['/api', '/app', '/subpages']),
        INFOLINKS_CONFIG: config,
        PUBLIC_AD_ELIGIBLE_ROUTES: publicRoutes
    }));
    return import(`${managerModule}?test=${Date.now()}-${Math.random()}`);
}

function disabledConfig() {
    return {
        enabled: false,
        script: { src: '', type: 'text/javascript', async: true, defer: true, attributes: {} },
        initialization: { globals: {} }
    };
}

function enabledConfig() {
    return {
        enabled: true,
        script: { src: scriptSource, type: 'text/javascript', async: true, defer: true, attributes: {} },
        initialization: { globals: {} }
    };
}

function createDocument(path) {
    const main = 'Publisher content '.repeat(100);
    dom = new JSDOM(`<!doctype html><html lang="en"><head>
        <meta name="robots" content="index, follow">
        <link rel="canonical" href="https://clashpanel.com${path}">
    </head><body><main>${main}</main></body></html>`, {
        url: `https://clashpanel.com${path}`
    });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    return dom;
}

function setConsent(value) {
    window.ClashToolsCMP = { hasAdvertisingConsent: () => value };
}

function providerScripts() {
    return [...document.querySelectorAll(`script[src="${scriptSource}"]`)];
}
