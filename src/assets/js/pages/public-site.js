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
}

async function redirectReturningUser() {
    if (!document.body.classList.contains('public-site')) return;
    const session = await syncAuthSession().catch(() => null);
    if (session) window.location.replace('./subPages/dashboard.html');
}

async function init() {
    initI18n();
    initThemeButtons();
    initPublicMenu();
    window.addEventListener('clashtools:language-changed', updateThemeButtons);
    await redirectReturningUser();
}

const initialPublicSiteLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPublicSiteLoad);
