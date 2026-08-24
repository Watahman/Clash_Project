import { t } from '../i18n/i18n.js';

const SIDEBAR_COLLAPSED_KEY = 'clashtools_workspace_sidebar_collapsed';

function getStoredSidebarState() {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'; }
    catch { return false; }
}
function persistSidebarState(collapsed) {
    try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed)); }
    catch { /* The sidebar remains usable without storage. */ }
}

export function applyInitialSidebarState(body) {
    const previousTransition = body.style.transition;
    body.style.transition = 'none';
    body.classList.toggle('workspace-sidebar-collapsed', getStoredSidebarState());
    return () => window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (previousTransition) body.style.transition = previousTransition;
        else body.style.removeProperty('transition');
    }));
}

function syncCollapsedLabels(sidebar, collapsed) {
    sidebar.querySelectorAll('[data-workspace-nav]').forEach(link => {
        const label = link.querySelector('span')?.textContent?.trim();
        if (collapsed && label) link.title = label;
        else link.removeAttribute('title');
    });
    const profile = sidebar.querySelector('#profile-btn');
    if (!profile) return;
    profile.setAttribute('aria-label', t('shell.openProfile'));
    if (collapsed) profile.title = t('shell.openProfile');
    else profile.removeAttribute('title');
}

function setDesktopCollapsed(sidebar, collapsed, persist = true) {
    const button = sidebar.querySelector('#workspace-sidebar-toggle');
    document.body.classList.toggle('workspace-sidebar-collapsed', collapsed);
    button?.setAttribute('aria-expanded', String(!collapsed));
    if (button) {
        button.setAttribute('aria-label', t(collapsed ? 'shell.openMenu' : 'shell.closeMenu'));
        button.title = t(collapsed ? 'shell.openMenu' : 'shell.closeMenu');
    }
    syncCollapsedLabels(sidebar, collapsed);
    if (persist) persistSidebarState(collapsed);
}

export function initDesktopSidebar(sidebar) {
    const button = sidebar.querySelector('#workspace-sidebar-toggle');
    if (!button) return;
    setDesktopCollapsed(sidebar, getStoredSidebarState(), false);
    button.addEventListener('click', () => setDesktopCollapsed(
        sidebar,
        !document.body.classList.contains('workspace-sidebar-collapsed')
    ));
    window.addEventListener('clashtools:language-changed', () => setDesktopCollapsed(
        sidebar,
        document.body.classList.contains('workspace-sidebar-collapsed'),
        false
    ));
}

export function initMobileSidebar(sidebar, backdrop) {
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
    sidebar.addEventListener('click', event => event.target.closest('a') && close());
    document.addEventListener('keydown', event => event.key === 'Escape' && close());
}
