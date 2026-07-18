import { getLanguage, initI18n, t } from '../i18n/i18n.js';
import { profileHTML } from '../profile/profile_popup.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { getCurrentUserId } from '../utils/user.js';
import { summarizePlan } from '../cwl/cwl-plan-summary.js';
import {
    copyPlan,
    deletePlan,
    getAllPlansFromDatabase,
    renamePlan
} from '../Supabase/Supabase-Plan.js';

const refs = {};
let plans = [];
let userId = null;
let activeController;

function initRefs() {
    refs.container = document.querySelector('#draft-cwl-container');
    refs.status = document.querySelector('#drafts-status');
}

function setStatus(message = '', state = '') {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
    refs.status.hidden = !message;
}

function openPlanLink(planId) {
    const link = document.createElement('a');
    link.href = './cwl-planner.html';
    link.className = 'button button-small button-primary';
    link.textContent = t('drafts.open');
    link.addEventListener('click', () => localStorage.setItem('planner_id', planId));
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

function render() {
    refs.container.replaceChildren();
    if (!userId) {
        refs.container.appendChild(emptyRow('drafts.loginRequired', 'auth.login', './login.html'));
        return;
    }
    if (!plans.length) {
        refs.container.appendChild(emptyRow('drafts.empty', 'dashboard.createFirstPlan', './cwl-planner.html'));
        return;
    }
    plans.forEach(plan => refs.container.appendChild(renderPlan(plan)));
}

function cell(label, value) {
    const element = document.createElement('td');
    element.dataset.label = t(label);
    element.textContent = value;
    return element;
}

function renderPlan(plan) {
    const row = document.createElement('tr');
    row.dataset.planId = plan.id;

    const name = cell('plans.name', '');
    const heading = document.createElement('strong');
    heading.textContent = plan.name || t('plans.unnamed');
    const access = document.createElement('small');
    access.textContent = t(plan.isOwner ? 'drafts.owner' : 'drafts.shared');
    name.append(heading, access);

    const actions = document.createElement('td');
    actions.className = 'draft-actions workspace-row-actions';
    actions.appendChild(openPlanLink(plan.id));
    if (plan.isOwner) {
        actions.appendChild(actionButton(t('drafts.rename'), 'button button-small', () => showRename(row, plan)));
    }
    actions.appendChild(actionButton(t('drafts.copy'), 'button button-small', () => void copyExistingPlan(plan)));
    if (plan.isOwner) {
        actions.appendChild(actionButton(t('drafts.delete'), 'button button-small draft-delete', () => void removePlan(plan)));
    }

    row.append(
        name,
        cell('plans.clans', String(plan.clanCount)),
        cell('plans.freeRoster', String(plan.freePlayerCount)),
        cell('plans.updated', formatUpdatedAt(plan.updatedAt)),
        actions
    );
    return row;
}

function showRename(row, plan) {
    const cell = document.createElement('td');
    cell.colSpan = 5;
    const form = document.createElement('form');
    form.className = 'draft-rename-form';
    const label = document.createElement('label');
    label.textContent = t('drafts.name');
    const input = document.createElement('input');
    input.value = plan.name;
    input.maxLength = 40;
    input.required = true;
    label.appendChild(input);
    const actions = document.createElement('div');
    actions.className = 'draft-actions';
    const save = actionButton(t('drafts.save'), 'button button-small button-primary', () => {});
    save.type = 'submit';
    const cancel = actionButton(t('drafts.cancel'), 'button button-small', render);
    actions.append(save, cancel);
    form.append(label, actions);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const name = input.value.trim();
        if (!name) return;
        setBusy(form, true);
        try {
            await renamePlan(plan.id, name, userId);
            plan.name = name;
            render();
            setStatus(t('drafts.renamed'), 'success');
        } catch (error) {
            setStatus(error?.message || t('drafts.actionError'), 'error');
            setBusy(form, false);
        }
    });
    cell.appendChild(form);
    row.replaceChildren(cell);
    input.focus();
    input.select();
}

async function copyExistingPlan(plan) {
    setStatus(t('drafts.working'));
    try {
        const name = `${plan.name}${t('drafts.copySuffix')}`.slice(0, 40).trim();
        await copyPlan(plan.id, name, userId);
        await loadPlans();
        setStatus(t('drafts.copied'), 'success');
    } catch (error) {
        setStatus(error?.message || t('drafts.actionError'), 'error');
    }
}

async function removePlan(plan) {
    if (!window.confirm(t('drafts.deleteConfirm', { name: plan.name }))) return;
    setStatus(t('drafts.working'));
    try {
        await deletePlan(plan.id, userId);
        plans = plans.filter(item => item.id !== plan.id);
        if (localStorage.getItem('planner_id') === plan.id) localStorage.removeItem('planner_id');
        render();
        setStatus(t('drafts.deleted'), 'success');
    } catch (error) {
        setStatus(error?.message || t('drafts.actionError'), 'error');
    }
}

function setBusy(root, busy) {
    root.querySelectorAll('button, input').forEach(element => {
        element.disabled = busy;
    });
}

async function loadPlans() {
    activeController?.abort();
    activeController = new AbortController();
    setStatus(t('drafts.loading'));
    const result = await getAllPlansFromDatabase(userId, {
        signal: activeController.signal,
        forceRefresh: true
    });
    plans = Array.isArray(result) ? result.map(summarizePlan) : [];
    render();
    setStatus('');
}

async function init() {
    initI18n();
    await syncAuthSession().catch(() => null);
    initRefs();
    profileHTML({ preload: false });
    window.addEventListener('clashtools:language-changed', render);
    userId = getCurrentUserId();
    if (!userId) {
        setStatus(t('drafts.loginRequired'), 'error');
        render();
        return;
    }
    try {
        await loadPlans();
    } catch (error) {
        if (error?.name !== 'AbortError') setStatus(t('drafts.loadError'), 'error');
        render();
    }
}

void init();
