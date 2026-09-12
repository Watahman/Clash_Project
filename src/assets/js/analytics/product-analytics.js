const PRODUCT_EVENTS = Object.freeze([
    'tool_opened',
    'tag_submitted',
    'entity_load_succeeded',
    'entity_load_failed',
    'core_action_completed',
    'data_saved',
    'account_created',
    'tracking_enabled'
]);

const PROPERTY_KEYS = Object.freeze([
    'tool',
    'action',
    'entity_type',
    'mode',
    'outcome',
    'result_status',
    'source'
]);
const EVENT_SET = new Set(PRODUCT_EVENTS);
const PROPERTY_SET = new Set(PROPERTY_KEYS);
const INTERNAL_FLAG_KEY = 'clashpanel_analytics_internal';
const OPENED_TOOLS_KEY = '__clashpanel_product_analytics_opened_tools';
const MAX_VALUE_LENGTH = 80;

const TOOL_ROUTE_GROUPS = Object.freeze({
    cwl_planner: Object.freeze([
        '/app/cwl-planner', '/app/cwl-planner.html', '/app/cwl-planner-drafts',
        '/cwl-planner', '/cwl-planner.html', '/cwl-planner-drafts',
        '/subpages/cwl-planner', '/subpages/cwl-planner.html',
        '/subpages/cwl-planner-drafts', '/subpages/cwl-planner-drafts.html'
    ]),
    cwl_tracker: Object.freeze([
        '/app/cwl-tracker', '/app/cwl-tracker.html', '/app/cwl-operation-board',
        '/app/cwl-operation-board.html', '/app/war-board', '/app/war-operation-board',
        '/app/war-operation-board.html', '/cwl-tracker', '/cwl-tracker.html',
        '/war-board', '/war-operation-board', '/subpages/cwl-operation-board',
        '/subpages/cwl-operation-board.html', '/subpages/war-operation-board',
        '/subpages/war-operation-board.html'
    ]),
    clan_family: Object.freeze([
        '/app/clan-management', '/app/clan-management.html', '/app/groups',
        '/app/groups.html', '/clan-management', '/clan-management.html',
        '/groups', '/subpages/groups', '/subpages/groups.html'
    ]),
    advanced_stats: Object.freeze([
        '/app/advanced-stats', '/app/advanced-stats.html', '/advanced-stats',
        '/advanced-stats.html', '/subpages/advanced-stats', '/subpages/advanced-stats.html'
    ]),
    achievements: Object.freeze([
        '/app/achievements', '/app/achievements.html', '/achievements',
        '/achievements.html', '/subpages/achievements', '/subpages/achievements.html'
    ]),
    bracket_generator: Object.freeze([
        '/app/brackets', '/app/brackets.html', '/app/bracket-generator',
        '/app/bracket-generator.html', '/brackets', '/brackets.html',
        '/bracket-generator', '/bracket-generator.html', '/subpages/bracket-generator',
        '/subpages/bracket-generator.html'
    ]),
    minigames: Object.freeze([
        '/app/minigames', '/app/minigames.html', '/minigames', '/minigames.html',
        '/subpages/minigames', '/subpages/minigames.html'
    ])
});

const ROUTE_TOOL_MAP = Object.freeze(Object.entries(TOOL_ROUTE_GROUPS).reduce(
    (routes, [tool, paths]) => {
        paths.forEach(path => { routes[path] = tool; });
        return routes;
    }, {})
);
let memoryAnonymousId = '';
function browser() {
    return typeof window !== 'undefined' ? window : globalThis;
}
function readStorage(storage, key) {
    try {
        return storage?.getItem(key) || '';
    } catch {
        return '';
    }
}
function writeStorage(storage, key, value) {
    try {
        storage?.setItem(key, value);
    } catch {
        // Private browsing and blocked storage must not disable analytics.
    }
}

function getStorage(name) {
    try {
        return browser()[name] || null;
    } catch {
        return null;
    }
}

function randomIdentifier() {
    try {
        if (typeof globalThis.crypto?.randomUUID === 'function') {
            return globalThis.crypto.randomUUID();
        }
        if (typeof globalThis.crypto?.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            globalThis.crypto.getRandomValues(bytes);
            return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        }
    } catch {
        // Fall through to the non-sensitive, best-effort fallback.
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getAnonymousId() {
    if (memoryAnonymousId) return memoryAnonymousId;
    memoryAnonymousId = randomIdentifier();
    return memoryAnonymousId;
}

function isInternalTrafficFlagSet() {
    const value = readStorage(getStorage('localStorage'), INTERNAL_FLAG_KEY).toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(value);
}

function hasSensitiveFormat(value) {
    return /[\r\n]/.test(value)
        || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)
        || /(?:^|\s)#[a-z0-9]{3,15}(?:$|\s)/i.test(value)
        || /(?:bearer\s+|eyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)/i.test(value)
        || /(?:[?&](?:token|code|key|secret|password)=|https?:\/\/)/i.test(value);
}

function safePropertyValue(value) {
    if (typeof value === 'string') {
        const normalized = value.trim();
        if (!normalized || normalized.length > MAX_VALUE_LENGTH || hasSensitiveFormat(normalized)) {
            return undefined;
        }
        return normalized;
    }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e6) {
        return value;
    }
    return undefined;
}

function sanitizeProperties(properties) {
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};
    const safe = {};
    Object.entries(properties).forEach(([key, value]) => {
        if (!PROPERTY_SET.has(key)) return;
        const normalized = safePropertyValue(value);
        if (normalized !== undefined) safe[key] = normalized;
    });
    return safe;
}

function analyticsEndpoint() {
    const configured = String(browser().APP_CONFIG?.API_BASE_URL || '/api').trim();
    return `${configured.replace(/\/+$/, '')}/ProductAnalytics`;
}

function sendBeaconPayload(endpoint, body) {
    try {
        const currentBrowser = browser();
        const sendBeacon = currentBrowser.navigator?.sendBeacon;
        if (typeof sendBeacon !== 'function') return false;
        return Boolean(sendBeacon.call(currentBrowser.navigator, endpoint, new Blob([body], {
            type: 'application/json'
        })));
    } catch {
        return false;
    }
}

function sendKeepalivePayload(endpoint, body) {
    try {
        const currentBrowser = browser();
        const fetchFunction = currentBrowser.fetch || globalThis.fetch;
        if (typeof fetchFunction !== 'function') return false;
        const request = fetchFunction.call(currentBrowser, endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true
        });
        Promise.resolve(request).catch(() => {});
        return true;
    } catch {
        return false;
    }
}

function dispatch(payload) {
    const body = JSON.stringify(payload);
    const endpoint = analyticsEndpoint();
    if (sendBeaconPayload(endpoint, body)) return true;
    return sendKeepalivePayload(endpoint, body);
}

export function captureProductEvent(event, properties = {}) {
    try {
        if (!EVENT_SET.has(event)) return false;
        const payload = {
            event,
            properties: sanitizeProperties(properties),
            anonymous_id: getAnonymousId(),
            anonymous_internal: isInternalTrafficFlagSet()
        };
        return dispatch(payload);
    } catch {
        return false;
    }
}

export function trackTagSubmitted(properties = {}) {
    return captureProductEvent('tag_submitted', properties);
}

export function trackLoadSucceeded(properties = {}) {
    return captureProductEvent('entity_load_succeeded', properties);
}

export function trackLoadFailed(properties = {}) {
    return captureProductEvent('entity_load_failed', properties);
}

export function trackCoreAction(properties = {}) {
    return captureProductEvent('core_action_completed', properties);
}

export function trackDataSaved(properties = {}) {
    return captureProductEvent('data_saved', properties);
}

export function trackAccountCreated(properties = {}) {
    return captureProductEvent('account_created', properties);
}

export function trackTrackingEnabled(properties = {}) {
    return captureProductEvent('tracking_enabled', properties);
}

function normalizePath(pathname) {
    const value = String(pathname || '').trim().split(/[?#]/)[0].toLowerCase();
    if (!value) return '/';
    return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

export function getToolForPath(pathname = browser().location?.pathname) {
    return ROUTE_TOOL_MAP[normalizePath(pathname)] || null;
}

export function trackToolOpened(tool) {
    if (!tool || !Object.values(ROUTE_TOOL_MAP).includes(tool)) return false;
    const currentBrowser = browser();
    let openedTools = currentBrowser[OPENED_TOOLS_KEY];
    if (!(openedTools instanceof Set)) {
        openedTools = new Set();
        try {
            currentBrowser[OPENED_TOOLS_KEY] = openedTools;
        } catch {
            // A non-extensible global is unusual; this call still remains safe.
        }
    }
    if (openedTools.has(tool)) return false;
    const sent = captureProductEvent('tool_opened', { tool });
    if (sent) openedTools.add(tool);
    return sent;
}

export function initializeProductAnalytics(pathname = browser().location?.pathname) {
    const tool = getToolForPath(pathname);
    return tool ? trackToolOpened(tool) : false;
}

export function setInternalTraffic(enabled) {
    writeStorage(getStorage('localStorage'), INTERNAL_FLAG_KEY, enabled ? 'true' : 'false');
}

export {
    INTERNAL_FLAG_KEY,
    PRODUCT_EVENTS,
    PROPERTY_KEYS,
    ROUTE_TOOL_MAP
};

if (typeof window !== 'undefined') {
    initializeProductAnalytics();
}
