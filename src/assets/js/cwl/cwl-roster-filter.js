import { t } from '../i18n/i18n.js';
import { getPlayerAvailability } from './cwl-availability.js';
import {
    getPlayerPerformance,
    loadPlayerPerformanceBatch
} from './player-performance-client.js';

function normalizeSearchValue(value) {
    return String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function getPlayerSearchValue(card) {
    const name = card.querySelector('.cwl-player-name')?.textContent || '';
    const tag = card.dataset.playerTag
        || card.querySelector('.cwl-player-hashtag')?.textContent
        || '';
    return normalizeSearchValue(`${name} ${tag} ${tag.replace(/^#/, '')}`);
}

function filterFreeRoster(container, criteria = {}) {
    const filters = typeof criteria === 'string' ? { query: criteria } : criteria || {};
    const cards = playerCards(container);
    let visible = 0;
    cards.forEach(card => {
        const matches = matchesFilters(card, filters);
        card.hidden = !matches;
        if (matches) visible += 1;
    });
    return {
        total: cards.length,
        visible,
        hasQuery: Boolean(normalizeSearchValue(filters.query)),
        hasFilters: hasActiveFilters(filters)
    };
}

function initFreeRosterFilter(options) {
    const { container, input, status, sourceSelect, performanceMin,
        performanceMax, availabilitySelect, sorting } = options;
    if (!container || !input) return () => {};
    const controls = [input, sourceSelect, performanceMin, performanceMax,
        availabilitySelect, sorting].filter(Boolean);
    const immediateControls = new Set([input, performanceMin, performanceMax]);
    let scheduled = false;
    let runToken = 0;

    const applyFilter = async () => {
        scheduled = false;
        const token = ++runToken;
        syncSourceOptions(container, sourceSelect);
        const filters = readFilters(options);
        if (usesPerformance(filters, sorting?.value)) {
            await loadPlayerPerformanceBatch(playerTags(container)).catch(() => ({}));
            if (token !== runToken) return;
        }
        sortPlayerCards(container, sorting?.value || 'townhall');
        const result = filterFreeRoster(container, filters);
        renderFilterState(container, status, result);
        return result;
    };
    const applySoon = () => {
        void applyFilter();
    };
    const scheduleApply = () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            void applyFilter();
        });
    };
    const observer = new MutationObserver(scheduleApply);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    controls.forEach(control => {
        const eventName = immediateControls.has(control) ? 'input' : 'change';
        control.addEventListener(eventName, applySoon);
    });
    window.addEventListener('clashtools:language-changed', applySoon);
    window.addEventListener('clashtools:cwl-active-poll-changed', applySoon);
    window.addEventListener('clashtools:player-performance-updated', applySoon);
    void applyFilter();

    return () => {
        observer.disconnect();
        controls.forEach(control => {
            const eventName = immediateControls.has(control) ? 'input' : 'change';
            control.removeEventListener(eventName, applySoon);
        });
        window.removeEventListener('clashtools:language-changed', applySoon);
        window.removeEventListener('clashtools:cwl-active-poll-changed', applySoon);
        window.removeEventListener('clashtools:player-performance-updated', applySoon);
    };
}

function matchesFilters(card, filters) {
    const query = normalizeSearchValue(filters.query);
    if (query && !getPlayerSearchValue(card).includes(query)) return false;
    if (filters.sourceClan
        && normalizeSearchValue(cardSourceClan(card)) !== normalizeSearchValue(filters.sourceClan)) {
        return false;
    }
    if (filters.availability && filters.availability !== 'all'
        && availabilityState(card) !== filters.availability) return false;
    return matchesPerformanceRange(card, filters.performanceMin, filters.performanceMax);
}

function matchesPerformanceRange(card, minimum, maximum) {
    if (minimum == null && maximum == null) return true;
    const performance = numericPerformance(card, 'performance');
    if (performance == null) return false;
    return (minimum == null || performance >= minimum)
        && (maximum == null || performance <= maximum);
}

function readFilters(options) {
    return {
        query: options.input?.value || '',
        sourceClan: options.sourceSelect?.value || '',
        performanceMin: optionalNumber(options.performanceMin?.value),
        performanceMax: optionalNumber(options.performanceMax?.value),
        availability: options.availabilitySelect?.value || 'all'
    };
}

function hasActiveFilters(filters) {
    return Boolean(normalizeSearchValue(filters.query)
        || filters.sourceClan
        || filters.performanceMin != null
        || filters.performanceMax != null
        || (filters.availability && filters.availability !== 'all'));
}

function usesPerformance(filters, sortValue) {
    return filters.performanceMin != null || filters.performanceMax != null
        || sortValue === 'performance' || sortValue === 'reliability';
}

function sortPlayerCards(container, sortValue) {
    const current = playerCards(container);
    const sorted = [...current].sort((left, right) => compareCards(left, right, sortValue));
    if (sorted.every((card, index) => card === current[index])) return;
    container.append(...sorted);
}

function compareCards(left, right, sortValue) {
    if (sortValue === 'name') return byName(left, right);
    if (sortValue === 'clan') {
        return cardSourceClan(left).localeCompare(cardSourceClan(right), undefined, { sensitivity: 'base' })
            || byName(left, right);
    }
    if (sortValue === 'performance' || sortValue === 'reliability') {
        return compareNullableDescending(
            numericPerformance(left, sortValue),
            numericPerformance(right, sortValue)
        ) || byName(left, right);
    }
    return Number(right.dataset.townHall || 0) - Number(left.dataset.townHall || 0)
        || byName(left, right);
}

function syncSourceOptions(container, select) {
    if (!select) return;
    const selected = select.value;
    const clans = [...new Set(playerCards(container).map(cardSourceClan).filter(Boolean))]
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
    select.replaceChildren(
        option('', t('planner.allSourceClans')),
        ...clans.map(clan => option(clan, clan))
    );
    select.value = clans.includes(selected) ? selected : '';
}

function renderFilterState(container, status, result) {
    const noMatches = result.hasFilters && result.total > 0 && result.visible === 0;
    container.dataset.filterEmpty = String(noMatches);
    container.dataset.filterEmptyLabel = t('planner.noRosterMatches');
    if (status) {
        status.textContent = result.hasFilters
            ? t('planner.rosterResults', { visible: result.visible, total: result.total })
            : '';
    }
}

function playerCards(container) {
    return Array.from(container?.children || []).filter(element =>
        element.matches?.('.cwl-player-article[data-planner-card="true"]')
    );
}

function playerTags(container) {
    return playerCards(container).map(card => card.dataset.playerTag).filter(Boolean);
}

function cardSourceClan(card) {
    return card._cwlPlayer?.clanName
        || card.dataset.sourceClan
        || card._cwlPlayer?.clanTag
        || card.querySelector('.cwl-player-clan')?.textContent?.trim()
        || '';
}

function availabilityState(card) {
    return card.dataset.availability
        || getPlayerAvailability(card.dataset.playerTag).state
        || 'unknown';
}

function numericPerformance(card, key) {
    const value = getPlayerPerformance(card.dataset.playerTag)?.[key];
    return Number.isFinite(Number(value)) ? Number(value) : null;
}

function byName(left, right) {
    const name = card => card.querySelector('.cwl-player-name')?.textContent?.trim() || '';
    return name(left).localeCompare(name(right), undefined, { sensitivity: 'base' });
}

function compareNullableDescending(left, right) {
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return right - left;
}

function optionalNumber(value) {
    if (value == null || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function option(value, label) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
}

export { filterFreeRoster, initFreeRosterFilter, normalizeSearchValue };
