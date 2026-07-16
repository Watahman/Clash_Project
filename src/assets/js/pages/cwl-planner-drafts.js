import { getLanguage, initI18n, t } from '../i18n/i18n.js';
import { profileHTML } from '../profile/profile_popup.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { getCurrentUserId } from '../utils/user.js';
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
    refs.newPlan = document.querySelector('#add-draft-cwl');
    refs.status = document.querySelector('#drafts-status');
}

function setStatus(message = '', state = '') {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
}

function openPlan(planId) {
    localStorage.setItem('planner_id', planId);
    window.location.assign('./cwl-planner.html');
}

function button(label, className, handler) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    element.addEventListener('click', handler);
    return element;
}

function render() {
    refs.container.replaceChildren(refs.newPlan);
    if (!plans.length) {
        const empty = document.createElement('p');
        empty.className = 'draft-empty';
        empty.textContent = t('drafts.empty');
        refs.container.appendChild(empty);
        return;
    }
    plans.forEach(plan => refs.container.appendChild(renderPlan(plan)));
}

function renderPlan(plan) {
    const card = document.createElement('article');
    card.className = 'draft-card';
    card.dataset.planId = plan.id;

    const heading = document.createElement('h2');
    heading.textContent = plan.name;
    card.appendChild(heading);

    const meta = document.createElement('p');
    meta.className = 'draft-meta';
    const updated = plan.updatedAt
        ? new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' })
            .format(new Date(plan.updatedAt))
        : '';
    meta.textContent = updated
        ? t('drafts.updated', { date: updated })
        : t(plan.isOwner ? 'drafts.owner' : 'drafts.shared');
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'draft-actions';
    actions.appendChild(button(t('drafts.open'), 'btn btn-primary', () => openPlan(plan.id)));
    if (plan.isOwner) {
        actions.appendChild(button(t('drafts.rename'), 'btn', () => showRename(card, plan)));
    }
    actions.appendChild(button(t('drafts.copy'), 'btn', () => void copyExistingPlan(plan)));
    if (plan.isOwner) {
        actions.appendChild(button(t('drafts.delete'), 'btn draft-delete', () => void removePlan(plan)));
    }
    card.appendChild(actions);
    return card;
}

function showRename(card, plan) {
    const form = document.createElement('form');
    form.className = 'draft-rename-form';
    const input = document.createElement('input');
    input.value = plan.name;
    input.maxLength = 40;
    input.required = true;
    input.setAttribute('aria-label', t('drafts.name'));
    const actions = document.createElement('div');
    actions.className = 'draft-actions';
    const save = button(t('drafts.save'), 'btn btn-primary', () => {});
    save.type = 'submit';
    const cancel = button(t('drafts.cancel'), 'btn', render);
    actions.append(save, cancel);
    form.append(input, actions);
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
    card.replaceChildren(form);
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
    plans = await getAllPlansFromDatabase(userId, {
        signal: activeController.signal,
        forceRefresh: true
    });
    if (!Array.isArray(plans)) plans = [];
    render();
    setStatus('');
}

async function init() {
    initI18n();
    await syncAuthSession().catch(() => null);
    initRefs();
    userId = getCurrentUserId();
    if (!userId) {
        setStatus(t('drafts.loginRequired'), 'error');
        refs.container.replaceChildren(refs.newPlan);
        profileHTML();
        return;
    }
    try {
        await loadPlans();
    } catch (error) {
        if (error?.name !== 'AbortError') setStatus(t('drafts.loadError'), 'error');
    }
    profileHTML();
}

void init();
