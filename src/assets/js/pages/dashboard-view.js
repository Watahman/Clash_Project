import { getLanguage, t } from '../i18n/i18n.js?v=20260831-master-live-v1';
import * as authClient from '../auth/auth-client.js?v=20260829-public-auth-v1';
import { ACCESS, WORKSPACE_MODULES } from '../shell/module-registry.js?v=20260829-public-dashboard-v1';
import { renderGroups, renderPlans } from './dashboard-tables.js?v=20260831-dashboard-v1';

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
    return authState?.status === (authClient.AUTH_STATES?.AUTHENTICATED || 'authenticated');
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

    const locked = module.access === ACCESS.AUTH && !isAuthenticated(authState);
    const stateName = module.comingSoon ? 'coming-soon' : locked ? 'auth-required' : 'available';
    element.dataset.moduleAccess = module.access;
    element.dataset.moduleState = stateName;
    if (module.comingSoon) {
        if (element.matches('a')) element.removeAttribute('href');
        action.textContent = t('common.comingSoon');
        return;
    }
    if (element.matches('a')) element.href = locked ? loginHref(module.href) : module.href;
    action.textContent = locked
        ? `🔒 ${t('auth.login')}`
        : t(moduleActionKey(module, element, action));
}

function applyModuleStates(authState) {
    document.querySelectorAll('[data-module-id]').forEach(element => setModuleAction(element, authState));
}

export function renderUser(refs, state) {
    const name = String(state.user?.name || '').trim();
    refs.welcome.textContent = name ? t('dashboard.welcomeName', { name }) : t('dashboard.welcome');
    const accounts = Array.isArray(state.user?.accounts) ? state.user.accounts : [];
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
    if (state.guestDraft || state.plans.length) {
        setNextAction(refs, 'dashboard.v2ContinueTitle', 'dashboard.v2ContinueCopy', 'dashboard.v2ContinueAction', '/app/cwl-planner');
        refs.nextAction.onclick = state.plans.length
            ? () => selectPlan(state.plans[0].id)
            : null;
    } else if (state.groups.length) {
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
    renderUser(refs, state);
    const tools = { formatUpdatedAt, loginHref, moduleForId, selectPlan, setStatus };
    renderPlans(refs, state, tools);
    renderGroups(refs, state, tools);
    renderDashboardPriority(refs, state, selectPlan);
    applyModuleStates(state.authState || { status: 'guest' });
    window.dispatchEvent(new CustomEvent('clashtools:dashboard-state', {
        detail: {
            loggedIn: state.loggedIn,
            plans: state.plans.length,
            groups: state.groups.length,
            accounts: Array.isArray(state.user?.accounts) ? state.user.accounts.length : 0,
            hasErrors: state.plansError || state.groupsError
        }
    }));
}
