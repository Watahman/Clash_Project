const CAPABILITY_PATH = '/api/preview-progress-access';
const CAPABILITY_EVENT = 'clashtools:preview-progress-access-changed';
const REQUEST_TIMEOUT_MS = 4000;
const PREVIEW_PROGRESS_MODULES = new Set(['advancedStats', 'achievements']);

let capabilityState = Object.freeze({
    status: 'idle',
    enabled: false,
    identity: ''
});
let capabilityRequest = null;
let capabilityGeneration = 0;

function normalizeIdentity(identity) {
    return String(identity || '').trim();
}

function identityFromAuthState(authState) {
    return normalizeIdentity(authState?.session?.user?.id);
}

function publishCapability(state) {
    const changed = state.enabled !== capabilityState.enabled
        || state.identity !== capabilityState.identity
        || state.status !== capabilityState.status;
    capabilityState = Object.freeze(state);
    if (!changed || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(CAPABILITY_EVENT, {
        detail: capabilityState
    }));
}

async function requestCapability() {
    let controller;
    let timeout;
    try {
        controller = new AbortController();
        timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        const response = await fetch(CAPABILITY_PATH, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: controller.signal
        });
        if (!response.ok) return false;
        const payload = await response.json();
        return payload?.enabled === true;
    } catch {
        return false;
    } finally {
        if (timeout) window.clearTimeout(timeout);
    }
}

export function getPreviewProgressAccess() {
    return capabilityState;
}

export function isPreviewProgressModule(module) {
    return PREVIEW_PROGRESS_MODULES.has(module?.id);
}

export function isPreviewProgressUnlocked(module, enabled = capabilityState.enabled) {
    return isPreviewProgressModule(module) && enabled === true;
}

export function onPreviewProgressAccessChange(callback) {
    if (typeof window === 'undefined') return () => {};
    const listener = event => callback?.(event.detail || capabilityState);
    window.addEventListener(CAPABILITY_EVENT, listener);
    return () => window.removeEventListener(CAPABILITY_EVENT, listener);
}

export function resolvePreviewProgressAccess({ authState, identity, force = false } = {}) {
    const resolvedIdentity = normalizeIdentity(identity) || identityFromAuthState(authState);
    if (authState && (authState.status !== 'authenticated' || !resolvedIdentity)) {
        capabilityGeneration += 1;
        capabilityRequest = null;
        publishCapability({ status: 'resolved', enabled: false, identity: '' });
        return Promise.resolve(capabilityState);
    }
    if (!force && capabilityState.status === 'resolved'
        && capabilityState.identity === resolvedIdentity) {
        return Promise.resolve(capabilityState);
    }
    if (!force && capabilityRequest?.identity === resolvedIdentity) {
        return capabilityRequest.promise;
    }

    const generation = ++capabilityGeneration;
    publishCapability({ status: 'loading', enabled: false, identity: resolvedIdentity });
    const request = {
        identity: resolvedIdentity,
        promise: null
    };
    request.promise = requestCapability().then(enabled => {
        if (generation !== capabilityGeneration || capabilityRequest !== request) {
            return capabilityState;
        }
        const state = { status: 'resolved', enabled, identity: resolvedIdentity };
        publishCapability(state);
        return capabilityState;
    });
    request.promise.then(() => {
        if (capabilityRequest === request) capabilityRequest = null;
    });
    capabilityRequest = request;
    return request.promise;
}

export async function enforcePreviewProgressAccess() {
    const state = await resolvePreviewProgressAccess();
    if (!state.enabled && typeof window !== 'undefined') {
        window.location.replace('/dashboard');
    }
    return state;
}

export { CAPABILITY_EVENT };
