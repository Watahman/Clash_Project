import { initI18n, t } from '../i18n/i18n.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { getThemePreference, setThemePreference } from '../theme/theme-manager.js';

function toggleTheme() {
    const next = getThemePreference() === 'light' ? 'dark' : 'light';
    setThemePreference(next);
    updateThemeButtons();
}

function updateThemeButtons() {
    const isLight = document.documentElement.dataset.theme === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        button.setAttribute('aria-pressed', String(isLight));
        button.setAttribute('aria-label', t(isLight ? 'theme.useDark' : 'theme.useLight'));
        button.title = t(isLight ? 'theme.useDark' : 'theme.useLight');
    });
}

function initThemeButtons() {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
        button.addEventListener('click', toggleTheme);
    });
    updateThemeButtons();
}

function initPublicMenu() {
    const button = document.querySelector('#public-menu');
    const nav = document.querySelector('#public-nav');
    if (!button || !nav) return;

    const actions = document.querySelector('.public-actions');
    const languageSwitcher = actions?.querySelector('[data-language-switcher]');
    const mobileControls = document.createElement('div');
    mobileControls.className = 'public-nav-mobile-controls';
    if (languageSwitcher) nav.append(mobileControls);

    const syncLanguageControl = () => {
        if (!languageSwitcher || !actions) return;
        if (window.matchMedia('(max-width: 70rem)').matches) {
            mobileControls.append(languageSwitcher);
        } else {
            actions.prepend(languageSwitcher);
        }
    };

    const close = () => {
        button.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
    };
    button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', event => {
        if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });

    syncLanguageControl();
    window.addEventListener('resize', syncLanguageControl, { passive: true });
}

function initCookiePreferencesControls() {
    const controls = Array.from(document.querySelectorAll('[data-cookie-preferences]'));
    if (!controls.length) return;

    const sync = () => {
        const openPreferences = window.ClashToolsCMP?.openPreferences;
        controls.forEach(control => {
            control.hidden = typeof openPreferences !== 'function';
            control.onclick = typeof openPreferences === 'function'
                ? () => openPreferences.call(window.ClashToolsCMP)
                : null;
        });
    };
    sync();
    window.addEventListener('clashtools:cmp-ready', sync);
}

async function redirectReturningUser() {
    if (document.body.dataset.redirectAuthenticated !== 'true') return;
    const session = await syncAuthSession().catch(() => null);
    if (session) window.location.replace('/dashboard');
}

async function init() {
    initI18n();
    initThemeButtons();
    initPublicMenu();
    initCookiePreferencesControls();
    window.addEventListener('clashtools:language-changed', updateThemeButtons);
    await redirectReturningUser();
}

const initialPublicSiteLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPublicSiteLoad);
