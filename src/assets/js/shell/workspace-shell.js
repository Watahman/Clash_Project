import { initI18n, t } from '../i18n/i18n.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { getThemePreference, setThemePreference } from '../theme/theme-manager.js';
import { getNotifications, markNotificationRead } from '../Supabase/Supabase-Notifications.js';
import { getCurrentUserId } from '../utils/user.js';
import { checkUserId } from '../Supabase/Supabase-User.js';
import { getNameInitials } from '../utils/name-initials.js';
import { onUserProfileUpdate } from '../profile/profile-events.js';
import {
    buildGroupPollHref,
    pollNotificationCopy,
    stageGroupPollNavigation
} from '../notifications/poll-notifications.js';

let notificationsData = null;
let notificationsRequestId = 0;

const SIDEBAR_COLLAPSED_KEY = 'clashtools_workspace_sidebar_collapsed';

const pageConfig = {
    dashboard: { key: 'nav.dashboard', fallback: 'Dashboard' },
    planner: { key: 'nav.cwl', fallback: 'CWL Planner' },
    drafts: { key: 'nav.savedPlans', fallback: 'Saved plans' },
    operation: { key: 'nav.operation', fallback: 'Operation Board' },
    groups: { key: 'nav.groups', fallback: 'Clan Family' },
    bracket: { key: 'nav.bracket', fallback: 'Bracket generator' }
};

function applyWorkspaceUserIdentity(userData) {
    const user = Array.isArray(userData)
        ? userData[0]
        : userData;

    const name = String(user?.name || '').trim();

    if (!name) {
        return;
    }

    const initials = getNameInitials(name, 'CT');

    document
        .querySelectorAll('.workspace-avatar')
        .forEach(avatar => {
            avatar.textContent = initials;
            avatar.title = name;
        });

    const profileName = document.querySelector(
        '.workspace-profile-copy strong'
    );

    if (profileName) {
        profileName.removeAttribute('data-i18n');
        profileName.textContent = name;
    }
}

async function loadWorkspaceUserIdentity() {
    const userId = getCurrentUserId();

    if (!userId) {
        return;
    }

    try {
        const userData = await checkUserId(userId);
        applyWorkspaceUserIdentity(userData);
    } catch {
        // De standaardwaarde CT/Gebruiker blijft zichtbaar.
    }
}

const icons = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 5l8 6.5v7a1 1 0 0 1-1 1h-5v-5h-4v5H5a1 1 0 0 1-1-1v-7Z" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    planner: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 6.5h14M5 12h14M5 17.5h14" stroke-width="1.7" stroke-linecap="round"/></svg>',
    drafts: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5h9l3 3v12H6v-15Z" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 11h6M9 15h6" stroke-width="1.7" stroke-linecap="round"/></svg>',
    operation: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 19V9m5 10V5m5 14v-7m4 7V7" stroke-width="1.7" stroke-linecap="round"/></svg>',
    groups: '<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19v-1.5A3.5 3.5 0 0 1 7 14h3a3.5 3.5 0 0 1 3.5 3.5V19m0-4h2.5a3 3 0 0 1 3 3v1" stroke-width="1.7" stroke-linecap="round"/></svg>',
    bracket: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 5h4v4H6V5Zm8 10h4v4h-4v-4Zm0-10h4v4h-4V5ZM10 7h2v10h2M12 7h2" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke-width="1.8" stroke-linecap="round"/></svg>',
    collapse: '<svg viewBox="0 0 24 24" fill="none"><path d="m14.5 6-6 6 6 6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 6 2.5 6 2.5 7H4c0-1 2.5-1 2.5-7Zm3 10h5" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

function navLink(page, href) {
    const config = pageConfig[page];
    return `<a href="${href}" data-workspace-nav="${page}">${icons[page]}<span data-i18n="${config.key}">${config.fallback}</span></a>`;
}

function comingSoonNavItem(page) {
    const config = pageConfig[page];
    return `<a class="workspace-nav-coming-soon" data-workspace-nav="${page}" aria-disabled="true" tabindex="-1">${icons[page]}<span class="workspace-nav-item-copy"><span data-i18n="${config.key}">${config.fallback}</span><small class="workspace-coming-soon-badge" data-i18n="common.comingSoon">(Coming soon)</small></span></a>`;
}

function shellMarkup(currentPage) {
    const current = pageConfig[currentPage] || pageConfig.dashboard;
    return {
        sidebar: `<aside class="workspace-sidebar" id="workspace-sidebar">
            <a class="workspace-brand" href="./dashboard.html"><img src="../assets/css/pictures/clashtools-logo.png" alt=""><span><strong>ClashPanel</strong><small>CWL workspace</small></span></a>
            <button class="workspace-sidebar-toggle" id="workspace-sidebar-toggle" type="button" aria-controls="workspace-sidebar" aria-expanded="true">${icons.collapse}</button>
            <nav class="workspace-nav" id="workspace-navigation" aria-label="Applicatienavigatie" data-i18n-aria-label="shell.navigation">
                <p data-i18n="shell.overview">Overzicht</p>
                ${navLink('dashboard', './dashboard.html')}
                <p>CWL</p>
                ${navLink('planner', './cwl-planner.html')}
                ${navLink('drafts', './cwl-planner-drafts.html')}
                ${navLink('operation', './cwl-operation-board.html')}
                <p data-i18n="shell.collaborate">Samenwerken</p>
                ${navLink('groups', './groups.html')}
                ${comingSoonNavItem('bracket')}
            </nav>
            <div class="workspace-sidebar-bottom"><button class="workspace-profile-button" id="profile-btn" type="button" data-i18n-aria-label="shell.openProfile"><span class="workspace-avatar" aria-hidden="true">CT</span><span class="workspace-profile-copy"><strong data-i18n="header.user">Gebruiker</strong><small data-i18n="shell.profileAccounts">Profiel & accounts</small></span><span class="workspace-profile-arrow" aria-hidden="true">›</span></button></div>
        </aside>`,
        topbar: `<header class="workspace-topbar">
            <button class="workspace-mobile-menu" id="workspace-mobile-menu" type="button" aria-controls="workspace-sidebar" aria-expanded="false" data-i18n-aria-label="shell.openMenu">${icons.menu}</button>
            <div class="workspace-breadcrumbs"><span>ClashPanel</span><b>/</b><strong data-workspace-current data-i18n="${current.key}">${current.fallback}</strong></div>
            <div class="workspace-top-actions">
                <span class="workspace-sync"><i></i><span data-i18n="shell.online">Online</span></span>
                <button type="button" data-language-control data-i18n="header.language">Taal</button>
                <button class="theme-button" type="button" data-theme-toggle data-i18n-aria-label="theme.toggle"><span aria-hidden="true">◐</span></button>
                <div class="workspace-notifications" id="workspace-notifications-root">
                    <button class="workspace-icon-button" id="workspace-notifications" type="button" aria-expanded="false" aria-controls="workspace-notifications-panel" data-i18n-aria-label="notifications.title">
                        ${icons.bell}
                        <span class="workspace-notifications-count hidden" id="workspace-notifications-count" aria-hidden="true">0</span>
                    </button>
                    <section class="workspace-notifications-panel hidden" id="workspace-notifications-panel" aria-labelledby="workspace-notifications-title" aria-live="polite">
                        <div class="workspace-notifications-heading">
                            <strong id="workspace-notifications-title" data-i18n="notifications.title">Notificaties</strong>
                            <button class="workspace-notifications-close" id="workspace-notifications-close" type="button" data-i18n-aria-label="common.close" aria-label="Close">&times;</button>
                        </div>
                        <div class="workspace-notifications-list" id="workspace-notifications-list"></div>
                    </section>
                </div>
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


function getStoredSidebarState() {
    try {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
        return false;
    }
}

function persistSidebarState(collapsed) {
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
        // The sidebar still works when storage is unavailable.
    }
}

function applyInitialSidebarState(body) {
    const previousTransition = body.style.transition;

    // The body already exists before the module runs. Disable the grid
    // transition while restoring the saved state so a collapsed sidebar does
    // not briefly render at its expanded width during page navigation.
    body.style.transition = 'none';
    body.classList.toggle('workspace-sidebar-collapsed', getStoredSidebarState());

    return () => {
        const restoreTransition = () => {
            if (previousTransition) body.style.transition = previousTransition;
            else body.style.removeProperty('transition');
        };

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(restoreTransition);
            });
        } else {
            window.setTimeout(restoreTransition, 0);
        }
    };
}

function syncCollapsedSidebarLabels(sidebar, collapsed) {
    sidebar.querySelectorAll('[data-workspace-nav]').forEach(link => {
        const label = link.querySelector('span')?.textContent?.trim();
        if (collapsed && label) link.title = label;
        else link.removeAttribute('title');
    });

    const profileButton = sidebar.querySelector('#profile-btn');
    if (profileButton) {
        const profileLabel = t('shell.openProfile');
        profileButton.setAttribute('aria-label', profileLabel);
        if (collapsed) profileButton.title = profileLabel;
        else profileButton.removeAttribute('title');
    }
}

function setDesktopSidebarCollapsed(sidebar, collapsed, { persist = true } = {}) {
    const body = document.body;
    const button = sidebar.querySelector('#workspace-sidebar-toggle');
    body.classList.toggle('workspace-sidebar-collapsed', collapsed);
    button?.setAttribute('aria-expanded', String(!collapsed));

    const label = t(collapsed ? 'shell.openMenu' : 'shell.closeMenu');
    if (button) {
        button.setAttribute('aria-label', label);
        button.title = label;
    }

    syncCollapsedSidebarLabels(sidebar, collapsed);
    if (persist) persistSidebarState(collapsed);
}

function initDesktopSidebar(sidebar) {
    const button = sidebar.querySelector('#workspace-sidebar-toggle');
    if (!button) return;

    setDesktopSidebarCollapsed(sidebar, getStoredSidebarState(), { persist: false });

    button.addEventListener('click', () => {
        setDesktopSidebarCollapsed(
            sidebar,
            !document.body.classList.contains('workspace-sidebar-collapsed')
        );
    });

    window.addEventListener('clashtools:language-changed', () => {
        setDesktopSidebarCollapsed(
            sidebar,
            document.body.classList.contains('workspace-sidebar-collapsed'),
            { persist: false }
        );
    });
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
}

function setNotificationsCount(count) {
    const badge = document.querySelector('#workspace-notifications-count');
    if (!badge) return;
    const safeCount = Math.max(0, Number(count) || 0);
    badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
    badge.classList.toggle('hidden', safeCount === 0);
}

function renderNotifications(data) {
    const list = document.querySelector('#workspace-notifications-list');
    if (!list) return;

    const items = Array.isArray(data?.items) ? data.items : [];
    const unread = Number(data?.unread ?? items.filter(item => !item.read_at).length);
    setNotificationsCount(unread);
    window.dispatchEvent(new CustomEvent('clashtools:notifications-updated', {
        detail: { items }
    }));
    list.replaceChildren();

    if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'workspace-notifications-empty';
        empty.textContent = t('notifications.empty');
        list.appendChild(empty);
        return;
    }

    items.forEach(notification => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'workspace-notification-item';
        item.classList.toggle('unread', !notification.read_at);

        const copy = pollNotificationCopy(notification, t);
        const title = document.createElement('strong');
        title.textContent = copy.title;

        const body = document.createElement('span');
        body.textContent = copy.body;

        item.append(title, body);
        item.addEventListener('click', async () => {
            const userId = getCurrentUserId();
            if (!notification.read_at && userId) {
                await markNotificationRead(userId, notification.id).catch(() => null);
                notification.read_at = new Date().toISOString();
                item.classList.remove('unread');
                data.unread = Math.max(0, Number(data.unread ?? unread) - 1);
                setNotificationsCount(data.unread);
                window.dispatchEvent(new CustomEvent('clashtools:notifications-updated', {
                    detail: { items }
                }));
            }

            if (notification.related_group_id) {
                const pollHref = buildGroupPollHref(notification, window.location.href);
                stageGroupPollNavigation(notification, sessionStorage, localStorage);
                window.location.href = pollHref || (window.location.pathname.includes('/subpages/')
                    ? './groups.html'
                    : './subpages/groups.html');
            }
        });

        list.appendChild(item);
    });
}

async function loadWorkspaceNotifications({ showLoading = false } = {}) {
    const list = document.querySelector('#workspace-notifications-list');
    const panel = document.querySelector('#workspace-notifications-panel');
    const userId = getCurrentUserId();
    const requestId = ++notificationsRequestId;

    if (!list || !panel) return;
    if (!userId) {
        notificationsData = { items: [], unread: 0 };
        renderNotifications(notificationsData);
        return;
    }

    if (showLoading && !notificationsData) {
        list.replaceChildren();
        const loading = document.createElement('p');
        loading.className = 'workspace-notifications-empty';
        loading.textContent = t('profile.loading');
        list.appendChild(loading);
    }

    panel.setAttribute('aria-busy', 'true');
    try {
        const data = await getNotifications(userId);
        if (requestId !== notificationsRequestId) return;
        notificationsData = data || { items: [], unread: 0 };
        renderNotifications(notificationsData);
    } catch {
        if (requestId !== notificationsRequestId) return;
        list.replaceChildren();
        const error = document.createElement('p');
        error.className = 'workspace-notifications-empty workspace-notifications-error';
        error.textContent = t('profile.loadError');
        list.appendChild(error);
    } finally {
        if (requestId === notificationsRequestId) panel.removeAttribute('aria-busy');
    }
}

function initNotificationsPopover() {
    const root = document.querySelector('#workspace-notifications-root');
    const button = document.querySelector('#workspace-notifications');
    const panel = document.querySelector('#workspace-notifications-panel');
    const closeButton = document.querySelector('#workspace-notifications-close');
    if (!root || !button || !panel || !closeButton) return Promise.resolve();

    const close = ({ restoreFocus = false } = {}) => {
        if (panel.classList.contains('hidden')) return;
        panel.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
        if (restoreFocus) button.focus();
    };

    const open = () => {
        panel.classList.remove('hidden');
        button.setAttribute('aria-expanded', 'true');
        void loadWorkspaceNotifications({ showLoading: true });
        window.requestAnimationFrame(() => closeButton.focus());
    };

    button.addEventListener('click', () => {
        if (panel.classList.contains('hidden')) open();
        else close();
    });
    closeButton.addEventListener('click', () => close({ restoreFocus: true }));
    document.addEventListener('pointerdown', event => {
        if (!panel.classList.contains('hidden') && !root.contains(event.target)) close();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.classList.contains('hidden')) {
            event.preventDefault();
            close({ restoreFocus: true });
        }
    });
    window.addEventListener('clashtools:language-changed', () => {
        if (notificationsData) renderNotifications(notificationsData);
    });
    window.addEventListener('clashtools:notifications-requested', () => {
        if (notificationsData) renderNotifications(notificationsData);
    });
    window.addEventListener('clashtools:notifications-refresh-requested', () => {
        void loadWorkspaceNotifications();
    });

    return Promise.resolve();
}

async function protectRoute() {
    const session = await syncAuthSession().catch(() => null);
    if (session) return true;
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`./login.html?next=${encodeURIComponent(next)}`);
    return false;
}

async function loadInitialWorkspaceData() {
    if (!await protectRoute()) return;
    await Promise.allSettled([
        loadWorkspaceUserIdentity(),
        loadWorkspaceNotifications()
    ]);
}

function initWorkspaceShell() {
    const body = document.body;
    if (!body.classList.contains('workspace-app') || body.dataset.shellReady === 'true') return;
    const main = body.querySelector(':scope > main');
    if (!main) return;
    body.querySelector(':scope > header')?.remove();

    const finishInitialSidebarRestore = applyInitialSidebarState(body);

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
    finishInitialSidebarRestore();

    document.querySelector(`[data-workspace-nav="${currentPage}"]`)?.setAttribute('aria-current', 'page');
    initI18n(body);
    initThemeButton();
    initDesktopSidebar(sidebar);
    initMobileSidebar(sidebar, backdrop);
    initProfileShortcuts();
    initNotificationsPopover();

    onUserProfileUpdate(applyWorkspaceUserIdentity);

    window.addEventListener(
        'clashtools:language-changed',
        updateThemeButton
    );

    return loadInitialWorkspaceData();
}

const initialWorkspaceLoad = initWorkspaceShell();
window.clashtoolsRegisterInitialLoad?.(initialWorkspaceLoad);
