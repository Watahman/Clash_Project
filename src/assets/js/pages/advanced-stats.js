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
} from './advanced-stats-renderer.js?v=20260811-1';
import { arrayValue } from './advanced-stats-formatters.js?v=20260811-1';
import { isPlayerFacingUnitName } from './advanced-stats-army-view.js?v=20260809-4';

const PERIOD_DEFAULT = '30d';
const ACCOUNT_STORAGE_KEY = 'clashpanel_advanced_stats_account';
const PERIOD_STORAGE_KEY = 'clashpanel_advanced_stats_period';
const BATTLE_PAGE_SIZE = 20;

const realApi = {
    getTracking: getAdvancedStatsTracking,
    startTracking: startAdvancedStatsTracking,
    pauseTracking: pauseAdvancedStatsTracking,
    resumeTracking: resumeAdvancedStatsTracking,
    stopTracking: stopAdvancedStatsTracking,
    deleteTracking: deleteAdvancedStatsData,
    getOverview: getAdvancedStatsOverview,
    getUnits: (tag, period) => getAdvancedStatsUnits(tag, period, 'ALL'),
    getArmies: (tag, period) => getAdvancedStatsArmies(tag, period, 12),
    getTrends: getAdvancedStatsTrends,
    getBattles: getAdvancedStatsBattles
};

const state = {
    api: realApi,
    accounts: [],
    playerTag: '',
    period: readStorage(PERIOD_STORAGE_KEY) || PERIOD_DEFAULT,
    category: 'ALL',
    tracking: null,
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

function emptySectionStates() {
    return { overview: 'idle', units: 'idle', armies: 'idle', trends: 'idle', battles: 'idle' };
}

function cacheElements() {
    const ids = {
        account: 'advanced-stats-account', noAccounts: 'advanced-stats-no-accounts', openProfile: 'advanced-stats-open-profile',
        profileError: 'advanced-stats-profile-error', profileRetry: 'advanced-stats-profile-retry', trackingError: 'advanced-stats-tracking-error', trackingRetry: 'advanced-stats-tracking-retry', pageStatus: 'advanced-stats-page-status',
        notTracking: 'advanced-stats-not-tracking', start: 'advanced-stats-start', initializing: 'advanced-stats-initializing', content: 'advanced-stats-content',
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

function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    return tag ? (tag.startsWith('#') ? tag : `#${tag}`) : '';
}

function collectAccount(value, output) {
    if (!value) return;
    if (typeof value === 'string') { const tag = normalizeTag(value); if (tag) output.push({ tag, name: tag }); return; }
    if (Array.isArray(value)) { value.forEach(item => collectAccount(item, output)); return; }
    if (typeof value !== 'object') return;
    const tag = normalizeTag(value.tag || value.playerTag || value.accountTag || value.clashTag);
    if (tag) output.push({ tag, name: String(value.name || value.playerName || value.accountName || value.baseName || tag).trim() || tag, townHallLevel: value.townHallLevel || value.townhall || value.townHall || value.th });
    collectAccount(value.base, output);
    collectAccount(value.account, output);
}

function accountsFromProfile(result) {
    const profile = Array.isArray(result) ? result[0] : result;
    const collected = [];
    collectAccount(profile?.accounts, collected);
    collectAccount(profile?.bases, collected);
    return [...new Map(collected.map(account => [account.tag, account])).values()];
}

function selectInitialAccount(accounts) {
    const query = new URLSearchParams(window.location.search).get('playerTag');
    const preferred = [query, readStorage(ACCOUNT_STORAGE_KEY)].map(normalizeTag).filter(Boolean);
    return preferred.find(tag => accounts.some(account => account.tag === tag)) || accounts[0]?.tag || '';
}

function readStorage(key) { try { return localStorage.getItem(key); } catch { return ''; } }
function writeStorage(key, value) { try { localStorage.setItem(key, value); } catch { /* preference only */ } }
function show(element, visible) { if (element) element.hidden = !visible; }
function setPageStatus(message = '', type = '') { elements.pageStatus.textContent = message; elements.pageStatus.dataset.state = type; elements.pageStatus.hidden = !message; }
function setDataStatus(message = '', type = '') { elements.dataStatus.textContent = message; elements.dataStatus.dataset.state = type; }

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
    if (clearTracking) { state.tracking = null; state.trackingError = false; }
    state.requestVersion += 1;
    renderPage();
}

async function initialize() {
    cacheElements();
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
    state.playerTag = selectInitialAccount(state.accounts);
    writeStorage(ACCOUNT_STORAGE_KEY, state.playerTag);
    renderPage();
    await refreshTrackingAndData();
}

async function retryProfileLoad() {
    if (state.busy) return;
    setBusy(true); state.profileError = false; setPageStatus(t('advancedStats.loadingTracking'));
    try {
        state.accounts = accountsFromProfile(await checkUserId(getCurrentUserId()));
        state.playerTag = selectInitialAccount(state.accounts);
        writeStorage(ACCOUNT_STORAGE_KEY, state.playerTag);
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
        state.tracking = await state.api.getTracking(state.playerTag);
        state.trackingError = false;
        if (version !== state.requestVersion) return;
        renderPage();
        setPageStatus('');
        const status = String(state.tracking?.status || 'DISABLED').toUpperCase();
        const hasHistory = Number(state.tracking?.battlesProcessed || 0) > 0;
        if (state.tracking?.trackingExists && (status !== 'INITIALIZING' || hasHistory)) await loadStatistics({ requestVersion: version, manageBusy: false });
        else { clearStatisticsState(); renderPage(); }
    } catch (error) {
        console.error('advanced_stats_tracking_load_failed', error); state.trackingError = true; setPageStatus(t('advancedStats.loadFailed'), 'error'); renderPage();
    } finally { if (!preserveBusy) setBusy(false); }
}

async function loadStatistics({ requestVersion = ++state.requestVersion, manageBusy = true } = {}) {
    if (!state.playerTag) return;
    if (manageBusy) setBusy(true);
    setDataStatus(t('advancedStats.loadingData'));
    const requests = await Promise.allSettled([
        state.api.getOverview(state.playerTag, state.period), state.api.getUnits(state.playerTag, state.period), state.api.getArmies(state.playerTag, state.period),
        state.api.getTrends(state.playerTag, state.period), state.api.getBattles(state.playerTag, state.period, { limit: BATTLE_PAGE_SIZE })
    ]);
    if (requestVersion !== state.requestVersion) {
        if (manageBusy) setBusy(false);
        return;
    }
    const [overview, units, armies, trends, battles] = requests;
    if (overview.status === 'fulfilled') { state.overview = overview.value; state.sectionStates.overview = 'ready'; } else state.sectionStates.overview = 'error';
    if (units.status === 'fulfilled') { state.unitCatalog = arrayValue(units.value?.items); state.units = filteredUnits(); state.sectionStates.units = 'ready'; } else state.sectionStates.units = 'error';
    if (armies.status === 'fulfilled') { state.armies = arrayValue(armies.value?.items); state.sectionStates.armies = 'ready'; } else state.sectionStates.armies = 'error';
    if (trends.status === 'fulfilled') { state.trends = arrayValue(trends.value?.points); state.sectionStates.trends = 'ready'; } else state.sectionStates.trends = 'error';
    if (battles.status === 'fulfilled') { state.battles = arrayValue(battles.value?.items); state.nextCursor = battles.value?.nextCursor || null; state.hasMore = Boolean(battles.value?.hasMore && state.nextCursor); state.sectionStates.battles = 'ready'; } else state.sectionStates.battles = 'error';
    renderPage();
    const names = ['summary', 'units', 'armies', 'trends', 'battles'];
    const failed = requests.map((request, index) => request.status === 'rejected' ? names[index] : null).filter(Boolean);
    names.forEach(name => document.getElementById(`advanced-stats-${name}-section`)?.setAttribute('data-load-error', String(failed.includes(name))));
    setDataStatus(failed.length ? t('advancedStats.partialLoadFailed', { sections: failed.map(name => t(`advancedStats.section.${name}`)).join(', ') }) : t('advancedStats.updatedNow'), failed.length ? 'warning' : 'success');
    if (manageBusy) setBusy(false);
}

function filteredUnits() {
    return state.unitCatalog.filter(unit => (state.category === 'ALL' || String(unit?.category || '').toUpperCase() === state.category)
        && isPlayerFacingUnitName(unit?.name || unit?.unitName));
}

async function loadMoreBattles() {
    if (!state.nextCursor || state.busy) return;
    setBusy(true);
    try {
        const response = await state.api.getBattles(state.playerTag, state.period, { limit: BATTLE_PAGE_SIZE, cursor: state.nextCursor });
        state.battles.push(...arrayValue(response?.items)); state.nextCursor = response?.nextCursor || null; state.hasMore = Boolean(response?.hasMore && state.nextCursor); renderPage();
    } catch (error) { console.error('advanced_stats_battles_more_failed', error); setDataStatus(t('advancedStats.loadFailed'), 'error'); }
    finally { setBusy(false); }
}

async function runTrackingAction(action) {
    if (!state.playerTag || state.busy) return;
    setBusy(true); setDataStatus(t('advancedStats.loadingTracking'));
    try { await state.api[action](state.playerTag); await refreshTrackingAndData({ preserveBusy: true }); }
    catch (error) { console.error('advanced_stats_action_failed', error); setDataStatus(error?.code === 'ADVANCED_STATS_ROLLOUT_RESTRICTED' ? t('advancedStats.rolloutRestricted') : t('advancedStats.actionFailed'), 'error'); }
    finally { setBusy(false); }
}

function openConfirmation(action) {
    state.confirmAction = action;
    const deleting = action === 'deleteTracking';
    elements.dialogTitle.textContent = t(deleting ? 'advancedStats.delete' : 'advancedStats.stop');
    elements.dialogCopy.textContent = t(deleting ? 'advancedStats.confirmDelete' : 'advancedStats.confirmStop');
    elements.dialogConfirm.textContent = t(deleting ? 'advancedStats.delete' : 'advancedStats.stop');
    elements.dialogConfirm.dataset.action = action;
    elements.deleteField.hidden = !deleting;
    elements.deleteInput.value = '';
    elements.dialogError.hidden = true;
    elements.dialog.showModal();
    (deleting ? elements.deleteInput : elements.dialogCancel).focus();
}

function submitConfirmation(event) {
    if (event.submitter?.value !== 'confirm') return;
    event.preventDefault();
    if (state.confirmAction === 'deleteTracking' && elements.deleteInput.value.trim() !== t('advancedStats.deleteKeyword')) {
        elements.dialogError.textContent = t('advancedStats.deletePrompt'); elements.dialogError.hidden = false; elements.deleteInput.focus(); return;
    }
    const action = state.confirmAction;
    elements.dialog.close();
    void runTrackingAction(action);
}

function bindEvents() {
    elements.account.addEventListener('change', () => { state.playerTag = normalizeTag(elements.account.value); writeStorage(ACCOUNT_STORAGE_KEY, state.playerTag); resetRangeData({ clearTracking: true }); void refreshTrackingAndData(); });
    elements.openProfile?.addEventListener('click', () => document.querySelector('#profile-btn')?.click());
    elements.profileRetry?.addEventListener('click', retryProfileLoad);
    elements.trackingRetry?.addEventListener('click', () => void refreshTrackingAndData());
    elements.start?.addEventListener('click', () => void runTrackingAction('startTracking'));
    elements.pause?.addEventListener('click', () => void runTrackingAction('pauseTracking'));
    elements.resume?.addEventListener('click', () => void runTrackingAction('resumeTracking'));
    elements.refresh?.addEventListener('click', () => void refreshTrackingAndData());
    elements.stop?.addEventListener('click', () => openConfirmation('stopTracking'));
    elements.delete?.addEventListener('click', () => openConfirmation('deleteTracking'));
    elements.dialogForm?.addEventListener('submit', submitConfirmation);
    elements.periods?.addEventListener('click', event => {
        const period = event.target.closest('[data-period]')?.dataset.period;
        if (!period || period === state.period) return;
        state.period = period; writeStorage(PERIOD_STORAGE_KEY, period); resetRangeData(); void loadStatistics();
    });
    elements.unitCategory?.addEventListener('change', () => { state.category = elements.unitCategory.value || 'ALL'; state.units = filteredUnits(); renderStatistics(elements, state); });
    elements.loadMore?.addEventListener('click', loadMoreBattles);
    window.addEventListener('clashtools:language-changed', renderPage);
}

const initialLoad = initialize();
window.clashtoolsRegisterInitialLoad?.(initialLoad);
