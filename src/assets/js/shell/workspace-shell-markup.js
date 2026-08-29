import { ACCESS, getWorkspaceModule, getWorkspaceSections } from './module-registry.js?v=20260829-public-dashboard-v1';
import { THEME_TOGGLE_MARKUP } from '../theme/theme-toggle-markup.js';

const shellIcons = Object.freeze({
    menu: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke-width="1.8" stroke-linecap="round"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" fill="none"><path d="m14.5 6-6 6 6 6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.5 6 2.5 7H4c0-1 2.5-1 2.5-7Zm3 10h5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
});

function navLink(module) {
    const authLock = module.access === ACCESS.AUTH
        ? '<span class="workspace-nav-lock" data-workspace-auth-lock aria-hidden="true">&#128274;</span>'
        : '';
    const attributes = `data-workspace-nav="${module.id}" data-workspace-section="${module.section}" data-workspace-access="${module.access}"`;
    if (module.comingSoon) {
        return `<a class="workspace-nav-coming-soon" ${attributes} aria-disabled="true" tabindex="-1">${module.icon}<span class="workspace-nav-item-copy"><span data-i18n="${module.key}">${module.fallback}</span><small class="workspace-coming-soon-badge" data-i18n="common.comingSoon">(Coming soon)</small></span>${authLock}</a>`;
    }
    return `<a href="${module.href}" ${attributes}>${module.icon}<span data-i18n="${module.key}">${module.fallback}</span>${authLock}</a>`;
}
function navigationMarkup() {
    return getWorkspaceSections().map(section => `
        <p data-workspace-section-label="${section.id}" data-i18n="${section.key}">${section.fallback}</p>
        ${section.modules.map(navLink).join('')}
    `).join('');
}

function sidebarMarkup() {
    return `<aside class="workspace-sidebar" id="workspace-sidebar">
        <a class="workspace-brand" href="/"><img src="../assets/css/pictures/clashtools-logo.png" alt=""><span><strong>ClashPanel</strong><small>Tools &amp; community</small></span></a>
        <button class="workspace-sidebar-toggle" id="workspace-sidebar-toggle" type="button" aria-controls="workspace-sidebar" aria-expanded="true">${shellIcons.collapse}</button>
        <nav class="workspace-nav" id="workspace-navigation" aria-label="Application navigation" data-i18n-aria-label="shell.navigation">${navigationMarkup()}</nav>
        <div class="workspace-sidebar-bottom"><a class="workspace-profile-button" id="profile-btn" href="/app/profile" data-auth-only hidden data-i18n-aria-label="shell.openProfile"><span class="workspace-avatar" aria-hidden="true">CT</span><span class="workspace-profile-copy"><strong data-i18n="header.user">User</strong><small data-i18n="shell.profileAccounts">Profile &amp; accounts</small></span><span class="workspace-profile-arrow" aria-hidden="true">›</span></a><a class="workspace-login-cta workspace-login-cta-sidebar" href="/subpages/login.html" data-auth-login data-guest-only hidden><span class="workspace-avatar" aria-hidden="true">→</span><span class="workspace-profile-copy"><strong data-i18n="auth.login">Log in</strong><small data-i18n="shell.guestPrompt">Use your account for saved work</small></span></a></div>
    </aside>`;
}

function topbarMarkup(currentPage) {
    const current = getWorkspaceModule(currentPage);
    const section = getWorkspaceSections().find(candidate => candidate.id === current.section);
    return `<header class="workspace-topbar">
        <button class="workspace-mobile-menu" id="workspace-mobile-menu" type="button" aria-controls="workspace-sidebar" aria-expanded="false" data-i18n-aria-label="shell.openMenu">${shellIcons.menu}</button>
        <div class="workspace-breadcrumbs"><span>ClashPanel</span><b>/</b><span data-workspace-current-section data-i18n="${section.key}">${section.fallback}</span><b>/</b><strong data-workspace-current data-i18n="${current.key}">${current.fallback}</strong></div>
        <div class="workspace-top-actions">
            <span class="workspace-sync"><i></i><span data-i18n="shell.online">Online</span></span>
            <button type="button" data-language-control data-i18n="header.language">Language</button>
            <button class="theme-button" type="button" data-theme-toggle data-i18n-aria-label="theme.toggle">${THEME_TOGGLE_MARKUP}</button>
            <div class="workspace-notifications" id="workspace-notifications-root" data-auth-only hidden>
                <button class="workspace-icon-button" id="workspace-notifications" type="button" aria-expanded="false" aria-controls="workspace-notifications-panel" data-i18n-aria-label="notifications.title">${shellIcons.bell}<span class="workspace-notifications-count hidden" id="workspace-notifications-count" aria-hidden="true">0</span></button>
                <section class="workspace-notifications-panel hidden" id="workspace-notifications-panel" aria-labelledby="workspace-notifications-title" aria-live="polite">
                    <div class="workspace-notifications-heading"><strong id="workspace-notifications-title" data-i18n="notifications.title">Notifications</strong><button class="workspace-notifications-close" id="workspace-notifications-close" type="button" data-i18n-aria-label="common.close" aria-label="Close">&times;</button></div>
                    <div class="workspace-notifications-list" id="workspace-notifications-list"></div>
                </section>
            </div>
            <a class="workspace-avatar workspace-avatar-top" id="workspace-profile-shortcut" href="/app/profile" data-auth-only hidden data-i18n-aria-label="shell.openProfile">CT</a>
            <a class="workspace-login-cta workspace-login-cta-top" href="/subpages/login.html" data-auth-login data-guest-only hidden data-i18n="auth.login">Log in</a>
        </div>
    </header>
    <div class="workspace-auth-status" id="workspace-auth-status" role="status" aria-live="polite" hidden>
        <span data-workspace-auth-message></span>
        <button type="button" class="workspace-auth-retry" data-workspace-auth-retry data-i18n="auth.retry">Retry</button>
    </div>`;
}

export function buildWorkspaceShellMarkup(currentPage) {
    return { sidebar: sidebarMarkup(), topbar: topbarMarkup(currentPage) };
}
