import { initI18n, t } from '../i18n/i18n.js';
import {
    AuthConfigurationError,
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

function setStatus(message = '', state = '') {
    status.textContent = message;
    status.dataset.state = state;
}

function setBusy(busy) {
    submitButton.disabled = busy;
    googleButton.disabled = busy;
    forgotButton.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
}

function authErrorMessage(error) {
    if (error instanceof AuthConfigurationError) return t('auth.notConfigured');
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
        window.location.href = '../index.html';
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
        setStatus(error instanceof AuthConfigurationError ? t('auth.notConfigured') : t('auth.resetError'), 'error');
    } finally {
        setBusy(false);
    }
}

async function loginWithGoogle() {
    setBusy(true);
    setStatus(t('auth.redirecting'), 'loading');
    try {
        await signInWithGoogle();
    } catch (error) {
        setStatus(error instanceof AuthConfigurationError ? t('auth.notConfigured') : t('auth.oauthUnavailable'), 'error');
        setBusy(false);
    }
}

function init() {
    initI18n();
    form.addEventListener('submit', submitLogin);
    forgotButton.addEventListener('click', resetPassword);
    googleButton.addEventListener('click', loginWithGoogle);
    syncAuthSession()
        .then(session => {
            if (session) window.location.href = '../index.html';
        })
        .catch(() => {
            // A missing/expired session is the normal state on this page.
        });
}

init();
