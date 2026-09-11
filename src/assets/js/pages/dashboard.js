import { initI18n } from '../i18n/i18n.js?v=20260831-master-live-v1';
import * as authClient from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { getCurrentUserId } from '../utils/user.js';
import { checkUserId } from '../Supabase/Supabase-User.js?v=20260829-public-auth-v1';
import { getAllPlansFromDatabase } from '../Supabase/Supabase-Plan.js?v=20260829-public-auth-v1';
import { getGroupInfo, getGroupsOfUser } from '../Supabase/Supabase-Group.js?v=20260829-public-auth-v1';
import { summarizePlan } from '../cwl/cwl-plan-summary.js';
import { onUserProfileUpdate } from '../profile/profile-events.js';
import * as plannerStorage from '../cwl/cwl-planner-guest-storage.js?v=20260829-public-auth-v1';
import {
    renderDashboard,
    renderUser,
    setStatus
} from './dashboard-view.js?v=20260831-dashboard-v1';

const refs = {};
const state = {
    user: null,
    plans: [],
    groups: [],
    guestDraft: null,
    authState: null,
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

function selectPlan(planId) {
    plannerStorage.persistActivePlannerId(planId);
}

function isAuthenticated(authState) {
    return authState?.status === (authClient.AUTH_STATES?.AUTHENTICATED || 'authenticated');
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

function renderCurrentDashboard() {
    renderDashboard(refs, state, selectPlan);
}

function bindDashboardEvents() {
    onUserProfileUpdate(profile => {
        state.user = { ...state.user, ...profile };
        renderUser(refs, state);
    });
    refs.accountLine.addEventListener('click', () => document.querySelector('#profile-btn')?.click());
    window.addEventListener('clashtools:language-changed', renderCurrentDashboard);
}

async function resolveDashboardAuth() {
    const resolveAuthState = authClient.resolveAuthState;
    const fallback = {
        status: authClient.AUTH_STATES?.UNAVAILABLE || 'auth-unavailable',
        session: null
    };
    if (typeof resolveAuthState !== 'function') {
        return { status: authClient.AUTH_STATES?.GUEST || 'guest', session: null };
    }
    return resolveAuthState().catch(() => fallback);
}

function applyAuthState(authState) {
    plannerStorage.configureGuestPlanner({ authState });
    state.authState = authState;
    state.guestDraft = plannerStorage.readGuestPlannerDraft();
    const userId = getCurrentUserId();
    state.loggedIn = isAuthenticated(authState) && Boolean(userId);
    return userId;
}

async function loadAuthenticatedData(userId) {
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
}

async function init() {
    initI18n();
    initRefs();
    state.authState = { status: authClient.AUTH_STATES?.GUEST || 'guest' };
    state.guestDraft = plannerStorage.readGuestPlannerDraft();
    renderCurrentDashboard();
    bindDashboardEvents();

    const authState = await resolveDashboardAuth();
    const userId = applyAuthState(authState);
    if (!state.loggedIn) {
        renderCurrentDashboard();
        return;
    }

    await loadAuthenticatedData(userId);
    renderCurrentDashboard();
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
