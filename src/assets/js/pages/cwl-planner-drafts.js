import { initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { AUTH_STATES, resolveAuthState } from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { getCurrentUserId } from '../utils/user.js';
import { summarizePlan } from '../cwl/cwl-plan-summary.js';
import { createSavedPlansView } from './cwl-planner-drafts-view.js?v=20260829-public-auth-v1';
import { createSavedPlansActions } from './cwl-planner-drafts-actions.js?v=20260829-public-auth-v1';
import {
    getAllPlansFromDatabase
} from '../Supabase/Supabase-Plan.js?v=20260829-public-auth-v1';
import * as plannerStorage from '../cwl/cwl-planner-guest-storage.js?v=20260829-public-auth-v1';

const refs = {};
let plans = [];
let userId = null;
let activeController;
let savedPlansView;
let savedPlanActions;
const listState = { query: '', sort: 'updated-desc' };

function clearActivePlan(planId = '') {
    if (!planId || plannerStorage.readActivePlannerId() === planId) {
        plannerStorage.persistActivePlannerId(null);
    }
}

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
        reloadPlans: loadPlans,
        clearActivePlan
    });
    savedPlansView = createSavedPlansView({
        refs,
        getPlans: () => plans,
        getUserId: () => userId,
        listState,
        setStatus,
        selectPlan: plannerStorage.persistActivePlannerId,
        clearActivePlan,
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
    const authState = await resolveAuthState().catch(() => null);
    if (authState?.status !== AUTH_STATES.AUTHENTICATED) return;
    plannerStorage.configureGuestPlanner({ authState });
    initI18n();
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
