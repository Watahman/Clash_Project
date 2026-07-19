import { _BASE_URL } from '../Data/config.js';
import { requestJson, HttpError } from '../utils/request-json.js';

const LEGACY_USER_ID_KEY = 'id';
const listeners = new Set();

export class AuthConfigurationError extends Error {
    constructor() {
        super('Authenticatie is niet geconfigureerd.');
        this.name = 'AuthConfigurationError';
    }
}

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

function notify(session) {
    rememberUser(session?.user);

    listeners.forEach(callback => {
        callback?.(session || null);
    });
}

export function isAuthConfigured() {
    return true;
}

export async function syncAuthSession() {
    try {
        const data = await requestJson(authEndpoint('/AuthSession'), {
            method: 'POST',
            body: {},
            auth: false,
            loading: 'background'
        });

        const session = data?.session || null;
        notify(session);
        return session;
    } catch (error) {
        if (error instanceof HttpError && error.status === 401) {
            notify(null);
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
        auth: false,
        loading: 'blocking',
        loadingMessage: 'Inloggen...'
    });

    notify(data.session || null);
    return data;
}

export async function signUpWithPassword(name, email, password) {
    const data = await requestJson(authEndpoint('/AuthSignup'), {
        body: {
            name: String(name || '').trim(),
            email: String(email || '').trim(),
            password
        },
        auth: false,
        loading: 'blocking',
        loadingMessage: 'Account maken...'
    });

    notify(data.session || null);
    return data;
}

export async function requestPasswordReset(email) {
    return requestJson(authEndpoint('/AuthRecover'), {
        body: {
            email: String(email || '').trim()
        },
        auth: false
    });
}

export async function signInWithGoogle() {
    const returnUrl = new URL('../index.html', window.location.href).href;

    window.location.assign(
        `${authEndpoint('/AuthGoogle')}?returnUrl=${encodeURIComponent(returnUrl)}`
    );
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
        auth: true,
        loading: 'blocking',
        loadingMessage: 'Wachtwoord wijzigen...'
    });
}

export async function signOut() {
    try {
        await requestJson(authEndpoint('/AuthLogout'), {
            body: {},
            auth: false
        });
    } finally {
        notify(null);
    }
}

export function onAuthStateChange(callback) {
    listeners.add(callback);

    syncAuthSession()
        .then(session => callback?.(session))
        .catch(() => callback?.(null));

    return () => listeners.delete(callback);
}