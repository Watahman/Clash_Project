import {
    AD_ELIGIBLE_ROUTES,
    HARD_EXCLUDED_PREFIXES,
    INFOLINKS_CONFIG
} from './infolinks-config.js';

const SCRIPT_ID = 'clashpanel-infolinks-script';
const state = {
    initialized: false,
    loading: false,
    script: null
};

function currentPath(pathname = globalThis.window?.location?.pathname || '/') {
    return (String(pathname || '/').replace(/\/+$/, '') || '/').toLowerCase();
}

function isTopLevelPage() {
    if (!globalThis.window) return false;
    try { return globalThis.window?.top === globalThis.window?.self; }
    catch { return false; }
}

function isHardExcluded(path) {
    return HARD_EXCLUDED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function navigationReturnedOk() {
    const navigation = globalThis.performance?.getEntriesByType?.('navigation')?.[0];
    return !navigation?.responseStatus || navigation.responseStatus === 200;
}

function hasMeaningfulPublisherContent(doc = globalThis.document) {
    const main = doc?.querySelector('main');
    if (!main || main.hidden || main.getAttribute('aria-busy') === 'true') return false;
    if (doc.body?.matches('.workspace-app, .auth-page, .error-page')) return false;
    if (main.matches('[data-loading="true"], [data-empty="true"], [data-error="true"]')) return false;
    return (main.textContent || '').replace(/\s+/g, ' ').trim().length >= 800;
}

function isIndexableCanonicalPage(path, doc = globalThis.document) {
    const robots = doc?.querySelector('meta[name="robots"]')?.content?.toLowerCase() || '';
    const canonical = doc?.querySelector('link[rel="canonical"]')?.href;
    const hostname = globalThis.window?.location?.hostname || '';
    if (hostname.endsWith('.workers.dev') || robots.includes('noindex') || !canonical) return false;
    try {
        const url = new URL(canonical);
        return url.origin === 'https://clashpanel.com' && currentPath(url.pathname) === path;
    } catch { return false; }
}

function isAdRouteEligible(path = currentPath(), doc = globalThis.document) {
    const normalized = currentPath(path);
    return isTopLevelPage()
        && AD_ELIGIBLE_ROUTES.has(normalized)
        && !isHardExcluded(normalized)
        && navigationReturnedOk()
        && isIndexableCanonicalPage(normalized, doc)
        && hasMeaningfulPublisherContent(doc);
}

function hasConsent() {
    try { return globalThis.window?.ClashToolsCMP?.hasAdvertisingConsent?.() === true; }
    catch { return false; }
}

function configuredScriptUrl() {
    const source = String(INFOLINKS_CONFIG.script?.src || '').trim();
    if (!INFOLINKS_CONFIG.enabled || !source) return null;
    try {
        const url = new URL(source, globalThis.window?.location?.origin);
        return url.protocol === 'https:' ? url.href : null;
    } catch { return null; }
}

function hasConfiguredIntegration() {
    return Boolean(configuredScriptUrl());
}

function copyConfiguredGlobals() {
    const globals = INFOLINKS_CONFIG.initialization?.globals;
    if (!globals || typeof globals !== 'object') return;
    Object.entries(globals).forEach(([name, value]) => {
        if (!/^[$A-Z_a-z][$\w]*$/.test(name) || name === '__proto__') return;
        try { globalThis.window[name] = value; } catch { /* Provider globals are optional. */ }
    });
}

function applyScriptAttributes(script) {
    const settings = INFOLINKS_CONFIG.script || {};
    if (settings.type) script.type = settings.type;
    if (settings.async) script.async = true;
    if (settings.defer) script.defer = true;
    Object.entries(settings.attributes || {}).forEach(([name, value]) => {
        if (name && value !== undefined && value !== null) script.setAttribute(name, String(value));
    });
}

function removeProviderScript() {
    state.script?.remove?.();
    state.script = null;
    state.loading = false;
}

function onScriptError() {
    state.loading = false;
    state.script = null;
}

function createProviderScript(doc, source) {
    const script = doc.createElement('script');
    script.id = SCRIPT_ID;
    script.dataset.infolinksProvider = 'true';
    script.src = source;
    applyScriptAttributes(script);
    script.addEventListener('error', onScriptError, { once: true });
    return script;
}

function canLoad(root) {
    return isTopLevelPage()
        && hasConsent()
        && hasConfiguredIntegration()
        && isAdRouteEligible(undefined, root);
}

function findExistingScript(root) {
    return root?.querySelector?.(`#${SCRIPT_ID}, script[data-infolinks-provider="true"]`) || null;
}

function appendProviderScript(root) {
    const doc = root?.ownerDocument || root;
    const source = configuredScriptUrl();
    if (!doc?.body || !source) return false;
    const existing = findExistingScript(doc);
    if (existing) {
        state.script = existing;
        state.loading = false;
        return true;
    }
    copyConfiguredGlobals();
    const script = createProviderScript(doc, source);
    state.script = script;
    state.loading = true;
    doc.body.append(script);
    return true;
}

function bindConsentEvents() {
    if (state.initialized) return;
    state.initialized = true;
    globalThis.window?.addEventListener('clashtools:ad-consent-changed', onConsentChange);
    globalThis.window?.addEventListener('ad-consent-changed', onConsentChange);
}

function onConsentChange(event) {
    if (event?.detail?.advertisingConsent === false) return removeProviderScript();
    if (event?.detail?.advertisingConsent === true) initInfolinksAds();
}

function initInfolinksAds({ root = globalThis.document } = {}) {
    bindConsentEvents();
    if (!canLoad(root)) return false;
    if (state.loading || state.script?.isConnected) return true;
    return appendProviderScript(root);
}

const api = {
    AD_ELIGIBLE_ROUTES,
    HARD_EXCLUDED_PREFIXES,
    currentPath,
    hasConfiguredIntegration,
    init: initInfolinksAds,
    initInfolinksAds,
    isAdRouteEligible
};

if (globalThis.window) globalThis.window.ClashToolsInfolinks = api;

export {
    AD_ELIGIBLE_ROUTES,
    HARD_EXCLUDED_PREFIXES,
    currentPath,
    hasConfiguredIntegration,
    initInfolinksAds,
    isAdRouteEligible
};
