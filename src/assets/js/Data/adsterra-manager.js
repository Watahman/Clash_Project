const NATIVE_KEY = 'b6ef4e968b1f1a4390ef24f608b1a36e';
const AD_NETWORK = 'https://www.highrevenueformat.com';
const NATIVE_NETWORK = 'https://pl31261194.profitableratecpmnetwork.com';
const STYLE_ID = 'clashpanel-adsterra-css';
const STYLE_URL = '/assets/css/adsterra.css?v=20260909-adsterra-v1';
const AD_ELIGIBLE_ROUTES = new Set(['/', '/guides', '/guides/fair-cwl-roster', '/guides/cwl-rotation', '/guides/cwl-availability', '/guides/missed-attacks', '/guides/cwl-attack-defense', '/guides/cwl-season-history', '/guides/cwl-bonus-medals', '/guides/spreadsheet-vs-cwl-planner', '/methodology', '/cwl-planner', '/cwl-tracker', '/clan-management', '/bracket-generator', '/minigames', '/about', '/changelog']);
const HARD_EXCLUDED_PREFIXES = ['/app', '/api', '/dashboard', '/subpages'];
const AD_UNITS = Object.freeze({
    native: Object.freeze({ type: 'native', key: NATIVE_KEY, containerId: `container-${NATIVE_KEY}`, width: 0, height: 0, src: `${NATIVE_NETWORK}/${NATIVE_KEY}/invoke.js` }),
    'rectangle-300x250': Object.freeze({ type: 'rectangle-300x250', key: '61a6eb16f5ada2c23381e3dc05d609fa', width: 300, height: 250, src: `${AD_NETWORK}/61a6eb16f5ada2c23381e3dc05d609fa/invoke.js` }),
    'mobile-320x50': Object.freeze({ type: 'mobile-320x50', key: 'fb56e6640ae77dbed5cc52a16d8531a4', width: 320, height: 50, src: `${AD_NETWORK}/fb56e6640ae77dbed5cc52a16d8531a4/invoke.js` }),
    'desktop-728x90': Object.freeze({ type: 'desktop-728x90', key: '674c1dce68ef2c0985ffc5aa5ff5ee07', width: 728, height: 90, src: `${AD_NETWORK}/674c1dce68ef2c0985ffc5aa5ff5ee07/invoke.js` })
});
const LABELS = Object.freeze({ en: 'Advertisement', nl: 'Advertentie', fr: 'Publicité', de: 'Werbung', es: 'Publicidad' });
const GUIDE_ROUTES = new Set([...AD_ELIGIBLE_ROUTES].filter(route => route.startsWith('/guides/')));
const PLACEMENTS = Object.freeze({
    '/': [{ id: 'home-horizontal', type: 'responsive-horizontal', after: '.home3-featured' }, { id: 'home-native', type: 'native', after: '.home3-ecosystem' }], '/guides': [{ id: 'guides-horizontal', type: 'responsive-horizontal', after: '.resource-hero' }, { id: 'guides-native', type: 'native', after: '.guide-library' }], guidesDetail: [{ id: 'guide-detail-horizontal', type: 'responsive-horizontal', after: '.resource-hero' }],
    '/methodology': [{ id: 'methodology-horizontal', type: 'responsive-horizontal', after: '.resource-hero' }, { id: 'methodology-native', type: 'native', after: '#performance' }], '/cwl-planner': [{ id: 'planner-horizontal', type: 'responsive-horizontal', after: '.cp-detail-section' }, { id: 'planner-native', type: 'native', after: '.home-v2-products' }], '/cwl-tracker': [{ id: 'tracker-horizontal', type: 'responsive-horizontal', after: '.cp-detail-section' }, { id: 'tracker-native', type: 'native', after: '.home-v2-products' }], '/clan-management': [{ id: 'clan-horizontal', type: 'responsive-horizontal', after: '.cp-detail-section' }, { id: 'clan-native', type: 'native', after: '.home-v2-products' }],
    '/bracket-generator': [{ id: 'bracket-horizontal', type: 'responsive-horizontal', after: '.bracket-public-products' }], '/minigames': [{ id: 'minigames-horizontal', type: 'responsive-horizontal', before: '.game-shell' }], '/about': [{ id: 'about-horizontal', type: 'responsive-horizontal', after: '.feature-v2-workflow' }], '/changelog': [{ id: 'changelog-horizontal', type: 'responsive-horizontal', after: '#august-4' }]
});
const state = {
    initialized: false,
    nativeClaimed: false,
    slotRecords: new Map(),
    atOptionsQueue: Promise.resolve(),
    consentDenied: false,
    slotSequence: 0
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
function iframeMarkup(unit, slotId) {
    const options = JSON.stringify({ key: unit.key, format: 'iframe', height: unit.height, width: unit.width, params: {} });
    const src = unit.src.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return `<!doctype html><html><body><script>window.atOptions=${options};<\/script><script src="${src}" data-adsterra-slot="${slotId}" onload="parent.postMessage({source:'clashpanel-adsterra',slot:'${slotId}',status:'loaded'},'*')" onerror="parent.postMessage({source:'clashpanel-adsterra',slot:'${slotId}',status:'failed'},'*')"><\/script></body></html>`;
}
function loadAtOptionsFrame(slot, unit, slotId) {
    return new Promise(resolve => {
        const doc = globalThis.document;
        const frame = doc.createElement('iframe');
        frame.className = 'cp-ad-frame';
        frame.width = String(unit.width);
        frame.height = String(unit.height);
        frame.title = adLabel();
        frame.setAttribute('aria-label', adLabel());
        frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
        frame.dataset.adsterraSlot = slotId;
        frame.srcdoc = iframeMarkup(unit, slotId);
        let timer;
        const finish = ok => {
            if (timer) globalThis.window?.clearTimeout(timer);
            globalThis.window?.removeEventListener('message', onMessage);
            frame.removeEventListener('error', onError);
            if (!ok) frame.remove();
            resolve(ok ? frame : null);
        };
        const onMessage = event => {
            if (event.source !== frame.contentWindow || event.data?.source !== 'clashpanel-adsterra' || event.data.slot !== slotId) return;
            finish(event.data.status === 'loaded');
        };
        const onError = () => finish(false);
        globalThis.window?.addEventListener('message', onMessage);
        frame.addEventListener('error', onError, { once: true });
        timer = globalThis.window?.setTimeout(() => finish(false), 10000);
        slot.querySelector('.cp-ad-content')?.append(frame);
    });
}
function queueAtOptionsFrame(slot, unit, slotId) {
    const task = state.atOptionsQueue.then(() => loadAtOptionsFrame(slot, unit, slotId));
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
    content.append(script, container);
    script.addEventListener('error', () => collapseSlot(slot));
    return true;
}
function hasConsent() {
    try { return globalThis.window?.ClashToolsCMP?.hasAdvertisingConsent?.() === true; }
    catch { return false; }
}
function loadSlot(slot) {
    if (!slot || ['loaded', 'loading', 'failed', 'too-narrow'].includes(slot.dataset.adsterraState)) return;
    if (!hasConsent()) return;
    const type = normalizedType(slot.dataset.adsterraSlot);
    const id = slot.dataset.adsterraPlacement || `slot-${state.slotRecords.size + 1}`;
    const unit = type === 'responsive-horizontal' ? chooseHorizontalUnit(slotWidth(slot)) : AD_UNITS[type];
    if (type !== 'native' && !unit) return collapseSlot(slot, 'too-narrow');
    slot.dataset.adsterraState = 'loading';
    slot.hidden = false;
    slot.removeAttribute('aria-hidden');
    if (type === 'native') {
        if (!loadNative(slot)) return collapseSlot(slot);
        slot.dataset.adsterraState = 'loaded';
        state.slotRecords.set(id, slot.dataset.adsterraState);
        return;
    }
    queueAtOptionsFrame(slot, unit, id).then(frame => {
        if (!frame) return collapseSlot(slot);
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
    const placements = PLACEMENTS[path] || (GUIDE_ROUTES.has(path) ? PLACEMENTS.guidesDetail : []);
    const created = [];
    placements.forEach(placement => {
        const anchor = root.querySelector?.(placement.after || placement.before);
        if (!anchor) return;
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
    AD_ELIGIBLE_ROUTES, AD_UNITS, HARD_EXCLUDED_PREFIXES, PLACEMENTS,
    currentPath, isAdRouteEligible, chooseHorizontalUnit, createAdSlot,
    mountAdSlot,
    init: initAdsterraAds
};

if (globalThis.window) globalThis.window.ClashToolsAdManager = api;

export {
    AD_ELIGIBLE_ROUTES, AD_UNITS, HARD_EXCLUDED_PREFIXES, PLACEMENTS,
    currentPath, isAdRouteEligible, chooseHorizontalUnit, createAdSlot, mountAdSlot,
    initAdsterraAds
};
