import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authCallback: null,
    resolveAuthState: vi.fn(),
    onAuthStateChange: vi.fn(callback => {
        mocks.authCallback = callback;
        return () => {};
    }),
    clearWorkspaceUserIdentity: vi.fn(),
    clearWorkspaceNotifications: vi.fn(),
    loadWorkspaceUserIdentity: vi.fn(),
    loadWorkspaceNotifications: vi.fn()
}));

vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    AUTH_STATES: {
        LOADING: 'loading',
        GUEST: 'guest',
        AUTHENTICATED: 'authenticated',
        UNAVAILABLE: 'auth-unavailable'
    },
    onAuthStateChange: mocks.onAuthStateChange,
    resolveAuthState: mocks.resolveAuthState
}));
vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    AUTH_STATES: {
        LOADING: 'loading',
        GUEST: 'guest',
        AUTHENTICATED: 'authenticated',
        UNAVAILABLE: 'auth-unavailable'
    },
    onAuthStateChange: mocks.onAuthStateChange,
    resolveAuthState: mocks.resolveAuthState
}));
vi.mock('../../src/assets/js/fixtures/redesign-fixture-mode.js', () => ({
    isRedesignFixtureRequested: () => false
}));
vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({
    initI18n: vi.fn(),
    t: key => key
}));
vi.mock('../../src/assets/js/theme/theme-manager.js?v=20260829-public-auth-v1', () => ({
    toggleTheme: vi.fn()
}));
vi.mock('../../src/assets/js/shell/workspace-guidance.js?v=20260829-public-auth-v1', () => ({
    initWorkspaceGuidance: vi.fn()
}));
vi.mock('../../src/assets/js/shell/workspace-notifications.js?v=20260829-public-auth-v1', () => ({
    initNotificationsPopover: vi.fn(),
    clearWorkspaceNotifications: mocks.clearWorkspaceNotifications,
    loadWorkspaceNotifications: mocks.loadWorkspaceNotifications
}));
vi.mock('../../src/assets/js/shell/workspace-sidebar.js?v=20260829-public-auth-v1', () => ({
    applyInitialSidebarState: () => () => {},
    initDesktopSidebar: vi.fn(),
    initMobileSidebar: vi.fn()
}));
vi.mock('../../src/assets/js/shell/workspace-shell-markup.js?v=20260829-public-auth-v1', () => ({
    buildWorkspaceShellMarkup: () => ({
        sidebar: '<aside><nav><a data-workspace-nav="dashboard"></a></nav></aside>',
        topbar: '<header><div id="workspace-auth-status"><span data-workspace-auth-message></span><button data-workspace-auth-retry></button></div></header>'
    })
}));
vi.mock('../../src/assets/js/shell/workspace-user.js?v=20260829-public-auth-v1', () => ({
    clearWorkspaceUserIdentity: mocks.clearWorkspaceUserIdentity,
    loadWorkspaceUserIdentity: mocks.loadWorkspaceUserIdentity,
    subscribeWorkspaceUserIdentity: vi.fn()
}));
vi.mock('../../src/assets/js/auth/auth-navigation.js?v=20260829-public-auth-v1', () => ({
    buildLoginUrl: () => '/subpages/login.html?next=%2Fdashboard',
    getCurrentReturnPath: () => '/dashboard',
    redirectToLogin: vi.fn()
}));
vi.mock('../../src/assets/js/shell/module-registry.js?v=20260829-public-auth-v1', () => ({
    ACCESS: { PUBLIC: 'public', AUTH: 'auth' },
    getWorkspaceModule: page => ({ access: page === 'explore' ? 'public' : 'auth' })
}));

describe('workspace auth transitions', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = '<main>Private data</main>';
        document.body.className = 'workspace-app';
        document.body.removeAttribute('data-shell-ready');
        document.body.dataset.workspacePage = 'dashboard';
        mocks.resolveAuthState.mockReset().mockResolvedValue({
            status: 'authenticated',
            session: { user: { id: 'u1' } },
            error: null
        });
        mocks.loadWorkspaceUserIdentity.mockClear();
        mocks.loadWorkspaceNotifications.mockClear();
        mocks.clearWorkspaceUserIdentity.mockClear();
        mocks.clearWorkspaceNotifications.mockClear();
        mocks.authCallback = null;
    });

    it('redirects a protected route on a later guest transition and keeps unavailable private content retryable', async () => {
        await import('../../src/assets/js/shell/workspace-shell.js?v=20260829-public-auth-v1');
        await vi.waitFor(() => expect(document.body.dataset.authInitialReady).toBe('true'));

        mocks.authCallback(null, { status: 'auth-unavailable', session: null, error: new Error('offline') });
        expect(document.body.dataset.authState).toBe('auth-unavailable');
        expect(document.querySelector('[data-workspace-auth-retry]').hidden).toBe(false);
        expect(mocks.loadWorkspaceUserIdentity).toHaveBeenCalledTimes(1);
        expect(mocks.loadWorkspaceNotifications).toHaveBeenCalledTimes(1);
        expect(mocks.clearWorkspaceUserIdentity).toHaveBeenCalled();
        expect(mocks.clearWorkspaceNotifications).toHaveBeenCalled();

        mocks.authCallback(null, { status: 'guest', session: null, error: null });
        const { redirectToLogin } = await import('../../src/assets/js/auth/auth-navigation.js?v=20260829-public-auth-v1');
        expect(redirectToLogin).toHaveBeenCalledWith('/dashboard');
        expect(mocks.loadWorkspaceUserIdentity).toHaveBeenCalledTimes(1);
        expect(mocks.loadWorkspaceNotifications).toHaveBeenCalledTimes(1);
    });

    it('keeps a public route usable when a later transition becomes guest', async () => {
        document.body.dataset.workspacePage = 'explore';
        await import('../../src/assets/js/shell/workspace-shell.js?v=20260829-public-auth-v1');
        await vi.waitFor(() => expect(document.body.dataset.authInitialReady).toBe('true'));

        mocks.authCallback(null, { status: 'guest', session: null, error: null });

        expect(document.body.dataset.authState).toBe('guest');
        expect(document.querySelector('main')).not.toBeNull();
    });
});
