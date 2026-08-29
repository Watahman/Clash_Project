import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getAllPlansFromDatabase: vi.fn(),
    getPlanFromDatabase: vi.fn(),
    setPlanToDatabase: vi.fn(),
    getGroupsOfUser: vi.fn(),
    getGroupInfo: vi.fn(),
    getGroupPolls: vi.fn(),
    getUserBases: vi.fn(),
    getFriends: vi.fn(),
    setCanAutosave: vi.fn(),
    setLoading: vi.fn(),
    requireAuthForAction: vi.fn(),
    onAuthStateChange: vi.fn()
}));

vi.mock('../../src/assets/js/Data/config.js', () => ({
    canAutosave: true,
    isLoading: false,
    setCanAutosave: mocks.setCanAutosave,
    setLoading: mocks.setLoading
}));
vi.mock('../../src/assets/js/templates/CWLTemplates.js?v=20260829-public-auth-v1', () => ({
    createPlayerCard: vi.fn(),
    createClanCard: vi.fn(),
    applyClanLeagueRestriction: vi.fn()
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Plan.js?v=20260829-public-auth-v1', () => ({
    getAllPlansFromDatabase: mocks.getAllPlansFromDatabase,
    getPlanFromDatabase: mocks.getPlanFromDatabase,
    setPlanToDatabase: mocks.setPlanToDatabase
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Group.js?v=20260829-public-auth-v1', () => ({
    getGroupsOfUser: mocks.getGroupsOfUser,
    getGroupInfo: mocks.getGroupInfo,
    getGroupMembers: vi.fn(),
    getGroupClans: vi.fn()
}));
vi.mock('../../src/assets/js/Supabase/Supabase-GroupPolls.js?v=20260829-public-auth-v1', () => ({
    getGroupPolls: mocks.getGroupPolls
}));
vi.mock('../../src/assets/js/Supabase/Supabase-User.js?v=20260829-public-auth-v1', () => ({
    getUserBases: mocks.getUserBases
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Friend.js?v=20260829-public-auth-v1', () => ({
    getFriends: mocks.getFriends
}));
vi.mock('../../src/assets/js/utils/user.js', () => ({
    getCurrentUserId: () => localStorage.getItem('id')
}));
vi.mock('../../src/assets/js/API/API-Clan.js?v=20260829-public-auth-v1', () => ({ getClanInfoRequest: vi.fn() }));
vi.mock('../../src/assets/js/API/API-Functions.js?v=20260829-public-auth-v1', () => ({ getPlayerBasicData: vi.fn() }));
vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    getCurrentReturnPath: () => '/app/cwl-planner',
    requireAuthForAction: mocks.requireAuthForAction,
    onAuthStateChange: mocks.onAuthStateChange
}));
vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({
    t: key => ({
        'cwl.defaultPlanName': 'Untitled',
        'planner.guestStored': 'Guest plan · Stored on this device',
        'cwl.noPlan': 'No plans'
    }[key] || key)
}));
vi.mock('../../src/assets/js/cwl/cwl-availability.js?v=20260829-public-auth-v1', () => ({
    getActiveCwlPollMeta: () => ({ groupId: '', pollId: '' }),
    clearActiveCwlPoll: vi.fn(),
    setActiveCwlPoll: vi.fn()
}));

const guestState = Object.freeze({ status: 'guest', session: null });
const authenticatedState = Object.freeze({
    status: 'authenticated',
    session: { user: { id: 'user-1' } }
});
const nextAuthenticatedState = Object.freeze({
    status: 'authenticated',
    session: { user: { id: 'user-2' } }
});

let authStateListener;

function transitionAuth(state) {
    expect(authStateListener).toEqual(expect.any(Function));
    authStateListener(state.session, state);
}

function deferred() {
    let resolve;
    const promise = new Promise(result => { resolve = result; });
    return { promise, resolve };
}

function plannerRefs(authState) {
    return {
        availablePlayers: document.querySelector('#available'),
        allClans: document.querySelector('#clans'),
        totalPlayerAmount: document.querySelector('#total'),
        planName: document.querySelector('#name'),
        loadPlan: document.querySelector('#plans'),
        authState
    };
}

function setupPlanner() {
    document.body.innerHTML = `
        <div id="available"></div>
        <div id="clans"></div>
        <p id="total">0</p>
        <input id="name" value="Guest roster">
        <select id="plans"></select>
        <span id="cwl-save-status"></span>
        <p id="cwl-plan-limit-feedback" hidden></p>`;
}

describe('CWL Planner guest flow', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        setupPlanner();
        Object.values(mocks).forEach(mock => mock.mockReset());
        mocks.getAllPlansFromDatabase.mockResolvedValue([]);
        mocks.requireAuthForAction.mockResolvedValue({ executed: false });
        authStateListener = null;
        mocks.onAuthStateChange.mockImplementation(listener => {
            authStateListener = listener;
            return () => {
                if (authStateListener === listener) authStateListener = null;
            };
        });
    });

    it('restores only the namespaced guest draft and never reads account plans', async () => {
        localStorage.setItem('id', 'stale-account-id');
        localStorage.setItem('planner_id', 'private-plan');
        localStorage.setItem('clashtools_planner_cache', JSON.stringify([
            { id: 'private-plan', name: 'Private account plan' }
        ]));
        localStorage.setItem('clashpanel:guest:planner:current', JSON.stringify({
            version: 1,
            name: 'Local plan',
            info: {
                schemaVersion: 5,
                freePlayers: [{ name: 'Local player', tag: '#LOCAL', townHallLevel: 17 }],
                clans: [],
                pollMeta: { groupId: '', pollId: '' }
            },
            savedAt: '2026-08-28T00:00:00.000Z'
        }));

        const templates = await import('../../src/assets/js/templates/CWLTemplates.js?v=20260829-public-auth-v1');
        const { initPlanIO, loadAllPlans } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(guestState);
        initPlanIO(refs);
        await loadAllPlans();

        expect(mocks.getAllPlansFromDatabase).not.toHaveBeenCalled();
        expect(refs.planName.value).toBe('Local plan');
        expect(refs.loadPlan.textContent).not.toContain('Private account plan');
        expect(templates.createPlayerCard).toHaveBeenCalledWith(
            expect.objectContaining({ tag: '#LOCAL' }),
            null
        );
        expect(document.querySelector('#cwl-save-status').textContent)
            .toBe('Guest plan · Stored on this device');
    });

    it('opens the account-namespaced active plan selected from Dashboard or Drafts', async () => {
        localStorage.setItem('clashpanel:planner:user-1:active', 'cloud-plan');
        mocks.getAllPlansFromDatabase.mockResolvedValue([{
            id: 'cloud-plan',
            name: 'Selected cloud plan',
            isOwner: true,
            info: { schemaVersion: 5, freePlayers: [], clans: [], pollMeta: {} }
        }]);
        const { initPlanIO, loadAllPlans } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(authenticatedState);
        initPlanIO(refs);

        await loadAllPlans();

        expect(refs.loadPlan.value).toBe('cloud-plan');
        expect(refs.planName.value).toBe('Selected cloud plan');
        expect(localStorage.getItem('planner_id')).toBeNull();
    });

    it('stores guest changes locally without calling cloud save or private cache writes', async () => {
        const { initPlanIO, loadAllPlans, savePlan } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(guestState);
        refs.availablePlayers.innerHTML = `
            <article class="cwl-player-article" data-planner-card="true" data-player-tag="#LOCAL">
                <p class="cwl-player-name">Local player</p>
                <p class="cwl-player-clan">Free roster</p>
                <p class="cwl-player-hashtag">#LOCAL</p>
            </article>`;
        initPlanIO(refs);
        await loadAllPlans();

        const result = await savePlan({ immediate: true });
        const draft = JSON.parse(localStorage.getItem('clashpanel:guest:planner:current'));

        expect(result).toEqual({ local: true });
        expect(mocks.setPlanToDatabase).not.toHaveBeenCalled();
        expect(draft).toMatchObject({ version: 1, name: 'Guest roster' });
        expect(draft.info.freePlayers[0].tag).toBe('#LOCAL');
        expect(localStorage.getItem('clashtools_planner_cache')).toBeNull();
        expect(localStorage.getItem('clashtools_last_planner_players')).toBeNull();
    });

    it('keeps the guest draft after cloud failure and clears it only after success', async () => {
        localStorage.setItem('clashpanel:guest:planner:current', JSON.stringify({
            version: 1,
            name: 'Migrating plan',
            info: { schemaVersion: 5, freePlayers: [], clans: [], pollMeta: {} },
            savedAt: '2026-08-28T00:00:00.000Z'
        }));
        const { initPlanIO, loadAllPlans, savePlan } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(authenticatedState);
        initPlanIO(refs);
        await loadAllPlans();

        mocks.setPlanToDatabase.mockRejectedValueOnce(new Error('offline'));
        expect(await savePlan({ immediate: true })).toBeNull();
        expect(localStorage.getItem('clashpanel:guest:planner:current')).not.toBeNull();

        mocks.setPlanToDatabase.mockResolvedValueOnce({ uuid: 'cloud-plan', revision: 1 });
        expect(await savePlan({ immediate: true })).toEqual({ uuid: 'cloud-plan', revision: 1 });
        expect(localStorage.getItem('clashpanel:guest:planner:current')).toBeNull();
    });

    it('clears private plan DOM and selection state before a logout guest view appears', async () => {
        const { initPlanIO, loadAllPlans } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(authenticatedState);
        initPlanIO(refs);
        await loadAllPlans();

        refs.availablePlayers.innerHTML = '<article class="cwl-player-article">Private player</article>';
        refs.allClans.innerHTML = '<article class="cwl-clan-article">Private clan</article>';
        refs.totalPlayerAmount.textContent = '30';
        refs.planName.value = 'Private plan';
        refs.loadPlan.innerHTML = '<option value="private-plan">Private plan</option>';
        refs.loadPlan.value = 'private-plan';

        transitionAuth(guestState);

        expect(refs.availablePlayers.childElementCount).toBe(0);
        expect(refs.allClans.childElementCount).toBe(0);
        expect(refs.totalPlayerAmount.textContent).toBe('0');
        expect(refs.planName.value).toBe('');
        expect(refs.loadPlan.value).toBe('');
        expect(refs.loadPlan.querySelector('[value="private-plan"]')).toBeNull();
        expect(refs.loadPlan.disabled).toBe(true);
    });

    it('clears private plan DOM before a different account view appears', async () => {
        const { initPlanIO, loadAllPlans } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(authenticatedState);
        initPlanIO(refs);
        await loadAllPlans();

        refs.availablePlayers.innerHTML = '<article class="cwl-player-article">Account A player</article>';
        refs.allClans.innerHTML = '<article class="cwl-clan-article">Account A clan</article>';
        refs.planName.value = 'Account A plan';
        refs.loadPlan.innerHTML = '<option value="account-a-plan">Account A plan</option>';
        refs.loadPlan.value = 'account-a-plan';

        transitionAuth(nextAuthenticatedState);

        expect(refs.availablePlayers.childElementCount).toBe(0);
        expect(refs.allClans.childElementCount).toBe(0);
        expect(refs.planName.value).toBe('');
        expect(refs.loadPlan.value).toBe('');
        expect(refs.loadPlan.querySelector('[value="account-a-plan"]')).toBeNull();
    });

    it('ignores a late Account A save after switching to Account B', async () => {
        const saveResponse = deferred();
        const { initPlanIO, loadAllPlans, savePlan } = await import(
            '../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(authenticatedState);
        refs.availablePlayers.innerHTML = `
            <article class="cwl-player-article" data-planner-card="true" data-player-tag="#A">
                <p class="cwl-player-name">Account A player</p>
                <p class="cwl-player-clan">Account A clan</p>
                <p class="cwl-player-hashtag">#A</p>
            </article>`;
        initPlanIO(refs);
        await loadAllPlans();
        mocks.setPlanToDatabase.mockReturnValueOnce(saveResponse.promise);

        const pendingSave = savePlan({ immediate: true });
        await vi.waitFor(() => expect(mocks.setPlanToDatabase).toHaveBeenCalled());
        transitionAuth(nextAuthenticatedState);
        await Promise.resolve();
        await Promise.resolve();
        const accountBCacheBeforeLateResponse = localStorage.getItem(
            'clashpanel:planner:user-2:cache'
        );
        saveResponse.resolve({ uuid: 'late-account-a-plan', revision: 4 });

        expect(await pendingSave).toBeNull();
        expect(refs.loadPlan.querySelector('[value="late-account-a-plan"]')).toBeNull();
        expect(localStorage.getItem('clashpanel:planner:user-2:cache'))
            .toBe(accountBCacheBeforeLateResponse);
        expect(localStorage.getItem('clashpanel:planner:user-2:active')).toBeNull();
    });

    it('does not load Clan Family or account sources for a guest', async () => {
        const { initGroupOverlay } = await import('../../src/assets/js/cwl/cwl-group.js?v=20260829-public-auth-v1');
        const select = document.createElement('select');
        document.body.append(select);

        initGroupOverlay(select, { authState: guestState });

        await Promise.resolve();
        expect(mocks.getGroupsOfUser).not.toHaveBeenCalled();
        expect(mocks.getGroupPolls).not.toHaveBeenCalled();
        expect(mocks.getUserBases).not.toHaveBeenCalled();
    });

    it('does not request linked accounts or friends when the player picker opens for a guest', async () => {
        const { initAddPlayersOverlay } = await import(
            '../../src/assets/js/cwl/cwl-overlay-player-picker.js?v=20260829-public-auth-v1'
        );
        document.body.innerHTML = `
            <button id="add"></button>
            <button id="confirm"></button>
            <button id="selected"></button>
            <input id="tag">
            <select id="group"></select>
            <div id="cwl-overlay-add-players" class="hidden"></div>
            <div id="cwl-account-list"></div>
            <p id="modal-account-list-empty"></p>`;
        const refs = {
            addPlayersBtn: document.querySelector('#add'),
            modalTabBtn: [],
            segBtns: [],
            addSelectedBtn: document.querySelector('#selected'),
            overlayConfirmTagBtn: document.querySelector('#confirm'),
            cwlInputTag: document.querySelector('#tag'),
            selectGroup: document.querySelector('#group'),
            authState: guestState
        };

        initAddPlayersOverlay(refs);
        await Promise.resolve();

        expect(mocks.getUserBases).not.toHaveBeenCalled();
        expect(mocks.getFriends).not.toHaveBeenCalled();
        expect(mocks.getGroupsOfUser).not.toHaveBeenCalled();
    });

    it('gates the visible Save action through the shared auth return flow', async () => {
        const { initPlannerSaveAction } = await import(
            '../../src/assets/js/cwl/cwl-planner-save-action.js?v=20260829-public-auth-v1'
        );
        const button = document.createElement('button');
        document.body.append(button);

        initPlannerSaveAction({ button });
        button.click();
        await Promise.resolve();

        expect(mocks.requireAuthForAction).toHaveBeenCalledWith(expect.objectContaining({
            reason: 'save-plan',
            returnTo: '/app/cwl-planner',
            action: expect.any(Function)
        }));
    });

    it('stores the current guest draft before showing the sign-in prompt', async () => {
        const { initPlanIO } = await import('../../src/assets/js/cwl/cwl-plan-io.js?v=20260829-public-auth-v1');
        const { initPlannerSaveAction } = await import(
            '../../src/assets/js/cwl/cwl-planner-save-action.js?v=20260829-public-auth-v1'
        );
        const refs = plannerRefs(guestState);
        const button = document.createElement('button');
        const dialog = document.createElement('dialog');
        dialog.id = 'cwl-guest-save-dialog';
        dialog.innerHTML = `
            <h2 data-i18n="planner.saveGuestTitle"></h2>
            <p data-i18n="planner.saveGuestDescription"></p>
            <button type="button" data-cwl-guest-save-close></button>
            <button type="button" data-cwl-guest-save-login></button>`;
        document.body.append(button, dialog);
        initPlanIO(refs);
        mocks.requireAuthForAction.mockImplementation(async ({ onGuest }) => {
            await onGuest({
                loginUrl: '/subpages/login.html?next=%2Fapp%2Fcwl-planner',
                returnTo: '/app/cwl-planner',
                state: guestState
            });
            return { executed: false };
        });

        initPlannerSaveAction({ button });
        button.click();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(JSON.parse(localStorage.getItem('clashpanel:guest:planner:current')))
            .toMatchObject({ version: 1, name: 'Guest roster' });
        expect(dialog.hasAttribute('open')).toBe(true);
        expect(dialog.querySelector('[data-i18n="planner.saveGuestTitle"]')).toBeTruthy();
    });

    it('provides localized guest-save copy for every workspace language', async () => {
        const { workspaceLocales } = await import('../../src/assets/js/i18n/workspace-locales.js?v=20260829-public-auth-v1');
        ['nl', 'en', 'fr', 'de', 'es'].forEach(language => {
            expect(workspaceLocales[language]['planner.saveGuestTitle']).toEqual(expect.any(String));
            expect(workspaceLocales[language]['planner.saveGuestDescription'])
                .toEqual(expect.any(String));
        });
    });
});
