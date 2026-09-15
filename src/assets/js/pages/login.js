import { initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import {
    requestPasswordReset,
    signInWithGoogle,
    signInWithPassword,
    resolveAuthState,
    AUTH_STATES,
    onAuthStateChange
} from '../auth/auth-client.js?v=20260915-auth-policy-v1';
import {
    buildRegisterUrl,
    getPostLoginDestination,
    getSafeReturnPath,
    redirectAfterLogin
} from '../auth/auth-navigation.js?v=20260915-auth-policy-v1';

const form = document.querySelector('#auth-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const submitButton = document.querySelector('#submit-button');
const forgotButton = document.querySelector('#forgot-password');
const googleButton = document.querySelector('#google-login');
const status = document.querySelector('#auth-status');
let authNavigationClaimed = false;
let stopAuthStateListener;

function destinationAfterLogin() {
    const requested = new URLSearchParams(window.location.search).get('next');
    return getPostLoginDestination(getSafeReturnPath(requested));
}

function preserveReturnPath(link) {
    if (!link) return;
    const hasNext = new URLSearchParams(window.location.search).has('next');
    link.href = hasNext ? buildRegisterUrl(destinationAfterLogin()) : buildRegisterUrl();
}

function preserveAuthLinks() {
    preserveReturnPath(document.querySelector('a[href="register.html"]'));
}

function clearOAuthFailureMarker() {
    const params = new URLSearchParams(window.location.search);
    params.delete('oauth');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

function setStatus(message = '', state = '') {
    status.textContent = message;
    status.dataset.state = state;
}

function setBusy(busy) {
    if (form) {
        form.querySelectorAll('button, input, select, textarea').forEach(control => {
            control.disabled = busy;
        });
        form.inert = busy;
        form.toggleAttribute('inert', busy);
        form.setAttribute('aria-busy', String(busy));
    }
}

function setAuthPageState(state) {
    document.body.dataset.authState = state;
    setBusy(state !== AUTH_STATES.GUEST);
    if (state === AUTH_STATES.UNAVAILABLE) {
        setStatus(t('auth.sessionUnavailable'), 'error');
    }
}

function applyResolvedAuthState(state) {
    if (!state?.status) return;
    setAuthPageState(state.status);
    if (state.status === AUTH_STATES.AUTHENTICATED && !authNavigationClaimed) {
        authNavigationClaimed = true;
        stopAuthStateListener?.();
        redirectAfterLogin(destinationAfterLogin());
        return;
    }
    if (state.status === AUTH_STATES.GUEST) {
        setBusy(false);
    }
}

async function loginWithGoogle() {
    setBusy(true);
    setStatus(t('auth.redirecting'), 'loading');
    try {
        await signInWithGoogle(destinationAfterLogin());
    } catch (error) {
        setStatus(error?.code === 'AUTH_NOT_CONFIGURED' ? t('auth.notConfigured') : t('auth.oauthUnavailable'), 'error');
        setBusy(false);
    }
}

function authErrorMessage(error) {
    if (error?.code === 'AUTH_NOT_CONFIGURED') return t('auth.notConfigured');
    if (error?.status === 429) return t('auth.tooManyRequests');
    return t('auth.invalidCredentials');
}

async function submitLogin(event) {
    event.preventDefault();
    if (!form.reportValidity()) return;
    setBusy(true);
    setStatus(t('auth.signingIn'), 'loading');
    try {
        await signInWithPassword(emailInput.value, passwordInput.value);
        applyResolvedAuthState({ status: AUTH_STATES.AUTHENTICATED });
    } catch (error) {
        setStatus(authErrorMessage(error), 'error');
        setBusy(false);
    } finally {
        if (document.body.dataset.authState !== AUTH_STATES.AUTHENTICATED) {
            setBusy(false);
        }
    }
}

async function resetPassword() {
    if (!emailInput.reportValidity()) {
        setStatus(t('auth.enterEmailFirst'), 'error');
        emailInput.focus();
        return;
    }
    setBusy(true);
    setStatus(t('auth.sendingReset'), 'loading');
    try {
        await requestPasswordReset(emailInput.value);
        setStatus(t('auth.resetSent'), 'success');
    } catch (error) {
        setStatus(error?.code === 'AUTH_NOT_CONFIGURED' ? t('auth.notConfigured') : t('auth.resetError'), 'error');
    } finally {
        setBusy(false);
    }
}

async function init() {
    setAuthPageState(AUTH_STATES.LOADING);
    initI18n();
    form.addEventListener('submit', submitLogin);
    forgotButton.addEventListener('click', resetPassword);
    googleButton.addEventListener('click', loginWithGoogle);
    if (new URLSearchParams(window.location.search).get('oauth') === 'failed') {
        setStatus(t('auth.oauthUnavailable'), 'error');
        clearOAuthFailureMarker();
    }
    preserveAuthLinks();
    stopAuthStateListener = onAuthStateChange?.((_session, state) => applyResolvedAuthState(state));
    const state = await resolveAuthState().catch(error => ({
        status: AUTH_STATES.UNAVAILABLE,
        session: null,
        error
    }));
    applyResolvedAuthState(state);
}

const initialLoginLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialLoginLoad);
