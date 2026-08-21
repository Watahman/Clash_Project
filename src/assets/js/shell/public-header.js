import { THEME_TOGGLE_MARKUP } from '../theme/theme-toggle-markup.js';

const PUBLIC_NAV_ITEMS = Object.freeze([
    { id: 'tools', href: '/#features', key: 'public.nav.tools', label: 'Tools' },
    { id: 'games', href: '/minigames', key: null, label: 'Games' },
    { id: 'guides', href: '/guides', key: 'public.nav.guides', label: 'Guides' },
    { id: 'methodology', href: '/methodology', key: 'public.nav.methodology', label: 'Methodology' },
    { id: 'about', href: '/about', key: 'public.nav.about', label: 'About' },
    { id: 'changelog', href: '/changelog', key: 'public.nav.changelog', label: 'Changelog' }
]);

const TOOL_PATHS = new Set([
    '/'
]);

const CAPABILITY_LABEL_KEYS = Object.freeze({
    '/': 'homeV2.capabilitiesLabel',
    '/about': 'feature.about.capabilitiesLabel',
    '/cwl-planner': 'feature.planner.capabilitiesLabel',
    '/cwl-tracker': 'feature.tracker.capabilitiesLabel',
    '/clan-management': 'feature.family.capabilitiesLabel',
    '/bracket-generator': 'feature.bracket.capabilitiesLabel'
});

function normalizedPath(pathname = window.location.pathname) {
    return String(pathname || '/')
        .replace(/\/index\.html$/i, '/')
        .replace(/\/$/, '') || '/';
}

function currentPublicSection(pathname) {
    const normalized = normalizedPath(pathname);

    if (normalized === '/minigames') return 'games';
    if (TOOL_PATHS.has(normalized)) return 'tools';
    if (normalized === '/guides') return 'guides';
    if (normalized === '/methodology') return 'methodology';
    if (normalized === '/about') return 'about';
    if (normalized === '/changelog') return 'changelog';
    return null;
}

function navMarkup(activeSection) {
    return PUBLIC_NAV_ITEMS.map(item => {
        const current = item.id === activeSection ? ' aria-current="page"' : '';
        const translation = item.key ? ` data-i18n="${item.key}"` : '';
        return `<a href="${item.href}"${translation}${current}>${item.label}</a>`;
    }).join('');
}

export function normalizePublicHeader(root = document) {
    if (!root.body?.classList.contains('public-site')) return;

    const header = root.querySelector('header.public-header');
    if (!header || header.dataset.publicHeaderNormalized === 'true') return;

    const activeSection = currentPublicSection(window.location.pathname);
    header.innerHTML = `
        <a class="public-brand" href="/" data-i18n-aria-label="public.homeLabel" aria-label="ClashPanel home">
            <img src="/assets/css/pictures/clashtools-logo.png" alt="" width="160" height="160">
            <span>ClashPanel</span>
        </a>
        <nav class="public-nav" id="public-nav" data-i18n-aria-label="public.navigation" aria-label="Public navigation">
            ${navMarkup(activeSection)}
        </nav>
        <div class="public-actions">
            <button type="button" data-language-control data-i18n="header.language">Language</button>
            <button class="theme-button" type="button" data-theme-toggle data-i18n-aria-label="theme.toggle" aria-label="Switch theme">${THEME_TOGGLE_MARKUP}</button>
            <a class="link-button" href="/subpages/login.html" data-i18n="auth.login">Log in</a>
            <a class="button button-primary" href="/subpages/register.html" data-i18n="public.startFree">Start for free</a>
        </div>
        <button class="public-menu" id="public-menu" type="button" aria-controls="public-nav" aria-expanded="false" data-i18n-aria-label="public.openMenu" aria-label="Open menu">
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
        </button>`;
    header.dataset.publicHeaderNormalized = 'true';
}

export function normalizePublicFooter(root = document) {
    if (!root.body?.classList.contains('public-site')) return;

    const footer = root.querySelector('footer.public-footer');
    if (!footer || footer.dataset.publicFooterNormalized === 'true') return;

    footer.innerHTML = `
        <div class="public-footer-main">
            <a class="public-brand" href="/" data-i18n-aria-label="public.homeLabel" aria-label="ClashPanel home">
                <img src="/assets/css/pictures/clashtools-logo.png" alt="" width="160" height="160">
                <span>ClashPanel</span>
            </a>
            <nav data-i18n-aria-label="public.footerNav" aria-label="Footer navigation">
                <a href="/guides" data-i18n="public.footer.guides">Guides</a>
                <a href="/methodology" data-i18n="public.footer.methodology">Methodology</a>
                <a href="/about" data-i18n="public.footer.about">About</a>
                <a href="/changelog" data-i18n="public.footer.changelog">Changelog</a>
                <a href="/privacy" data-i18n="public.privacy">Privacy</a>
                <a href="/cookies" data-i18n="public.cookies">Cookies</a>
                <a href="/terms" data-i18n="public.terms">Terms of use</a>
                <a href="/contact" data-i18n="public.contact">Contact</a>
                <a href="https://supercell.com/en/fan-content-policy/" target="_blank" rel="noopener noreferrer" data-i18n="public.fanPolicy">Supercell Fan Content Policy</a>
                <button type="button" class="public-footer-link" data-cookie-preferences hidden data-i18n="public.cookiePreferences">Cookie preferences</button>
            </nav>
        </div>
        <p class="public-disclaimer" data-i18n="public.disclaimer">ClashPanel is unofficial and is not endorsed by Supercell.</p>
        <p class="public-footer-meta" data-i18n="public.footer.meta">© 2026 ClashPanel · Not affiliated with Supercell</p>`;
    footer.dataset.publicFooterNormalized = 'true';
}

function bindPublicAccessibility(root) {
    if (!root.body?.classList.contains('public-site')) return;
    const key = CAPABILITY_LABEL_KEYS[normalizedPath()];
    const strip = root.querySelector('.home-v2-signal-strip');
    if (key && strip) strip.dataset.i18nAriaLabel = key;
}

function loadPolicyOverlay(root) {
    if (!root.querySelector('[data-policy-document]')) return;
    if (root.body.dataset.policyOverlayLoaded === 'true') return;
    root.body.dataset.policyOverlayLoaded = 'true';
    void import('../pages/public-policy-overlay.js')
        .then(module => module.initPublicPolicyOverlay())
        .catch(() => {
            delete root.body.dataset.policyOverlayLoaded;
        });
}

export function normalizePublicShell(root = document) {
    normalizePublicHeader(root);
    normalizePublicFooter(root);
    bindPublicAccessibility(root);
    loadPolicyOverlay(root);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => normalizePublicShell(), { once: true });
} else {
    normalizePublicShell();
}
