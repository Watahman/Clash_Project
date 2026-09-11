import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    authState: { status: 'authenticated', session: { user: { id: 'user-a' } } },
    plans: [{
        id: 'plan-a', name: 'Account A plan', clanCount: 1,
        freePlayerCount: 2, updatedAt: '2026-08-29T10:00:00Z', isOwner: true
    }],
    resolveAuthState: vi.fn(),
    getAllPlans: vi.fn(),
    checkUserId: vi.fn(),
    onUserProfileUpdate: vi.fn()
}));

vi.mock('../../src/assets/js/i18n/i18n.js?v=20260831-master-live-v1', () => ({
    getLanguage: () => 'en',
    initI18n: vi.fn(),
    t: (key, values = {}) => Object.entries(values).reduce(
        (result, [name, value]) => result.replaceAll(`{${name}}`, value), key
    )
}));
vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    AUTH_STATES: { AUTHENTICATED: 'authenticated' },
    resolveAuthState: mocks.resolveAuthState
}));
vi.mock('../../src/assets/js/utils/user.js', () => ({
    getCurrentUserId: () => localStorage.getItem('id')
}));
vi.mock('../../src/assets/js/Supabase/Supabase-User.js?v=20260829-public-auth-v1', () => ({
    checkUserId: mocks.checkUserId
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Plan.js?v=20260829-public-auth-v1', () => ({
    getAllPlansFromDatabase: mocks.getAllPlans
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Group.js?v=20260829-public-auth-v1', () => ({
    getGroupInfo: vi.fn(),
    getGroupsOfUser: vi.fn().mockResolvedValue([])
}));
vi.mock('../../src/assets/js/groups/groups-roles.js', () => ({
    roleLabelKey: role => role
}));
vi.mock('../../src/assets/js/cwl/cwl-plan-summary.js', () => ({
    summarizePlan: plan => plan
}));
vi.mock('../../src/assets/js/utils/name-initials.js', () => ({
    getNameInitials: name => name.slice(0, 1)
}));
vi.mock('../../src/assets/js/profile/profile-events.js', () => ({
    onUserProfileUpdate: mocks.onUserProfileUpdate
}));

function renderDashboardShell() {
    document.body.innerHTML = `
        <h1 id="dashboard-welcome"></h1>
        <p id="dashboard-plan-status"></p>
        <table><tbody id="dashboard-plan-list"></tbody></table>
        <p id="dashboard-group-status"></p>
        <div id="dashboard-group-list"></div>
        <p id="dashboard-account-line"><span id="dashboard-account-count"></span></p>
        <h2 id="dashboard-next-title"></h2>
        <p id="dashboard-next-copy"></p>
        <a id="dashboard-next-action"></a>
        <aside class="dashboard-attention"><p id="dashboard-attention-copy"></p></aside>`;
}

async function mountDashboard(userId, plan) {
    vi.resetModules();
    localStorage.setItem('id', userId);
    mocks.authState = { status: 'authenticated', session: { user: { id: userId } } };
    mocks.resolveAuthState.mockResolvedValue(mocks.authState);
    mocks.checkUserId.mockResolvedValue({ id: userId, name: userId, accounts: [] });
    mocks.getAllPlans.mockResolvedValue(plan ? [plan] : []);
    renderDashboardShell();
    await import('../../src/assets/js/pages/dashboard.js?v=20260831-dashboard-v1');
    await vi.waitFor(() => expect(mocks.getAllPlans).toHaveBeenCalledWith(userId));
    await vi.waitFor(() => expect(document.querySelector('[data-plan-open-ready]') ||
        document.querySelector('#dashboard-plan-list a')).not.toBeNull());
}

describe('planner entry storage flow', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        mocks.resolveAuthState.mockReset();
        mocks.getAllPlans.mockReset();
        mocks.checkUserId.mockReset();
    });

    it('stores the Dashboard plan selection in the planner key for the active user', async () => {
        await mountDashboard('user-a', mocks.plans[0]);
        const open = document.querySelector('#dashboard-plan-list a');
        open.addEventListener('click', event => event.preventDefault());
        open.click();

        expect(localStorage.getItem('clashpanel:planner:user-a:active')).toBe('plan-a');
        expect(localStorage.getItem('planner_id')).toBeNull();
    });

    it('keeps planner active selections isolated when the account changes', async () => {
        await mountDashboard('user-a', mocks.plans[0]);
        const accountAOpen = document.querySelector('#dashboard-plan-list a');
        accountAOpen.addEventListener('click', event => event.preventDefault());
        accountAOpen.click();

        const accountBPlan = { ...mocks.plans[0], id: 'plan-b', name: 'Account B plan' };
        await mountDashboard('user-b', accountBPlan);
        const accountBOpen = document.querySelector('#dashboard-plan-list a');
        accountBOpen.addEventListener('click', event => event.preventDefault());
        accountBOpen.click();

        expect(localStorage.getItem('clashpanel:planner:user-a:active')).toBe('plan-a');
        expect(localStorage.getItem('clashpanel:planner:user-b:active')).toBe('plan-b');
        expect(localStorage.getItem('planner_id')).toBeNull();
    });

    it('shows and prioritizes the local guest draft without requiring cloud access', async () => {
        mocks.resolveAuthState.mockResolvedValue({ status: 'guest', session: null });
        localStorage.setItem('clashpanel:guest:planner:current', JSON.stringify({
            version: 1,
            name: 'September CWL',
            info: { schemaVersion: 5, freePlayers: [], clans: [], pollMeta: {} },
            savedAt: '2026-08-31T12:00:00Z'
        }));
        renderDashboardShell();

        await import('../../src/assets/js/pages/dashboard.js?v=20260831-dashboard-v1');
        await vi.waitFor(() => expect(document.querySelector('#dashboard-plan-list strong')?.textContent)
            .toBe('September CWL'));

        expect(document.querySelector('#dashboard-plan-list a')?.getAttribute('href'))
            .toBe('/app/cwl-planner');
        expect(document.querySelector('#dashboard-next-action')?.getAttribute('href'))
            .toBe('/app/cwl-planner');
        expect(document.querySelector('#dashboard-next-title')?.textContent)
            .toBe('dashboard.v2ContinueTitle');
        expect(mocks.getAllPlans).not.toHaveBeenCalled();
    });
});
