import { getLanguage, initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { AUTH_STATES, resolveAuthState } from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { getCurrentUserId } from '../utils/user.js';
import { checkUserId } from '../Supabase/Supabase-User.js?v=20260829-public-auth-v1';
import { getAllPlansFromDatabase } from '../Supabase/Supabase-Plan.js?v=20260829-public-auth-v1';
import { getGroupInfo, getGroupsOfUser } from '../Supabase/Supabase-Group.js?v=20260829-public-auth-v1';
import { roleLabelKey } from '../groups/groups-roles.js';
import { summarizePlan } from '../cwl/cwl-plan-summary.js';
import { getNameInitials } from '../utils/name-initials.js';
import { onUserProfileUpdate } from '../profile/profile-events.js';
import * as plannerStorage from '../cwl/cwl-planner-guest-storage.js?v=20260829-public-auth-v1';

const refs = {};
const state = {
    user: null,
    plans: [],
    groups: [],
    loggedIn: false,
    plansError: false,
    groupsError: false
};

function initRefs() {
    refs.welcome = document.querySelector('#dashboard-welcome');
    refs.planStatus = document.querySelector('#dashboard-plan-status');
    refs.planList = document.querySelector('#dashboard-plan-list');
    refs.groupStatus = document.querySelector('#dashboard-group-status');
    refs.groupList = document.querySelector('#dashboard-group-list');
    refs.accountLine = document.querySelector('#dashboard-account-line');
    refs.accountCount = document.querySelector('#dashboard-account-count');
    refs.nextTitle = document.querySelector('#dashboard-next-title');
    refs.nextCopy = document.querySelector('#dashboard-next-copy');
    refs.nextAction = document.querySelector('#dashboard-next-action');
    refs.attention = document.querySelector('.dashboard-attention');
    refs.attentionCopy = document.querySelector('#dashboard-attention-copy');
}

function formatUpdatedAt(value) {
    if (!value) return t('plans.unknownDate');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('plans.unknownDate');
    return new Intl.DateTimeFormat(getLanguage(), {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function setStatus(element, key = '', stateName = '') {
    element.textContent = key ? t(key) : '';
    element.dataset.state = stateName;
    element.hidden = !key;
}

function selectPlan(planId) {
    plannerStorage.persistActivePlannerId(planId);
}

function tableMessage(key, actionKey = '', actionHref = '') {
    const row = document.createElement('tr');
    row.className = 'workspace-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 5;
    const message = document.createElement('p');
    message.textContent = t(key);
    cell.appendChild(message);
    if (actionKey && actionHref) {
        const action = document.createElement('a');
        action.href = actionHref;
        action.textContent = t(actionKey);
        cell.appendChild(action);
    }
    row.appendChild(cell);
    return row;
}

function planRow(plan) {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    name.dataset.label = t('plans.name');
    const strong = document.createElement('strong');
    strong.textContent = plan.name || t('plans.unnamed');
    const access = document.createElement('small');
    access.textContent = t(plan.isOwner ? 'drafts.owner' : 'drafts.shared');
    name.append(strong, access);

    const clans = document.createElement('td');
    clans.dataset.label = t('plans.clans');
    clans.textContent = String(plan.clanCount);
    const free = document.createElement('td');
    free.dataset.label = t('plans.freeRoster');
    free.textContent = String(plan.freePlayerCount);
    const updated = document.createElement('td');
    updated.dataset.label = t('plans.updated');
    updated.textContent = formatUpdatedAt(plan.updatedAt);
    const actions = document.createElement('td');
    actions.className = 'workspace-row-actions';
    const open = document.createElement('a');
    open.href = '/app/cwl-planner';
    open.className = 'workspace-row-link';
    open.textContent = t('drafts.open');
    open.addEventListener('click', () => selectPlan(plan.id));
    actions.appendChild(open);
    row.append(name, clans, free, updated, actions);
    return row;
}

function renderPlans() {
    refs.planList.replaceChildren();
    if (state.plansError) {
        setStatus(refs.planStatus, 'dashboard.plansError', 'error');
        refs.planList.appendChild(tableMessage('dashboard.plansUnavailable'));
        return;
    }
    setStatus(refs.planStatus);
    if (!state.loggedIn) {
        refs.planList.appendChild(tableMessage('dashboard.loginRequired', 'auth.login', '/subpages/login.html'));
        return;
    }
    if (!state.plans.length) {
        refs.planList.appendChild(tableMessage('dashboard.noPlans', 'dashboard.createFirstPlan', '/app/cwl-planner'));
        return;
    }
    state.plans.slice(0, 3).forEach(plan => refs.planList.appendChild(planRow(plan)));
}

function groupRow(entry) {
    const link = document.createElement('a');
    link.className = 'workspace-summary-row';
    link.href = '/app/clan-management';
    link.addEventListener('click', () => sessionStorage.setItem('clashtoolsOpenGroupId', entry.group.id));
    const mark = document.createElement('span');
    mark.className = 'workspace-group-mark';
    mark.textContent = getNameInitials(entry.group.name);
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = entry.group.name;
    const role = document.createElement('small');
    role.textContent = t(roleLabelKey(entry.membership.role));
    copy.append(name, role);
    const open = document.createElement('span');
    open.className = 'workspace-summary-open';
    open.textContent = '→';
    link.append(mark, copy, open);
    return link;
}

function groupMessage(key, actionKey = '', actionHref = '') {
    const container = document.createElement('div');
    container.className = 'workspace-empty-state';
    const message = document.createElement('p');
    message.textContent = t(key);
    container.appendChild(message);
    if (actionKey && actionHref) {
        const action = document.createElement('a');
        action.href = actionHref;
        action.textContent = t(actionKey);
        container.appendChild(action);
    }
    return container;
}

function renderGroups() {
    refs.groupList.replaceChildren();
    if (state.groupsError) {
        setStatus(refs.groupStatus, 'dashboard.groupsError', 'error');
        refs.groupList.appendChild(groupMessage('dashboard.groupsUnavailable'));
        return;
    }
    setStatus(refs.groupStatus);
    if (!state.loggedIn) {
        refs.groupList.appendChild(groupMessage('dashboard.loginRequired'));
        return;
    }
    if (!state.groups.length) {
        refs.groupList.appendChild(groupMessage('dashboard.noGroups', 'dashboard.openGroups', '/app/clan-management'));
        return;
    }
    state.groups.forEach(group => refs.groupList.appendChild(groupRow(group)));
}

function renderUser() {
    const name = String(state.user?.name || '').trim();
    refs.welcome.textContent = name ? t('dashboard.welcomeName', { name }) : t('dashboard.welcome');
    const accounts = Array.isArray(state.user?.accounts) ? state.user.accounts : [];
    refs.accountCount.textContent = String(accounts.length);
    refs.accountLine.hidden = accounts.length === 0;
}

function setNextAction(titleKey, copyKey, actionKey, href) {
    refs.nextTitle.textContent = t(titleKey);
    refs.nextCopy.textContent = t(copyKey);
    refs.nextAction.textContent = t(actionKey);
    refs.nextAction.href = href;
}

function renderDashboardPriority() {
    if (state.plans.length) {
        setNextAction('dashboard.v2ContinueTitle', 'dashboard.v2ContinueCopy', 'dashboard.v2ContinueAction', '/app/cwl-planner');
        refs.nextAction.onclick = () => selectPlan(state.plans[0].id);
    } else if (state.groups.length) {
        setNextAction('dashboard.v2FamilyTitle', 'dashboard.v2FamilyCopy', 'dashboard.v2FamilyAction', '/app/clan-management');
        refs.nextAction.onclick = null;
    } else {
        setNextAction('dashboard.v2StartTitle', 'dashboard.v2StartCopy', 'dashboard.v2StartAction', '/app/cwl-planner');
        refs.nextAction.onclick = null;
    }

    const hasError = state.plansError || state.groupsError;
    refs.attention.dataset.state = hasError ? 'error' : 'clear';
    refs.attentionCopy.textContent = t(hasError ? 'dashboard.v2LoadIssue' : 'dashboard.v2Nothing');
}

function renderAll() {
    renderUser();
    renderPlans();
    renderGroups();
    renderDashboardPriority();
    window.dispatchEvent(new CustomEvent('clashtools:dashboard-state', {
        detail: {
            loggedIn: state.loggedIn,
            plans: state.plans.length,
            groups: state.groups.length,
            accounts: Array.isArray(state.user?.accounts) ? state.user.accounts.length : 0,
            hasErrors: state.plansError || state.groupsError
        }
    }));
}

async function loadRecentGroups(userId) {
    const memberships = await getGroupsOfUser(userId);
    if (!Array.isArray(memberships) || !memberships.length) return [];
    const results = await Promise.allSettled(
        memberships.slice(0, 2).map(async membership => {
            const groupInfo = await getGroupInfo(membership.group_id);
            const group = Array.isArray(groupInfo) ? groupInfo[0] : null;
            return group ? { membership, group } : null;
        })
    );
    return results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value);
}

async function init() {
    const authState = await resolveAuthState().catch(() => null);
    if (authState?.status !== AUTH_STATES.AUTHENTICATED) return;
    plannerStorage.configureGuestPlanner({ authState });
    initI18n();
    initRefs();
    onUserProfileUpdate(profile => {
        state.user = { ...state.user, ...profile };
        renderUser();
    });
    refs.accountLine.addEventListener('click', () => document.querySelector('#profile-btn')?.click());
    window.addEventListener('clashtools:language-changed', renderAll);
    const userId = getCurrentUserId();
    state.loggedIn = Boolean(userId);
    if (!userId) {
        renderAll();
        return;
    }

    setStatus(refs.planStatus, 'dashboard.loadingPlans');
    setStatus(refs.groupStatus, 'dashboard.loadingGroups');
    const [userResult, plansResult, groupsResult] = await Promise.allSettled([
        checkUserId(userId),
        getAllPlansFromDatabase(userId),
        loadRecentGroups(userId)
    ]);
    if (userResult.status === 'fulfilled' && !userResult.value?.error) state.user = userResult.value;
    if (plansResult.status === 'fulfilled') {
        state.plans = Array.isArray(plansResult.value) ? plansResult.value.map(summarizePlan) : [];
    } else {
        state.plansError = true;
    }
    if (groupsResult.status === 'fulfilled') state.groups = groupsResult.value;
    else state.groupsError = true;
    renderAll();
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
