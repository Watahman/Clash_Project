const PUBLIC_NAV_ITEMS = Object.freeze([
    { id: 'tools', href: '/#features', label: 'Tools' },
    { id: 'guides', href: '/guides', label: 'Guides' },
    { id: 'methodology', href: '/methodology', label: 'Methodology' },
    { id: 'about', href: '/about', label: 'About' },
    { id: 'changelog', href: '/changelog', label: 'Changelog' }
]);

function currentPublicSection(pathname) {
    const normalized = String(pathname || '/')
        .replace(/\/index\.html$/i, '/')
        .replace(/\/$/, '') || '/';

    if (normalized === '/guides') return 'guides';
    if (normalized === '/methodology') return 'methodology';
    if (normalized === '/about') return 'about';
    if (normalized === '/changelog') return 'changelog';
    return 'tools';
}

function navMarkup(activeSection) {
    return PUBLIC_NAV_ITEMS.map(item => {
        const current = item.id === activeSection
            ? ' aria-current="page"'
            : '';
        return `<a href="${item.href}"${current}>${item.label}</a>`;
    }).join('');
}

export function normalizePublicHeader(root = document) {
    if (!root.body?.classList.contains('public-site')) return;

    const header = root.querySelector('header.public-header');
    if (!header || header.dataset.publicHeaderNormalized === 'true') return;

    const activeSection = currentPublicSection(window.location.pathname);
    header.innerHTML = `
        <a class="public-brand" href="/" aria-label="ClashPanel home">
            <img src="/assets/css/pictures/clashtools-logo.png" alt="" width="160" height="160">
            <span>ClashPanel</span>
        </a>
        <nav class="public-nav" id="public-nav" aria-label="Public navigation">
            ${navMarkup(activeSection)}
        </nav>
        <div class="public-actions">
            <button type="button" data-language-control data-i18n="header.language">Language</button>
            <button class="theme-button" type="button" data-theme-toggle data-i18n-aria-label="theme.toggle" aria-label="Switch theme">
                <span aria-hidden="true">◐</span>
            </button>
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => normalizePublicHeader(), { once: true });
} else {
    normalizePublicHeader();
}
