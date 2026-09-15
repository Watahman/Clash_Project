import { getLanguage, t } from '../i18n/i18n.js?v=20260831-master-live-v1';
import * as authClient from '../auth/auth-client.js?v=20260915-auth-policy-v1';
import { ACCESS, WORKSPACE_MODULES } from '../shell/module-registry.js?v=20260829-public-dashboard-v1';
import { renderGroups, renderPlans } from './dashboard-tables.js?v=20260915-auth-policy-v1';

export function formatUpdatedAt(value) {
    if (!value) return t('plans.unknownDate');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('plans.unknownDate');
    return new Intl.DateTimeFormat(getLanguage(), {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

export function setStatus(element, key = '', stateName = '') {
    element.textContent = key ? t(key) : '';
    element.dataset.state = stateName;
    element.hidden = !key;
}

function isAuthenticated(authState) {
    return authState?.status === (authClient.AUTH_STATES?.AUTHENTICATED || 'authenticated')
        && Boolean(authState?.session?.user?.id);
}

function authPresentationStatus(authState) {
    const status = authState?.status || (authClient.AUTH_STATES?.LOADING || 'loading');
    if (status === (authClient.AUTH_STATES?.AUTHENTICATED || 'authenticated')) return 'authenticated';
    if (status === (authClient.AUTH_STATES?.GUEST || 'guest')) return 'guest';
    if (status === (authClient.AUTH_STATES?.UNAVAILABLE || 'auth-unavailable')) return 'unavailable';
    return 'loading';
}

function hasPrivateDashboardData(state) {
    return Boolean(state?.loggedIn && isAuthenticated(state.authState));
}

function stateForPresentation(state) {
    if (hasPrivateDashboardData(state)) return state;
    return {
        ...state,
        user: null,
        plans: [],
        groups: [],
        plansError: false,
        groupsError: false,
        loggedIn: false
    };
}

export function moduleForId(id) {
    return WORKSPACE_MODULES.find(module => module.id === id) || null;
}

export function loginHref(returnTo) {
    let buildLoginUrl;
    try {
        buildLoginUrl = authClient.buildLoginUrl;
    } catch {
        buildLoginUrl = null;
    }
    if (typeof buildLoginUrl === 'function') return buildLoginUrl(returnTo);
    return `/subpages/login.html?next=${encodeURIComponent(returnTo)}`;
}

function moduleActionKey(module, element, action) {
    if (module.id === 'profile') return 'dashboard.openProfile';
    if (module.id === 'drafts') return 'dashboard.allPlans';
    if (module.id === 'groups' && action === element) return 'dashboard.manageGroups';
    return 'explore.open';
}

function setModuleAction(element, authState) {
    const module = moduleForId(element.dataset.moduleId);
    if (!module) return;
    const action = element.matches('[data-module-action]')
        ? element
        : element.querySelector('[data-module-action]');
    if (!action) return;

    const authStatus = authPresentationStatus(authState);
    const protectedModule = module.access === ACCESS.AUTH;
    const locked = protectedModule && authStatus === 'guest';
    const unresolved = protectedModule && ['loading', 'unavailable'].includes(authStatus);
    const stateName = module.comingSoon ? 'coming-soon'
        : unresolved ? `auth-${authStatus}`
            : locked ? 'auth-required' : 'available';
    element.dataset.moduleAccess = module.access;
    element.dataset.moduleState = stateName;
    if (module.comingSoon) {
        if (element.matches('a')) element.removeAttribute('href');
        action.textContent = t('common.comingSoon');
        return;
    }
    if (unresolved) {
        if (element.matches('a')) element.removeAttribute('href');
        element.setAttribute('aria-disabled', 'true');
        action.textContent = t(authStatus === 'unavailable'
            ? 'auth.sessionUnavailable'
            : 'auth.checkingSession');
        return;
    }
    element.removeAttribute('aria-disabled');
    if (element.matches('a')) element.href = locked ? loginHref(module.href) : module.href;
    action.textContent = locked
        ? `🔒 ${t('auth.login')}`
        : t(moduleActionKey(module, element, action));
}

function applyModuleStates(authState) {
    document.querySelectorAll('[data-module-id]').forEach(element => setModuleAction(element, authState));
}

export function renderUser(refs, state) {
    const privateData = hasPrivateDashboardData(state);
    const name = privateData ? String(state.user?.name || '').trim() : '';
    refs.welcome.textContent = name ? t('dashboard.welcomeName', { name }) : t('dashboard.welcome');
    const accounts = privateData && Array.isArray(state.user?.accounts) ? state.user.accounts : [];
    refs.accountCount.textContent = String(accounts.length);
    refs.accountLine.hidden = accounts.length === 0;
}

function setNextAction(refs, titleKey, copyKey, actionKey, href) {
    refs.nextTitle.textContent = t(titleKey);
    refs.nextCopy.textContent = t(copyKey);
    refs.nextAction.textContent = t(actionKey);
    refs.nextAction.href = href;
}

function renderDashboardPriority(refs, state, selectPlan) {
    const privateData = hasPrivateDashboardData(state);
    const plans = privateData ? state.plans : [];
    const groups = privateData ? state.groups : [];
    if (state.guestDraft || plans.length) {
        setNextAction(refs, 'dashboard.v2ContinueTitle', 'dashboard.v2ContinueCopy', 'dashboard.v2ContinueAction', '/app/cwl-planner');
        refs.nextAction.onclick = plans.length
            ? () => selectPlan(plans[0].id)
            : null;
    } else if (groups.length) {
        setNextAction(refs, 'dashboard.v2FamilyTitle', 'dashboard.v2FamilyCopy', 'dashboard.v2FamilyAction', '/app/clan-management');
        refs.nextAction.onclick = null;
    } else {
        setNextAction(refs, 'dashboard.v2StartTitle', 'dashboard.v2StartCopy', 'dashboard.v2StartAction', '/app/cwl-planner');
        refs.nextAction.onclick = null;
    }

    const hasError = state.plansError || state.groupsError;
    refs.attention.dataset.state = hasError ? 'error' : 'clear';
    refs.attentionCopy.textContent = t(hasError ? 'dashboard.v2LoadIssue' : 'dashboard.v2Nothing');
}

export function renderDashboard(refs, state, selectPlan) {
    const presentationState = stateForPresentation(state);
    renderUser(refs, presentationState);
    const tools = { formatUpdatedAt, loginHref, moduleForId, selectPlan, setStatus };
    renderPlans(refs, presentationState, tools);
    renderGroups(refs, presentationState, tools);
    renderDashboardPriority(refs, presentationState, selectPlan);
    applyModuleStates(presentationState.authState || { status: 'loading' });
    window.dispatchEvent(new CustomEvent('clashtools:dashboard-state', {
        detail: {
            loggedIn: presentationState.loggedIn,
            plans: presentationState.plans.length,
            groups: presentationState.groups.length,
            accounts: Array.isArray(presentationState.user?.accounts)
                ? presentationState.user.accounts.length
                : 0,
            hasErrors: presentationState.plansError || presentationState.groupsError
        }
    }));
}
