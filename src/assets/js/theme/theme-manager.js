const THEME_STORAGE_KEY = 'clashtools_theme';
const THEMES = new Set(['dark', 'light']);

function isPublicPage() {
    return document.documentElement.classList.contains('public-page')
        || document.body?.classList.contains('public-site');
}

function getSystemTheme() {
    if (isPublicPage()) return 'dark';
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
    const theme = isPublicPage() ? 'dark' : safePreference(preference);
    document.documentElement.dataset.themePreference = theme;
    document.documentElement.dataset.theme = theme;
    return theme;
}

export function setThemePreference(preference) {
    const theme = safePreference(preference);

    if (isPublicPage()) {
        return applyTheme('dark');
    }

    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent('clashtools:theme-changed', {
        detail: { preference: theme, theme }
    }));
}

export function initTheme() {
    applyTheme();
}

initTheme();
