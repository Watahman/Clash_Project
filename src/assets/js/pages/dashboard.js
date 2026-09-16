import { initI18n } from '../i18n/i18n.js?v=20260831-master-live-v1';
import * as authClient from '../auth/auth-client.js?v=20260915-auth-policy-v1';
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
} from './dashboard-view.js?v=20260916-preview-progress-v1';

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
let authTransitionGeneration = 0;
let lastAuthIdentity = '';
let unsubscribeAuthState;
let unsubscribeProfileUpdate;
let languageChangeHandler;
let accountClickHandler;

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

function authStatus(name, fallback) {
    return authClient.AUTH_STATES?.[name] || fallback;
}

function isAuthenticated(authState) {
    return authState?.status === authStatus('AUTHENTICATED', 'authenticated')
        && Boolean(authState?.session?.user?.id);
}

function getAuthenticatedUserId(authState) {
    if (!isAuthenticated(authState)) return '';
    return String(authState.session.user.id || '').trim();
}

function getAuthIdentity(authState) {
    const status = String(authState?.status || authStatus('LOADING', 'loading'));
    const userId = status === authStatus('AUTHENTICATED', 'authenticated')
        ? getAuthenticatedUserId(authState)
        : '';
    return `${status}:${userId}`;
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

function clearPersonalState() {
    state.user = null;
    state.plans = [];
    state.groups = [];
    state.plansError = false;
    state.groupsError = false;
}

function clearDashboardSubscriptions() {
    unsubscribeAuthState?.();
    unsubscribeProfileUpdate?.();
    unsubscribeAuthState = null;
    unsubscribeProfileUpdate = null;
    if (languageChangeHandler) {
        window.removeEventListener('clashtools:language-changed', languageChangeHandler);
        languageChangeHandler = null;
    }
    if (accountClickHandler) {
        refs.accountLine?.removeEventListener('click', accountClickHandler);
        accountClickHandler = null;
    }
}

function bindDashboardProfileEvents() {
    unsubscribeProfileUpdate = onUserProfileUpdate(profile => {
        if (!state.loggedIn || !state.user || !profile) return;
        state.user = { ...state.user, ...profile };
        renderUser(refs, state);
    });
}

function bindDashboardNavigationEvents() {
    accountClickHandler = () => document.querySelector('#profile-btn')?.click();
    refs.accountLine?.addEventListener('click', accountClickHandler);
    languageChangeHandler = renderCurrentDashboard;
    window.addEventListener('clashtools:language-changed', languageChangeHandler);
}

function bindDashboardAuthEvents() {
    let subscribeAuthState;
    try {
        subscribeAuthState = authClient.onAuthStateChange;
    } catch {
        subscribeAuthState = null;
    }
    if (typeof subscribeAuthState === 'function') {
        unsubscribeAuthState = subscribeAuthState((_session, authState) => {
            applyDashboardAuthState(authState);
        });
    }
}

function bindDashboardEvents() {
    clearDashboardSubscriptions();
    bindDashboardProfileEvents();
    bindDashboardNavigationEvents();
    bindDashboardAuthEvents();
}

async function resolveDashboardAuth() {
    const resolveAuthState = authClient.resolveAuthState;
    const fallback = {
        status: authStatus('UNAVAILABLE', 'auth-unavailable'),
        session: null
    };
    if (typeof resolveAuthState !== 'function') {
        return fallback;
    }
    return resolveAuthState().catch(() => fallback);
}

function applyAuthState(authState) {
    plannerStorage.configureGuestPlanner({ authState });
    state.authState = authState;
    state.guestDraft = plannerStorage.readGuestPlannerDraft();
    const userId = getAuthenticatedUserId(authState);
    state.loggedIn = Boolean(userId);
    return userId;
}

function isCurrentAuthenticatedLoad(userId, generation) {
    return generation === authTransitionGeneration
        && state.loggedIn
        && getAuthenticatedUserId(state.authState) === userId;
}

async function loadAuthenticatedData(userId, generation) {
    if (!isCurrentAuthenticatedLoad(userId, generation)) return false;
    setStatus(refs.planStatus, 'dashboard.loadingPlans');
    setStatus(refs.groupStatus, 'dashboard.loadingGroups');
    const [userResult, plansResult, groupsResult] = await Promise.allSettled([
        checkUserId(userId),
        getAllPlansFromDatabase(userId),
        loadRecentGroups(userId)
    ]);
    if (!isCurrentAuthenticatedLoad(userId, generation)) return false;
    state.user = userResult.status === 'fulfilled' && !userResult.value?.error
        ? userResult.value
        : null;
    if (plansResult.status === 'fulfilled') {
        state.plans = Array.isArray(plansResult.value) ? plansResult.value.map(summarizePlan) : [];
    } else {
        state.plansError = true;
    }
    if (groupsResult.status === 'fulfilled') state.groups = groupsResult.value;
    else state.groupsError = true;
    return true;
}

function applyDashboardAuthState(authState) {
    const nextState = authState || {
        status: authStatus('GUEST', 'guest'),
        session: null
    };
    const nextIdentity = getAuthIdentity(nextState);
    if (nextIdentity === lastAuthIdentity) return;

    lastAuthIdentity = nextIdentity;
    authTransitionGeneration += 1;
    const generation = authTransitionGeneration;
    const userId = applyAuthState(nextState);
    clearPersonalState();
    state.loggedIn = Boolean(userId);
    renderCurrentDashboard();
    if (userId) {
        void loadAuthenticatedData(userId, generation).then(loaded => {
            if (loaded) renderCurrentDashboard();
        });
    }
}

async function init() {
    initI18n();
    initRefs();
    state.authState = { status: authStatus('LOADING', 'loading'), session: null };
    state.guestDraft = plannerStorage.readGuestPlannerDraft();
    renderCurrentDashboard();
    bindDashboardEvents();

    const authState = await resolveDashboardAuth();
    applyDashboardAuthState(authState);
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
