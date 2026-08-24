import { initI18n, t } from '../i18n/i18n.js';
import { getCurrentUserId } from '../utils/user.js';
import { initGroupPolls } from '../groups/groups-polls.js?v=20260813-redesign';
import { createClanAdmin } from '../groups/groups-admin-clans.js';
import { initGroupMemberDrawer } from '../groups/groups-member-drawer.js?v=20260813-redesign';
import { initClanFamilyOverview } from '../groups/clan-family-overview.js?v=20260813-redesign';
import { initClanFamilyMembers } from '../groups/clan-family-members.js';
import { applyFamilyCopy, familyCopy } from '../groups/clan-family-copy.js';
import { activateGroupTab, bindGroupTabs, normalizeGroupTab } from '../groups/groups-tabs.js';
import { initGroupIndexSlider } from '../groups/groups-index-slider.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { initClanFamilyActions } from '../groups/clan-family-actions.js?v=20260813-redesign';
import { createClanFamilyListController } from '../groups/clan-family-list.js?v=20260813-redesign';
import {
    GROUP_TAB_STORAGE_PREFIX, OPEN_GROUP_STORAGE_KEY, OPEN_POLL_STORAGE_KEY,
    readGroupPollTarget, unreadPollNotificationCount
} from '../notifications/poll-notifications.js';

const selectedGroupKey = 'clashtoolsSelectedGroupId';
const refs = queryRefs();
const state = { group: null, members: [], entry: {}, currentRole: 'member', userId: '', fixture: null, reload: 0, notifications: [] };
let clanAdmin;

async function init() {
    initI18n();
    applyFamilyCopy(document);
    initGroupIndexSlider(refs.workspace, refs.indexToggle);
    stageRequestedPollTarget();
    await syncAuthSession().catch(() => null);
    const familyList = createClanFamilyListController({
        refs,
        state,
        resetGroupDetail,
        emptyMessage
    });
    initClanFamilyActions({
        refs,
        getState,
        reloadGroups: familyList.reload,
        resetGroupDetail,
        setPageStatus,
        isFixture: () => Boolean(state.fixture)
    });
    initTabs();
    initFamilyMenu();
    initCopyCode();
    initModules();
    bindNotifications();
    await familyList.reload();
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
        entry: state.entry,
        fixture: state.fixture
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
    const button = refs.detailCode;
    button?.setAttribute('data-copy-state', 'copied');
    clearTimeout(button?.copyFeedbackTimer);
    if (button) button.copyFeedbackTimer = window.setTimeout(() => button.setAttribute('data-copy-state', 'copy'), 1000);
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
    refs.list?.querySelectorAll('.groups-item.active').forEach(item => { item.classList.remove('active'); item.setAttribute('aria-pressed', 'false'); });
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

function queryClanElements() {
    return {
        clanTag: document.querySelector('#groups-admin-clan-tag'),
        addClan: document.querySelector('#groups-admin-add-clan'),
        linkedClans: document.querySelector('#groups-clan-list'),
        scanUnlinked: document.querySelector('#groups-admin-scan-unlinked'),
        unlinkedAccounts: document.querySelector('#groups-unlinked-accounts'),
        auditStatus: document.querySelector('#groups-audit-status'),
        retry: document.querySelector('#groups-clans-retry')
    };
}

function queryRefs() {
    return {
        workspace: document.querySelector('.groups-workspace'),
        indexToggle: document.querySelector('#groups-index-toggle'),
        list: document.querySelector('#groups-list'),
        listCount: document.querySelector('#groups-list-count'),
        detailEmpty: document.querySelector('#groups-detail-empty'),
        detailContent: document.querySelector('#groups-detail-content'),
        detailCode: document.querySelector('#groups-detail-code'),
        detailCodeText: document.querySelector('#groups-detail-code-text'),
        settingsCopy: document.querySelector('#groups-settings-copy-code'),
        settingsName: document.querySelector('#groups-settings-family-name'),
        metaClans: document.querySelector('#cf-metric-clans'),
        tabClanCount: document.querySelector('#groups-detail-tab-clan-count'),
        pollCount: document.querySelector('#groups-detail-tab-poll-count'),
        newButton: document.querySelector('#groups-new-btn'),
        emptyCreate: document.querySelector('#groups-empty-create'),
        emptyJoin: document.querySelector('#groups-empty-join'),
        joinShortcut: document.querySelector('#groups-join-shortcut'),
        newOverlay: document.querySelector('#groups-overlay-new'),
        createTab: document.querySelector('#groups-tab-create'),
        joinTab: document.querySelector('#groups-tab-join'),
        createPanel: document.querySelector('#groups-panel-create'),
        joinPanel: document.querySelector('#groups-panel-join'),
        nameOption: document.querySelector('#groups-create-opt-name'),
        clanOption: document.querySelector('#groups-create-opt-clan'),
        createNameOption: document.querySelector('#groups-create-opt-name'),
        createClanOption: document.querySelector('#groups-create-opt-clan'),
        createByName: document.querySelector('#groups-create-by-name'),
        createByClan: document.querySelector('#groups-create-by-clan'),
        nameInput: document.querySelector('#groups-input-name'),
        clanInput: document.querySelector('#groups-input-clan-tag'),
        clanHint: document.querySelector('#groups-clan-hint'),
        createConfirm: document.querySelector('#groups-overlay-create-btn'),
        joinCode: document.querySelector('#groups-input-join-code'),
        joinConfirm: document.querySelector('#groups-overlay-join-btn'),
        menuButton: document.querySelector('#groups-family-menu-button'),
        familyMenu: document.querySelector('#groups-family-menu'),
        settingsShortcut: document.querySelector('#groups-settings-shortcut'),
        leaveShortcut: document.querySelector('#groups-leave-shortcut'),
        leaveButton: document.querySelector('#groups-leave-btn'),
        leaveOverlay: document.querySelector('#groups-overlay-leave'),
        leaveCancel: document.querySelector('#groups-leave-cancel-btn'),
        leaveConfirm: document.querySelector('#groups-leave-confirm-btn'),
        emptyTitle: document.querySelector('#groups-detail-empty-title'),
        emptyBody: document.querySelector('#groups-detail-empty-body'),
        retry: document.querySelector('#groups-retry'),
        pageStatus: document.querySelector('#groups-page-status')
    };
}

function setPageStatus(message) { if (!refs.pageStatus) return; refs.pageStatus.textContent = message || ''; refs.pageStatus.hidden = !message; }

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
