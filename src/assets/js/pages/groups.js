import { initI18n, t } from '../i18n/i18n.js';
import { getClanInfoRequest } from '../API/API-Clan.js';
import { createGroupCard } from '../templates/GroupTemplates.js';
import { profileHTML } from '../profile/profile_popup.js';
import { addGroupClan, createGroup, getGroupsOfUser, joinGroup, leaveGroup } from '../Supabase/Supabase-Group.js';
import { getCurrentUserId } from '../utils/user.js';
import { withGlobalLoading } from '../utils/loading-state.js';
import { initGroupPolls } from '../groups/groups-polls.js';
import { createClanAdmin } from '../groups/groups-admin-clans.js';
import { initGroupMemberDrawer } from '../groups/groups-member-drawer.js';
import { initClanFamilyOverview } from '../groups/clan-family-overview.js';
import { initClanFamilyMembers } from '../groups/clan-family-members.js';
import { loadClanFamilyFixture } from '../groups/clan-family-fixtures.js';
import { applyFamilyCopy, familyCopy } from '../groups/clan-family-copy.js';
import { activateGroupTab, bindGroupTabs, normalizeGroupTab } from '../groups/groups-tabs.js';
import { initGroupIndexSlider } from '../groups/groups-index-slider.js';
import { openGroupDialog, closeGroupDialog, bindGroupDialog } from '../groups/groups-dialog.js';
import { syncAuthSession } from '../auth/auth-client.js';
import {
    GROUP_TAB_STORAGE_PREFIX, OPEN_GROUP_STORAGE_KEY, OPEN_POLL_STORAGE_KEY,
    readGroupPollTarget, unreadPollNotificationCount
} from '../notifications/poll-notifications.js';

const selectedGroupKey = 'clashtoolsSelectedGroupId';
const refs = queryRefs();
const state = { group: null, members: [], entry: {}, currentRole: 'member', userId: '', fixture: null, reload: 0, notifications: [] };
let createMode = 'name';
let clanAdmin;

async function init() {
    initI18n();
    applyFamilyCopy(document);
    initGroupIndexSlider(refs.workspace, refs.indexToggle);
    stageRequestedPollTarget();
    await syncAuthSession().catch(() => null);
    initCreateJoinOverlay();
    initTabs();
    initFamilyMenu();
    initCopyCode();
    initLeaveFlow();
    initRetry();
    initModules();
    bindNotifications();
    profileHTML();
    await reloadGroups();
}

function initModules() {
    clanAdmin = createClanAdmin(queryClanElements(), getState, setPageStatus, emptyMessage);
    initGroupPolls(emptyMessage);
    initGroupMemberDrawer(emptyMessage);
    initClanFamilyMembers();
    initClanFamilyOverview(tab => showGroupTab(tab));
    window.addEventListener('clashtools:group-opened', event => {
        state.group = event.detail?.group || null;
        state.members = event.detail?.members || [];
        state.entry = event.detail?.entry || {};
        state.currentRole = event.detail?.currentRole || 'member';
        state.userId = event.detail?.currentUserId || getCurrentUserId();
        state.fixture = event.detail?.fixture || null;
        window.localStorage.setItem(selectedGroupKey, state.group?.id || '');
        const storedTab = state.group?.id ? window.localStorage.getItem(`${GROUP_TAB_STORAGE_PREFIX}${state.group.id}`) : '';
        if (storedTab) showGroupTab(storedTab, false);
        updateHeaderMenu();
        void clanAdmin.load();
        updatePollNotificationCount();
        window.dispatchEvent(new CustomEvent('clashtools:notifications-requested'));
    });
    window.addEventListener('clashtools:group-roles-updated', event => {
        state.group = event.detail?.group || state.group;
        state.members = event.detail?.members || state.members;
        state.currentRole = event.detail?.currentRole || state.currentRole;
        state.userId = event.detail?.currentUserId || state.userId;
    });
    window.addEventListener('clan-family:clans-updated', updateHeaderCounts);
}

function getState() {
    return {
        group: state.group,
        members: state.members,
        currentRole: state.currentRole,
        userId: state.userId || getCurrentUserId(),
        canAdmin: ['leader', 'co_leader'].includes(state.currentRole),
        entry: state.entry
    };
}

function initTabs() {
    bindGroupTabs(document, tabName => showGroupTab(tabName));
    activateGroupTab(document, 'overview');
}

function showGroupTab(tabName, persist = true) {
    const safeTab = activateGroupTab(document, normalizeGroupTab(tabName));
    if (persist && state.group?.id) localStorage.setItem(`${GROUP_TAB_STORAGE_PREFIX}${state.group.id}`, safeTab);
    if (safeTab === 'settings') refs.familyMenu?.classList.add('hidden');
}

function initFamilyMenu() {
    refs.menuButton?.addEventListener('click', () => {
        const open = refs.familyMenu?.classList.toggle('hidden') === false;
        refs.menuButton.setAttribute('aria-expanded', String(open));
    });
    refs.settingsShortcut?.addEventListener('click', () => showGroupTab('settings'));
    refs.leaveShortcut?.addEventListener('click', () => refs.leaveButton?.click());
    document.addEventListener('click', event => {
        if (!refs.familyMenu || refs.familyMenu.contains(event.target) || event.target === refs.menuButton) return;
        refs.familyMenu.classList.add('hidden');
        refs.menuButton?.setAttribute('aria-expanded', 'false');
    });
}

function initCreateJoinOverlay() {
    bindGroupDialog(refs.newOverlay, () => closeGroupDialog(refs.newOverlay));
    refs.newButton?.addEventListener('click', () => openNewOverlay('create'));
    refs.emptyCreate?.addEventListener('click', () => openNewOverlay('create'));
    refs.emptyJoin?.addEventListener('click', () => openNewOverlay('join'));
    refs.joinShortcut?.addEventListener('click', () => openNewOverlay('join'));
    refs.createTab?.addEventListener('click', () => selectOverlayTab('create'));
    refs.joinTab?.addEventListener('click', () => selectOverlayTab('join'));
    refs.createNameOption?.addEventListener('click', () => selectCreateMode('name'));
    refs.createClanOption?.addEventListener('click', () => selectCreateMode('clanTag'));
    refs.createConfirm?.addEventListener('click', () => submitCreate());
    refs.joinConfirm?.addEventListener('click', () => submitJoin());
    selectOverlayTab('create');
    selectCreateMode('name');
}

function openNewOverlay(tab) {
    if (state.fixture) return setPageStatus(familyCopy('noManagement'));
    if (!getCurrentUserId()) return setPageStatus(t('groups.login'));
    selectOverlayTab(tab);
    openGroupDialog(refs.newOverlay, tab === 'join' ? refs.joinCode : refs.nameInput);
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
    const value = (createMode === 'clanTag' ? refs.clanInput : refs.nameInput)?.value.trim();
    if (!value) return;
    closeGroupDialog(refs.newOverlay, { restoreFocus: false });
    await createNewGroup(value, createMode);
}

async function createNewGroup(value, option) {
    const userId = getCurrentUserId();
    if (!userId || !value) return;
    if (option === 'name') {
        await withGlobalLoading(async () => {
            const created = await createGroup(value, userId);
            const groupId = Array.isArray(created) ? created[0]?.id : created?.id;
            if (groupId) localStorage.setItem(selectedGroupKey, groupId);
            if (refs.nameInput) refs.nameInput.value = '';
            await reloadGroups();
        }, t('groups.loading')).catch(error => { console.error(error); setPageStatus(t('groups.createError')); });
        return;
    }
    await withGlobalLoading(async () => {
        const clanInfo = await getClanInfoRequest(value);
        const clanTag = normalizeTag(clanInfo?.tag || value);
        const created = await createGroup(clanInfo?.name || clanTag, userId);
        const groupId = Array.isArray(created) ? created[0]?.id : created?.id;
        if (!groupId) throw new Error('GROUP_ID_MISSING');
        await addGroupClan(groupId, { tag: clanTag, name: clanInfo?.name || clanTag, badgeUrl: clanBadgeUrl(clanInfo) });
        localStorage.setItem(selectedGroupKey, groupId);
        if (refs.clanInput) refs.clanInput.value = '';
        await reloadGroups();
    }, t('groups.loading')).catch(error => {
        console.error(error);
        refs.clanHint.textContent = error?.message === 'GROUP_ID_MISSING' ? t('groups.clanLinkError') : t('groups.clanNotFound');
        setPageStatus(t('groups.createError'));
    });
}

async function submitJoin() {
    const code = refs.joinCode?.value.trim();
    if (!code) return;
    closeGroupDialog(refs.newOverlay, { restoreFocus: false });
    const userId = getCurrentUserId();
    if (!userId) return setPageStatus(t('groups.login'));
    await withGlobalLoading(async () => {
        await joinGroup(userId, code);
        if (refs.joinCode) refs.joinCode.value = '';
        await reloadGroups();
    }, t('groups.loading')).catch(error => { console.error(error); setPageStatus(t('groups.joinError')); });
}

async function reloadGroups() {
    const sequence = ++state.reload;
    renderListLoading();
    try {
        const fixture = await loadClanFamilyFixture();
        if (fixture) {
            state.fixture = fixture;
            state.userId = fixture.currentUserId;
            return renderGroupList(fixture.entries, fixture.currentUserId, sequence);
        }
        state.fixture = null;
        const userId = getCurrentUserId();
        if (!userId) return showLoginState();
        const memberships = await withGlobalLoading(() => getGroupsOfUser(userId), t('groups.loading'));
        if (sequence !== state.reload) return;
        const requestedGroupId = sessionStorage.getItem(OPEN_GROUP_STORAGE_KEY) || localStorage.getItem(selectedGroupKey) || '';
        await renderGroupList(memberships, userId, sequence, requestedGroupId);
        sessionStorage.removeItem(OPEN_GROUP_STORAGE_KEY);
    } catch (error) {
        if (sequence !== state.reload) return;
        console.error(error);
        showListError();
    }
}

async function renderGroupList(entries, userId, sequence, requestedGroupId = '') {
    refs.list?.replaceChildren();
    const safeEntries = Array.isArray(entries) ? entries : [];
    refs.listCount.textContent = String(safeEntries.length);
    if (!safeEntries.length) return showEmptyFamily();
    const cardOptions = {
        currentUserId: userId,
        fixture: state.fixture,
        autoOpenGroupId: requestedGroupId || safeEntries[0]?.group?.id,
        autoOpenFirst: true
    };
    if (state.fixture) cardOptions.entries = safeEntries;
    const opened = await createGroupCard(safeEntries.map(entry => entry.membership || entry), cardOptions);
    if (sequence !== state.reload) return;
    if (!opened) showListError();
}

function renderListLoading() {
    refs.list?.replaceChildren();
    for (let index = 0; index < 4; index += 1) {
        const row = document.createElement('div'); row.className = 'cf-list-skeleton'; row.setAttribute('aria-hidden', 'true'); refs.list?.appendChild(row);
    }
}

function showEmptyFamily() {
    resetGroupDetail();
    refs.list?.appendChild(emptyMessage(t('groups.none')));
    refs.emptyTitle.textContent = familyCopy('familyEmptyTitle');
    refs.emptyBody.textContent = familyCopy('familyEmptyBody');
    refs.emptyCreate?.classList.remove('hidden');
    refs.emptyJoin?.classList.remove('hidden');
}

function showLoginState() {
    resetGroupDetail();
    refs.list?.replaceChildren(emptyMessage(t('groups.login')));
    refs.emptyTitle.textContent = t('groups.login');
    refs.emptyBody.textContent = familyCopy('familyEmptyBody');
    refs.emptyCreate?.classList.add('hidden');
    refs.emptyJoin?.classList.add('hidden');
}

function showListError() {
    refs.list?.replaceChildren();
    const message = emptyMessage(t('groups.loadError'));
    const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'button button-secondary button-small'; retry.textContent = familyCopy('retry'); retry.addEventListener('click', () => void reloadGroups());
    message.appendChild(retry);
    refs.list?.appendChild(message);
    resetGroupDetail();
}

function initRetry() {
    refs.retry?.addEventListener('click', () => void reloadGroups());
}

function initCopyCode() {
    [refs.detailCode, refs.settingsCopy].filter(Boolean).forEach(button => button.addEventListener('click', copyInviteCode));
}

async function copyInviteCode() {
    const code = refs.detailCodeText?.textContent?.trim();
    if (!code || code === '------') return;
    try {
        await navigator.clipboard?.writeText(code);
    } catch {
        const input = document.createElement('textarea'); input.value = code; input.setAttribute('readonly', ''); input.className = 'sr-only'; document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
    }
    refs.detailCode?.setAttribute('data-copy-state', 'copied');
    setPageStatus(t('groups.copyCode'));
    window.setTimeout(() => refs.detailCode?.setAttribute('data-copy-state', 'idle'), 1800);
}

function initLeaveFlow() {
    bindGroupDialog(refs.leaveOverlay, () => closeGroupDialog(refs.leaveOverlay));
    refs.leaveButton?.addEventListener('click', () => openGroupDialog(refs.leaveOverlay, refs.leaveCancel));
    refs.leaveCancel?.addEventListener('click', () => closeGroupDialog(refs.leaveOverlay));
    refs.leaveConfirm?.addEventListener('click', async () => {
        const userId = state.userId || getCurrentUserId();
        const code = refs.detailCodeText?.textContent?.trim();
        closeGroupDialog(refs.leaveOverlay, { restoreFocus: false });
        if (!userId || !code) return;
        if (state.fixture) return setPageStatus(familyCopy('noManagement'));
        await withGlobalLoading(async () => { await leaveGroup(userId, code); localStorage.removeItem(selectedGroupKey); resetGroupDetail(); await reloadGroups(); }, t('groups.loading')).catch(error => { console.error(error); setPageStatus(t('groups.leaveError')); });
    });
}

function bindNotifications() {
    window.addEventListener('clashtools:notifications-updated', event => { state.notifications = event.detail?.items || []; updatePollNotificationCount(); });
    window.addEventListener('clashtools:group-tab-requested', event => showGroupTab(event.detail?.tab || 'overview'));
}

function updatePollNotificationCount() {
    const badge = refs.pollCount;
    if (!badge) return;
    const count = state.group?.id ? unreadPollNotificationCount(state.notifications, state.group.id) : 0;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count === 0);
    badge.setAttribute('aria-label', `${count} ${familyCopy('responses')}`);
}

function updateHeaderCounts(event) {
    if (!state.group?.id || event.detail?.groupId !== state.group.id) return;
    const count = String(event.detail?.count || event.detail?.clans?.length || 0);
    if (refs.metaClans) refs.metaClans.textContent = count;
    if (refs.tabClanCount) refs.tabClanCount.textContent = count;
    const inspectorClans = document.querySelector('#groups-inspector-clans');
    if (inspectorClans) inspectorClans.textContent = count;
}

function updateHeaderMenu() {
    refs.familyMenu?.classList.add('hidden');
    refs.menuButton?.setAttribute('aria-expanded', 'false');
    refs.settingsName.textContent = state.group?.name || '—';
}

function resetGroupDetail() {
    state.group = null; state.members = []; state.entry = {}; state.currentRole = 'member';
    refs.detailEmpty?.classList.remove('hidden'); refs.detailContent?.classList.add('hidden'); refs.familyMenu?.classList.add('hidden');
    refs.emptyCreate?.classList.remove('hidden'); refs.emptyJoin?.classList.remove('hidden');
    refs.list?.querySelectorAll('.groups-item.active').forEach(item => { item.classList.remove('active'); item.setAttribute('aria-selected', 'false'); });
    refs.pollCount?.classList.add('hidden');
}

function emptyMessage(text) {
    const node = document.createElement('div'); node.className = 'groups-empty'; node.textContent = text; return node;
}

function stageRequestedPollTarget() {
    const target = readGroupPollTarget(window.location.href);
    if (!target.groupId) return;
    sessionStorage.setItem(OPEN_GROUP_STORAGE_KEY, target.groupId);
    if (target.pollId) sessionStorage.setItem(OPEN_POLL_STORAGE_KEY, target.pollId);
    localStorage.setItem(`${GROUP_TAB_STORAGE_PREFIX}${target.groupId}`, target.tab || 'members');
}

function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase(); return tag ? (tag.startsWith('#') ? tag : `#${tag}`) : '';
}

function clanBadgeUrl(info) { return info?.badgeUrls?.medium || info?.badgeUrls?.small || info?.badgeUrls?.large || ''; }

function queryClanElements() {
    return { clanTag: document.querySelector('#groups-admin-clan-tag'), addClan: document.querySelector('#groups-admin-add-clan'), linkedClans: document.querySelector('#groups-clan-list'), scanUnlinked: document.querySelector('#groups-admin-scan-unlinked'), unlinkedAccounts: document.querySelector('#groups-unlinked-accounts'), auditStatus: document.querySelector('#groups-audit-status'), retry: document.querySelector('#groups-clans-retry') };
}

function queryRefs() {
    return {
        workspace: document.querySelector('.groups-workspace'), indexToggle: document.querySelector('#groups-index-toggle'), list: document.querySelector('#groups-list'), listCount: document.querySelector('#groups-list-count'), detailEmpty: document.querySelector('#groups-detail-empty'), detailContent: document.querySelector('#groups-detail-content'), detailCode: document.querySelector('#groups-detail-code'), detailCodeText: document.querySelector('#groups-detail-code-text'), settingsCopy: document.querySelector('#groups-settings-copy-code'), settingsName: document.querySelector('#groups-settings-family-name'), metaClans: document.querySelector('#groups-detail-meta-clans'), tabClanCount: document.querySelector('#groups-detail-tab-clan-count'), pollCount: document.querySelector('#groups-detail-tab-poll-count'), newButton: document.querySelector('#groups-new-btn'), emptyCreate: document.querySelector('#groups-empty-create'), emptyJoin: document.querySelector('#groups-empty-join'), joinShortcut: document.querySelector('#groups-join-shortcut'), newOverlay: document.querySelector('#groups-overlay-new'), createTab: document.querySelector('#groups-tab-create'), joinTab: document.querySelector('#groups-tab-join'), createPanel: document.querySelector('#groups-panel-create'), joinPanel: document.querySelector('#groups-panel-join'), nameOption: document.querySelector('#groups-create-opt-name'), clanOption: document.querySelector('#groups-create-opt-clan'), createNameOption: document.querySelector('#groups-create-opt-name'), createClanOption: document.querySelector('#groups-create-opt-clan'), createByName: document.querySelector('#groups-create-by-name'), createByClan: document.querySelector('#groups-create-by-clan'), nameInput: document.querySelector('#groups-input-name'), clanInput: document.querySelector('#groups-input-clan-tag'), clanHint: document.querySelector('#groups-clan-hint'), createConfirm: document.querySelector('#groups-overlay-create-btn'), joinCode: document.querySelector('#groups-input-join-code'), joinConfirm: document.querySelector('#groups-overlay-join-btn'), menuButton: document.querySelector('#groups-family-menu-button'), familyMenu: document.querySelector('#groups-family-menu'), settingsShortcut: document.querySelector('#groups-settings-shortcut'), leaveShortcut: document.querySelector('#groups-leave-shortcut'), leaveButton: document.querySelector('#groups-leave-btn'), leaveOverlay: document.querySelector('#groups-overlay-leave'), leaveCancel: document.querySelector('#groups-leave-cancel-btn'), leaveConfirm: document.querySelector('#groups-leave-confirm-btn'), emptyTitle: document.querySelector('#groups-detail-empty-title'), emptyBody: document.querySelector('#groups-detail-empty-body'), retry: document.querySelector('#groups-retry'), pageStatus: document.querySelector('#groups-page-status')
    };
}

function setPageStatus(message) { if (!refs.pageStatus) return; refs.pageStatus.textContent = message || ''; refs.pageStatus.hidden = !message; }

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
