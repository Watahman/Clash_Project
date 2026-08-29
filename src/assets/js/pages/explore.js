import { initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import * as authClient from '../auth/auth-client.js?v=20260829-public-auth-v1';
import {
    ACCESS,
    WORKSPACE_MODULES,
    WORKSPACE_SECTIONS
} from '../shell/module-registry.js?v=20260829-public-auth-v1';

const visibleIds = new Set([
    'groups', 'planner', 'operation', 'warOperation',
    'bracket', 'minigames', 'advancedStats', 'achievements'
]);

const EXPLORE_ART = Object.freeze({
    groups: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><path d="m28 72 55-34 62 27 45-25M28 72l58 37 62-34 42 23M86 109V65m62 34V65"/><circle cx="28" cy="72" r="8"/><circle cx="83" cy="38" r="8"/><circle cx="145" cy="65" r="8"/><circle cx="190" cy="40" r="8"/><circle cx="86" cy="109" r="8"/><circle cx="148" cy="99" r="8"/></svg>`,
    planner: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><rect x="30" y="30" width="166" height="112" rx="10"/><path d="M30 62h166M30 90h166M30 118h166M72 30v112M114 30v112M156 30v112"/><circle cx="51" cy="46" r="4"/><circle cx="93" cy="76" r="4"/><circle cx="135" cy="104" r="4"/><circle cx="177" cy="132" r="4"/></svg>`,
    operation: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><path d="M28 137h184M36 120V48M36 120h166M48 106l31-32 27 20 38-47 38 22"/><path d="M48 106h.01M79 74h.01M106 94h.01M144 47h.01M182 69h.01"/><path d="M166 39h36v36"/></svg>`,
    warOperation: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><path d="M120 22 62 47v39c0 29 21 51 58 65 37-14 58-36 58-65V47l-58-25Z"/><path d="m84 108 72-58M93 50l54 58M120 49v58M91 79h58"/><circle cx="120" cy="79" r="17"/></svg>`,
    bracket: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><path d="M31 34h32v22h30v29h34v29h52M31 136h32v-22h30V85h34V56h52M63 45h18M63 125h18M127 85h21"/><circle cx="31" cy="34" r="7"/><circle cx="31" cy="136" r="7"/><circle cx="127" cy="85" r="7"/><circle cx="179" cy="114" r="7"/><circle cx="179" cy="56" r="7"/></svg>`,
    minigames: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><path d="M67 58h106c17 0 29 12 34 29l9 32c4 15-13 26-25 15l-20-19H69l-20 19c-12 11-29 0-25-15l9-32c5-17 17-29 34-29Z"/><rect x="96" y="68" width="48" height="17" rx="4"/><path d="M105 76.5h12m7 0h12M70 83v28M56 97h28M80 57c-1-9 5-16 14-19M160 38c9 3 15 10 14 19M91 111h18M131 111h18"/><circle cx="169" cy="87" r="4"/><circle cx="187" cy="105" r="4"/><circle cx="187" cy="87" r="4"/><circle cx="169" cy="105" r="4"/></svg>`,
    advancedStats: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><path d="M30 139h182M40 124V50M52 121V94h23v27M91 121V72h23v49M130 121V57h23v64M169 121V38h23v83"/><path d="m44 83 34-27 35 20 39-38 38 17"/><circle cx="44" cy="83" r="5"/><circle cx="78" cy="56" r="5"/><circle cx="113" cy="76" r="5"/><circle cx="152" cy="38" r="5"/><circle cx="190" cy="55" r="5"/></svg>`,
    achievements: `<svg viewBox="0 0 240 170" fill="none" focusable="false"><path d="M87 31h66v41c0 24-14 39-33 39S87 96 87 72V31Z"/><path d="M87 43H63v10c0 17 10 28 27 28M153 43h24v10c0 17-10 28-27 28M120 111v24M91 145h58M104 31V18M120 31V13M136 31V18"/><path d="m42 44 12 8M198 44l-12 8M44 95l13-4M196 95l-13-4"/></svg>`
});

function authExport(name) {
    try {
        return authClient[name];
    } catch {
        return undefined;
    }
}

function isAuthenticated(state) {
    return state?.status === (authExport('AUTH_STATES')?.AUTHENTICATED || 'authenticated');
}

function actionMarkup(module, authState) {
    if (module.comingSoon) {
        return '<strong class="explore-card-status" data-i18n="common.comingSoon">Coming soon</strong>';
    }
    if (module.access === ACCESS.AUTH && !isAuthenticated(authState)) {
        return '<strong class="explore-card-status explore-card-status--locked"><span aria-hidden="true">🔒</span> <span data-i18n="auth.login">Sign in</span></strong>';
    }
    return '<strong data-i18n="explore.open">Open →</strong>';
}

function cardMarkup(module, authState) {
    const descriptionKey = `explore.${module.id}.description`;
    const section = WORKSPACE_SECTIONS.find(candidate => candidate.id === module.section);
    const tag = module.comingSoon ? 'div' : 'a';
    const state = module.comingSoon
        ? 'aria-disabled="true"'
        : `href="${module.href}"`;
    const title = module.comingSoon
        ? `<h2><span data-i18n="${module.key}">${module.fallback}</span> <span class="workspace-coming-soon-badge" data-i18n="common.comingSoon">(Coming soon)</span></h2>`
        : `<h2 data-i18n="${module.key}">${module.fallback}</h2>`;
    const action = actionMarkup(module, authState);
    return `<${tag} class="cp-module-card explore-card explore-card--${module.id}${module.comingSoon ? ' explore-card--coming-soon' : ''}" data-pillar="${module.section}" data-explore-card="${module.section}" ${state}>
        <span class="explore-card-heading">${module.icon}<span class="page-kicker" data-i18n="${section.key}">${section.fallback}</span></span>
        ${title}
        <p data-i18n="${descriptionKey}">${t(descriptionKey)}</p>
        ${action}
        <span class="explore-card-art" aria-hidden="true">${EXPLORE_ART[module.id]}</span>
    </${tag}>`;
}

function renderCards(container, authState) {
    const modules = WORKSPACE_MODULES.filter(module => visibleIds.has(module.id));
    container.innerHTML = modules.map(module => cardMarkup(module, authState)).join('');
}

function applyFilter(filter, cards) {
    cards.forEach(card => {
        card.hidden = filter !== 'all' && card.dataset.exploreCard !== filter;
    });
}

function initFilters() {
    const cards = [...document.querySelectorAll('[data-explore-card]')];
    document.querySelectorAll('[data-explore-filter]').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('[data-explore-filter]').forEach(item => {
                item.setAttribute('aria-selected', String(item === button));
            });
            applyFilter(button.dataset.exploreFilter, cards);
        });
    });
}

async function init() {
    initI18n();
    const container = document.querySelector('.explore-grid');
    if (!container) return;
    const initialState = { status: authExport('AUTH_STATES')?.LOADING || 'loading' };
    renderCards(container, initialState);
    const resolveState = authExport('resolveAuthState');
    const authState = typeof resolveState === 'function'
        ? await resolveState().catch(() => initialState)
        : { status: authExport('AUTH_STATES')?.GUEST || 'guest' };
    renderCards(container, authState);
    initI18n(container);
    initFilters();
}

const initialPageLoad = Promise.resolve().then(init);
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
