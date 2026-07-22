import { _BASE_URL } from '../Data/config.js';
import { requestJson, HttpError } from '../utils/request-json.js';
import { clearCachePrefix } from '../cache/local-cache.js';

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
        loadingMessage: 'Inloggen...'
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
        loadingMessage: 'Account maken...'
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
        loadingMessage: 'Wachtwoord wijzigen...'
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

export async function getGoogleSignInUrl(next = '/subPages/dashboard.html') {
    const data = await requestJson(authEndpoint('/AuthGoogle'), {
        body: { next },
        loading: 'blocking',
        loadingMessage: 'Doorsturen naar Google...'
    });
    if (!data?.url) {
        throw new HttpError('Google-login gaf geen geldige doorstuur-URL.', {
            code: 'INVALID_GOOGLE_AUTH_RESPONSE'
        });
    }
    return data.url;
}

export async function signInWithGoogle(next = '/subPages/dashboard.html') {
    window.location.assign(await getGoogleSignInUrl(next));
}
