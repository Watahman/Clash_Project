import { syncAuthSession } from '../auth/auth-client.js';
import { isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';
import { initI18n, t } from '../i18n/i18n.js?v=20260812-redesign';
import { getThemePreference, setThemePreference } from '../theme/theme-manager.js';
import { getWorkspaceModule } from './module-registry.js';
import { initWorkspaceGuidance } from './workspace-guidance.js?v=20260809-4';
import {
    initNotificationsPopover,
    loadWorkspaceNotifications
} from './workspace-notifications.js';
import {
    applyInitialSidebarState,
    initDesktopSidebar,
    initMobileSidebar
} from './workspace-sidebar.js';
import { buildWorkspaceShellMarkup } from './workspace-shell-markup.js';
import {
    loadWorkspaceUserIdentity,
    subscribeWorkspaceUserIdentity
} from './workspace-user.js';

const GUIDANCE_STYLESHEET = '../assets/css/workspace-guidance.css?v=20260812-redesign';
const MODULE_TITLED_PAGES = new Set(['groups', 'drafts', 'operation']);
const MODULE_KICKERS = Object.freeze({
    drafts: { selector: '.hero-eyebrow', key: 'shell.identity.savedPlansKicker' },
    operation: { selector: '.op-page-kicker', key: 'shell.identity.cwlKicker' }
});

function syncCanonicalWorkspaceIdentity(currentPage) {
    if (!MODULE_TITLED_PAGES.has(currentPage)) return;
    const module = getWorkspaceModule(currentPage);
    const main = document.querySelector('main');
    const heading = main?.querySelector('h1');
    if (heading) {
        heading.removeAttribute('data-compete-i18n');
        heading.dataset.i18n = module.key;
        heading.textContent = t(module.key);
    }

    const kickerConfig = MODULE_KICKERS[currentPage];
    const kicker = kickerConfig ? main?.querySelector(kickerConfig.selector) : null;
    if (kicker) {
        kicker.removeAttribute('data-compete-i18n');
        kicker.dataset.i18n = kickerConfig.key;
        kicker.textContent = t(kickerConfig.key);
    }

    const title = document.querySelector('title');
    const titleKey = `shell.identity.${currentPage}`;
    if (title) {
        title.removeAttribute('data-compete-i18n');
        title.dataset.i18n = titleKey;
        title.textContent = t(titleKey);
    }
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
    document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
        setThemePreference(getThemePreference() === 'light' ? 'dark' : 'light');
        updateThemeButton();
    });
    updateThemeButton();
}

async function protectRoute() {
    if (isRedesignFixtureRequested()) return true;
    const session = await syncAuthSession().catch(() => null);
    if (session) return true;
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/subpages/login.html?next=${encodeURIComponent(next)}`);
    return false;
}

async function loadInitialWorkspaceData() {
    if (isRedesignFixtureRequested()) return;
    if (!await protectRoute()) return;
    await Promise.allSettled([
        loadWorkspaceUserIdentity(),
        loadWorkspaceNotifications()
    ]);
}

function ensureGuidanceStyles() {
    if (document.querySelector('link[data-workspace-guidance]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GUIDANCE_STYLESHEET;
    link.dataset.workspaceGuidance = 'true';
    document.head.appendChild(link);
}

function mountShell(body, main, currentPage) {
    const markup = buildWorkspaceShellMarkup(currentPage);
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
    return { sidebar, backdrop };
}

function initMountedShell(body, sidebar, backdrop, currentPage) {
    document.querySelector(`[data-workspace-nav="${currentPage}"]`)?.setAttribute('aria-current', 'page');
    initI18n(body);
    syncCanonicalWorkspaceIdentity(currentPage);
    ensureGuidanceStyles();
    initWorkspaceGuidance(currentPage);
    initThemeButton();
    initDesktopSidebar(sidebar);
    initMobileSidebar(sidebar, backdrop);
    initNotificationsPopover();
    if (!isRedesignFixtureRequested()) subscribeWorkspaceUserIdentity();
    window.addEventListener('clashtools:language-changed', () => {
        updateThemeButton();
        syncCanonicalWorkspaceIdentity(currentPage);
    });
}

function initWorkspaceShell() {
    const body = document.body;
    if (!body.classList.contains('workspace-app') || body.dataset.shellReady === 'true') return;
    const main = body.querySelector(':scope > main');
    if (!main) return;
    body.querySelector(':scope > header')?.remove();
    const finishRestore = applyInitialSidebarState(body);
    const currentPage = body.dataset.workspacePage || 'dashboard';
    const { sidebar, backdrop } = mountShell(body, main, currentPage);
    body.dataset.shellReady = 'true';
    finishRestore();
    initMountedShell(body, sidebar, backdrop, currentPage);
    return loadInitialWorkspaceData();
}

const initialWorkspaceLoad = initWorkspaceShell();
window.clashtoolsRegisterInitialLoad?.(initialWorkspaceLoad);
