import { _BASE_URL } from '../Data/config.js';
import { requestJson, HttpError } from '../utils/request-json.js';
import { clearCachePrefix } from '../cache/local-cache.js';
import { t } from '../i18n/i18n.js';

const LEGACY_USER_ID_KEY = 'id';
const listeners = new Set();

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

async function notify(session, { clearAll = false } = {}) {
    const previousUserId = localStorage.getItem(LEGACY_USER_ID_KEY) || '';
    const nextUserId = session?.user?.id || '';
    if (clearAll || previousUserId !== nextUserId) await clearCachePrefix('');
    rememberUser(session?.user);

    listeners.forEach(callback => {
        callback?.(session || null);
    });
}

export async function syncAuthSession() {
    try {
        const data = await requestJson(authEndpoint('/AuthSession'), {
            method: 'POST',
            body: {},
            loading: 'background'
        });

        const session = data?.session || null;
        await notify(session);
        return session;
    } catch (error) {
        await notify(null, { clearAll: true });
        if (error instanceof HttpError && error.status === 401) {
            return null;
        }

        throw error;
    }
}

export async function signInWithPassword(email, password) {
    const data = await requestJson(authEndpoint('/AuthLogin'), {
        body: {
            email: String(email || '').trim(),
            password
        },
        loading: 'blocking',
        loadingMessage: t('auth.signingIn')
    });

    await notify(data.session || null);
    return data;
}

export async function signUpWithPassword(name, email, password) {
    const data = await requestJson(authEndpoint('/AuthSignup'), {
        body: {
            name: String(name || '').trim(),
            email: String(email || '').trim(),
            password
        },
        loading: 'blocking',
        loadingMessage: t('auth.creatingAccount')
    });

    await notify(data.session || null);
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
        loadingMessage: t('settings.changingPassword')
    });
}

export async function signOut() {
    try {
        await requestJson(authEndpoint('/AuthLogout'), {
            body: {}
        });
    } finally {
        await notify(null, { clearAll: true });
    }
}

export function onAuthStateChange(callback) {
    listeners.add(callback);

    void syncAuthSession().catch(() => {});

    return () => listeners.delete(callback);
}

export async function getGoogleSignInUrl(next = '/app/dashboard') {
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

export async function signInWithGoogle(next = '/app/dashboard') {
    window.location.assign(await getGoogleSignInUrl(next));
}
