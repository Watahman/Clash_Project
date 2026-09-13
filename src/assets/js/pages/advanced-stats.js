import { applyI18n, t } from '../i18n/i18n.js?v=20260913-advanced-dashboard-v2';
import { AUTH_STATES, resolveAuthState } from '../auth/auth-client.js?v=20260913-advanced-dashboard-v2';
import { getRedesignFixture } from '../fixtures/redesign-fixture-mode.js';
import { getCurrentUserId } from '../utils/user.js';
import { checkUserId } from '../Supabase/Supabase-User.js?v=20260913-advanced-dashboard-v2';
import {
    deleteAdvancedStatsData,
    getAdvancedStatsArmies,
    getAdvancedStatsBattles,
    getAdvancedStatsOverview,
    getAdvancedStatsTracking,
    getAdvancedStatsTrends,
    getAdvancedStatsUnits,
    getAdvancedStatsLifetime,
    pauseAdvancedStatsTracking,
    resumeAdvancedStatsTracking,
    startAdvancedStatsTracking,
    stopAdvancedStatsTracking
} from '../Supabase/Supabase-AdvancedStats.js?v=20260913-advanced-dashboard-v2';
import { getAdvancedStatsFixture } from './advanced-stats-fixtures.js?v=20260913-advanced-dashboard-v2';
import {
    renderAccountSelector,
    renderStatistics,
    renderTracking,
    syncPeriodButtons,
    syncAttackCategoryButtons,
    syncTrendMetricButtons
} from './advanced-stats-renderer.js?v=20260913-advanced-dashboard-v2';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260809-4';
import { accountsFromProfile, normalizeTag, selectInitialAccount } from './advanced-stats-account.js?v=20260913-advanced-dashboard-v2';
import { createTrackingActions } from './advanced-stats-actions.js?v=20260913-advanced-dashboard-v2';
import {
    normalizeAnalysis,
    queuedAnalysis
} from './advanced-stats-analysis.js?v=20260913-advanced-dashboard-v2';
import {
    loadMoreBattles as loadMoreBattlesFromApi,
    loadCategoryStatistics as loadCategoryStatisticsFromApi,
    loadStatistics as loadStatisticsFromApi,
    resetBattleHistoryState
} from './advanced-stats-data-loader.js?v=20260913-advanced-dashboard-v2';
import { waitForHistoricalAnalysis } from './advanced-stats-analysis-controller.js?v=20260913-advanced-dashboard-v2';
import {
    cacheAdvancedStatsElements,
    emptyAdvancedStatsSectionStates,
    readAdvancedStatsPreference,
    writeAdvancedStatsPreference
} from './advanced-stats-dom.js?v=20260913-advanced-dashboard-v2';
import { createAdvancedStatsPageUi } from './advanced-stats-page-ui.js?v=20260913-advanced-dashboard-v2';
import { createLifetimeLoader } from './advanced-stats-lifetime-state.js?v=20260913-advanced-dashboard-v2';

const PERIOD_DEFAULT = '30d';
const ACCOUNT_STORAGE_KEY = 'clashpanel_advanced_stats_account';
const PERIOD_STORAGE_KEY = 'clashpanel_advanced_stats_period';
const FAVORITE_ARMY_LIMIT = 3;

const realApi = {
    getTracking: getAdvancedStatsTracking,
    startTracking: startAdvancedStatsTracking,
    pauseTracking: pauseAdvancedStatsTracking,
    resumeTracking: resumeAdvancedStatsTracking,
    stopTracking: stopAdvancedStatsTracking,
    deleteTracking: deleteAdvancedStatsData,
    getOverview: getAdvancedStatsOverview,
    getUnits: (tag, period) => getAdvancedStatsUnits(tag, period, 'ALL'),
    getArmies: (tag, period) => getAdvancedStatsArmies(tag, period, FAVORITE_ARMY_LIMIT),
    getTrends: getAdvancedStatsTrends,
    getLifetime: getAdvancedStatsLifetime,
    getBattles: getAdvancedStatsBattles
};

const state = {
    api: realApi,
    accounts: [],
    playerTag: '',
    period: readAdvancedStatsPreference(PERIOD_STORAGE_KEY) || PERIOD_DEFAULT,
    category: 'ALL',
    attackCategory: 'ALL',
    trendMetric: 'attacks',
    tracking: null,
    analysis: null,
    analysisRequested: false,
    overview: null,
    lifetime: null,
    lifetimeState: 'idle',
    lifetimePlayerTag: '',
    lifetimeLoadAttempted: false,
    lifetimeGeneration: 0,
    unitCatalog: [],
    units: [],
    armies: [],
    trends: [],
    battles: [],
    nextCursor: null,
    hasMore: false,
    sectionStates: emptyAdvancedStatsSectionStates(),
    requestVersion: 0,
    busy: false,
    profileError: false,
    trackingError: false
};

const elements = {};
let trackingActions;

const pageUi = createAdvancedStatsPageUi({ elements, state, renderAccountSelector });
const { setDataStatus, setBusy, setPageStatus } = pageUi;
const lifetimeLoader = createLifetimeLoader({ state, renderPage });
const { loadLifetime, resetLifetimeState } = lifetimeLoader;

function renderPage() {
    applyI18n(document);
    renderAccountSelector(elements, state);
    renderTracking(elements, state);
    renderStatistics(elements, state);
    syncPeriodButtons(elements, state.period);
    syncAttackCategoryButtons(elements, state.attackCategory);
    syncTrendMetricButtons(elements, state.trendMetric);
}

function clearStatisticsState() {
    state.overview = null; state.unitCatalog = []; state.units = []; state.armies = []; state.trends = [];
    resetBattleHistoryState(state);
    state.sectionStates = emptyAdvancedStatsSectionStates();
}

function resetRangeData({ clearTracking = false } = {}) {
    clearStatisticsState();
    if (clearTracking) { state.tracking = null; state.analysis = null; state.analysisRequested = false; state.trackingError = false; }
    state.requestVersion += 1;
    renderPage();
}

function beginHistoricalAnalysis() {
    state.analysisRequested = true;
    state.analysis = queuedAnalysis();
    state.trackingError = false;
    setPageStatus(t('advancedStats.analysisLiveStatus'));
    renderPage();
}

function failHistoricalAnalysis() {
    state.analysis = {
        ...queuedAnalysis(),
        phase: 'ERROR',
        active: false,
        ready: false,
        error: true
    };
    state.analysisRequested = true;
    renderPage();
}

async function initialize() {
    const requestedFixture = await getRedesignFixture().catch(() => null);
    const fixtureMode = requestedFixture?.module === 'advanced-stats';
    if (!fixtureMode) {
        const authState = await resolveAuthState().catch(() => null);
        if (authState?.status !== AUTH_STATES.AUTHENTICATED) return;
    }
    Object.assign(elements, cacheAdvancedStatsElements());
    trackingActions = createTrackingActions({
        state, elements, setBusy, setDataStatus, refreshTrackingAndData,
        onStartRequested: beginHistoricalAnalysis,
        onStartFailed: failHistoricalAnalysis
    });
    applyI18n(document);
    bindEvents();
    setPageStatus(t('advancedStats.loadingTracking'));
    const fixture = await getAdvancedStatsFixture().catch(error => { console.error('[advanced-stats-fixture]', error); return null; });
    if (fixture) { state.api = fixture; state.accounts = fixture.accounts; state.playerTag = fixture.accounts[0]?.tag || ''; renderPage(); if (state.playerTag) await refreshTrackingAndData(); else setPageStatus(''); return; }
    const userId = getCurrentUserId();
    if (!userId) return;
    try {
        state.accounts = accountsFromProfile(await checkUserId(userId));
        state.profileError = false;
    } catch (error) {
        console.error('advanced_stats_profile_load_failed', error); state.profileError = true; state.accounts = []; setPageStatus(''); renderPage(); return;
    }
    if (!state.accounts.length) { setPageStatus(''); renderPage(); return; }
    state.playerTag = selectInitialAccount(state.accounts, readAdvancedStatsPreference(ACCOUNT_STORAGE_KEY));
    writeAdvancedStatsPreference(ACCOUNT_STORAGE_KEY, state.playerTag);
    renderPage();
    await refreshTrackingAndData();
}

async function retryProfileLoad() {
    if (state.busy) return;
    setBusy(true); state.profileError = false; setPageStatus(t('advancedStats.loadingTracking'));
    try {
        state.accounts = accountsFromProfile(await checkUserId(getCurrentUserId()));
        state.playerTag = selectInitialAccount(state.accounts, readAdvancedStatsPreference(ACCOUNT_STORAGE_KEY));
        writeAdvancedStatsPreference(ACCOUNT_STORAGE_KEY, state.playerTag);
        renderPage();
        if (state.playerTag) await refreshTrackingAndData({ preserveBusy: true }); else setPageStatus('');
    } catch (error) { console.error('advanced_stats_profile_load_failed', error); state.profileError = true; setPageStatus(''); renderPage(); }
    finally { setBusy(false); }
}

async function refreshTrackingAndData({ preserveBusy = false } = {}) {
    if (!state.playerTag) { renderPage(); return; }
    const version = ++state.requestVersion;
    if (!preserveBusy) setBusy(true);
    setPageStatus(t('advancedStats.loadingTracking'));
    try {
        const tracking = await state.api.getTracking(state.playerTag);
        if (version !== state.requestVersion) return;
        state.tracking = tracking;
        if (!tracking?.trackingExists) resetLifetimeState();
        state.analysis = normalizeAnalysis(tracking);
        state.analysisRequested = state.analysis.active
            || (state.analysis.error && Number(tracking?.battlesProcessed || 0) === 0);
        state.trackingError = false;
        renderPage();
        void loadLifetime();
        setPageStatus('');
        const status = String(state.tracking?.status || 'DISABLED').toUpperCase();
        const hasHistory = Number(state.tracking?.battlesProcessed || 0) > 0;
        if (state.analysis.active) await waitForHistoricalAnalysis({
            state, version, tracking, renderPage, loadStatistics, setDataStatus,
            errorMessage: t('advancedStats.analysisLoadFailed')
        });
        else if (state.analysis.error && !hasHistory) setDataStatus(t('advancedStats.analysisLoadFailed'), 'error');
        else if (state.tracking?.trackingExists && (status !== 'INITIALIZING' || hasHistory)) await loadStatistics({ requestVersion: version, manageBusy: false });
        else { clearStatisticsState(); renderPage(); }
    } catch (error) {
        if (version !== state.requestVersion) return;
        console.error('advanced_stats_tracking_load_failed', error); state.trackingError = true; setPageStatus(t('advancedStats.loadFailed'), 'error'); renderPage();
    } finally { if (!preserveBusy && version === state.requestVersion) setBusy(false); }
}

function loadStatistics(options = {}) {
    const requestVersion = options.requestVersion ?? ++state.requestVersion;
    return loadStatisticsFromApi({ state, setBusy, setDataStatus, renderPage, ...options, requestVersion });
}

function loadCategoryStatistics({ requestVersion }) {
    setBusy(true);
    return loadCategoryStatisticsFromApi({
        state, requestVersion, manageBusy: false, setBusy, setDataStatus, renderPage
    }).finally(() => {
        if (requestVersion === state.requestVersion) setBusy(false);
    });
}

function loadMoreBattles() {
    return loadMoreBattlesFromApi({ state, setBusy, setDataStatus, renderPage });
}

function bindEvents() {
    elements.account.addEventListener('change', () => {
        state.playerTag = normalizeTag(elements.account.value);
        writeAdvancedStatsPreference(ACCOUNT_STORAGE_KEY, state.playerTag);
        resetLifetimeState();
        resetRangeData({ clearTracking: true });
        void refreshTrackingAndData();
    });
    elements.openProfile?.addEventListener('click', () => document.querySelector('#profile-btn')?.click());
    elements.profileRetry?.addEventListener('click', retryProfileLoad);
    elements.trackingRetry?.addEventListener('click', () => void refreshTrackingAndData());
    elements.start?.addEventListener('click', trackingActions.start);
    elements.analysisRetry?.addEventListener('click', trackingActions.start);
    elements.pause?.addEventListener('click', trackingActions.pause);
    elements.resume?.addEventListener('click', trackingActions.resume);
    elements.refresh?.addEventListener('click', () => void refreshTrackingAndData());
    elements.stop?.addEventListener('click', trackingActions.openStopConfirmation);
    elements.delete?.addEventListener('click', trackingActions.openDeleteConfirmation);
    elements.dialogForm?.addEventListener('submit', trackingActions.submitConfirmation);
    elements.periods?.addEventListener('click', event => {
        const period = event.target.closest('[data-period]')?.dataset.period;
        if (!period || period === state.period) return;
        state.period = period; writeAdvancedStatsPreference(PERIOD_STORAGE_KEY, period); resetRangeData(); void loadStatistics();
    });
    elements.attackCategories?.addEventListener('click', event => {
        const value = event.target.closest('[data-attack-category]')?.dataset.attackCategory;
        const attackCategory = String(value || '').trim().toUpperCase();
        if (!['ALL', 'REGULAR', 'COMPETITIVE'].includes(attackCategory) || attackCategory === state.attackCategory) return;
        state.attackCategory = attackCategory;
        const version = ++state.requestVersion;
        renderPage();
        void loadCategoryStatistics({ requestVersion: version });
    });
    elements.trendMetrics?.addEventListener('click', event => {
        const metric = event.target.closest('[data-trend-metric]')?.dataset.trendMetric;
        if (!metric || metric === state.trendMetric) return;
        state.trendMetric = metric;
        renderPage();
    });
    elements.unitCategory?.addEventListener('change', () => {
        state.category = elements.unitCategory.value || 'ALL';
        state.units = state.unitCatalog.filter(unit => (state.category === 'ALL' || String(unit?.category || '').toUpperCase() === state.category)
            && isPlayerFacingUnitName(unit?.name || unit?.unitName));
        renderStatistics(elements, state);
    });
    elements.loadMore?.addEventListener('click', loadMoreBattles);
    window.addEventListener('clashtools:language-changed', renderPage);
}

const initialLoad = initialize();
window.clashtoolsRegisterInitialLoad?.(initialLoad);
