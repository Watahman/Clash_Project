import { getLanguage, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { filterAndSortPlans } from '../cwl/cwl-plan-list.js';

export function createSavedPlansView(options) {
    const { refs, getPlans, getUserId, listState, setStatus } = options;
    return {
        bindControls: () => bindListControls(refs, listState, render, options),
        render: () => renderPlanTable({ refs, getPlans, getUserId, listState, setStatus, options }),
        setControlsEnabled: enabled => setListControlsEnabled(refs, enabled)
    };

    function render() {
        renderPlanTable({ refs, getPlans, getUserId, listState, setStatus, options });
    }
}

function renderPlanTable({ refs, getPlans, getUserId, listState, setStatus, options }) {
    refs.container.replaceChildren();
    const userId = getUserId();
    const plans = getPlans();
    if (!userId) {
        updateFilterStatus(refs, 0, 0);
        refs.container.appendChild(emptyRow('drafts.loginRequired', 'auth.login', '/subpages/login.html'));
        return;
    }
    if (!plans.length) {
        updateFilterStatus(refs, 0, 0);
        refs.container.appendChild(emptyRow('drafts.empty', 'dashboard.createFirstPlan', './cwl-planner.html'));
        return;
    }
    const visiblePlans = filterAndSortPlans(plans, { ...listState, language: getLanguage() });
    updateFilterStatus(refs, visiblePlans.length, plans.length);
    if (!visiblePlans.length) {
        refs.container.appendChild(emptyRow('drafts.noMatches'));
        return;
    }
    visiblePlans.forEach(plan => refs.container.appendChild(renderPlan(plan, options)));
}

function bindListControls(refs, listState, render, options) {
    refs.search?.addEventListener('input', event => {
        listState.query = event.currentTarget.value;
        render();
    });
    refs.sort?.addEventListener('change', event => {
        listState.sort = event.currentTarget.value;
        render();
    });
    document.querySelector('[data-new-plan]')?.addEventListener('click', () => {
        options.clearActivePlan?.();
    });
}

function setListControlsEnabled(refs, enabled) {
    if (refs.search) refs.search.disabled = !enabled;
    if (refs.sort) refs.sort.disabled = !enabled;
}

function updateFilterStatus(refs, visible, total) {
    if (!refs.filterStatus) return;
    refs.filterStatus.textContent = total ? t('drafts.results', { visible, total }) : '';
    refs.filterStatus.hidden = !total;
}

function openPlanLink(planId, className = 'button button-small button-primary', options = {}) {
    const link = document.createElement('a');
    link.href = './cwl-planner.html';
    link.className = className;
    link.textContent = t('drafts.open');
    link.addEventListener('click', () => options.selectPlan?.(planId));
    return link;
}

function actionButton(label, className, handler) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    element.addEventListener('click', handler);
    return element;
}

function exportPlan(plan, setStatus) {
    const safeName = String(plan.name || 'cwl-plan').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cwl-plan';
    const payload = {
        format: 'clashpanel-cwl-plan',
        exportedAt: new Date().toISOString(),
        name: plan.name || t('plans.unnamed'),
        info: plan.info ?? plan.planInfo ?? null
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(t('drafts.exported'), 'success');
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

function emptyRow(messageKey, actionKey = '', actionHref = '') {
    const row = document.createElement('tr');
    row.className = 'workspace-empty-row';
    const cell = document.createElement('td');
    cell.colSpan = 5;
    const message = document.createElement('p');
    message.textContent = t(messageKey);
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

function cell(label, value) {
    const element = document.createElement('td');
    element.dataset.label = t(label);
    element.textContent = value;
    return element;
}

function renderPlan(plan, options) {
    const row = document.createElement('tr');
    row.dataset.planId = plan.id;
    row.append(
        createPlanNameCell(plan, options),
        cell('plans.clans', String(plan.clanCount)),
        cell('plans.freeRoster', String(plan.freePlayerCount)),
        cell('plans.updated', formatUpdatedAt(plan.updatedAt)),
        createPlanActions(plan, row, options)
    );
    return row;
}

function createPlanNameCell(plan, options) {
    const name = cell('plans.name', '');
    const nameLink = openPlanLink(plan.id, 'draft-plan-name-link', options);
    const heading = document.createElement('strong');
    heading.textContent = plan.name || t('plans.unnamed');
    nameLink.replaceChildren(heading);
    const access = document.createElement('small');
    access.textContent = t(plan.isOwner ? 'drafts.owner' : 'drafts.shared');
    name.append(nameLink, access);
    return name;
}

function createPlanActions(plan, row, options) {
    const actions = document.createElement('td');
    actions.className = 'draft-actions workspace-row-actions';
    actions.appendChild(openPlanLink(plan.id, undefined, options));
    const more = document.createElement('details');
    more.className = 'draft-plan-actions-menu';
    const summary = document.createElement('summary');
    summary.textContent = '…';
    summary.setAttribute('aria-label', t('plans.actions'));
    more.appendChild(summary);
    const menu = document.createElement('div');
    menu.className = 'draft-plan-actions-menu-content';
    if (plan.isOwner) {
        menu.appendChild(actionButton(t('drafts.rename'), 'button button-small', () => options.onRename(row, plan)));
    }
    menu.appendChild(actionButton(t('drafts.copy'), 'button button-small', () => options.onCopy(plan)));
    menu.appendChild(actionButton(t('drafts.export'), 'button button-small', () => exportPlan(plan, options.setStatus)));
    if (plan.isOwner) {
        menu.appendChild(actionButton(t('drafts.delete'), 'button button-small draft-delete', () => options.onDelete(plan)));
    }
    more.appendChild(menu);
    actions.appendChild(more);
    return actions;
}
