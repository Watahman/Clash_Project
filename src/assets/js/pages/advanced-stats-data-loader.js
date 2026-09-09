import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { arrayValue } from './advanced-stats-formatters.js?v=20260829-public-auth-v1';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260811-2';

const BATTLE_PAGE_SIZE = 20;
const SECTION_NAMES = ['summary', 'units', 'armies', 'trends', 'battles'];
const RAW_HISTORY_NOT_RETAINED = 'raw_attack_history_not_retained';

function filteredUnits(state) {
    return state.unitCatalog.filter(unit => (state.category === 'ALL' || String(unit?.category || '').toUpperCase() === state.category)
        && isPlayerFacingUnitName(unit?.name || unit?.unitName));
}

function applySectionResult(state, result, key, map = value => value) {
    if (result.status !== 'fulfilled') {
        state.sectionStates[key] = 'error';
        return;
    }
    map(result.value);
    state.sectionStates[key] = 'ready';
}

function markSectionErrors(failures) {
    SECTION_NAMES.forEach(name => {
        document.getElementById(`advanced-stats-${name}-section`)
            ?.setAttribute('data-load-error', String(failures.includes(name)));
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
        state.api.getOverview(state.playerTag, state.period),
        state.api.getUnits(state.playerTag, state.period),
        state.api.getArmies(state.playerTag, state.period),
        state.api.getTrends(state.playerTag, state.period),
        state.api.getBattles(state.playerTag, state.period, { limit: BATTLE_PAGE_SIZE })
    ]);
    if (requestVersion !== state.requestVersion) return;
    const [overview, units, armies, trends, battles] = requests;
    applySectionResult(state, overview, 'overview', value => { state.overview = value; });
    applySectionResult(state, units, 'units', value => {
        state.unitCatalog = arrayValue(value?.items);
        state.units = filteredUnits(state);
    });
    applySectionResult(state, armies, 'armies', value => { state.armies = arrayValue(value?.items); });
    applySectionResult(state, trends, 'trends', value => { state.trends = arrayValue(value?.points); });
    applySectionResult(state, battles, 'battles', value => applyBattleResult(state, value));
    renderPage();
    const failed = requests.map((request, index) => request.status === 'rejected' ? SECTION_NAMES[index] : null).filter(Boolean);
    markSectionErrors(failed);
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
