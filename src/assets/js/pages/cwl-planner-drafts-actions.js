import { t } from '../i18n/i18n.js';
import { hasReachedPlanLimit } from '../cwl/cwl-plan-limits.js';
import {
    copyPlan,
    deletePlan,
    renamePlan
} from '../Supabase/Supabase-Plan.js';

export function createSavedPlansActions(options) {
    return {
        rename: (row, plan) => showRename(row, plan, options),
        copy: plan => { void copyExistingPlan(plan, options); },
        remove: plan => { void removePlan(plan, options); }
    };
}

function showRename(row, plan, options) {
    const { cell, form, input } = createRenameForm(options.render, plan);
    form.addEventListener('submit', event => submitRename(event, plan, input, form, options));
    cell.appendChild(form);
    row.replaceChildren(cell);
    input.focus();
    input.select();
}

function createRenameForm(render, plan) {
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
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'button button-small button-primary';
    save.textContent = t('drafts.save');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button button-small';
    cancel.textContent = t('drafts.cancel');
    cancel.addEventListener('click', render);
    actions.append(save, cancel);
    form.append(label, actions);
    return { cell, form, input };
}

async function submitRename(event, plan, input, form, options) {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
        input.setCustomValidity(t('drafts.actionError'));
        input.reportValidity?.();
        options.setStatus(t('drafts.actionError'), 'error');
        return;
    }
    input.setCustomValidity('');
    setBusy(form, true);
    try {
        await renamePlan(plan.id, name, options.getUserId());
        plan.name = name;
        options.render();
        options.setStatus(t('drafts.renamed'), 'success');
    } catch (error) {
        options.setStatus(error?.message || t('drafts.actionError'), 'error');
        setBusy(form, false);
    }
}

async function copyExistingPlan(plan, options) {
    if (hasReachedPlanLimit(options.getPlans().filter(item => item.isOwner))) {
        options.setStatus(t('cwl.planLimitReached'), 'error');
        return;
    }
    options.setStatus(t('drafts.working'));
    try {
        const name = `${plan.name}${t('drafts.copySuffix')}`.slice(0, 40).trim();
        await copyPlan(plan.id, name, options.getUserId());
        await options.reloadPlans();
        options.setStatus(t('drafts.copied'), 'success');
    } catch (error) {
        options.setStatus(
            error?.code === 'PLAN_LIMIT_REACHED'
                ? t('cwl.planLimitReached')
                : error?.message || t('drafts.actionError'),
            'error'
        );
    }
}

async function removePlan(plan, options) {
    if (!await confirmDeletePlan(plan, options.refs)) return;
    options.setStatus(t('drafts.working'));
    try {
        await deletePlan(plan.id, options.getUserId());
        const remaining = options.getPlans().filter(item => item.id !== plan.id);
        options.setPlans(remaining);
        if (localStorage.getItem('planner_id') === plan.id) localStorage.removeItem('planner_id');
        options.setControlsEnabled(remaining.length > 0);
        options.render();
        options.setStatus(t('drafts.deleted'), 'success');
    } catch (error) {
        options.setStatus(error?.message || t('drafts.actionError'), 'error');
    }
}

async function confirmDeletePlan(plan, refs) {
    const dialog = refs.deleteDialog;
    if (!dialog || typeof dialog.showModal !== 'function') {
        return window.confirm(t('drafts.deleteConfirm', { name: plan.name }));
    }
    if (refs.deleteDialogMessage) {
        refs.deleteDialogMessage.textContent = t('drafts.deleteConfirm', { name: plan.name });
    }
    dialog.showModal();
    return new Promise(resolve => {
        const cancelButton = dialog.querySelector('[data-delete-cancel]');
        const confirmButton = dialog.querySelector('[data-delete-confirm]');
        const onCancel = () => finish(false);
        const onCancelClick = () => finish(false);
        const onConfirmClick = () => finish(true);
        const cleanup = () => {
            cancelButton?.removeEventListener('click', onCancelClick);
            confirmButton?.removeEventListener('click', onConfirmClick);
            dialog.removeEventListener('cancel', onCancel);
        };
        const finish = value => {
            cleanup();
            dialog.close();
            resolve(value);
        };
        cancelButton?.addEventListener('click', onCancelClick);
        confirmButton?.addEventListener('click', onConfirmClick);
        dialog.addEventListener('cancel', onCancel);
    });
}

function setBusy(root, busy) {
    root.querySelectorAll('button, input').forEach(element => {
        element.disabled = busy;
    });
}
