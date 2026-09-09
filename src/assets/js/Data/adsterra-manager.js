import {
    AD_ELIGIBLE_ROUTES, AD_UNITS, APP_AD_ELIGIBLE_ROUTES,
    APP_PLACEMENTS, GUIDE_ROUTES, HARD_EXCLUDED_PREFIXES, LABELS,
    PLACEMENTS
} from './adsterra-config.js';
import {
    hasWorkspaceShell, isAppContentReady, isPlacementReady,
    observeReadiness, waitForNativeCreative, waitForStandardCreative
} from './adsterra-render.js?v=20260910-adsterra-v3';

const STYLE_ID = 'clashpanel-adsterra-css';
const STYLE_URL = '/assets/css/adsterra.css?v=20260910-adsterra-v3';
const state = {
    initialized: false,
    nativeClaimed: false,
    slotRecords: new Map(),
    atOptionsQueue: Promise.resolve(),
    consentDenied: false,
    slotSequence: 0,
    readinessObserver: null,
    nativeSlot: null
};
function currentPath(pathname = globalThis.window?.location?.pathname || '/') {
    return (pathname.replace(/\/+$/, '') || '/').toLowerCase();
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
    const robots = doc?.querySelector('meta[name="robots"]')?.content.toLowerCase() || '';
    const canonical = doc?.querySelector('link[rel="canonical"]')?.href;
    const hostname = globalThis.window?.location?.hostname || '';
    if (hostname.endsWith('.workers.dev')) return false;
    if (robots.includes('noindex') || !canonical) return false;
    try {
        const url = new URL(canonical);
        return url.origin === 'https://clashpanel.com' && currentPath(url.pathname) === path;
    } catch { return false; }
}
function isAdRouteEligible(path = currentPath(), doc = globalThis.document) {
    if (!AD_ELIGIBLE_ROUTES.has(path) || isHardExcluded(path)) return false;
    if (APP_AD_ELIGIBLE_ROUTES.has(path)) return navigationReturnedOk() && hasWorkspaceShell(doc);
    return navigationReturnedOk() && isIndexableCanonicalPage(path, doc) && hasMeaningfulPublisherContent(doc);
}
function languageCode() {
    const language = (globalThis.document?.documentElement?.lang || 'en').slice(0, 2).toLowerCase();
    return LABELS[language] ? language : 'en';
}
function adLabel() { return LABELS[languageCode()]; }
function normalizedType(type) {
    return type === 'responsive' ? 'responsive-horizontal' : type;
}
function slotClass(type) { return normalizedType(type).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''); }
function createAdSlot(type, placementId = '') {
    const doc = globalThis.document;
    if (!doc) return null;
    const slot = doc.createElement('section');
    const normalized = normalizedType(type);
    slot.className = `cp-ad-slot cp-ad-slot--${slotClass(normalized)}`;
    slot.dataset.adsterraSlot = normalized;
    if (placementId) slot.dataset.adsterraPlacement = placementId;
    slot.setAttribute('aria-label', adLabel());
    slot.hidden = true;
    const label = doc.createElement('p');
    label.className = 'cp-ad-label';
    label.textContent = adLabel();
    const content = doc.createElement('div');
    content.className = 'cp-ad-content';
    slot.append(label, content);
    return slot;
}
function setSlotLabel(slot) {
    slot.setAttribute('aria-label', adLabel());
    const label = slot.querySelector('.cp-ad-label');
    if (label) label.textContent = adLabel();
}
function collapseSlot(slot, reason = 'failed') {
    slot.hidden = true;
    slot.dataset.adsterraState = reason;
    slot.setAttribute('aria-hidden', 'true');
    slot.classList.add('is-collapsed');
    if (state.nativeSlot === slot) Object.assign(state, { nativeClaimed: false, nativeSlot: null });
    if (slot.dataset.adsterraPlacement) state.slotRecords.set(slot.dataset.adsterraPlacement, reason);
    const content = slot.querySelector('.cp-ad-content');
    if (content) content.replaceChildren();
}
function slotWidth(slot) {
    const rect = slot.getBoundingClientRect?.();
    const own = rect?.width || slot.clientWidth;
    if (own) return own;
    const parent = slot.parentElement?.getBoundingClientRect?.().width || slot.parentElement?.clientWidth;
    return parent || globalThis.window?.innerWidth || 0;
}
function chooseHorizontalUnit(width) {
    if (width >= AD_UNITS['desktop-728x90'].width) return AD_UNITS['desktop-728x90'];
    if (width >= AD_UNITS['mobile-320x50'].width) return AD_UNITS['mobile-320x50'];
    return null;
}
function loadAtOptionsBanner(slot, unit, slotId) {
    const content = slot.querySelector('.cp-ad-content');
    const win = globalThis.window;
    if (!content || !win || !hasConsent()) return Promise.resolve(false);
    const options = { key: unit.key, format: 'iframe', height: unit.height, width: unit.width, params: {} };
    const previousOptions = win.atOptions;
    const script = document.createElement('script');
    script.async = false;
    script.dataset.cfasync = 'false';
    script.setAttribute('data-cfasync', 'false');
    script.dataset.adsterraProviderFor = slotId;
    script.src = unit.src;
    win.atOptions = options;
    const rendered = waitForStandardCreative(content, script);
    content.append(script);
    return rendered.finally(() => {
        if (win.atOptions !== options) return;
        if (previousOptions === undefined) delete win.atOptions;
        else win.atOptions = previousOptions;
    });
}
function queueAtOptionsBanner(slot, unit, slotId) {
    const task = state.atOptionsQueue.then(() => loadAtOptionsBanner(slot, unit, slotId));
    state.atOptionsQueue = task.catch(() => null);
    return task;
}
function loadNative(slot) {
    if (state.nativeClaimed) return state.nativeSlot === slot;
    const content = slot.querySelector('.cp-ad-content');
    if (!content || document.getElementById(AD_UNITS.native.containerId)) return false;
    state.nativeClaimed = true;
    state.nativeSlot = slot;
    const script = document.createElement('script');
    script.async = true;
    script.dataset.cfasync = 'false';
    script.setAttribute('data-cfasync', 'false');
    script.src = AD_UNITS.native.src;
    const container = document.createElement('div');
    container.id = AD_UNITS.native.containerId;
    const renderPromise = waitForNativeCreative(container, script);
    content.append(script, container);
    return renderPromise.then(ok => {
        if (!ok) state.nativeClaimed = false;
        return ok;
    });
}
function hasConsent() {
    try { return globalThis.window?.ClashToolsCMP?.hasAdvertisingConsent?.() === true; }
    catch { return false; }
}
function loadSlot(slot) {
    if (!slot || ['loaded', 'loading', 'failed', 'too-narrow'].includes(slot.dataset.adsterraState)) return;
    const path = currentPath();
    if (APP_AD_ELIGIBLE_ROUTES.has(path) && !isAppContentReady(path, document)) return;
    if (!hasConsent()) return;
    const type = normalizedType(slot.dataset.adsterraSlot);
    const id = slot.dataset.adsterraPlacement || `slot-${state.slotRecords.size + 1}`;
    const unit = type === 'responsive-horizontal' ? chooseHorizontalUnit(slotWidth(slot)) : AD_UNITS[type];
    if (type !== 'native' && !unit) return collapseSlot(slot, 'too-narrow');
    slot.dataset.adsterraState = 'loading';
    slot.hidden = false;
    slot.removeAttribute('aria-hidden');
    slot.classList.remove('is-collapsed');
    if (type === 'native') {
        Promise.resolve(loadNative(slot)).then(ok => {
            if (!ok) return collapseSlot(slot, 'empty-native');
            slot.dataset.adsterraState = 'loaded';
            state.slotRecords.set(id, slot.dataset.adsterraState);
        });
        return;
    }
    queueAtOptionsBanner(slot, unit, id).then(rendered => {
        if (!rendered) return collapseSlot(slot);
        if (!hasConsent()) return collapseSlot(slot, 'consent-denied');
        slot.dataset.adsterraFormat = unit.type;
        slot.dataset.adsterraState = 'loaded';
        state.slotRecords.set(id, slot.dataset.adsterraState);
    }).catch(() => collapseSlot(slot));
}
function hydrateSlots(root = globalThis.document) {
    if (!hasConsent()) return;
    root.querySelectorAll?.('[data-adsterra-slot]').forEach(slot => {
        setSlotLabel(slot);
        const id = slot.dataset.adsterraPlacement || `slot-${++state.slotSequence}`;
        slot.dataset.adsterraPlacement = id;
        if (state.slotRecords.has(id)) return;
        loadSlot(slot);
    });
}
function insertPlacement(anchor, placement, id) {
    const existing = document.querySelector(`[data-adsterra-placement="${id}"]`);
    if (existing) return existing;
    const sibling = placement.before ? anchor.previousElementSibling : anchor.nextElementSibling;
    if (sibling?.dataset?.adsterraSlot === normalizedType(placement.type)) {
        sibling.dataset.adsterraPlacement = id;
        return sibling;
    }
    const slot = createAdSlot(placement.type, id);
    if (!slot) return null;
    if (placement.before) anchor.before(slot); else anchor.after(slot);
    return slot;
}
function applyConfiguredPlacements(root = globalThis.document) {
    const path = currentPath();
    if (!AD_ELIGIBLE_ROUTES.has(path)) return [];
    const placements = PLACEMENTS[path] || APP_PLACEMENTS[path] || (GUIDE_ROUTES.has(path) ? PLACEMENTS.guidesDetail : []);
    const created = [];
    placements.forEach(placement => {
        const anchor = root.querySelector?.(placement.after || placement.before);
        if (!anchor || !isPlacementReady(path, anchor)) return;
        const slot = insertPlacement(anchor, placement, placement.id);
        if (slot) created.push(slot);
    });
    hydrateSlots(root);
    return created;
}
function onConsentChange(event) {
    state.consentDenied = event?.detail?.advertisingConsent === false;
    if (hasConsent()) {
        document.querySelectorAll('[data-adsterra-slot][data-adsterra-state="consent-denied"]').forEach(slot => {
            state.slotRecords.delete(slot.dataset.adsterraPlacement);
            slot.dataset.adsterraState = '';
            slot.classList.remove('is-collapsed');
        });
        applyConfiguredPlacements();
        hydrateSlots();
    }
    else if (state.consentDenied) document.querySelectorAll('[data-adsterra-slot]').forEach(slot => collapseSlot(slot, 'consent-denied'));
}
function ensureStylesheet() {
    const doc = globalThis.document;
    if (!doc?.head || doc.getElementById(STYLE_ID) || doc.querySelector('link[href*="/assets/css/adsterra.css"]')) return;
    const link = doc.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = STYLE_URL;
    doc.head.append(link);
}
function initAdsterraAds({ root = globalThis.document } = {}) {
    if (!isAdRouteEligible(undefined, root)) return [];
    ensureStylesheet();
    if (!state.initialized) {
        state.initialized = true;
        state.readinessObserver = observeReadiness(root, () => applyConfiguredPlacements(root));
        window.addEventListener('clashtools:cmp-ready', onConsentChange);
        window.addEventListener('clashtools:ad-consent-changed', onConsentChange);
        window.addEventListener('ad-consent-changed', onConsentChange);
        window.addEventListener('clashtools:language-changed', () => {
            document.querySelectorAll('[data-adsterra-slot]').forEach(setSlotLabel);
            applyConfiguredPlacements(root);
        });
    }
    return applyConfiguredPlacements(root);
}
function mountAdSlot(slot, type) {
    if (!slot) return null;
    ensureStylesheet();
    slot.dataset.adsterraSlot = normalizedType(type || slot.dataset.adsterraSlot);
    if (!slot.classList.contains('cp-ad-slot')) slot.classList.add('cp-ad-slot');
    if (!slot.querySelector('.cp-ad-content')) {
        const fresh = createAdSlot(slot.dataset.adsterraSlot, slot.dataset.adsterraPlacement);
        slot.replaceWith(fresh);
        slot = fresh;
    }
    hydrateSlots(slot.parentElement || document);
    return slot;
}

const api = {
    AD_ELIGIBLE_ROUTES, AD_UNITS, APP_AD_ELIGIBLE_ROUTES, APP_PLACEMENTS,
    HARD_EXCLUDED_PREFIXES, PLACEMENTS,
    currentPath, isAdRouteEligible, chooseHorizontalUnit, createAdSlot,
    mountAdSlot,
    init: initAdsterraAds
};

if (globalThis.window) globalThis.window.ClashToolsAdManager = api;

export {
    AD_ELIGIBLE_ROUTES, AD_UNITS, APP_AD_ELIGIBLE_ROUTES, APP_PLACEMENTS,
    HARD_EXCLUDED_PREFIXES, PLACEMENTS,
    currentPath, isAdRouteEligible, chooseHorizontalUnit, createAdSlot, mountAdSlot,
    initAdsterraAds
};
