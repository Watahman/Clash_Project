import { getClanInfoRequest } from '../API/API-Clan.js';
import { createGroup, addGroupClan, joinGroup, leaveGroup } from '../Supabase/Supabase-Group.js';
import { getCurrentUserId } from '../utils/user.js';
import { withGlobalLoading } from '../utils/loading-state.js';
import { bindGroupDialog, closeGroupDialog, openGroupDialog } from './groups-dialog.js?v=20260813-redesign';
import { familyCopy } from './clan-family-copy.js';
import { t } from '../i18n/i18n.js';

const DEFAULT_SELECTED_GROUP_KEY = 'clashtoolsSelectedGroupId';
const DEFAULT_API = { createGroup, addGroupClan, joinGroup, leaveGroup };
const DEFAULT_DIALOGS = { bind: bindGroupDialog, close: closeGroupDialog, open: openGroupDialog };

export function initClanFamilyActions({
    refs,
    getState,
    reloadGroups,
    resetGroupDetail,
    setPageStatus,
    isFixture = () => Boolean(getState()?.entry?.fixture),
    selectedGroupKey = DEFAULT_SELECTED_GROUP_KEY,
    api = DEFAULT_API,
    getClanInfo = getClanInfoRequest,
    getUserId = getCurrentUserId,
    loading = withGlobalLoading,
    translate = t,
    copy = familyCopy,
    dialogs = DEFAULT_DIALOGS,
    storage = window.localStorage
}) {
    let createMode = 'name';

    bindCreateJoin();
    bindLeaveFlow();

    return { openNewOverlay, selectOverlayTab, selectCreateMode };

    function bindCreateJoin() {
        dialogs.bind(refs.newOverlay, () => dialogs.close(refs.newOverlay));
        refs.newButton?.addEventListener('click', () => openNewOverlay('create'));
        refs.emptyCreate?.addEventListener('click', () => openNewOverlay('create'));
        refs.emptyJoin?.addEventListener('click', () => openNewOverlay('join'));
        refs.joinShortcut?.addEventListener('click', () => openNewOverlay('join'));
        refs.createTab?.addEventListener('click', () => selectOverlayTab('create'));
        refs.joinTab?.addEventListener('click', () => selectOverlayTab('join'));
        refs.createNameOption?.addEventListener('click', () => selectCreateMode('name'));
        refs.createClanOption?.addEventListener('click', () => selectCreateMode('clanTag'));
        refs.createConfirm?.addEventListener('click', () => void submitCreate());
        refs.joinConfirm?.addEventListener('click', () => void submitJoin());
        selectOverlayTab('create');
        selectCreateMode('name');
    }

    function openNewOverlay(tab) {
        if (isFixture()) return setPageStatus(copy('noManagement'));
        if (!getUserId()) return setPageStatus(translate('groups.login'));
        selectOverlayTab(tab);
        dialogs.open(refs.newOverlay, tab === 'join' ? refs.joinCode : refs.nameInput);
    }

    function selectOverlayTab(tab) {
        const join = tab === 'join';
        refs.createPanel?.classList.toggle('hidden', join);
        refs.joinPanel?.classList.toggle('hidden', !join);
        refs.createTab?.classList.toggle('is-active', !join);
        refs.joinTab?.classList.toggle('is-active', join);
        refs.createTab?.setAttribute('aria-selected', String(!join));
        refs.joinTab?.setAttribute('aria-selected', String(join));
    }

    function selectCreateMode(mode) {
        createMode = mode === 'clanTag' ? 'clanTag' : 'name';
        const byClan = createMode === 'clanTag';
        refs.nameOption?.classList.toggle('is-active', !byClan);
        refs.clanOption?.classList.toggle('is-active', byClan);
        refs.createByName?.classList.toggle('hidden', byClan);
        refs.createByClan?.classList.toggle('hidden', !byClan);
    }

    async function submitCreate() {
        const input = createMode === 'clanTag' ? refs.clanInput : refs.nameInput;
        const value = input?.value.trim();
        if (!value) return;
        dialogs.close(refs.newOverlay, { restoreFocus: false });
        await createNewGroup(value, createMode);
    }

    async function createNewGroup(value, option) {
        const userId = getUserId();
        if (!userId || !value) return;
        const operation = option === 'clanTag' ? () => createFromClan(value, userId) : () => createFromName(value, userId);
        await loading(operation, translate('groups.loading')).catch(error => reportCreateError(error, option));
    }

    async function createFromName(name, userId) {
        const created = await api.createGroup(name, userId);
        rememberCreatedGroup(created);
        if (refs.nameInput) refs.nameInput.value = '';
        await reloadGroups();
    }

    async function createFromClan(value, userId) {
        const clanInfo = await getClanInfo(value);
        const clanTag = normalizeClanTag(clanInfo?.tag || value);
        const created = await api.createGroup(clanInfo?.name || clanTag, userId);
        const groupId = rememberCreatedGroup(created);
        if (!groupId) throw new Error('GROUP_ID_MISSING');
        await api.addGroupClan(groupId, {
            tag: clanTag,
            name: clanInfo?.name || clanTag,
            badgeUrl: clanBadgeUrl(clanInfo)
        });
        if (refs.clanInput) refs.clanInput.value = '';
        await reloadGroups();
    }

    function rememberCreatedGroup(created) {
        const groupId = Array.isArray(created) ? created[0]?.id : created?.id;
        if (groupId) storage.setItem(selectedGroupKey, groupId);
        return groupId;
    }

    function reportCreateError(error, option) {
        console.error(error);
        if (option === 'clanTag' && refs.clanHint) {
            refs.clanHint.textContent = error?.message === 'GROUP_ID_MISSING'
                ? translate('groups.clanLinkError')
                : translate('groups.clanNotFound');
        }
        setPageStatus(translate('groups.createError'));
    }

    async function submitJoin() {
        const code = refs.joinCode?.value.trim();
        if (!code) return;
        dialogs.close(refs.newOverlay, { restoreFocus: false });
        const userId = getUserId();
        if (!userId) return setPageStatus(translate('groups.login'));
        await loading(async () => {
            await api.joinGroup(userId, code);
            if (refs.joinCode) refs.joinCode.value = '';
            await reloadGroups();
        }, translate('groups.loading')).catch(error => reportActionError(error, 'join'));
    }

    function bindLeaveFlow() {
        dialogs.bind(refs.leaveOverlay, () => dialogs.close(refs.leaveOverlay));
        refs.leaveButton?.addEventListener('click', () => dialogs.open(refs.leaveOverlay, refs.leaveCancel));
        refs.leaveCancel?.addEventListener('click', () => dialogs.close(refs.leaveOverlay));
        refs.leaveConfirm?.addEventListener('click', () => void confirmLeave());
    }

    async function confirmLeave() {
        const userId = getState()?.userId || getUserId();
        const code = refs.detailCodeText?.textContent?.trim();
        dialogs.close(refs.leaveOverlay, { restoreFocus: false });
        if (!userId || !code) return;
        if (isFixture()) return setPageStatus(copy('noManagement'));
        await loading(async () => {
            await api.leaveGroup(userId, code);
            storage.removeItem(selectedGroupKey);
            resetGroupDetail();
            await reloadGroups();
        }, translate('groups.loading')).catch(error => reportActionError(error, 'leave'));
    }

    function reportActionError(error, action) {
        console.error(error);
        setPageStatus(translate(action === 'join' ? 'groups.joinError' : 'groups.leaveError'));
    }
}

export function normalizeClanTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    return tag ? (tag.startsWith('#') ? tag : `#${tag}`) : '';
}

export function clanBadgeUrl(info) {
    return info?.badgeUrls?.medium || info?.badgeUrls?.small || info?.badgeUrls?.large || '';
}
