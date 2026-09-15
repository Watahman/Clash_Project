import { _BASE_URL } from '../Data/config.js';
import { requestJson, HttpError, setSessionContextResolver } from '../utils/request-json.js?v=20260829-public-auth-v1';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import {
    buildLoginUrl,
    getCurrentReturnPath,
    getSafeReturnPath,
    redirectToLogin
} from './auth-navigation.js?v=20260915-auth-policy-v1';
import { AuthUnavailableError } from './auth-errors.js?v=20260829-public-auth-v1';
import { installAuthEventListeners } from './auth-event-registry.js?v=20260915-auth-race-v1';
import { createAuthNotifier } from './auth-notifier.js?v=20260915-auth-race-v1';

export const AUTH_TRANSITION = Object.freeze({
    SIGNED_OUT: 'signed-out',
    SESSION_EXPIRED: 'session-expired'
});
const listeners = new Set();
export const AUTH_STATES = Object.freeze({
    LOADING: 'loading',
    GUEST: 'guest',
    AUTHENTICATED: 'authenticated',
    UNAVAILABLE: 'auth-unavailable'
});
export { AuthUnavailableError };
let authState = Object.freeze({
    status: AUTH_STATES.LOADING,
    session: null,
    error: null,
    reason: null,
    cause: null
});
let sessionRequest = null;
let sessionAbortController = null;
let authGeneration = 0;
let explicitSignOutGeneration = null;
function authEndpoint(path) {
    return `${_BASE_URL}${path}`;
}
function safeTranslate(key, params) {
    try { return t(key, params); } catch { return key; }
}
function setAuthState(status, session = null, error = null, {
    reason = null,
    cause = null
} = {}) {
    authState = Object.freeze({ status, session, error, reason, cause });
    listeners.forEach(callback => callback?.(session, authState));
    return authState;
}
function beginAuthTransition() {
    authGeneration += 1;
    invalidateAuthCache();
    sessionAbortController?.abort();
    sessionAbortController = null;
    sessionRequest = null;
    return authGeneration;
}
function isCurrentGeneration(generation) {
    return generation === authGeneration;
}
const { invalidate: invalidateAuthCache, notify } = createAuthNotifier({
    getGeneration: () => authGeneration,
    isCurrentGeneration
});
export function getAuthRequestContext() {
    return Object.freeze({
        generation: authGeneration,
        userId: authState.session?.user?.id || null
    });
}
setSessionContextResolver?.(getAuthRequestContext);
function handleAuthSessionExpired(event) {
    const requestGeneration = event?.detail?.authGeneration;
    if (Number.isFinite(requestGeneration) && requestGeneration !== authGeneration) return;
    if (requestGeneration === explicitSignOutGeneration) return;
    const generation = beginAuthTransition();
    setAuthState(AUTH_STATES.GUEST, null, null, {
        reason: AUTH_TRANSITION.SESSION_EXPIRED,
        cause: 'expired-401'
    });
    void notify(null, {
        generation,
        clearAll: true,
        cacheAlreadyInvalidated: true
    }).catch(() => {});
}
async function requestAuthState(generation, signal) {
    try {
        const data = await requestJson(authEndpoint('/AuthSession'), {
            method: 'POST',
            body: {},
            loading: 'background',
            loadingMessage: safeTranslate('common.loading'),
            signal,
            sessionBound: true,
            authGeneration: generation
        });
        if (!isCurrentGeneration(generation)) return authState;
        const session = data?.session || null;
        await notify(session, { generation });
        if (!isCurrentGeneration(generation)) return authState;
        return setAuthState(
            session ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.GUEST,
            session
        );
    } catch (error) {
        if (!isCurrentGeneration(generation) || error?.name === 'AbortError') return authState;
        if (error instanceof HttpError && error.status === 401) {
            await notify(null, { generation });
            if (!isCurrentGeneration(generation)) return authState;
            return setAuthState(AUTH_STATES.GUEST, null, null, {
                reason: AUTH_TRANSITION.SESSION_EXPIRED,
                cause: 'expired-401'
            });
        }
        return setAuthState(AUTH_STATES.UNAVAILABLE, null, new AuthUnavailableError(error));
    }
}

export function getAuthState() {
    return authState;
}
export function isAuthenticated() {
    return authState.status === AUTH_STATES.AUTHENTICATED && Boolean(authState.session);
}
export async function resolveAuthState({ force = false } = {}) {
    if (sessionRequest) return sessionRequest;
    if (!force && authState.status !== AUTH_STATES.LOADING) return authState;
    const generation = authGeneration;
    const controller = new AbortController();
    sessionAbortController = controller;
    const request = requestAuthState(generation, controller.signal);
    sessionRequest = request;
    try {
        return await request;
    } finally {
        if (sessionAbortController === controller) sessionAbortController = null;
        if (sessionRequest === request) sessionRequest = null;
    }
}
export async function syncAuthSession() {
    const state = await resolveAuthState();
    if (state.status === AUTH_STATES.UNAVAILABLE) throw state.error;
    return state.session;
}
export async function signInWithPassword(email, password) {
    const generation = beginAuthTransition();
    const data = await requestJson(authEndpoint('/AuthLogin'), {
        body: {
            email: String(email || '').trim(),
            password
        },
        loading: 'blocking',
        loadingMessage: safeTranslate('auth.signingIn')
    });
    if (!isCurrentGeneration(generation)) return data;
    await notify(data.session || null, {
        generation,
        cacheAlreadyInvalidated: true
    });
    if (isCurrentGeneration(generation)) setAuthState(
        data.session ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.GUEST,
        data.session || null
    );
    return data;
}
export async function signUpWithPassword(name, email, password) {
    const generation = beginAuthTransition();
    const data = await requestJson(authEndpoint('/AuthSignup'), {
        body: {
            name: String(name || '').trim(),
            email: String(email || '').trim(),
            password
        },
        loading: 'blocking',
        loadingMessage: safeTranslate('auth.creatingAccount')
    });
    if (!isCurrentGeneration(generation)) return data;
    await notify(data.session || null, {
        generation,
        cacheAlreadyInvalidated: true
    });
    if (isCurrentGeneration(generation)) setAuthState(
        data.session ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.GUEST,
        data.session || null
    );
    return data;
}
export async function requestPasswordReset(email) {
    return requestJson(authEndpoint('/AuthRecover'), {
        body: {
            email: String(email || '').trim()
        },
        loadingMessage: safeTranslate('common.loading')
    });
}
export async function changeAuthenticatedPassword(
    currentPassword,
    newPassword
) {
    return requestJson(authEndpoint('/AuthChangePassword'), {
        body: {
            currentPassword,
            newPassword
        },
        loading: 'blocking',
        loadingMessage: safeTranslate('settings.changingPassword'),
        sessionBound: true,
        authGeneration: getAuthRequestContext().generation
    });
}
export async function signOut() {
    const generation = beginAuthTransition();
    explicitSignOutGeneration = generation;
    try {
        await requestJson(authEndpoint('/AuthLogout'), {
            body: {},
            loadingMessage: safeTranslate('common.loading'),
            sessionBound: true,
            authGeneration: generation
        });
    } finally {
        if (isCurrentGeneration(generation)) {
            await notify(null, {
                generation,
                clearAll: true,
                cacheAlreadyInvalidated: true
            });
            if (isCurrentGeneration(generation)) setAuthState(AUTH_STATES.GUEST, null, null, {
                reason: AUTH_TRANSITION.SIGNED_OUT,
                cause: 'explicit-sign-out'
            });
        }
        if (explicitSignOutGeneration === generation) explicitSignOutGeneration = null;
    }
}
export function onAuthStateChange(callback) {
    listeners.add(callback);
    if (authState.status === AUTH_STATES.LOADING) void resolveAuthState().catch(() => {});
    else callback?.(authState.session, authState);

    return () => listeners.delete(callback);
}
function handlePersistedPageShow(event) {
    if (!event?.persisted) return;
    beginAuthTransition();
    setAuthState(AUTH_STATES.LOADING);
    void resolveAuthState({ force: true }).catch(() => {});
}
installAuthEventListeners({
    onSessionExpired: handleAuthSessionExpired,
    onPersistedPageShow: handlePersistedPageShow
});
export async function requireAuthForAction({
    action,
    reason = '',
    returnTo = getCurrentReturnPath(),
    onGuest
    } = {}) {
    const state = await resolveAuthState({ force: true });
    if (state.status === AUTH_STATES.UNAVAILABLE) throw state.error;
    if (state.status === AUTH_STATES.GUEST) {
        const loginUrl = buildLoginUrl(getSafeReturnPath(returnTo));
        const context = { state, reason, returnTo: getSafeReturnPath(returnTo), loginUrl };
        if (typeof onGuest === 'function') await onGuest(context);
        else redirectToLogin(context.returnTo);
        return { ...context, executed: false };
    }

    const result = typeof action === 'function' ? await action(state.session) : undefined;
    return { state, session: state.session, result, executed: true };
}
export {
    buildLoginUrl,
    getCurrentReturnPath,
    getSafeReturnPath,
    redirectToLogin
};
export async function getGoogleSignInUrl(next = '/dashboard') {
    const data = await requestJson(authEndpoint('/AuthGoogle'), {
        body: { next },
        loading: 'blocking',
        loadingMessage: safeTranslate('auth.redirecting')
    });
    if (!data?.url) {
        throw new HttpError(safeTranslate('auth.googleInvalidRedirect'), {
            code: 'INVALID_GOOGLE_AUTH_RESPONSE'
        });
    }
    return data.url;
}
export async function signInWithGoogle(next = '/dashboard', location = window.location) {
    location.replace(await getGoogleSignInUrl(next));
}
