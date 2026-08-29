import { normalizePublicHeader } from '../shell/public-header.js?v=20260829-public-header-cta-v2';
import { ensureThemeToggleMarkup } from './theme-toggle-markup.js';

const THEME_STORAGE_KEY = 'clashtools_theme';
const THEMES = new Set(['dark', 'light']);
const THEME_TRANSITION_DURATION = 640;

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

function prefersReducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function transitionOrigin(source) {
    const rect = source?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
        return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    return {
        x: Math.min(window.innerWidth, Math.max(0, rect.left + rect.width / 2)),
        y: Math.min(window.innerHeight, Math.max(0, rect.top + rect.height / 2))
    };
}

function animateThemeReveal(source, transition) {
    if (!transition?.ready?.then || prefersReducedMotion()) return;

    transition.ready.then(() => {
        const { x, y } = transitionOrigin(source);
        const radius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        ) + 16;
        document.documentElement.animate(
            {
                clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
            },
            {
                duration: THEME_TRANSITION_DURATION,
                easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                pseudoElement: '::view-transition-new(root)'
            }
        );
    }).catch(() => {});
}

/** Toggle the persisted theme and reveal the new palette from the trigger. */
export function toggleTheme(source) {
    const nextTheme = getThemePreference() === 'light' ? 'dark' : 'light';
    const update = () => setThemePreference(nextTheme);

    if (prefersReducedMotion() || typeof document.startViewTransition !== 'function') {
        update();
        return nextTheme;
    }

    try {
        const transition = document.startViewTransition(update);
        animateThemeReveal(source, transition);
    } catch {
        // A transition can be rejected while another one is still running.
        // Keep the control reliable by applying the requested theme directly.
        update();
    }
    return nextTheme;
}

export function initTheme() {
    applyTheme();
    normalizePublicHeader();
    ensureThemeToggleMarkup();
}

initTheme();
