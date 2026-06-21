const THEME_STORAGE_KEY = 'clashtools_theme';
const THEMES = new Set(['dark', 'light', 'system']);
let systemThemeListenerAttached = false;

function getSystemTheme() {
    if (!window.matchMedia) return 'dark';
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(preference) {
    if (preference === 'system') return getSystemTheme();
    return preference === 'light' ? 'light' : 'dark';
}

function safePreference(value) {
    return THEMES.has(value) ? value : 'dark';
}

export function getThemePreference() {
    return safePreference(localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyTheme(preference = getThemePreference()) {
    const safe = safePreference(preference);
    const resolved = resolveTheme(safe);
    document.documentElement.dataset.themePreference = safe;
    document.documentElement.dataset.theme = resolved;
    return resolved;
}

export function setThemePreference(preference) {
    const safe = safePreference(preference);
    localStorage.setItem(THEME_STORAGE_KEY, safe);
    const resolved = applyTheme(safe);
    window.dispatchEvent(new CustomEvent('clashtools:theme-changed', {
        detail: { preference: safe, theme: resolved }
    }));
}

export function initTheme() {
    applyTheme();
    if (systemThemeListenerAttached || !window.matchMedia) return;

    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener?.('change', () => {
        if (getThemePreference() === 'system') applyTheme('system');
    });
    systemThemeListenerAttached = true;
}

initTheme();
