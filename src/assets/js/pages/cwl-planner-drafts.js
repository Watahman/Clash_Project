import { initI18n, t } from '../i18n/i18n.js';
import { syncAuthSession } from '../auth/auth-client.js';
import { getCurrentUserId } from '../utils/user.js';
import { summarizePlan } from '../cwl/cwl-plan-summary.js';
import { createSavedPlansView } from './cwl-planner-drafts-view.js';
import { createSavedPlansActions } from './cwl-planner-drafts-actions.js';
import {
    getAllPlansFromDatabase
} from '../Supabase/Supabase-Plan.js';

const refs = {};
let plans = [];
let userId = null;
let activeController;
let savedPlansView;
let savedPlanActions;
const listState = { query: '', sort: 'updated-desc' };

function initRefs() {
    refs.container = document.querySelector('#draft-cwl-container');
    refs.status = document.querySelector('#drafts-status');
    refs.search = document.querySelector('#drafts-search');
    refs.sort = document.querySelector('#drafts-sort');
    refs.filterStatus = document.querySelector('#drafts-filter-status');
    refs.deleteDialog = document.querySelector('#saved-plan-delete-dialog');
    refs.deleteDialogMessage = document.querySelector('#saved-plan-delete-message');
    savedPlanActions = createSavedPlansActions({
        refs,
        getPlans: () => plans,
        setPlans: nextPlans => { plans = nextPlans; },
        getUserId: () => userId,
        setStatus,
        render,
        setControlsEnabled: enabled => savedPlansView.setControlsEnabled(enabled),
        reloadPlans: loadPlans
    });
    savedPlansView = createSavedPlansView({
        refs,
        getPlans: () => plans,
        getUserId: () => userId,
        listState,
        setStatus,
        onRename: savedPlanActions.rename,
        onCopy: savedPlanActions.copy,
        onDelete: savedPlanActions.remove
    });
}

function setStatus(message = '', state = '') {
    refs.status.textContent = message;
    refs.status.dataset.state = state;
    refs.status.hidden = !message;
}

function render() {
    savedPlansView.render();
}

function setListControlsEnabled(enabled) {
    savedPlansView.setControlsEnabled(enabled);
}

function bindListControls() {
    savedPlansView.bindControls();
}

async function loadPlans() {
    activeController?.abort();
    activeController = new AbortController();
    setStatus(t('drafts.loading'));
    setListControlsEnabled(false);
    const result = await getAllPlansFromDatabase(userId, {
        signal: activeController.signal,
        forceRefresh: true
    });
    plans = Array.isArray(result) ? result.map(summarizePlan) : [];
    setListControlsEnabled(plans.length > 0);
    render();
    setStatus('');
}

async function init() {
    initI18n();
    await syncAuthSession().catch(() => null);
    initRefs();
    bindListControls();
    setListControlsEnabled(false);
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

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
