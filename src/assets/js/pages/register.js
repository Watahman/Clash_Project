import { initI18n, t } from '../i18n/i18n.js';
import {
    signInWithGoogle,
    signUpWithPassword,
    syncAuthSession
} from '../auth/auth-client.js';
import { isStrongPassword } from '../utils/password.js';

const form = document.querySelector('#auth-form');
const nameInput = document.querySelector('#username');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const confirmationInput = document.querySelector('#password2');
const submitButton = document.querySelector('#submit-button');
const googleButton = document.querySelector('#google-login');
const status = document.querySelector('#auth-status');
const strengthSegments = [1, 2, 3].map(index => document.querySelector(`#seg${index}`));

function setStatus(message = '', state = '') {
    status.textContent = message;
    status.dataset.state = state;
}

function setBusy(busy) {
    submitButton.disabled = busy;
    googleButton.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
}

async function registerWithGoogle() {
    setBusy(true);
    setStatus(t('auth.redirecting'), 'loading');
    try {
        await signInWithGoogle('/subpages/dashboard.html');
    } catch (error) {
        setStatus(error?.code === 'AUTH_NOT_CONFIGURED' ? t('auth.notConfigured') : t('auth.oauthUnavailable'), 'error');
        setBusy(false);
    }
}

function passwordStrength(password) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
}

function updatePasswordHints() {
    const score = passwordStrength(passwordInput.value);
    strengthSegments.forEach((segment, index) => segment.classList.toggle('active', index < score));
    confirmationInput.setCustomValidity(
        confirmationInput.value && confirmationInput.value !== passwordInput.value
            ? t('auth.passwordMismatch')
            : ''
    );
}

async function submitRegistration(event) {
    event.preventDefault();
    updatePasswordHints();
    if (!form.reportValidity()) return;
    if (!isStrongPassword(passwordInput.value) || passwordStrength(passwordInput.value) < 3) {
        setStatus(t('auth.passwordRequirements'), 'error');
        passwordInput.focus();
        return;
    }

    setBusy(true);
    setStatus(t('auth.creatingAccount'), 'loading');
    try {
        const data = await signUpWithPassword(nameInput.value, emailInput.value, passwordInput.value);
        if (data.session) {
            window.location.href = './dashboard.html';
            return;
        }
        form.reset();
        updatePasswordHints();
        setStatus(t('auth.confirmEmail'), 'success');
    } catch (error) {
        const message = error?.code === 'AUTH_NOT_CONFIGURED'
            ? t('auth.notConfigured')
            : error?.status === 429
                ? t('auth.tooManyRequests')
                : t('auth.registrationError');
        setStatus(message, 'error');
    } finally {
        setBusy(false);
    }
}

async function init() {
    initI18n();
    form.addEventListener('submit', submitRegistration);
    passwordInput.addEventListener('input', updatePasswordHints);
    confirmationInput.addEventListener('input', updatePasswordHints);
    googleButton.addEventListener('click', registerWithGoogle);
    const session = await syncAuthSession().catch(() => null);
    if (session) window.location.href = './dashboard.html';
}

const initialRegisterLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialRegisterLoad);
