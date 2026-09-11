import { t } from '../i18n/i18n.js?v=20260831-master-live-v1';
import { roleLabelKey } from '../groups/groups-roles.js';
import { getNameInitials } from '../utils/name-initials.js';

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

function guestPlanRow(draft, formatUpdatedAt) {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    name.dataset.label = t('plans.name');
    const strong = document.createElement('strong');
    strong.textContent = draft.name || t('plans.unnamed');
    const access = document.createElement('small');
    access.textContent = t('dashboard.localPlanStored');
    name.append(strong, access);

    const clans = document.createElement('td');
    clans.dataset.label = t('plans.clans');
    clans.textContent = String(draft.info?.clans?.length || 0);
    const free = document.createElement('td');
    free.dataset.label = t('plans.freeRoster');
    free.textContent = String(draft.info?.freePlayers?.length || 0);
    const updated = document.createElement('td');
    updated.dataset.label = t('plans.updated');
    updated.textContent = formatUpdatedAt(draft.savedAt);
    const actions = document.createElement('td');
    actions.className = 'workspace-row-actions';
    const open = document.createElement('a');
    open.href = '/app/cwl-planner';
    open.className = 'workspace-row-link';
    open.dataset.planOpenReady = 'true';
    open.textContent = t('dashboard.continueDraft');
    actions.appendChild(open);
    row.append(name, clans, free, updated, actions);
    return row;
}

function guestPlansMessage(loginHref, plannerHref) {
    const row = document.createElement('tr');
    row.className = 'workspace-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 5;
    const message = document.createElement('p');
    message.textContent = t('dashboard.noCloudPlans');
    const detail = document.createElement('p');
    detail.textContent = t('dashboard.saveAcrossDevices');
    const action = document.createElement('a');
    action.href = loginHref(plannerHref);
    action.textContent = t('dashboard.signInToSave');
    cell.append(message, detail, action);
    row.appendChild(cell);
    return row;
}

function planRow(plan, formatUpdatedAt, selectPlan) {
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

export function renderPlans(refs, state, tools) {
    refs.planList.replaceChildren();
    if (state.plansError) {
        tools.setStatus(refs.planStatus, 'dashboard.plansError', 'error');
        refs.planList.appendChild(tableMessage('dashboard.plansUnavailable'));
        return;
    }
    tools.setStatus(refs.planStatus);
    if (!state.loggedIn) {
        const plannerHref = tools.moduleForId('drafts')?.href || '/app/cwl-planner-drafts';
        refs.planList.appendChild(state.guestDraft
            ? guestPlanRow(state.guestDraft, tools.formatUpdatedAt)
            : guestPlansMessage(tools.loginHref, plannerHref));
        return;
    }
    if (!state.plans.length) {
        refs.planList.appendChild(tableMessage('dashboard.noPlans', 'dashboard.createFirstPlan', '/app/cwl-planner'));
        return;
    }
    state.plans.slice(0, 3).forEach(plan => refs.planList.appendChild(
        planRow(plan, tools.formatUpdatedAt, tools.selectPlan)
    ));
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

export function renderGroups(refs, state, tools) {
    refs.groupList.replaceChildren();
    if (state.groupsError) {
        tools.setStatus(refs.groupStatus, 'dashboard.groupsError', 'error');
        refs.groupList.appendChild(groupMessage('dashboard.groupsUnavailable'));
        return;
    }
    tools.setStatus(refs.groupStatus);
    if (!state.loggedIn) {
        const module = tools.moduleForId('groups');
        refs.groupList.appendChild(groupMessage(
            'dashboard.groupsGuestCopy',
            'auth.login',
            tools.loginHref(module?.href || '/app/clan-management')
        ));
        return;
    }
    if (!state.groups.length) {
        refs.groupList.appendChild(groupMessage('dashboard.noGroups', 'dashboard.openGroups', '/app/clan-management'));
        return;
    }
    state.groups.forEach(group => refs.groupList.appendChild(groupRow(group)));
}
