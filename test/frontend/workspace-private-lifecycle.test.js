import { beforeEach, describe, expect, it, vi } from 'vitest';

const userMocks = vi.hoisted(() => ({
    checkUserId: vi.fn()
}));
const authMocks = vi.hoisted(() => ({ state: null }));

vi.mock('../../src/assets/js/Supabase/Supabase-User.js?v=20260829-public-auth-v1', () => ({
    checkUserId: userMocks.checkUserId
}));
vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    AUTH_STATES: { AUTHENTICATED: 'authenticated' },
    getAuthState: () => authMocks.state
}));
vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({ t: key => key }));
vi.mock('../../src/assets/js/profile/profile-events.js', () => ({
    onUserProfileUpdate: vi.fn(() => () => {})
}));

const notificationMocks = vi.hoisted(() => ({
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn()
}));

vi.mock('../../src/assets/js/Supabase/Supabase-Notifications.js?v=20260829-public-auth-v1', () => ({
    getNotifications: notificationMocks.getNotifications,
    markNotificationRead: notificationMocks.markNotificationRead
}));
vi.mock('../../src/assets/js/notifications/poll-notifications.js', () => ({
    buildGroupPollHref: vi.fn(() => null),
    pollNotificationCopy: vi.fn(() => ({ title: 'Notice', body: 'Details' })),
    stageGroupPollNavigation: vi.fn()
}));
function authenticated(userId) {
    return { status: 'authenticated', session: { user: { id: userId } } };
}

function privateMarkup() {
    document.body.innerHTML = `
        <a class="workspace-avatar">CT</a>
        <div class="workspace-profile-copy"><strong>Wrong fixture</strong></div>
    `;
}

describe('workspace identity lifecycle', () => {
    beforeEach(() => {
        vi.resetModules();
        userMocks.checkUserId.mockReset();
        authMocks.state = authenticated('user-a');
        localStorage.clear();
        localStorage.setItem('id', 'user-a');
        privateMarkup();
    });

    it('clears identity immediately when the session becomes guest', async () => {
        userMocks.checkUserId.mockResolvedValue({ id: 'user-a', name: 'Alice' });
        const identity = await import('../../src/assets/js/shell/workspace-user.js?v=20260829-public-auth-v1');

        await identity.loadWorkspaceUserIdentity(authMocks.state, 1);
        expect(document.querySelector('.workspace-avatar').textContent).toBe('A');

        authMocks.state = { status: 'guest', session: null };
        localStorage.removeItem('id');
        identity.clearWorkspaceUserIdentity();

        expect(document.querySelector('.workspace-avatar').textContent).toBe('CT');
        expect(document.querySelector('.workspace-avatar').title).toBe('');
        expect(document.querySelector('.workspace-profile-copy strong').textContent).toBe('header.user');
    });

    it('ignores a late account A response after account B starts loading', async () => {
        let resolveA;
        let resolveB;
        userMocks.checkUserId
            .mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }))
            .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }));
        const identity = await import('../../src/assets/js/shell/workspace-user.js?v=20260829-public-auth-v1');

        const pendingA = identity.loadWorkspaceUserIdentity(authMocks.state, 1);
        authMocks.state = authenticated('user-b');
        localStorage.setItem('id', 'user-b');
        identity.clearWorkspaceUserIdentity();
        const pendingB = identity.loadWorkspaceUserIdentity(authMocks.state, 2);

        resolveA({ id: 'user-a', name: 'Alice' });
        await pendingA;
        expect(document.querySelector('.workspace-profile-copy strong').textContent).toBe('header.user');

        resolveB({ id: 'user-b', name: 'Bob' });
        await pendingB;
        expect(document.querySelector('.workspace-profile-copy strong').textContent).toBe('Bob');
    });
});

describe('workspace notification lifecycle', () => {
    beforeEach(() => {
        vi.resetModules();
        notificationMocks.getNotifications.mockReset();
        authMocks.state = authenticated('user-a');
        localStorage.clear();
        localStorage.setItem('id', 'user-a');
        document.body.innerHTML = `
            <div id="workspace-notifications-root">
                <button id="workspace-notifications"></button>
                <section id="workspace-notifications-panel"><div id="workspace-notifications-list"></div></section>
                <span id="workspace-notifications-count"></span>
            </div>
        `;
    });

    it('clears notification state and DOM when the session becomes guest', async () => {
        notificationMocks.getNotifications.mockResolvedValue({
            items: [{ id: 'a', read_at: null }], unread: 1
        });
        const notifications = await import('../../src/assets/js/shell/workspace-notifications.js?v=20260829-public-auth-v1');

        await notifications.loadWorkspaceNotifications({
            authState: authMocks.state, authGeneration: 1
        });
        expect(document.querySelector('#workspace-notifications-list').children).toHaveLength(1);

        authMocks.state = { status: 'guest', session: null };
        localStorage.removeItem('id');
        notifications.clearWorkspaceNotifications();

        expect(document.querySelector('#workspace-notifications-list').children).toHaveLength(0);
        expect(document.querySelector('#workspace-notifications-count').textContent).toBe('0');
        expect(document.querySelector('#workspace-notifications-root').hidden).toBe(true);
    });

    it('ignores a late account A response after account B starts loading', async () => {
        let resolveA;
        let resolveB;
        notificationMocks.getNotifications
            .mockImplementationOnce(() => new Promise(resolve => { resolveA = resolve; }))
            .mockImplementationOnce(() => new Promise(resolve => { resolveB = resolve; }));
        const notifications = await import('../../src/assets/js/shell/workspace-notifications.js?v=20260829-public-auth-v1');

        const pendingA = notifications.loadWorkspaceNotifications({
            authState: authMocks.state, authGeneration: 1
        });
        authMocks.state = authenticated('user-b');
        localStorage.setItem('id', 'user-b');
        notifications.clearWorkspaceNotifications();
        const pendingB = notifications.loadWorkspaceNotifications({
            authState: authMocks.state, authGeneration: 2
        });

        resolveA({ items: [{ id: 'a', read_at: null }], unread: 1 });
        await pendingA;
        expect(document.querySelector('#workspace-notifications-list').children).toHaveLength(0);

        resolveB({ items: [{ id: 'b', read_at: null }], unread: 1 });
        await pendingB;
        expect(document.querySelector('#workspace-notifications-list').children).toHaveLength(1);
        expect(document.querySelector('#workspace-notifications-list').textContent).toContain('Notice');
    });
});
