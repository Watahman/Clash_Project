import { initI18n, t } from '../i18n/i18n.js';
import {
    requestPasswordReset,
    signInWithGoogle,
    signInWithPassword,
    syncAuthSession
} from '../auth/auth-client.js';

const form = document.querySelector('#auth-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const submitButton = document.querySelector('#submit-button');
const forgotButton = document.querySelector('#forgot-password');
const googleButton = document.querySelector('#google-login');
const status = document.querySelector('#auth-status');

function destinationAfterLogin() {
    const requested = new URLSearchParams(window.location.search).get('next');
    if (!requested) return '/app/dashboard';
    try {
        const destination = new URL(requested, window.location.origin);
        if (destination.origin !== window.location.origin
            || (!destination.pathname.startsWith('/app/')
                && !destination.pathname.startsWith('/subpages/'))) {
            return '/app/dashboard';
        }
        return `${destination.pathname}${destination.search}${destination.hash}`;
    } catch {
        return '/app/dashboard';
    }
}

function setStatus(message = '', state = '') {
    status.textContent = message;
    status.dataset.state = state;
}

function setBusy(busy) {
    submitButton.disabled = busy;
    forgotButton.disabled = busy;
    googleButton.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
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
        window.location.href = destinationAfterLogin();
    } catch (error) {
        setStatus(authErrorMessage(error), 'error');
    } finally {
        setBusy(false);
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
    initI18n();
    form.addEventListener('submit', submitLogin);
    forgotButton.addEventListener('click', resetPassword);
    googleButton.addEventListener('click', loginWithGoogle);
    if (new URLSearchParams(window.location.search).get('oauth') === 'failed') {
        setStatus(t('auth.oauthUnavailable'), 'error');
        window.history.replaceState({}, '', window.location.pathname);
    }
    const session = await syncAuthSession().catch(() => null);
    if (session) window.location.href = destinationAfterLogin();
}

const initialLoginLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialLoginLoad);
