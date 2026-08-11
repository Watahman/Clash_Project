import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initClanFamilyActions, normalizeClanTag } from '../../src/assets/js/groups/clan-family-actions.js';

function makeRefs() {
    document.body.innerHTML = `
        <button id="new"></button><button id="empty-create"></button><button id="empty-join"></button><button id="join-shortcut"></button>
        <div id="new-overlay" class="hidden"><button id="create-tab"></button><button id="join-tab"></button><div id="create-panel"></div><div id="join-panel" class="hidden"></div>
            <button id="name-option"></button><button id="clan-option"></button><div id="create-by-name"></div><div id="create-by-clan" class="hidden"></div>
            <input id="name-input"><input id="clan-input"><p id="clan-hint"></p><button id="create-confirm"></button><input id="join-code"><button id="join-confirm"></button></div>
        <button id="leave-button"></button><div id="leave-overlay" class="hidden"><button id="leave-cancel"></button><button id="leave-confirm"></button></div>
        <span id="detail-code">------</span>`;
    return {
        newButton: document.querySelector('#new'),
        emptyCreate: document.querySelector('#empty-create'),
        emptyJoin: document.querySelector('#empty-join'),
        joinShortcut: document.querySelector('#join-shortcut'),
        newOverlay: document.querySelector('#new-overlay'),
        createTab: document.querySelector('#create-tab'),
        joinTab: document.querySelector('#join-tab'),
        createPanel: document.querySelector('#create-panel'),
        joinPanel: document.querySelector('#join-panel'),
        createNameOption: document.querySelector('#name-option'),
        createClanOption: document.querySelector('#clan-option'),
        nameOption: document.querySelector('#name-option'),
        clanOption: document.querySelector('#clan-option'),
        createByName: document.querySelector('#create-by-name'),
        createByClan: document.querySelector('#create-by-clan'),
        nameInput: document.querySelector('#name-input'),
        clanInput: document.querySelector('#clan-input'),
        clanHint: document.querySelector('#clan-hint'),
        createConfirm: document.querySelector('#create-confirm'),
        joinCode: document.querySelector('#join-code'),
        joinConfirm: document.querySelector('#join-confirm'),
        leaveButton: document.querySelector('#leave-button'),
        leaveOverlay: document.querySelector('#leave-overlay'),
        leaveCancel: document.querySelector('#leave-cancel'),
        leaveConfirm: document.querySelector('#leave-confirm'),
        detailCodeText: document.querySelector('#detail-code')
    };
}

function makeDialogs() {
    return {
        bind: vi.fn(),
        open: vi.fn(dialog => dialog?.classList.remove('hidden')),
        close: vi.fn(dialog => dialog?.classList.add('hidden'))
    };
}

function makeController(refs, overrides = {}) {
    const api = {
        createGroup: vi.fn().mockResolvedValue([{ id: 'family-1' }]),
        addGroupClan: vi.fn().mockResolvedValue([]),
        joinGroup: vi.fn().mockResolvedValue([]),
        leaveGroup: vi.fn().mockResolvedValue([]),
        ...overrides.api
    };
    const reloadGroups = vi.fn().mockResolvedValue(undefined);
    const resetGroupDetail = vi.fn();
    const setPageStatus = vi.fn();
    const controller = initClanFamilyActions({
        refs,
        api,
        getClanInfo: overrides.getClanInfo || vi.fn().mockResolvedValue({ tag: '#NORTH1', name: 'Northwind Main' }),
        getState: () => ({ userId: 'user-1' }),
        getUserId: () => 'user-1',
        reloadGroups,
        resetGroupDetail,
        setPageStatus,
        isFixture: overrides.isFixture || (() => false),
        loading: operation => operation(),
        copy: overrides.copy || (key => key),
        translate: overrides.translate || (key => key),
        dialogs: makeDialogs(),
        storage: localStorage
    });
    return { controller, api, reloadGroups, resetGroupDetail, setPageStatus };
}

describe('Clan Family lifecycle actions', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('preserves create-by-name, create-by-clan and invitation code behavior', async () => {
        const refs = makeRefs();
        const getClanInfo = vi.fn().mockResolvedValue({ tag: '#north1', name: 'Northwind Main' });
        const { controller, api, reloadGroups } = makeController(refs, { getClanInfo });

        refs.newButton.click();
        refs.nameInput.value = 'Northwind Family';
        refs.createConfirm.click();
        await vi.waitFor(() => expect(api.createGroup).toHaveBeenCalledWith('Northwind Family', 'user-1'));
        expect(localStorage.getItem('clashtoolsSelectedGroupId')).toBe('family-1');

        controller.selectCreateMode('clanTag');
        refs.clanInput.value = 'north1';
        refs.createConfirm.click();
        await vi.waitFor(() => expect(getClanInfo).toHaveBeenCalledWith('north1'));
        await vi.waitFor(() => expect(api.addGroupClan).toHaveBeenCalledWith('family-1', {
            tag: '#NORTH1',
            name: 'Northwind Main',
            badgeUrl: ''
        }));
        expect(reloadGroups).toHaveBeenCalledTimes(2);
        expect(normalizeClanTag('north1')).toBe('#NORTH1');
    });

    it('joins with the invitation code and leaves through the confirmed backend path', async () => {
        const refs = makeRefs();
        const { controller, api, reloadGroups, resetGroupDetail } = makeController(refs);
        controller.selectOverlayTab('join');
        refs.joinCode.value = 'NW-240817';
        refs.joinConfirm.click();
        await vi.waitFor(() => expect(api.joinGroup).toHaveBeenCalledWith('user-1', 'NW-240817'));

        localStorage.setItem('clashtoolsSelectedGroupId', 'family-1');
        refs.detailCodeText.textContent = 'NW-240817';
        refs.leaveButton.click();
        refs.leaveConfirm.click();
        await vi.waitFor(() => expect(api.leaveGroup).toHaveBeenCalledWith('user-1', 'NW-240817'));
        expect(localStorage.getItem('clashtoolsSelectedGroupId')).toBeNull();
        expect(resetGroupDetail).toHaveBeenCalledOnce();
        expect(reloadGroups).toHaveBeenCalledTimes(2);
    });

    it('keeps fixture lifecycle controls read-only', () => {
        const refs = makeRefs();
        const { api, setPageStatus } = makeController(refs, { isFixture: () => true });
        refs.newButton.click();
        refs.leaveButton.click();
        expect(api.createGroup).not.toHaveBeenCalled();
        expect(api.joinGroup).not.toHaveBeenCalled();
        expect(api.leaveGroup).not.toHaveBeenCalled();
        expect(setPageStatus).toHaveBeenCalledWith('noManagement');
    });
});
