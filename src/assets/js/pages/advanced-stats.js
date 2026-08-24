import { applyI18n, t } from '../i18n/i18n.js?v=20260809-4';
import { getCurrentUserId } from '../utils/user.js';
import { checkUserId } from '../Supabase/Supabase-User.js';
import {
    deleteAdvancedStatsData,
    getAdvancedStatsArmies,
    getAdvancedStatsBattles,
    getAdvancedStatsOverview,
    getAdvancedStatsTracking,
    getAdvancedStatsTrends,
    getAdvancedStatsUnits,
    pauseAdvancedStatsTracking,
    resumeAdvancedStatsTracking,
    startAdvancedStatsTracking,
    stopAdvancedStatsTracking
} from '../Supabase/Supabase-AdvancedStats.js';
import { getAdvancedStatsFixture } from './advanced-stats-fixtures.js?v=20260811-1';
import {
    renderAccountSelector,
    renderStatistics,
    renderTracking,
    syncPeriodButtons
} from './advanced-stats-renderer.js?v=20260814-advanced-stats-v4';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260809-4';
import { accountsFromProfile, normalizeTag, selectInitialAccount } from './advanced-stats-account.js?v=20260811-2';
import { createTrackingActions } from './advanced-stats-actions.js?v=20260811-2';
import {
    normalizeAnalysis,
    queuedAnalysis
} from './advanced-stats-analysis.js?v=20260814-advanced-stats-v4';
import {
    loadMoreBattles as loadMoreBattlesFromApi,
    loadStatistics as loadStatisticsFromApi
} from './advanced-stats-data-loader.js?v=20260814-advanced-stats-v4';
import { waitForHistoricalAnalysis } from './advanced-stats-analysis-controller.js?v=20260814-advanced-stats-v4';

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
    getBattles: getAdvancedStatsBattles
};

const state = {
    api: realApi,
    accounts: [],
    playerTag: '',
    period: readPreference(PERIOD_STORAGE_KEY) || PERIOD_DEFAULT,
    category: 'ALL',
    tracking: null,
    analysis: null,
    analysisRequested: false,
    overview: null,
    unitCatalog: [],
    units: [],
    armies: [],
    trends: [],
    battles: [],
    nextCursor: null,
    hasMore: false,
    sectionStates: emptySectionStates(),
    requestVersion: 0,
    busy: false,
    profileError: false,
    trackingError: false
};

const elements = {};
let trackingActions;

function emptySectionStates() {
    return { overview: 'idle', units: 'idle', armies: 'idle', trends: 'idle', battles: 'idle' };
}

function cacheElements() {
    const ids = {
        account: 'advanced-stats-account', noAccounts: 'advanced-stats-no-accounts', openProfile: 'advanced-stats-open-profile',
        profileError: 'advanced-stats-profile-error', profileRetry: 'advanced-stats-profile-retry', trackingError: 'advanced-stats-tracking-error', trackingRetry: 'advanced-stats-tracking-retry', pageStatus: 'advanced-stats-page-status',
        notTracking: 'advanced-stats-not-tracking', start: 'advanced-stats-start', initializing: 'advanced-stats-initializing', content: 'advanced-stats-content',
        analysisLoading: 'advanced-stats-initializing', analysisTitle: 'advanced-stats-analysis-title', analysisText: 'advanced-stats-analysis-text', analysisStatus: 'advanced-stats-analysis-status',
        analysisProgress: 'advanced-stats-analysis-progress', analysisProcessed: 'advanced-stats-analysis-processed', analysisAvailable: 'advanced-stats-analysis-available', analysisError: 'advanced-stats-analysis-error', analysisRetry: 'advanced-stats-analysis-retry',
        analysisCoverageNormal: 'advanced-stats-analysis-coverage-normal', analysisCoverageNormalMeta: 'advanced-stats-analysis-coverage-normal-meta', analysisCoverageWar: 'advanced-stats-analysis-coverage-war', analysisCoverageWarMeta: 'advanced-stats-analysis-coverage-war-meta', analysisCoverageRanked: 'advanced-stats-analysis-coverage-ranked', analysisCoverageRankedMeta: 'advanced-stats-analysis-coverage-ranked-meta',
        dashboardCoverageNormal: 'advanced-stats-dashboard-coverage-normal', dashboardCoverageNormalMeta: 'advanced-stats-dashboard-coverage-normal-meta', dashboardCoverageWar: 'advanced-stats-dashboard-coverage-war', dashboardCoverageWarMeta: 'advanced-stats-dashboard-coverage-war-meta', dashboardCoverageRanked: 'advanced-stats-dashboard-coverage-ranked', dashboardCoverageRankedMeta: 'advanced-stats-dashboard-coverage-ranked-meta',
        trackingBar: document.querySelector('.advanced-stats__tracking-bar'), trackingTitle: 'advanced-stats-tracking-title', playerLine: 'advanced-stats-player-line',
        startedAt: 'advanced-stats-started-at', updatedAt: 'advanced-stats-updated-at', battlesProcessed: 'advanced-stats-battles-processed',
        refresh: 'advanced-stats-refresh', pause: 'advanced-stats-pause', resume: 'advanced-stats-resume', stop: 'advanced-stats-stop', delete: 'advanced-stats-delete',
        warning: 'advanced-stats-warning', warningTitle: 'advanced-stats-warning-title', warningText: 'advanced-stats-warning-text', completeSince: 'advanced-stats-complete-since',
        periods: 'advanced-stats-periods', dataStatus: 'advanced-stats-data-status', kpiAttacks: 'advanced-stats-kpi-attacks', kpiStars: 'advanced-stats-kpi-stars',
        kpiThreeStar: 'advanced-stats-kpi-three-star', kpiDestruction: 'advanced-stats-kpi-destruction', favoriteTroop: 'advanced-stats-favorite-troop',
        favoriteTroopMeta: 'advanced-stats-favorite-troop-meta', favoriteTroopImage: 'advanced-stats-favorite-troop-image', favoriteSpell: 'advanced-stats-favorite-spell',
        favoriteSpellMeta: 'advanced-stats-favorite-spell-meta', favoriteSpellImage: 'advanced-stats-favorite-spell-image', favoriteSiege: 'advanced-stats-favorite-siege',
        favoriteSiegeMeta: 'advanced-stats-favorite-siege-meta', favoriteSiegeImage: 'advanced-stats-favorite-siege-image', favoriteArmy: 'advanced-stats-favorite-army',
        favoriteArmyMeta: 'advanced-stats-favorite-army-meta', favoriteArmyImage: 'advanced-stats-favorite-army-image', trendChart: 'advanced-stats-trend-chart',
        trendEmpty: 'advanced-stats-trend-empty', armies: 'advanced-stats-armies', armiesEmpty: 'advanced-stats-armies-empty', unitCategory: 'advanced-stats-unit-category',
        units: 'advanced-stats-units', unitsMobile: 'advanced-stats-units-mobile', unitsTableWrap: 'advanced-stats-units-table-wrap', unitsEmpty: 'advanced-stats-units-empty',
        battles: 'advanced-stats-battles', battlesEmpty: 'advanced-stats-battles-empty', loadMore: 'advanced-stats-load-more', dialog: 'advanced-stats-confirm-dialog',
        dialogForm: 'advanced-stats-confirm-form', dialogTitle: 'advanced-stats-dialog-title', dialogCopy: 'advanced-stats-dialog-copy', dialogCancel: 'advanced-stats-dialog-cancel',
        dialogConfirm: 'advanced-stats-dialog-confirm', dialogError: 'advanced-stats-dialog-error', deleteField: 'advanced-stats-delete-field', deleteInput: 'advanced-stats-delete-input'
    };
    Object.entries(ids).forEach(([key, id]) => { elements[key] = typeof id === 'string' ? document.getElementById(id) : id; });
}

function readPreference(key) {
    try {
        return localStorage.getItem(key) || '';
    } catch {
        return '';
    }
}

function writePreference(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Preferences are optional when storage is unavailable.
    }
}

function setPageStatus(message = '', type = '') {
    if (!elements.pageStatus) return;
    elements.pageStatus.textContent = message;
    elements.pageStatus.dataset.state = type;
    elements.pageStatus.hidden = !message;
}

function setDataStatus(message = '', type = '') {
    if (!elements.dataStatus) return;
    elements.dataStatus.textContent = message;
    elements.dataStatus.dataset.state = type;
}

function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll('.advanced-stats button, .advanced-stats select').forEach(control => {
        control.disabled = busy || (control === elements.account && state.accounts.length < 2);
    });
    renderAccountSelector(elements, state);
}

function renderPage() {
    applyI18n(document);
    renderAccountSelector(elements, state);
    renderTracking(elements, state);
    renderStatistics(elements, state);
    syncPeriodButtons(elements, state.period);
}

function clearStatisticsState() {
    state.overview = null; state.unitCatalog = []; state.units = []; state.armies = []; state.trends = []; state.battles = [];
    state.nextCursor = null; state.hasMore = false; state.sectionStates = emptySectionStates();
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
    cacheElements();
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
    if (!userId) { window.location.assign('/subpages/login.html'); return; }
    try {
        state.accounts = accountsFromProfile(await checkUserId(userId));
        state.profileError = false;
    } catch (error) {
        console.error('advanced_stats_profile_load_failed', error); state.profileError = true; state.accounts = []; setPageStatus(''); renderPage(); return;
    }
    if (!state.accounts.length) { setPageStatus(''); renderPage(); return; }
    state.playerTag = selectInitialAccount(state.accounts, readPreference(ACCOUNT_STORAGE_KEY));
    writePreference(ACCOUNT_STORAGE_KEY, state.playerTag);
    renderPage();
    await refreshTrackingAndData();
}

async function retryProfileLoad() {
    if (state.busy) return;
    setBusy(true); state.profileError = false; setPageStatus(t('advancedStats.loadingTracking'));
    try {
        state.accounts = accountsFromProfile(await checkUserId(getCurrentUserId()));
        state.playerTag = selectInitialAccount(state.accounts, readPreference(ACCOUNT_STORAGE_KEY));
        writePreference(ACCOUNT_STORAGE_KEY, state.playerTag);
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
        state.analysis = normalizeAnalysis(tracking);
        state.analysisRequested = state.analysis.active
            || (state.analysis.error && Number(tracking?.battlesProcessed || 0) === 0);
        state.trackingError = false;
        renderPage();
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

function loadMoreBattles() {
    return loadMoreBattlesFromApi({ state, setBusy, setDataStatus, renderPage });
}

function bindEvents() {
    elements.account.addEventListener('change', () => { state.playerTag = normalizeTag(elements.account.value); writePreference(ACCOUNT_STORAGE_KEY, state.playerTag); resetRangeData({ clearTracking: true }); void refreshTrackingAndData(); });
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
        state.period = period; writePreference(PERIOD_STORAGE_KEY, period); resetRangeData(); void loadStatistics();
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
