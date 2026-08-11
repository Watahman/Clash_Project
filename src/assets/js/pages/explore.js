import { initI18n, t } from '../i18n/i18n.js';
import { profileHTML } from '../profile/profile_popup.js';
import { WORKSPACE_MODULES, WORKSPACE_SECTIONS } from '../shell/module-registry.js';

const visibleIds = new Set([
    'groups', 'planner', 'operation', 'warOperation',
    'bracket', 'minigames', 'advancedStats', 'achievements'
]);

function cardMarkup(module) {
    const descriptionKey = `explore.${module.id}.description`;
    const section = WORKSPACE_SECTIONS.find(candidate => candidate.id === module.section);
    return `<a class="cp-module-card" data-pillar="${module.section}" data-explore-card="${module.section}" href="${module.href}">
        <span class="explore-card-heading">${module.icon}<span class="page-kicker" data-i18n="${section.key}">${section.fallback}</span></span>
        <h2 data-i18n="${module.key}">${module.fallback}</h2>
        <p data-i18n="${descriptionKey}">${t(descriptionKey)}</p>
        <strong data-i18n="explore.open">Open →</strong>
    </a>`;
}

function renderCards(container) {
    const modules = WORKSPACE_MODULES.filter(module => visibleIds.has(module.id));
    container.innerHTML = modules.map(cardMarkup).join('');
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

function init() {
    initI18n();
    profileHTML();
    renderCards(document.querySelector('.explore-grid'));
    initI18n(document.querySelector('.explore-grid'));
    initFilters();
}

const initialPageLoad = Promise.resolve().then(init);
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
