import { normalizePublicHeader } from '../shell/public-header.js';

const THEME_STORAGE_KEY = 'clashtools_theme';
const THEMES = new Set(['dark', 'light']);

function getSystemTheme() {
    if (!window.matchMedia) return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function safePreference(value) {
    if (THEMES.has(value)) return value;

    // "system" existed in older versions. It did not have its own visual
    // design, so migrate it once to the user's current OS theme.
    if (value === 'system') {
        const migratedTheme = getSystemTheme();
        localStorage.setItem(THEME_STORAGE_KEY, migratedTheme);
        return migratedTheme;
    }

    return 'dark';
}

export function getThemePreference() {
    return safePreference(localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyTheme(preference = getThemePreference()) {
    const theme = safePreference(preference);
    document.documentElement.dataset.themePreference = theme;
    document.documentElement.dataset.theme = theme;
    return theme;
}

export function setThemePreference(preference) {
    const theme = safePreference(preference);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent('clashtools:theme-changed', {
        detail: { preference: theme, theme }
    }));
}

export function initTheme() {
    applyTheme();
    normalizePublicHeader();
}

initTheme();