import { _BASE_URL } from '../Data/config.js';
import { requestJson, HttpError, setSessionContextResolver } from '../utils/request-json.js?v=20260829-public-auth-v1';
import { clearCachePrefix, clearPrivateCache, invalidatePrivateCache } from '../cache/local-cache.js?v=20260829-public-auth-v1';
import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import {
    buildLoginUrl,
    getCurrentReturnPath,
    getSafeReturnPath,
    redirectToLogin
} from './auth-navigation.js?v=20260829-public-auth-v1';
import { AuthUnavailableError } from './auth-errors.js?v=20260829-public-auth-v1';

const LEGACY_USER_ID_KEY = 'id';
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
    error: null
});
let sessionRequest = null;
let sessionAbortController = null;
let authGeneration = 0;

function authEndpoint(path) {
    return `${_BASE_URL}${path}`;
}

function rememberUser(user) {
    if (user?.id) {
        localStorage.setItem(LEGACY_USER_ID_KEY, user.id);
    } else {
        localStorage.removeItem(LEGACY_USER_ID_KEY);
    }
}

async function clearSessionCache() {
    if (typeof clearPrivateCache === 'function') {
        await clearPrivateCache();
        return;
    }
    await clearCachePrefix('');
}

async function notify(session, { clearAll = false, cacheAlreadyInvalidated = false } = {}) {
    const previousUserId = localStorage.getItem(LEGACY_USER_ID_KEY) || '';
    const nextUserId = session?.user?.id || '';
    if (clearAll || previousUserId !== nextUserId) {
        if (!cacheAlreadyInvalidated) invalidatePrivateCache?.();
        await clearSessionCache();
    }
    rememberUser(session?.user);
}

function setAuthState(status, session = null, error = null) {
    authState = Object.freeze({ status, session, error });
    listeners.forEach(callback => callback?.(session, authState));
    return authState;
}

function beginAuthTransition() {
    authGeneration += 1;
    invalidatePrivateCache?.();
    sessionAbortController?.abort();
    sessionAbortController = null;
    return authGeneration;
}

function isCurrentGeneration(generation) {
    return generation === authGeneration;
}

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
    beginAuthTransition();
    setAuthState(AUTH_STATES.GUEST);
    void notify(null, { clearAll: true, cacheAlreadyInvalidated: true }).catch(() => {});
}

async function requestAuthState(generation, signal) {
    try {
        const data = await requestJson(authEndpoint('/AuthSession'), {
            method: 'POST',
            body: {},
            loading: 'background',
            signal,
            sessionBound: true,
            authGeneration: generation
        });

        if (!isCurrentGeneration(generation)) return authState;
        const session = data?.session || null;
        await notify(session);
        if (!isCurrentGeneration(generation)) return authState;
        return setAuthState(
            session ? AUTH_STATES.AUTHENTICATED : AUTH_STATES.GUEST,
            session
        );
    } catch (error) {
        if (!isCurrentGeneration(generation) || error?.name === 'AbortError') return authState;
        if (error instanceof HttpError && error.status === 401) {
            await notify(null);
            if (!isCurrentGeneration(generation)) return authState;
            return setAuthState(AUTH_STATES.GUEST);
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
    sessionRequest = requestAuthState(generation, controller.signal);
    try {
        return await sessionRequest;
    } finally {
        if (sessionAbortController === controller) sessionAbortController = null;
        if (sessionRequest) sessionRequest = null;
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
        loadingMessage: t('auth.signingIn')
    });

    if (!isCurrentGeneration(generation)) return data;
    await notify(data.session || null, { cacheAlreadyInvalidated: true });
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
        loadingMessage: t('auth.creatingAccount')
    });

    if (!isCurrentGeneration(generation)) return data;
    await notify(data.session || null, { cacheAlreadyInvalidated: true });
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
        }
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
        loadingMessage: t('settings.changingPassword'),
        sessionBound: true,
        authGeneration: getAuthRequestContext().generation
    });
}

export async function signOut() {
    const generation = beginAuthTransition();
    try {
        await requestJson(authEndpoint('/AuthLogout'), {
            body: {},
            sessionBound: true,
            authGeneration: generation
        });
    } finally {
        if (isCurrentGeneration(generation)) {
            await notify(null, { clearAll: true, cacheAlreadyInvalidated: true });
            if (isCurrentGeneration(generation)) setAuthState(AUTH_STATES.GUEST);
        }
    }
}

export function onAuthStateChange(callback) {
    listeners.add(callback);
    if (authState.status === AUTH_STATES.LOADING) void resolveAuthState().catch(() => {});
    else callback?.(authState.session, authState);

    return () => listeners.delete(callback);
}

if (typeof window !== 'undefined') {
    window.addEventListener('clashtools:auth-session-expired', handleAuthSessionExpired);
}

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
        loadingMessage: t('auth.redirecting')
    });
    if (!data?.url) {
        throw new HttpError(t('auth.googleInvalidRedirect'), {
            code: 'INVALID_GOOGLE_AUTH_RESPONSE'
        });
    }
    return data.url;
}

export async function signInWithGoogle(next = '/dashboard') {
    window.location.assign(await getGoogleSignInUrl(next));
}
