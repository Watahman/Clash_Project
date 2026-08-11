import { updateUserName } from "../Supabase/Supabase-User.js";
import { mountLanguageSwitcher, t } from "../i18n/i18n.js";
import { clearCachePrefix, invalidateUserCache } from "../cache/local-cache.js";
import { getCurrentUserId } from "../utils/user.js";
import { getThemePreference, setThemePreference } from "../theme/theme-manager.js";
import { changeAuthenticatedPassword } from "../auth/auth-client.js";
import { isStrongPassword } from "../utils/password.js";
import { publishUserProfileUpdate } from "./profile-events.js";

let initialized = false;
let currentProfile = null;
let onRefreshProfile = null;
let onProfileUpdated = null;
let refs = {};
let messageTimer = null;

const MESSAGE_DURATION = Object.freeze({
    success: 2500,
    error: 4000
});

function q(selector) {
    return document.querySelector(selector);
}

function setMessage(key, state = 'success') {
    if (!refs.message) return;

    if (messageTimer) {
        window.clearTimeout(messageTimer);
        messageTimer = null;
    }

    refs.message.textContent = t(key);
    refs.message.dataset.state = state;
    refs.message.classList.remove('hidden');

    const duration = MESSAGE_DURATION[state] || MESSAGE_DURATION.success;
    messageTimer = window.setTimeout(() => {
        clearMessage();
    }, duration);
}

function clearMessage() {
    if (messageTimer) {
        window.clearTimeout(messageTimer);
        messageTimer = null;
    }

    if (!refs.message) return;
    refs.message.textContent = '';
    refs.message.removeAttribute('data-state');
    refs.message.classList.add('hidden');
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
}

function syncThemeButtons() {
    const preference = getThemePreference();
    refs.themeOptions?.forEach(button => {
        const active = button.dataset.themeChoice === preference;
        button.classList.toggle('po-theme-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function initProfileLanguageSwitcher() {
    const switcher = mountLanguageSwitcher(refs.languageControl, {
        variant: 'profile',
        onChange: () => {
            setMessage('settings.saved');
        }
    });

    if (switcher) refs.languageControl = switcher;
}

function readName() {
    return refs.nameInput?.value.trim() || '';
}

async function saveName() {
    const userId = getCurrentUserId();
    const name = readName();
    clearMessage();

    if (!userId) return;
    if (name.length < 2 || name.length > 32) {
        setMessage('settings.nameInvalid', 'error');
        return;
    }

    setButtonLoading(refs.saveNameBtn, true);
    try {
        const result = await updateUserName(userId, name);
        if (result?.error) {
            setMessage('settings.nameChangeError', 'error');
            return;
        }
        currentProfile = {
            ...currentProfile,
            name
        };

        const profileName = q('#po-username');
        if (profileName) profileName.textContent = name;

        onProfileUpdated?.(currentProfile);

        publishUserProfileUpdate(currentProfile);

        setMessage('settings.nameChanged');
    } catch {
        setMessage('settings.nameChangeError', 'error');
    } finally {
        setButtonLoading(refs.saveNameBtn, false);
    }
}

async function savePassword() {
    const userId = getCurrentUserId();
    const currentPassword = refs.currentPassword?.value || '';
    const newPassword = refs.newPassword?.value || '';
    const confirmPassword = refs.confirmPassword?.value || '';
    clearMessage();

    if (!userId) return;
    if (!currentPassword) {
        setMessage('settings.currentPasswordRequired', 'error');
        return;
    }
    if (!isStrongPassword(newPassword)) {
        setMessage('settings.passwordInvalid', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        setMessage('settings.passwordMismatch', 'error');
        return;
    }

    setButtonLoading(refs.savePasswordBtn, true);
    try {
        await changeAuthenticatedPassword(currentPassword, newPassword);
        clearPasswordFields();
        setMessage('settings.passwordChanged');
    } catch (error) {
        const message = String(error?.message || '').toLowerCase();
        setMessage(message.includes('wachtwoord') || message.includes('password')
            ? 'settings.wrongPassword'
            : 'settings.passwordChangeError', 'error');
    } finally {
        setButtonLoading(refs.savePasswordBtn, false);
    }
}

function clearPasswordFields() {
    [refs.currentPassword, refs.newPassword, refs.confirmPassword].forEach(input => {
        if (input) input.value = '';
    });
}

function clearAppCache() {
    clearCachePrefix('');
    invalidateUserCache(getCurrentUserId());
    setMessage('settings.cacheCleared');
}

async function refreshProfile() {
    clearMessage();
    try {
        const profile = await onRefreshProfile?.();
        if (profile === null) throw new Error('Profile refresh failed');
        setMessage('settings.profileRefreshed');
    } catch {
        setMessage('settings.profileRefreshError', 'error');
    }
}

function bindRefs() {
    refs = {
        email: q('#po-settings-email'),
        nameInput: q('#po-settings-name'),
        saveNameBtn: q('#po-save-name'),
        currentPassword: q('#po-current-password'),
        newPassword: q('#po-new-password'),
        confirmPassword: q('#po-confirm-password'),
        savePasswordBtn: q('#po-save-password'),
        clearCacheBtn: q('#po-clear-cache'),
        refreshBtn: q('#po-refresh-profile'),
        message: q('#po-settings-message'),
        languageControl: q('#po-settings-language-button'),
        themeOptions: document.querySelectorAll('.po-theme-option')
    };
}

function bindOnce(element, eventName, handler, key = eventName) {
    if (!element || element.dataset[`poSettingsBound${key}`] === 'true') return;
    element.addEventListener(eventName, handler);
    element.dataset[`poSettingsBound${key}`] = 'true';
}

export function initProfileSettings(options = {}) {
    bindRefs();
    onRefreshProfile = options.onRefreshProfile;
    onProfileUpdated = options.onProfileUpdated;
    initProfileLanguageSwitcher();

    refs.themeOptions?.forEach(button => {
        bindOnce(button, 'click', () => {
            setThemePreference(button.dataset.themeChoice);
            syncThemeButtons();
            setMessage('settings.saved');
        }, 'Theme');
    });
    bindOnce(refs.saveNameBtn, 'click', saveName, 'SaveName');
    bindOnce(refs.nameInput, 'keydown', event => {
        if (event.key === 'Enter') saveName();
    }, 'NameEnter');
    bindOnce(refs.savePasswordBtn, 'click', savePassword, 'SavePassword');
    bindOnce(refs.clearCacheBtn, 'click', clearAppCache, 'ClearCache');
    bindOnce(refs.refreshBtn, 'click', refreshProfile, 'Refresh');

    if (!initialized) {
        window.addEventListener('clashtools:theme-changed', syncThemeButtons);
        initialized = true;
    }

    syncThemeButtons();
}

export function syncProfileSettings(profile) {
    currentProfile = profile || currentProfile;
    bindRefs();
    if (refs.nameInput) refs.nameInput.value = currentProfile?.name || '';
    if (refs.email) refs.email.textContent = currentProfile?.email || '-';
    syncThemeButtons();
}

export function resetProfileSettings() {
    clearMessage();
    clearPasswordFields();
    syncThemeButtons();
}
