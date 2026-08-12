import { initI18n, t } from '../i18n/i18n.js';
import { profileHTML } from '../profile/profile_popup.js';
import { WORKSPACE_MODULES } from '../shell/module-registry.js';

const visibleIds = new Set([
    'groups', 'planner', 'operation', 'warOperation',
    'bracket', 'minigames', 'advancedStats', 'achievements'
]);

const refs = {};

function moduleDescriptionKey(module) {
    return `explore.${module.id}.description`;
}

function cardMarkup(module) {
    const descriptionKey = moduleDescriptionKey(module);
    return `<a class="explore-tool-row" data-pillar="${module.section}" data-explore-card href="${module.href}">
        <span class="explore-tool-icon">${module.icon}</span>
        <span class="explore-tool-copy">
            <h2 data-i18n="${module.key}">${module.fallback}</h2>
            <p data-i18n="${descriptionKey}">${t(descriptionKey)}</p>
        </span>
        <span class="explore-tool-open" aria-hidden="true">→</span>
    </a>`;
}

function visibleModules() {
    return WORKSPACE_MODULES.filter(module => module.available && visibleIds.has(module.id));
}

function renderCards() {
    refs.grid.innerHTML = visibleModules().map(cardMarkup).join('');
    initI18n(refs.grid);
}

function normalizeSearch(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

function applySearch() {
    const query = normalizeSearch(refs.search.value);
    let visibleCount = 0;

    refs.grid.querySelectorAll('[data-explore-card]').forEach(card => {
        const matches = !query || normalizeSearch(card.textContent).includes(query);
        card.hidden = !matches;
        if (matches) visibleCount += 1;
    });

    refs.empty.hidden = visibleCount > 0;
}

function clearSearch() {
    refs.search.value = '';
    applySearch();
    refs.search.focus();
}

function initRefs() {
    refs.grid = document.querySelector('.explore-grid');
    refs.search = document.querySelector('#explore-search');
    refs.empty = document.querySelector('#explore-no-results');
    refs.clear = document.querySelector('#explore-clear-search');
}

function init() {
    initI18n();
    profileHTML();
    initRefs();
    renderCards();
    refs.search.addEventListener('input', applySearch);
    refs.clear.addEventListener('click', clearSearch);
    window.addEventListener('clashtools:language-changed', applySearch);
}

const initialPageLoad = Promise.resolve().then(init);
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
