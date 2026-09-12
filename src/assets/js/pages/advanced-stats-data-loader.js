import { t } from '../i18n/i18n.js?v=20260912-advanced-dashboard-v1';
import { arrayValue } from './advanced-stats-formatters.js?v=20260912-advanced-dashboard-v1';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260912-advanced-dashboard-v1';

const BATTLE_PAGE_SIZE = 20;
const SECTION_NAMES = ['overview', 'units', 'armies', 'trends', 'battles'];
const SECTION_ELEMENT_IDS = Object.freeze({ overview: 'advanced-stats-summary-section', units: 'advanced-stats-units-section', armies: 'advanced-stats-armies-section', trends: 'advanced-stats-trends-section', battles: 'advanced-stats-battles-section' });
const RAW_HISTORY_NOT_RETAINED = 'raw_attack_history_not_retained';
const COLLECTION_FIELDS = Object.freeze({ units: 'items', armies: 'items', trends: 'points', battles: 'items' });

function filteredUnits(state) {
    return state.unitCatalog.filter(unit => (state.category === 'ALL' || String(unit?.category || '').toUpperCase() === state.category)
        && isPlayerFacingUnitName(unit?.name || unit?.unitName));
}

function sectionHasData(state, key) {
    if (key === 'overview') return state.overview != null;
    if (key === 'units') return (state.unitCatalog?.length || 0) > 0 || (state.units?.length || 0) > 0;
    return Array.isArray(state[key]) && state[key].length > 0;
}

function mergeOverviewValue(previous, incoming) {
    if (!previous || typeof previous !== 'object' || !incoming || typeof incoming !== 'object') return incoming;
    const merged = { ...previous, ...incoming };
    if (previous.data && incoming.data && typeof previous.data === 'object' && typeof incoming.data === 'object') {
        merged.data = { ...previous.data, ...incoming.data };
        ['summary', 'favorites'].forEach(field => {
            if (previous.data[field] && incoming.data[field] && typeof incoming.data[field] === 'object') {
                merged.data[field] = { ...previous.data[field], ...incoming.data[field] };
            }
        });
    }
    return merged;
}

function retainedSectionValue(state, key, value) {
    if (key === 'overview') return mergeOverviewValue(state.overview, value);
    const field = COLLECTION_FIELDS[key];
    if (field && sectionHasData(state, key) && !Object.prototype.hasOwnProperty.call(value, field)) return null;
    return value;
}

function isPartialResponse(value) {
    return value?.partial === true || value?.data?.partial === true;
}

function applySectionResult(state, result, key, map = value => value) {
    if (result.status !== 'fulfilled') {
        const hasPrevious = sectionHasData(state, key);
        state.sectionStates[key] = hasPrevious ? 'stale' : 'error';
        return state.sectionStates[key];
    }
    if (result.value === null || result.value === undefined) {
        state.sectionStates[key] = sectionHasData(state, key) ? 'stale' : 'error';
        return state.sectionStates[key];
    }
    const value = retainedSectionValue(state, key, result.value);
    if (value === null && sectionHasData(state, key)) {
        state.sectionStates[key] = 'stale';
        return 'stale';
    }
    map(value);
    state.sectionStates[key] = isPartialResponse(result.value) ? 'partial' : 'ready';
    return state.sectionStates[key];
}

function markSectionErrors(failures, state) {
    SECTION_NAMES.forEach(name => {
        const section = document.getElementById(SECTION_ELEMENT_IDS[name]);
        if (!section) return;
        section.setAttribute('data-load-error', String(failures.includes(name)));
        section.dataset.loadState = state.sectionStates[name] || 'idle';
    });
}

function applyBattleResult(state, value) {
    const unsupported = value?.unsupported === true;
    state.battles = arrayValue(value?.items);
    state.battleHistoryUnsupported = unsupported;
    state.battleHistoryUnsupportedReason = unsupported
        ? value?.reason || RAW_HISTORY_NOT_RETAINED
        : null;
    state.nextCursor = unsupported ? null : value?.nextCursor || null;
    state.hasMore = !unsupported && Boolean(value?.hasMore && state.nextCursor);
}

export function resetBattleHistoryState(state) {
    state.battles = [];
    state.nextCursor = null;
    state.hasMore = false;
    state.battleHistoryUnsupported = false;
    state.battleHistoryUnsupportedReason = null;
}

export async function loadStatistics({
    state,
    requestVersion,
    manageBusy = true,
    setBusy,
    setDataStatus,
    renderPage
}) {
    if (!state.playerTag) return;
    if (manageBusy) setBusy(true);
    setDataStatus(t('advancedStats.loadingData'));
    const requests = await Promise.allSettled([
        state.api.getOverview(state.playerTag, state.period, state.attackCategory),
        state.api.getUnits(state.playerTag, state.period),
        state.api.getArmies(state.playerTag, state.period),
        state.api.getTrends(state.playerTag, state.period, state.attackCategory),
        state.api.getBattles(state.playerTag, state.period, { limit: BATTLE_PAGE_SIZE })
    ]);
    if (requestVersion !== state.requestVersion) return;
    const [overview, units, armies, trends, battles] = requests;
    const results = [];
    results.push(applySectionResult(state, overview, 'overview', value => { state.overview = value; }));
    results.push(applySectionResult(state, units, 'units', value => {
        state.unitCatalog = arrayValue(value?.items);
        state.units = filteredUnits(state);
    }));
    results.push(applySectionResult(state, armies, 'armies', value => { state.armies = arrayValue(value?.items); }));
    results.push(applySectionResult(state, trends, 'trends', value => { state.trends = arrayValue(value?.points); }));
    results.push(applySectionResult(state, battles, 'battles', value => applyBattleResult(state, value)));
    renderPage();
    const failed = results.map((result, index) => result === 'ready' ? null : SECTION_NAMES[index]).filter(Boolean);
    markSectionErrors(failed, state);
    setDataStatus(failed.length
        ? t('advancedStats.partialLoadFailed', { sections: failed.map(name => t(`advancedStats.section.${name}`)).join(', ') })
        : t('advancedStats.updatedNow'), failed.length ? 'warning' : 'success');
    if (manageBusy) setBusy(false);
}

export async function loadCategoryStatistics({
    state,
    requestVersion,
    manageBusy = true,
    setBusy,
    setDataStatus,
    renderPage
}) {
    if (!state.playerTag) return;
    if (manageBusy) setBusy(true);
    setDataStatus(t('advancedStats.loadingData'));
    const requests = await Promise.allSettled([
        state.api.getOverview(state.playerTag, state.period, state.attackCategory),
        state.api.getTrends(state.playerTag, state.period, state.attackCategory)
    ]);
    if (requestVersion !== state.requestVersion) {
        if (manageBusy) setBusy(false);
        return;
    }

    const results = [
        applySectionResult(state, requests[0], 'overview', value => { state.overview = value; }),
        applySectionResult(state, requests[1], 'trends', value => { state.trends = arrayValue(value?.points); })
    ];
    renderPage();
    const failed = results.map((result, index) => result === 'ready' ? null : ['overview', 'trends'][index]).filter(Boolean);
    markSectionErrors(failed, state);
    setDataStatus(failed.length
        ? t('advancedStats.partialLoadFailed', { sections: failed.map(name => t(`advancedStats.section.${name}`)).join(', ') })
        : t('advancedStats.updatedNow'), failed.length ? 'warning' : 'success');
    if (manageBusy) setBusy(false);
}

export async function loadMoreBattles({ state, setBusy, setDataStatus, renderPage }) {
    if (!state.nextCursor || state.busy || state.battleHistoryUnsupported) return;
    const version = state.requestVersion;
    setBusy(true);
    try {
        const response = await state.api.getBattles(state.playerTag, state.period, {
            limit: BATTLE_PAGE_SIZE,
            cursor: state.nextCursor
        });
        if (version !== state.requestVersion) return;
        if (response?.unsupported === true) {
            state.battleHistoryUnsupported = true;
            state.battleHistoryUnsupportedReason = response.reason || RAW_HISTORY_NOT_RETAINED;
            state.nextCursor = null;
            state.hasMore = false;
        } else {
            state.battles.push(...arrayValue(response?.items));
            state.nextCursor = response?.nextCursor || null;
            state.hasMore = Boolean(response?.hasMore && state.nextCursor);
        }
        renderPage();
    } catch (error) {
        if (version !== state.requestVersion) return;
        console.error('advanced_stats_battles_more_failed', error);
        setDataStatus(t('advancedStats.loadFailed'), 'error');
    } finally {
        if (version === state.requestVersion) setBusy(false);
    }
}
