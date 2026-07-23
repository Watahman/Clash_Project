import { initI18n, t } from '../i18n/i18n.js';
import { getClanInfoRequest } from '../API/API-Clan.js';
import { createGroupCard } from '../templates/GroupTemplates.js';
import { profileHTML } from '../profile/profile_popup.js';
import { addGroupClan, createGroup, getGroupsOfUser, joinGroup, leaveGroup } from '../Supabase/Supabase-Group.js';
import { getCurrentUserId } from '../utils/user.js';
import { withGlobalLoading } from '../utils/loading-state.js';
import { initCopyFeedback } from '../utils/copy-feedback.js';
import { initGroupsAdminPanel } from '../groups/groups-admin-panel.js';
import { initGroupPolls } from '../groups/groups-polls.js';
import { activateGroupTab, bindGroupTabs } from '../groups/groups-tabs.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { bindBackdropClick } from '../utils/backdrop-click.js';
import {
    GROUP_TAB_STORAGE_PREFIX,
    OPEN_GROUP_STORAGE_KEY,
    OPEN_POLL_STORAGE_KEY,
    readGroupPollTarget,
    unreadPollNotificationCount
} from '../notifications/poll-notifications.js';

const groupsNewBtn = document.querySelector('#groups-new-btn');
const groupsNewRail = document.querySelector('#groups-new-rail');
const groupsJoinShortcut = document.querySelector('#groups-join-shortcut');
const groupsList = document.querySelector('#groups-list');
const groupsListCount = document.querySelector('#groups-list-count');
const groupsDetailEmpty = document.querySelector('#groups-detail-empty');
const groupsDetailContent = document.querySelector('#groups-detail-content');
const groupsDetailCode = document.querySelector('#groups-detail-code');
const groupsOverlayNew = document.querySelector('#groups-overlay-new');
const groupsTabCreate = document.querySelector('#groups-tab-create');
const groupsTabJoin = document.querySelector('#groups-tab-join');
const groupsPanelCreate = document.querySelector('#groups-panel-create');
const groupsPanelJoin = document.querySelector('#groups-panel-join');
const groupsCreateOptName = document.querySelector('#groups-create-opt-name');
const groupsCreateOptClan = document.querySelector('#groups-create-opt-clan');
const groupsCreateByName = document.querySelector('#groups-create-by-name');
const groupsCreateByClan = document.querySelector('#groups-create-by-clan');
const groupsInputName = document.querySelector('#groups-input-name');
const groupsInputClanTag = document.querySelector('#groups-input-clan-tag');
const groupsClanHint = document.querySelector('#groups-clan-hint');
const groupsOverlayCreateBtn = document.querySelector('#groups-overlay-create-btn');
const groupsInputJoinCode = document.querySelector('#groups-input-join-code');
const groupsOverlayJoinBtn = document.querySelector('#groups-overlay-join-btn');
const groupsDetailCheckmark = document.querySelector('#groups-detail-checkmark');
const groupsDetailCopy = document.querySelector('#groups-detail-copy');
const groupOverlayLeave = document.querySelector('#groups-overlay-leave');
const groupsLeaveBtn = document.querySelector('#groups-leave-btn');
const groupsLeaveCancelBtn = document.querySelector('#groups-leave-cancel-btn');
const groupsLeaveConfirmBtn = document.querySelector('#groups-leave-confirm-btn');
const groupsAdminOverlay = document.querySelector('#groups-admin-overlay');
const groupsPageStatus = document.querySelector('#groups-page-status');

const SELECTED_GROUP_STORAGE_KEY = 'clashtoolsSelectedGroupId';
let adminPanel;
let createMode = 'name';
let currentGroupId = '';
let reloadSequence = 0;
let notificationItems = [];

async function init() {
    initI18n();
    stageRequestedPollTarget();
    await syncAuthSession().catch(() => null);
    initCreateJoinOverlay();
    initDetailTabs();
    initStaticActions();
    copyCodeInit();
    leaveGroupFun();
    adminPanel = initGroupsAdminPanel(emptyGroupMessage);
    initGroupPolls(emptyGroupMessage);
    escPopupClose();
    overlayBackdropClose();
    profileHTML();
    await reloadGroups();
}

function initStaticActions() {
    groupsNewBtn?.addEventListener('click', () => openNewGroupOverlay('create'));
    groupsNewRail?.addEventListener('click', () => openNewGroupOverlay('create'));
    groupsJoinShortcut?.addEventListener('click', () => openNewGroupOverlay('join'));
    document.querySelector('#groups-inspector-code')?.addEventListener('click', () => groupsDetailCode?.click());
    document.querySelector('#groups-inspector-leave')?.addEventListener('click', () => groupsLeaveBtn?.click());

    window.addEventListener('clashtools:group-opened', event => {
        currentGroupId = event.detail?.group?.id || '';
        const storedTab = currentGroupId ? localStorage.getItem(`${GROUP_TAB_STORAGE_PREFIX}${currentGroupId}`) : '';
        showGroupTab(storedTab || 'members', false);
        updateAvailabilityNotificationCount();
        window.dispatchEvent(new CustomEvent('clashtools:notifications-requested'));
    });
    window.addEventListener('clashtools:group-tab-requested', event => showGroupTab(event.detail?.tab || 'members'));
    window.addEventListener('clashtools:notifications-updated', event => {
        notificationItems = Array.isArray(event.detail?.items) ? event.detail.items : [];
        updateAvailabilityNotificationCount();
    });
    window.addEventListener('clashtools:group-clans-updated', event => {
        if (!currentGroupId || event.detail?.groupId !== currentGroupId) return;
        setText('#groups-detail-tab-clan-count', String(event.detail?.count || 0));
        setText('#groups-inspector-clans', String(event.detail?.count || 0));
    });
}

function stageRequestedPollTarget() {
    const target = readGroupPollTarget(window.location.href);
    if (!target.groupId) return;
    sessionStorage.setItem(OPEN_GROUP_STORAGE_KEY, target.groupId);
    if (target.pollId) sessionStorage.setItem(OPEN_POLL_STORAGE_KEY, target.pollId);
    localStorage.setItem(`${GROUP_TAB_STORAGE_PREFIX}${target.groupId}`, target.tab || 'members');
}

function updateAvailabilityNotificationCount() {
    const badge = document.querySelector('#groups-detail-tab-availability-count');
    if (!badge) return;
    const count = currentGroupId
        ? unreadPollNotificationCount(notificationItems, currentGroupId)
        : 0;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.setAttribute('aria-label', t('notifications.unreadPollCount', { count }));
    badge.classList.toggle('hidden', count === 0);
}

function requireLoggedIn() {
    const userId = getCurrentUserId();
    if (userId) return userId;
    resetGroupDetail();
    groupsList?.replaceChildren(emptyGroupMessage(t('groups.login')));
    return null;
}

function initCreateJoinOverlay() {
    groupsTabCreate?.addEventListener('click', () => selectOverlayTab('create'));
    groupsTabJoin?.addEventListener('click', () => selectOverlayTab('join'));
    groupsCreateOptName?.addEventListener('click', () => selectCreateMode('name'));
    groupsCreateOptClan?.addEventListener('click', () => selectCreateMode('clanTag'));
    groupsOverlayCreateBtn?.addEventListener('click', async () => {
        const value = createMode === 'clanTag' ? groupsInputClanTag?.value.trim() : groupsInputName?.value.trim();
        if (!value) return;
        groupsOverlayNew?.classList.add('hidden');
        await createNewGroup(value, createMode);
    });
    groupsOverlayJoinBtn?.addEventListener('click', async () => {
        const code = groupsInputJoinCode?.value.trim();
        if (!code) return;
        groupsOverlayNew?.classList.add('hidden');
        await joinGroupFun(code);
    });
    selectOverlayTab('create');
    selectCreateMode('name');
}

function openNewGroupOverlay(tab = 'create') {
    if (!requireLoggedIn()) return;
    selectOverlayTab(tab);
    groupsOverlayNew?.classList.remove('hidden');
    window.setTimeout(() => (tab === 'join' ? groupsInputJoinCode : groupsInputName)?.focus(), 0);
}

function selectOverlayTab(tab) {
    const join = tab === 'join';
    groupsPanelCreate?.classList.toggle('hidden', join);
    groupsPanelJoin?.classList.toggle('hidden', !join);
    groupsTabJoin?.classList.toggle('groups-overlay-tab-active', join);
    groupsTabCreate?.classList.toggle('groups-overlay-tab-active', !join);
}

function selectCreateMode(mode) {
    createMode = mode === 'clanTag' ? 'clanTag' : 'name';
    const byClan = createMode === 'clanTag';
    groupsCreateOptName?.classList.toggle('groups-create-option-active', !byClan);
    groupsCreateOptClan?.classList.toggle('groups-create-option-active', byClan);
    groupsCreateByName?.classList.toggle('hidden', byClan);
    groupsCreateByClan?.classList.toggle('hidden', !byClan);
}

function initDetailTabs() {
    bindGroupTabs(document, tabName => showGroupTab(tabName));
}

function showGroupTab(tabName, persist = true) {
    const safeTab = activateGroupTab(document, tabName);
    if (persist && currentGroupId) localStorage.setItem(`${GROUP_TAB_STORAGE_PREFIX}${currentGroupId}`, safeTab);
}

async function reloadGroups() {
    const userId = requireLoggedIn();
    if (!userId) return;
    const sequence = ++reloadSequence;
    groupsList?.replaceChildren(emptyGroupMessage(t('groups.loading')));
    if (groupsListCount) groupsListCount.textContent = '0';

    try {
        const data = await withGlobalLoading(() => getGroupsOfUser(userId), t('groups.loading'));
        if (sequence !== reloadSequence) return;
        groupsList?.replaceChildren();
        if (!Array.isArray(data) || data.length === 0) {
            groupsList?.appendChild(emptyGroupMessage(t('groups.none')));
            resetGroupDetail();
            return;
        }
        if (groupsListCount) groupsListCount.textContent = String(data.length);
        const requestedGroupId = sessionStorage.getItem(OPEN_GROUP_STORAGE_KEY) || localStorage.getItem(SELECTED_GROUP_STORAGE_KEY) || '';
        const opened = await createGroupCard(data, {
            autoOpenGroupId: requestedGroupId,
            autoOpenFirst: true,
            onSelect: groupId => localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, groupId)
        });
        sessionStorage.removeItem(OPEN_GROUP_STORAGE_KEY);
        if (!opened) {
            groupsList?.appendChild(emptyGroupMessage(t('groups.loadError')));
            resetGroupDetail();
        }
    } catch (error) {
        if (sequence !== reloadSequence) return;
        console.error(error);
        groupsList?.replaceChildren(emptyGroupMessage(t('groups.loadError')));
        resetGroupDetail();
    }
}

async function createNewGroup(value, option) {
    const userId = requireLoggedIn();
    if (!userId || !value) return;

    if (option === 'name') {
        setPageStatus('');
        await withGlobalLoading(async () => {
            const created = await createGroup(value, userId);
            const groupId = Array.isArray(created) ? created[0]?.id : created?.id;
            if (groupId) localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, groupId);
            if (groupsInputName) groupsInputName.value = '';
            await reloadGroups();
        }, t('groups.loading')).catch(error => {
            console.error(error);
            setPageStatus(t('groups.createError'));
        });
        return;
    }

    await withGlobalLoading(async () => {
        try {
            setPageStatus('');
            const clanInfo = await getClanInfoRequest(value);
            const clanTag = normalizeClanTag(clanInfo?.tag || value);
            const clanName = clanInfo?.name || clanTag;
            const officialBadgeUrl = clanBadgeUrl(clanInfo);
            const createdGroup = await createGroup(clanName, userId);
            const groupId = Array.isArray(createdGroup) ? createdGroup[0]?.id : createdGroup?.id;
            if (!groupId) throw new Error('GROUP_ID_MISSING');
            await addGroupClan(groupId, { tag: clanTag, name: clanName, badgeUrl: officialBadgeUrl })
                .catch(error => {
                    console.error(error);
                    throw new Error('GROUP_CLAN_LINK_FAILED');
                });
            localStorage.setItem(SELECTED_GROUP_STORAGE_KEY, groupId);
            if (groupsInputClanTag) groupsInputClanTag.value = '';
            if (groupsClanHint) groupsClanHint.textContent = '';
            await reloadGroups();
        } catch (error) {
            console.error(error);
            const linkFailed = ['GROUP_ID_MISSING', 'GROUP_CLAN_LINK_FAILED'].includes(error?.message);
            if (groupsClanHint) groupsClanHint.textContent = linkFailed ? t('groups.clanLinkError') : t('groups.clanNotFound');
            setPageStatus(linkFailed ? t('groups.clanLinkError') : t('groups.createError'));
        }
    }, t('groups.loading'));
}

function normalizeClanTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

function clanBadgeUrl(clanInfo) {
    return clanInfo?.badgeUrls?.medium || clanInfo?.badgeUrls?.small || clanInfo?.badgeUrls?.large || '';
}

async function joinGroupFun(code) {
    const userId = requireLoggedIn();
    if (!userId || !code) return;
    setPageStatus('');
    await withGlobalLoading(async () => {
        await joinGroup(userId, code);
        if (groupsInputJoinCode) groupsInputJoinCode.value = '';
        await reloadGroups();
    }, t('groups.loading')).catch(error => {
        console.error(error);
        setPageStatus(t('groups.joinError'));
    });
}

function leaveGroupFun() {
    groupsLeaveBtn?.addEventListener('click', () => groupOverlayLeave?.classList.remove('hidden'));
    groupsLeaveCancelBtn?.addEventListener('click', () => groupOverlayLeave?.classList.add('hidden'));
    groupsLeaveConfirmBtn?.addEventListener('click', async () => {
        const userId = requireLoggedIn();
        const code = document.querySelector('#groups-detail-code-text')?.textContent?.trim();
        groupOverlayLeave?.classList.add('hidden');
        if (!userId || !code) return;
        setPageStatus('');
        await withGlobalLoading(async () => {
            await leaveGroup(userId, code);
            localStorage.removeItem(SELECTED_GROUP_STORAGE_KEY);
            resetGroupDetail();
            await reloadGroups();
        }, t('groups.loading')).catch(error => {
            console.error(error);
            setPageStatus(t('groups.leaveError'));
        });
    });
}

function resetGroupDetail() {
    currentGroupId = '';
    updateAvailabilityNotificationCount();
    groupsDetailEmpty?.classList.remove('hidden');
    groupsDetailContent?.classList.add('hidden');
    groupsAdminOverlay?.classList.add('hidden');
    document.querySelector('#groups-inspector-management')?.classList.add('hidden');
    document.querySelectorAll('.groups-item.active').forEach(item => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
    });
    document.querySelector('#groups-member-list')?.replaceChildren(emptyGroupMessage(t('groups.noMembers')));
    setText('#groups-inspector-name', '—');
    setText('#groups-inspector-members', '—');
    setText('#groups-inspector-accounts', '—');
    setText('#groups-inspector-leaders', '—');
    setText('#groups-inspector-clans', '—');
}

function emptyGroupMessage(text) {
    const p = document.createElement('p');
    p.className = 'groups-empty';
    p.textContent = text;
    return p;
}

function copyCodeInit() {
    initCopyFeedback({ trigger: groupsDetailCode, copyIcon: groupsDetailCopy, checkIcon: groupsDetailCheckmark, getText: () => document.querySelector('#groups-detail-code-text')?.textContent?.trim() });
}

function escPopupClose() {
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (!groupsOverlayNew?.classList.contains('hidden')) return groupsOverlayNew.classList.add('hidden');
        if (!groupOverlayLeave?.classList.contains('hidden')) return groupOverlayLeave.classList.add('hidden');
        if (!document.querySelector('#groups-poll-answer-overlay')?.classList.contains('hidden')) return document.querySelector('#groups-poll-answer-close')?.click();
        adminPanel?.closeAll();
    });
}

function overlayBackdropClose() {
    bindBackdropClick(groupsOverlayNew, () => groupsOverlayNew.classList.add('hidden'));
    bindBackdropClick(groupOverlayLeave, () => groupOverlayLeave.classList.add('hidden'));
}

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
}

function setPageStatus(message) {
    if (!groupsPageStatus) return;
    groupsPageStatus.textContent = message || '';
    groupsPageStatus.hidden = !message;
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
