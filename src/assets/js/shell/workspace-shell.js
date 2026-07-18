import { initI18n, t } from '../i18n/i18n.js';
import { isAuthConfigured, syncAuthSession } from '../auth/auth-client.js';
import { getThemePreference, setThemePreference } from '../theme/theme-manager.js';

const pageConfig = {
    dashboard: { key: 'nav.dashboard', fallback: 'Dashboard' },
    planner: { key: 'nav.cwl', fallback: 'CWL Planner' },
    drafts: { key: 'nav.savedPlans', fallback: 'Opgeslagen plannen' },
    operation: { key: 'nav.operation', fallback: 'Operation Board' },
    groups: { key: 'nav.groups', fallback: 'Groepen' },
    bracket: { key: 'nav.bracket', fallback: 'Bracket generator' }
};

const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 5l8 6.5v7a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1v-7Z" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    planner: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 6.5h14M5 12h14M5 17.5h14" stroke-width="1.7" stroke-linecap="round"/></svg>',
    drafts: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5h9l3 3v12H6v-15Z" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 11h6M9 15h6" stroke-width="1.7" stroke-linecap="round"/></svg>',
    operation: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19V9m5 10V5m5 14v-7m4 7V7" stroke-width="1.7" stroke-linecap="round"/></svg>',
    groups: '<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19v-1.5A3.5 3.5 0 0 1 7 14h3a3.5 3.5 0 0 1 3.5 3.5V19m0-4h2.5a3 3 0 0 1 3 3v1" stroke-width="1.7" stroke-linecap="round"/></svg>',
    bracket: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 5h4v4H6V5Zm8 10h4v4h-4v-4Zm0-10h4v4h-4V5ZM10 7h2v10h2M12 7h2" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke-width="1.8" stroke-linecap="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.5 6 2.5 7H4c0-1 2.5-1 2.5-7Zm3 10h5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

function navLink(page, href) {
    const config = pageConfig[page];
    return `<a href="${href}" data-workspace-nav="${page}">${icons[page]}<span data-i18n="${config.key}">${config.fallback}</span></a>`;
}

function shellMarkup(currentPage) {
    const current = pageConfig[currentPage] || pageConfig.dashboard;
    return {
        sidebar: `<aside class="workspace-sidebar" id="workspace-sidebar">
            <a class="workspace-brand" href="./dashboard.html"><img src="../assets/css/pictures/clashtools-logo.png" alt=""><span><strong>ClashTools</strong><small>CWL workspace</small></span></a>
            <nav class="workspace-nav" aria-label="Applicatienavigatie" data-i18n-aria-label="shell.navigation">
                <p data-i18n="shell.overview">Overzicht</p>
                ${navLink('dashboard', './dashboard.html')}
                <p>CWL</p>
                ${navLink('planner', './cwl-planner.html')}
                ${navLink('drafts', './cwl-planner-drafts.html')}
                ${navLink('operation', './cwl-operation-board.html')}
                <p data-i18n="shell.collaborate">Samenwerken</p>
                ${navLink('groups', './groups.html')}
                ${navLink('bracket', './bracket-generator.html')}
            </nav>
            <div class="workspace-sidebar-bottom"><button class="workspace-profile-button" id="profile-btn" type="button"><span class="workspace-avatar" aria-hidden="true">CT</span><span class="workspace-profile-copy"><strong data-i18n="header.user">Gebruiker</strong><small data-i18n="shell.profileAccounts">Profiel & accounts</small></span><span class="workspace-profile-arrow" aria-hidden="true">›</span></button></div>
        </aside>`,
        topbar: `<header class="workspace-topbar">
            <button class="workspace-mobile-menu" id="workspace-mobile-menu" type="button" aria-controls="workspace-sidebar" aria-expanded="false" data-i18n-aria-label="shell.openMenu">${icons.menu}</button>
            <div class="workspace-breadcrumbs"><span>ClashTools</span><b>/</b><strong data-workspace-current data-i18n="${current.key}">${current.fallback}</strong></div>
            <div class="workspace-top-actions">
                <span class="workspace-sync"><i></i><span data-i18n="shell.online">Online</span></span>
                <button type="button" data-language-control data-i18n="header.language">Taal</button>
                <button class="theme-button" type="button" data-theme-toggle data-i18n-aria-label="theme.toggle"><span aria-hidden="true">◐</span></button>
                <button class="workspace-icon-button" id="workspace-notifications" type="button" data-i18n-aria-label="notifications.title">${icons.bell}</button>
                <button class="workspace-avatar workspace-avatar-top" id="workspace-profile-shortcut" type="button" data-i18n-aria-label="shell.openProfile">CT</button>
            </div>
        </header>`
    };
}

function updateThemeButton() {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    const isLight = document.documentElement.dataset.theme === 'light';
    button.setAttribute('aria-pressed', String(isLight));
    button.setAttribute('aria-label', t(isLight ? 'theme.useDark' : 'theme.useLight'));
    button.title = t(isLight ? 'theme.useDark' : 'theme.useLight');
}

function initThemeButton() {
    const button = document.querySelector('[data-theme-toggle]');
    button?.addEventListener('click', () => {
        setThemePreference(getThemePreference() === 'light' ? 'dark' : 'light');
        updateThemeButton();
    });
    updateThemeButton();
}

function initMobileSidebar(sidebar, backdrop) {
    const button = document.querySelector('#workspace-mobile-menu');
    const close = () => {
        sidebar.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        button?.setAttribute('aria-expanded', 'false');
    };
    button?.addEventListener('click', () => {
        const open = !sidebar.classList.contains('is-open');
        sidebar.classList.toggle('is-open', open);
        backdrop.classList.toggle('is-open', open);
        button.setAttribute('aria-expanded', String(open));
    });
    backdrop.addEventListener('click', close);
    sidebar.addEventListener('click', event => {
        if (event.target.closest('a')) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') close();
    });
}

function initProfileShortcuts() {
    const profileButton = document.querySelector('#profile-btn');
    document.querySelector('#workspace-profile-shortcut')?.addEventListener('click', () => profileButton?.click());
    document.querySelector('#workspace-notifications')?.addEventListener('click', () => {
        profileButton?.click();
        window.setTimeout(() => document.querySelector('#po-notifications-btn')?.click(), 0);
    });
}

async function protectRoute() {
    if (!isAuthConfigured()) return;
    const session = await syncAuthSession().catch(() => null);
    if (session) return;
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`./login.html?next=${encodeURIComponent(next)}`);
}

function initWorkspaceShell() {
    const body = document.body;
    if (!body.classList.contains('workspace-app') || body.dataset.shellReady === 'true') return;
    const main = body.querySelector(':scope > main');
    if (!main) return;
    body.querySelector(':scope > header')?.remove();

    const currentPage = body.dataset.workspacePage || 'dashboard';
    const markup = shellMarkup(currentPage);
    const sidebarTemplate = document.createElement('template');
    sidebarTemplate.innerHTML = markup.sidebar.trim();
    const sidebar = sidebarTemplate.content.firstElementChild;
    const area = document.createElement('div');
    area.className = 'workspace-area';
    area.innerHTML = markup.topbar;
    main.classList.add('workspace-content');
    area.appendChild(main);
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'workspace-sidebar-backdrop';
    backdrop.setAttribute('aria-label', t('shell.closeMenu'));
    body.prepend(backdrop, sidebar, area);
    body.dataset.shellReady = 'true';

    document.querySelector(`[data-workspace-nav="${currentPage}"]`)?.setAttribute('aria-current', 'page');
    initI18n(body);
    initThemeButton();
    initMobileSidebar(sidebar, backdrop);
    initProfileShortcuts();
    window.addEventListener('clashtools:language-changed', updateThemeButton);
    void protectRoute();
}

initWorkspaceShell();
