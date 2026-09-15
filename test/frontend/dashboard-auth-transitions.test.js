import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authCallback: null,
    profileCallback: null,
    resolveAuthState: vi.fn(),
    onAuthStateChange: vi.fn(callback => {
        mocks.authCallback = callback;
        return () => {
            if (mocks.authCallback === callback) mocks.authCallback = null;
        };
    }),
    onUserProfileUpdate: vi.fn(callback => {
        mocks.profileCallback = callback;
        return () => {
            if (mocks.profileCallback === callback) mocks.profileCallback = null;
        };
    }),
    checkUserId: vi.fn(),
    getAllPlans: vi.fn(),
    getGroupsOfUser: vi.fn(),
    getGroupInfo: vi.fn(),
    configureGuestPlanner: vi.fn(),
    readGuestPlannerDraft: vi.fn(() => null),
    persistActivePlannerId: vi.fn()
}));

vi.mock('../../src/assets/js/i18n/i18n.js?v=20260831-master-live-v1', () => ({
    getLanguage: () => 'en',
    initI18n: vi.fn(),
    t: (key, values = {}) => key === 'dashboard.welcomeName'
        ? `Welcome ${values.name}`
        : Object.entries(values).reduce(
            (result, [name, value]) => result.replaceAll(`{${name}}`, value), key
        )
}));
vi.mock('../../src/assets/js/auth/auth-client.js?v=20260915-auth-policy-v1', () => ({
    AUTH_STATES: {
        LOADING: 'loading',
        GUEST: 'guest',
        AUTHENTICATED: 'authenticated',
        UNAVAILABLE: 'auth-unavailable'
    },
    onAuthStateChange: mocks.onAuthStateChange,
    resolveAuthState: mocks.resolveAuthState,
    buildLoginUrl: returnTo => `/login?next=${encodeURIComponent(returnTo)}`
}));
vi.mock('../../src/assets/js/profile/profile-events.js', () => ({
    onUserProfileUpdate: mocks.onUserProfileUpdate
}));
vi.mock('../../src/assets/js/Supabase/Supabase-User.js?v=20260829-public-auth-v1', () => ({
    checkUserId: mocks.checkUserId
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Plan.js?v=20260829-public-auth-v1', () => ({
    getAllPlansFromDatabase: mocks.getAllPlans
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Group.js?v=20260829-public-auth-v1', () => ({
    getGroupsOfUser: mocks.getGroupsOfUser,
    getGroupInfo: mocks.getGroupInfo
}));
vi.mock('../../src/assets/js/cwl/cwl-planner-guest-storage.js?v=20260829-public-auth-v1', () => ({
    configureGuestPlanner: mocks.configureGuestPlanner,
    readGuestPlannerDraft: mocks.readGuestPlannerDraft,
    persistActivePlannerId: mocks.persistActivePlannerId
}));
vi.mock('../../src/assets/js/cwl/cwl-plan-summary.js', () => ({
    summarizePlan: plan => plan
}));
vi.mock('../../src/assets/js/groups/groups-roles.js', () => ({
    roleLabelKey: role => role
}));
vi.mock('../../src/assets/js/utils/name-initials.js', () => ({
    getNameInitials: name => name.slice(0, 1)
}));
vi.mock('../../src/assets/js/shell/module-registry.js?v=20260829-public-dashboard-v1', () => ({
    ACCESS: { PUBLIC: 'public', AUTH: 'auth' },
    WORKSPACE_MODULES: [
        { id: 'drafts', access: 'auth', href: '/app/cwl-planner-drafts' },
        { id: 'groups', access: 'auth', href: '/app/clan-management' },
        { id: 'profile', access: 'auth', href: '/app/profile' },
        { id: 'planner', access: 'auth', href: '/app/cwl-planner' },
        { id: 'operation', access: 'auth', href: '/app/cwl-tracker' },
        { id: 'minigames', access: 'public', href: '/app/minigames' },
        { id: 'advancedStats', access: 'auth', comingSoon: true, href: '/app/advanced-stats' }
    ]
}));

function authState(status, userId = '') {
    return {
        status,
        session: userId ? { user: { id: userId } } : null,
        error: null
    };
}

function renderDashboardShell() {
    document.body.innerHTML = `
        <h1 id="dashboard-welcome"></h1>
        <p id="dashboard-plan-status"></p>
        <table><tbody id="dashboard-plan-list"></tbody></table>
        <p id="dashboard-group-status"></p>
        <div id="dashboard-group-list"></div>
        <button id="dashboard-account-line" type="button"><strong id="dashboard-account-count"></strong></button>
        <h2 id="dashboard-next-title"></h2>
        <p id="dashboard-next-copy"></p>
        <a id="dashboard-next-action"></a>
        <aside class="dashboard-attention"><p id="dashboard-attention-copy"></p></aside>
        <a data-module-id="drafts" data-module-action></a>
        <a data-module-id="groups" data-module-action></a>`;
}

function setResolvedAccount(userId) {
    mocks.resolveAuthState.mockResolvedValue(authState('authenticated', userId));
    mocks.checkUserId.mockImplementation(async id => ({
        id,
        name: `User ${id}`,
        accounts: [{ id: `account-${id}` }]
    }));
    mocks.getAllPlans.mockImplementation(async id => [{
        id: `plan-${id}`,
        name: `Plan ${id}`,
        clanCount: 1,
        freePlayerCount: 2,
        updatedAt: '2026-09-01T10:00:00Z',
        isOwner: true
    }]);
    mocks.getGroupsOfUser.mockImplementation(async id => [{
        group_id: `group-${id}`,
        role: 'admin'
    }]);
    mocks.getGroupInfo.mockImplementation(async id => [{
        id,
        name: `Family ${id}`
    }]);
}

async function mountAccount(userId = 'user-a') {
    vi.resetModules();
    renderDashboardShell();
    setResolvedAccount(userId);
    await import('../../src/assets/js/pages/dashboard.js?v=20260831-dashboard-v1');
    await vi.waitFor(() => expect(document.querySelector('#dashboard-welcome')?.textContent)
        .toContain(`User ${userId}`));
}

function emitAuth(nextState) {
    expect(mocks.authCallback).toEqual(expect.any(Function));
    mocks.authCallback(nextState.session, nextState);
}

function expectPrivateStateCleared(userId) {
    expect(document.querySelector('#dashboard-welcome')?.textContent).toBe('dashboard.welcome');
    expect(document.querySelector('#dashboard-plan-list')?.textContent).not.toContain(userId);
    expect(document.querySelector('#dashboard-group-list')?.textContent).not.toContain(userId);
    expect(document.querySelector('#dashboard-account-count')?.textContent).toBe('0');
    expect(document.querySelector('#dashboard-account-line')).toHaveProperty('hidden', true);
}

describe('dashboard auth transitions', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        mocks.authCallback = null;
        mocks.profileCallback = null;
        mocks.resolveAuthState.mockReset();
        mocks.checkUserId.mockReset();
        mocks.getAllPlans.mockReset();
        mocks.getGroupsOfUser.mockReset();
        mocks.getGroupInfo.mockReset();
        mocks.readGuestPlannerDraft.mockReset().mockReturnValue(null);
        mocks.configureGuestPlanner.mockClear();
        mocks.onAuthStateChange.mockClear();
        mocks.onUserProfileUpdate.mockClear();
    });

    it.each([
        ['logout', 'guest'],
        ['expired session', 'guest']
    ])('clears personal content immediately on %s', async (_label, status) => {
        await mountAccount();

        emitAuth(authState(status));

        expectPrivateStateCleared('user-a');
        expect(document.querySelector('#dashboard-plan-list')?.textContent)
            .toContain('dashboard.noCloudPlans');
        expect(document.querySelector('#dashboard-group-list')?.textContent)
            .toContain('dashboard.groupsGuestCopy');
    });

    it.each([
        ['loading', 'auth.checkingSession'],
        ['auth-unavailable', 'auth.sessionUnavailable']
    ])('keeps %s neutral without login actions', async (status, message) => {
        await mountAccount();

        emitAuth(authState(status));

        expectPrivateStateCleared('user-a');
        expect(document.querySelector('#dashboard-plan-list')?.textContent).toContain(message);
        expect(document.querySelector('#dashboard-group-list')?.textContent).toContain(message);
        expect(document.querySelector('#dashboard-plan-list a')).toBeNull();
        expect(document.querySelector('#dashboard-group-list a')).toBeNull();
        document.querySelectorAll('[data-module-id]').forEach(module => {
            expect(module.dataset.moduleState).toBe(status === 'loading'
                ? 'auth-loading'
                : 'auth-unavailable');
            expect(module.hasAttribute('href')).toBe(false);
        });
    });

    it('ignores duplicate guest and authenticated events without reloading private data', async () => {
        await mountAccount();
        const initialCalls = {
            user: mocks.checkUserId.mock.calls.length,
            plans: mocks.getAllPlans.mock.calls.length,
            groups: mocks.getGroupsOfUser.mock.calls.length
        };

        emitAuth(authState('authenticated', 'user-a'));
        emitAuth(authState('guest'));
        emitAuth(authState('guest'));

        expectPrivateStateCleared('user-a');
        expect(mocks.checkUserId).toHaveBeenCalledTimes(initialCalls.user);
        expect(mocks.getAllPlans).toHaveBeenCalledTimes(initialCalls.plans);
        expect(mocks.getGroupsOfUser).toHaveBeenCalledTimes(initialCalls.groups);
    });

    it('reloads the new account and rejects late results from the old account', async () => {
        let resolveAUser;
        let resolveAPlans;
        let resolveAGroups;
        const aUser = new Promise(resolve => { resolveAUser = resolve; });
        const aPlans = new Promise(resolve => { resolveAPlans = resolve; });
        const aGroups = new Promise(resolve => { resolveAGroups = resolve; });
        mocks.resolveAuthState.mockResolvedValue(authState('authenticated', 'user-a'));
        mocks.checkUserId.mockImplementation(id => id === 'user-a' ? aUser : Promise.resolve({
            id, name: `User ${id}`, accounts: [{ id: `account-${id}` }]
        }));
        mocks.getAllPlans.mockImplementation(id => id === 'user-a' ? aPlans : Promise.resolve([{
            id: 'plan-user-b', name: 'Plan user-b', clanCount: 1, freePlayerCount: 1,
            updatedAt: '2026-09-01T10:00:00Z', isOwner: true
        }]));
        mocks.getGroupsOfUser.mockImplementation(id => id === 'user-a' ? aGroups : Promise.resolve([
            { group_id: 'group-user-b', role: 'admin' }
        ]));
        mocks.getGroupInfo.mockResolvedValue([{ id: 'group-user-b', name: 'Family user-b' }]);

        vi.resetModules();
        renderDashboardShell();
        await import('../../src/assets/js/pages/dashboard.js?v=20260831-dashboard-v1');
        await vi.waitFor(() => expect(mocks.checkUserId).toHaveBeenCalledWith('user-a'));

        emitAuth(authState('authenticated', 'user-b'));
        expectPrivateStateCleared('user-a');

        resolveAUser({ id: 'user-a', name: 'User user-a', accounts: [{ id: 'account-a' }] });
        resolveAPlans([{ id: 'plan-user-a', name: 'Plan user-a' }]);
        resolveAGroups([{ group_id: 'group-user-a', role: 'admin' }]);

        await vi.waitFor(() => expect(document.querySelector('#dashboard-welcome')?.textContent)
            .toContain('User user-b'));
        expect(document.querySelector('#dashboard-plan-list')?.textContent).toContain('Plan user-b');
        expect(document.querySelector('#dashboard-plan-list')?.textContent).not.toContain('Plan user-a');
        expect(document.querySelector('#dashboard-group-list')?.textContent).toContain('Family user-b');
        expect(document.querySelector('#dashboard-group-list')?.textContent).not.toContain('Family user-a');
        expect(mocks.checkUserId).toHaveBeenCalledWith('user-b');
        expect(mocks.getAllPlans).toHaveBeenCalledWith('user-b');
        expect(mocks.getGroupsOfUser).toHaveBeenCalledWith('user-b');
    });
});
