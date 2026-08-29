import { AUTH_STATES, onAuthStateChange, resolveAuthState } from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { buildLoginUrl, getCurrentReturnPath, redirectToLogin } from '../auth/auth-navigation.js?v=20260829-public-auth-v1';
import { isRedesignFixtureRequested } from '../fixtures/redesign-fixture-mode.js';
import { initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { toggleTheme as toggleThemePreference } from '../theme/theme-manager.js?v=20260829-public-auth-v1';
import { initWorkspaceGuidance } from './workspace-guidance.js?v=20260829-public-auth-v1';
import {
    initNotificationsPopover,
    clearWorkspaceNotifications,
    loadWorkspaceNotifications
} from './workspace-notifications.js?v=20260829-public-auth-v1';
import {
    applyInitialSidebarState,
    initDesktopSidebar,
    initMobileSidebar
} from './workspace-sidebar.js?v=20260829-public-auth-v1';
import { buildWorkspaceShellMarkup } from './workspace-shell-markup.js?v=20260829-public-auth-v1';
import {
    clearWorkspaceUserIdentity,
    loadWorkspaceUserIdentity,
    subscribeWorkspaceUserIdentity
} from './workspace-user.js?v=20260829-public-auth-v1';
import { ACCESS, getWorkspaceModule } from './module-registry.js?v=20260829-public-auth-v1';

const GUIDANCE_STYLESHEET = '../assets/css/workspace-guidance.css?v=20260812-redesign';
let workspaceAuthGeneration = 0;
let workspaceAuthUserId = '';

function updateThemeButton() {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    const isLight = document.documentElement.dataset.theme === 'light';
    button.setAttribute('aria-pressed', String(isLight));
    button.setAttribute('aria-label', t(isLight ? 'theme.useDark' : 'theme.useLight'));
    button.title = t(isLight ? 'theme.useDark' : 'theme.useLight');
}

function initThemeButton() {
    document.querySelector('[data-theme-toggle]')?.addEventListener('click', event => {
        toggleThemePreference(event.currentTarget);
        updateThemeButton();
    });
    updateThemeButton();
}

function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
    element.setAttribute('aria-hidden', String(hidden));
}

function authStatusMessage(state, access) {
    if (state.status === AUTH_STATES.LOADING && access === ACCESS.AUTH) return t('auth.checkingSession');
    if (state.status === AUTH_STATES.UNAVAILABLE) return t('auth.sessionUnavailable');
    return '';
}

function setAuthPresentation(body, state, access, onRetry) {
    body.dataset.authState = state.status;
    body.dataset.workspaceAccess = access;
    body.classList.toggle('workspace-auth-loading', state.status === AUTH_STATES.LOADING);
    const authenticated = state.status === AUTH_STATES.AUTHENTICATED;
    const guest = state.status === AUTH_STATES.GUEST;
    body.querySelectorAll('[data-auth-only]').forEach(element => setHidden(element, !authenticated));
    body.querySelectorAll('[data-guest-only]').forEach(element => setHidden(element, !guest));
    body.querySelectorAll('[data-workspace-auth-lock]').forEach(element => setHidden(element, authenticated));
    body.querySelectorAll('[data-auth-login]').forEach(element => {
        element.href = buildLoginUrl(getCurrentReturnPath());
    });
    const status = body.querySelector('#workspace-auth-status');
    const message = body.querySelector('[data-workspace-auth-message]');
    const retry = body.querySelector('[data-workspace-auth-retry]');
    const text = authStatusMessage(state, access);
    if (message) message.textContent = text;
    setHidden(status, !text);
    setHidden(retry, state.status !== AUTH_STATES.UNAVAILABLE);
    if (retry) retry.onclick = onRetry;
    body.querySelector(':scope > .workspace-area > main')?.setAttribute(
        'aria-busy', String(state.status === AUTH_STATES.LOADING)
    );
    window.dispatchEvent(new CustomEvent('clashtools:auth-state-changed', { detail: state }));
}

async function loadAuthenticatedWorkspaceData(state) {
    await Promise.allSettled([
        loadWorkspaceUserIdentity(state, workspaceAuthGeneration),
        loadWorkspaceNotifications({
            authState: state,
            authGeneration: workspaceAuthGeneration
        })
    ]);
}

function applyAuthState(body, state, access, onRetry) {
    const userId = String(state?.session?.user?.id || '').trim();
    const changedUser = state.status !== AUTH_STATES.AUTHENTICATED
        || userId !== workspaceAuthUserId;
    workspaceAuthGeneration += 1;
    if (changedUser) {
        clearWorkspaceUserIdentity();
        clearWorkspaceNotifications();
    }
    workspaceAuthUserId = state.status === AUTH_STATES.AUTHENTICATED ? userId : '';
    setAuthPresentation(body, state, access, onRetry);
}

function retryWorkspaceAuth(body, currentPage) {
    body.dataset.authInitialReady = 'false';
    void loadInitialWorkspaceData(body, currentPage, true)
        .finally(() => { body.dataset.authInitialReady = 'true'; });
}

function handleAuthTransition(body, currentPage, state) {
    if (body.dataset.authInitialReady !== 'true') return;
    const access = getWorkspaceModule(currentPage).access;
    const retry = () => retryWorkspaceAuth(body, currentPage);
    applyAuthState(body, state, access, retry);
    if (access === ACCESS.AUTH && state.status === AUTH_STATES.GUEST) {
        redirectToLogin(getCurrentReturnPath());
        return;
    }
    if (state.status === AUTH_STATES.AUTHENTICATED) void loadAuthenticatedWorkspaceData(state);
}

function subscribeWorkspaceAuth(body, currentPage) {
    if (isRedesignFixtureRequested()) return;
    onAuthStateChange((_session, state) => handleAuthTransition(body, currentPage, state));
}

async function loadInitialWorkspaceData(body, currentPage, force = false) {
    const access = getWorkspaceModule(currentPage).access;
    if (isRedesignFixtureRequested()) {
        setAuthPresentation(body, { status: AUTH_STATES.GUEST, session: null }, access);
        return;
    }

    applyAuthState(
        body,
        { status: AUTH_STATES.LOADING, session: null },
        access,
        () => retryWorkspaceAuth(body, currentPage)
    );
    const state = await resolveAuthState({ force });
    applyAuthState(body, state, access, () => retryWorkspaceAuth(body, currentPage));
    if (access === ACCESS.AUTH && state.status === AUTH_STATES.GUEST) {
        redirectToLogin(getCurrentReturnPath());
        return;
    }
    if (state.status !== AUTH_STATES.AUTHENTICATED) return;
    await loadAuthenticatedWorkspaceData(state);
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
    ensureGuidanceStyles();
    initWorkspaceGuidance(currentPage);
    initThemeButton();
    initDesktopSidebar(sidebar);
    initMobileSidebar(sidebar, backdrop);
    initNotificationsPopover();
    subscribeWorkspaceUserIdentity();
    subscribeWorkspaceAuth(body, currentPage);
    window.addEventListener('clashtools:language-changed', updateThemeButton);
    window.addEventListener('clashtools:theme-changed', updateThemeButton);
}

function initWorkspaceShell() {
    const body = document.body;
    if (!body.classList.contains('workspace-app') || body.dataset.shellReady === 'true') return;
    const main = body.querySelector(':scope > main');
    if (!main) return;
    body.querySelector(':scope > header')?.remove();
    const finishRestore = applyInitialSidebarState(body);
    const currentPage = body.dataset.workspacePage || 'dashboard';
    body.dataset.authInitialReady = 'false';
    const { sidebar, backdrop } = mountShell(body, main, currentPage);
    body.dataset.shellReady = 'true';
    finishRestore();
    initMountedShell(body, sidebar, backdrop, currentPage);
    const initialWorkspaceLoad = loadInitialWorkspaceData(body, currentPage)
        .finally(() => { body.dataset.authInitialReady = 'true'; });
    return initialWorkspaceLoad;
}

const initialWorkspaceLoad = initWorkspaceShell();
window.clashtoolsRegisterInitialLoad?.(initialWorkspaceLoad);
