import * as authClient from '../auth/auth-client.js?v=20260829-public-auth-v1';

const STORAGE_PREFIX = 'clashpanel:planner';
const LEGACY_KEYS = Object.freeze({
    cache: 'clashtools_planner_cache',
    recovery: 'clashtools_planner_recovery_v1',
    active: 'planner_id',
    players: 'clashtools_last_planner_players'
});

let authContext = null;
let fallbackUserId = '';
let authStateProvided = false;
let authGeneration = 0;
let authIdentity = '';
let authUnsubscribe;

export function configurePlannerAuth(options = {}) {
    authContext = options.authState ?? null;
    fallbackUserId = options.fallbackUserId || '';
    authStateProvided = options.authState !== undefined;
    authGeneration = 0;
    authIdentity = '';
}

export function hasCloudPlannerAccess(state = authContext, fallback = fallbackUserId) {
    if (authStateProvided || state) {
        return state?.status === 'authenticated' && Boolean(state.session?.user?.id);
    }
    return Boolean(fallback);
}

export function getCloudPlannerUserId(state = authContext, fallback = fallbackUserId) {
    if (!hasCloudPlannerAccess(state, fallback)) return '';
    return String(state?.session?.user?.id || fallback || '').trim();
}

export function getPlannerAuthIdentity(state = authContext) {
    const status = state?.status || 'guest';
    return `${status}:${getCloudPlannerUserId(state, '')}`;
}

export function getPlannerAuthGeneration() {
    return authGeneration;
}

export function getPlannerStorageKey(kind, userId = getCloudPlannerUserId()) {
    if (!LEGACY_KEYS[kind]) return null;
    if (!authStateProvided) return LEGACY_KEYS[kind];
    if (!userId) return null;
    return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${kind}`;
}

export function updatePlannerAuth(state) {
    authContext = state || null;
    fallbackUserId = '';
    authStateProvided = true;
}

export function matchesPlannerAuth(userId, generation) {
    if (generation != null && generation !== authGeneration) return false;
    return Boolean(userId) && userId === getCloudPlannerUserId();
}

export function isCurrentPlannerGeneration(generation) {
    return generation == null || generation === authGeneration;
}

export function bindPlannerAuthTransitions(initialState, onTransition) {
    authIdentity = getPlannerAuthIdentity(initialState);
    if (initialState === undefined) return;
    const subscribe = getAuthStateListener();
    if (typeof subscribe !== 'function') return;
    authUnsubscribe?.();
    authUnsubscribe = subscribe((session, state) => {
        const nextState = state || {
            status: session ? 'authenticated' : 'guest', session
        };
        const nextIdentity = getPlannerAuthIdentity(nextState);
        if (nextIdentity === authIdentity) return;
        authIdentity = nextIdentity;
        authGeneration += 1;
        updatePlannerAuth(nextState);
        window.dispatchEvent(new CustomEvent('clashtools:planner-auth-state-changed', {
            detail: nextState
        }));
        onTransition?.(nextState);
    });
}

function getAuthStateListener() {
    try {
        return authClient.onAuthStateChange;
    } catch {
        return null;
    }
}
