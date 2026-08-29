import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getClanMembersBasicData: vi.fn(),
    getPlayerBasicData: vi.fn(),
    getGroupClans: vi.fn(),
    getGroupInfo: vi.fn(),
    getGroupMembers: vi.fn(),
    getGroupsOfUser: vi.fn(),
    getGroupPolls: vi.fn(),
    getUserBases: vi.fn(),
    getFriends: vi.fn(),
    createClanCard: vi.fn(),
    createPlayerCard: vi.fn(),
    clearActiveCwlPoll: vi.fn(),
    setActiveCwlPoll: vi.fn(),
    requireAuthForAction: vi.fn()
}));

vi.mock('../../src/assets/js/API/API-Functions.js?v=20260829-public-auth-v1', () => ({
    getClanMembersBasicData: mocks.getClanMembersBasicData,
    getPlayerBasicData: mocks.getPlayerBasicData
}));
vi.mock('../../src/assets/js/Supabase/Supabase-Group.js?v=20260829-public-auth-v1', () => ({
    getGroupClans: mocks.getGroupClans,
    getGroupInfo: mocks.getGroupInfo,
    getGroupMembers: mocks.getGroupMembers,
    getGroupsOfUser: mocks.getGroupsOfUser
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
vi.mock('../../src/assets/js/templates/CWLTemplates.js?v=20260829-public-auth-v1', () => ({
    createClanCard: mocks.createClanCard,
    createPlayerCard: mocks.createPlayerCard
}));
vi.mock('../../src/assets/js/utils/user.js', () => ({
    getCurrentUserId: () => localStorage.getItem('id')
}));
vi.mock('../../src/assets/js/auth/auth-client.js?v=20260829-public-auth-v1', () => ({
    getCurrentReturnPath: () => '/app/cwl-planner',
    requireAuthForAction: mocks.requireAuthForAction
}));
vi.mock('../../src/assets/js/cwl/cwl-availability.js?v=20260829-public-auth-v1', () => ({
    clearActiveCwlPoll: mocks.clearActiveCwlPoll,
    getActiveCwlPollMeta: () => ({ groupId: '', pollId: '' }),
    setActiveCwlPoll: mocks.setActiveCwlPoll
}));
vi.mock('../../src/assets/js/fixtures/redesign-fixture-mode.js', () => ({
    isRedesignFixtureRequested: () => false
}));
vi.mock('../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1', () => ({
    t: key => key
}));

const authenticatedState = userId => ({
    status: 'authenticated',
    session: { user: { id: userId } }
});
const unavailableState = Object.freeze({ status: 'auth-unavailable', session: null });

function deferred() {
    let resolve;
    const promise = new Promise(result => { resolve = result; });
    return { promise, resolve };
}

function setupOverlayDom() {
    document.body.innerHTML = `
        <button id="add"></button>
        <button id="confirm"></button>
        <button id="selected"></button>
        <input id="tag">
        <div id="cwl-overlay-add-players"></div>
        <div id="cwl-container-add-players"></div>
        <div id="cwl-account-list"></div>
        <p id="modal-account-list-empty"></p>
        <select id="group"></select>
        <select id="poll"></select>
        <select id="roster-poll"></select>
        <div id="group-preview"></div>
        <div id="group-preview-list"></div>
        <div id="linked-clans"></div>`;
}

function overlayRefs(authState) {
    return {
        addPlayersBtn: document.querySelector('#add'),
        modalTabBtn: [],
        segBtns: [],
        addSelectedBtn: document.querySelector('#selected'),
        overlayConfirmTagBtn: document.querySelector('#confirm'),
        cwlInputTag: document.querySelector('#tag'),
        selectGroup: document.querySelector('#group'),
        selectGroupPoll: document.querySelector('#poll'),
        rosterPollSelect: document.querySelector('#roster-poll'),
        groupPreview: document.querySelector('#group-preview'),
        groupPreviewList: document.querySelector('#group-preview-list'),
        groupLinkedClans: document.querySelector('#linked-clans'),
        authState
    };
}

describe('CWL Planner private-source security guards', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        Object.values(mocks).forEach(mock => mock.mockReset());
        mocks.getGroupsOfUser.mockResolvedValue([]);
        mocks.getGroupInfo.mockResolvedValue([]);
        mocks.getGroupMembers.mockResolvedValue([]);
        mocks.getGroupClans.mockResolvedValue([]);
        mocks.getGroupPolls.mockResolvedValue([]);
        mocks.getUserBases.mockResolvedValue([]);
        mocks.getFriends.mockResolvedValue([]);
        mocks.requireAuthForAction.mockResolvedValue({ executed: false });
    });

    it('clears account DOM and ignores late account/friend responses after auth becomes unavailable', async () => {
        const ownBases = deferred();
        const friends = deferred();
        const friendBases = deferred();
        mocks.getUserBases.mockImplementation(userId => userId === 'user-1'
            ? ownBases.promise
            : friendBases.promise);
        mocks.getFriends.mockReturnValue(friends.promise);
        setupOverlayDom();

        const { initAddPlayersOverlay } = await import(
            '../../src/assets/js/cwl/cwl-overlay-player-picker.js?v=20260829-public-auth-v1'
        );
        initAddPlayersOverlay(overlayRefs(authenticatedState('user-1')));
        friends.resolve([{ user_a: 'user-1', user_b: 'friend-1', status: 'accepted' }]);
        await vi.waitFor(() => expect(mocks.getUserBases).toHaveBeenCalledWith('friend-1'));

        const staleCard = document.createElement('article');
        staleCard.className = 'cwl-player-article';
        document.querySelector('#cwl-account-list').append(staleCard);
        const renderCount = mocks.createPlayerCard.mock.calls.length;
        window.dispatchEvent(new CustomEvent('clashtools:planner-auth-state-changed', {
            detail: unavailableState
        }));

        expect(document.querySelector('#cwl-account-list .cwl-player-article')).toBeNull();
        ownBases.resolve([{ accounts: [{ name: 'stale own account' }] }]);
        friendBases.resolve([{ accounts: [{ name: 'stale friend account' }] }]);
        await Promise.resolve();
        await Promise.resolve();

        expect(mocks.createPlayerCard).toHaveBeenCalledTimes(renderCount);
    });

    it('clears group DOM and ignores a late response from the previous account', async () => {
        const oldGroups = deferred();
        mocks.getGroupsOfUser.mockReturnValueOnce(oldGroups.promise);
        document.body.innerHTML = `
            <select id="group"></select>
            <select id="poll"></select>
            <select id="roster-poll"></select>
            <div id="preview"></div>
            <div id="preview-list"><article class="cwl-player-article"></article></div>
            <div id="linked"><button>Private clan</button></div>`;

        const { initGroupOverlay } = await import('../../src/assets/js/cwl/cwl-group.js?v=20260829-public-auth-v1');
        const select = document.querySelector('#group');
        initGroupOverlay(select, {
            authState: authenticatedState('user-1'),
            selectGroupPoll: document.querySelector('#poll'),
            rosterPollSelect: document.querySelector('#roster-poll'),
            groupPreview: document.querySelector('#preview'),
            groupPreviewList: document.querySelector('#preview-list'),
            groupLinkedClans: document.querySelector('#linked')
        });

        window.dispatchEvent(new CustomEvent('clashtools:planner-auth-state-changed', {
            detail: authenticatedState('user-2')
        }));
        expect(document.querySelector('#preview-list .cwl-player-article')).toBeNull();
        expect(document.querySelector('#linked').children).toHaveLength(0);

        oldGroups.resolve([{ group_id: 'old-private-group' }]);
        await Promise.resolve();
        await Promise.resolve();

        expect(mocks.getGroupInfo).not.toHaveBeenCalled();
        expect(select.querySelector('option[value="old-private-group"]')).toBeNull();
    });
});
