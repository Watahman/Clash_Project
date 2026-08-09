import { t, getLanguage } from '../i18n/i18n.js';
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
import { presentArmy } from './advanced-stats-army-view.js';

const PERIOD_DEFAULT = '30d';
const ACCOUNT_STORAGE_KEY = 'clashpanel_advanced_stats_account';
const BATTLE_PAGE_SIZE = 20;

const state = {
    accounts: [],
    playerTag: '',
    period: PERIOD_DEFAULT,
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
    requestVersion: 0,
    busy: false
};

const elements = {};

function cacheElements() {
    const ids = [
        'advanced-stats-account', 'advanced-stats-no-accounts', 'advanced-stats-open-profile',
        'advanced-stats-profile-error', 'advanced-stats-profile-retry',
        'advanced-stats-page-status', 'advanced-stats-not-tracking', 'advanced-stats-start',
        'advanced-stats-initializing', 'advanced-stats-content', 'advanced-stats-tracking-title',
        'advanced-stats-player-line', 'advanced-stats-started-at', 'advanced-stats-updated-at',
        'advanced-stats-battles-processed', 'advanced-stats-refresh', 'advanced-stats-pause',
        'advanced-stats-resume', 'advanced-stats-stop', 'advanced-stats-delete',
        'advanced-stats-warning', 'advanced-stats-warning-title', 'advanced-stats-warning-text',
        'advanced-stats-complete-since', 'advanced-stats-periods', 'advanced-stats-data-status',
        'advanced-stats-kpi-attacks', 'advanced-stats-kpi-stars', 'advanced-stats-kpi-three-star',
        'advanced-stats-kpi-destruction', 'advanced-stats-favorite-troop',
        'advanced-stats-favorite-troop-meta', 'advanced-stats-favorite-spell',
        'advanced-stats-favorite-spell-meta', 'advanced-stats-favorite-siege',
        'advanced-stats-favorite-siege-meta', 'advanced-stats-favorite-army',
        'advanced-stats-favorite-army-meta', 'advanced-stats-trend-chart',
        'advanced-stats-trend-empty', 'advanced-stats-armies', 'advanced-stats-armies-empty',
        'advanced-stats-unit-category', 'advanced-stats-units', 'advanced-stats-units-empty',
        'advanced-stats-battles', 'advanced-stats-battles-empty', 'advanced-stats-load-more'
    ];
    ids.forEach(id => { elements[id] = document.getElementById(id); });
    elements.trackingBar = document.querySelector('.advanced-stats__tracking-bar');
}

function normalizeTag(value) {
    const tag = String(value || '').trim().toUpperCase();
    if (!tag) return '';
    return tag.startsWith('#') ? tag : `#${tag}`;
}

function collectAccount(account, output) {
    if (!account) return;
    if (typeof account === 'string') {
        const tag = normalizeTag(account);
        if (tag) output.push({ tag, name: tag });
        return;
    }
    if (Array.isArray(account)) {
        account.forEach(item => collectAccount(item, output));
        return;
    }
    if (typeof account !== 'object') return;

    const tag = normalizeTag(account.tag || account.playerTag || account.accountTag || account.clashTag);
    if (tag) {
        output.push({
            tag,
            name: String(account.name || account.playerName || account.accountName || account.baseName || tag).trim() || tag
        });
    }
    collectAccount(account.base, output);
    collectAccount(account.account, output);
}

function accountsFromProfile(result) {
    const profile = Array.isArray(result) ? result[0] : result;
    const collected = [];
    collectAccount(profile?.accounts, collected);
    collectAccount(profile?.bases, collected);
    const unique = new Map();
    collected.forEach(account => {
        if (!unique.has(account.tag)) unique.set(account.tag, account);
    });
    return [...unique.values()];
}

function selectInitialAccount(accounts) {
    const query = new URLSearchParams(window.location.search).get('playerTag');
    const candidates = [query, readStorage(ACCOUNT_STORAGE_KEY)].map(normalizeTag).filter(Boolean);
    return candidates.find(tag => accounts.some(account => account.tag === tag)) || accounts[0]?.tag || '';
}

function readStorage(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
    try { localStorage.setItem(key, value); } catch { /* optional preference only */ }
}

function renderAccountSelector() {
    const select = elements['advanced-stats-account'];
    select.replaceChildren();
    state.accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.tag;
        option.textContent = account.name === account.tag ? account.tag : `${account.name} · ${account.tag}`;
        option.selected = account.tag === state.playerTag;
        select.append(option);
    });
    select.disabled = state.accounts.length < 2 || state.busy;
}

function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll('.advanced-stats button, .advanced-stats select').forEach(control => {
        if (control === elements['advanced-stats-account']) {
            control.disabled = busy || state.accounts.length < 2;
        } else {
            control.disabled = busy;
        }
    });
}

function show(element, visible) {
    if (element) element.hidden = !visible;
}

function setPageStatus(key = '', fallback = '') {
    const element = elements['advanced-stats-page-status'];
    if (!element) return;
    element.textContent = key ? t(key) : fallback;
    element.hidden = !element.textContent;
}

function setDataStatus(key = '', fallback = '') {
    const element = elements['advanced-stats-data-status'];
    if (!element) return;
    element.textContent = key ? t(key) : fallback;
}

function activeAccount() {
    return state.accounts.find(account => account.tag === state.playerTag) || null;
}

async function initialize() {
    cacheElements();
    bindEvents();
    setPageStatus('advancedStats.loadingTracking');

    const userId = getCurrentUserId();
    if (!userId) {
        window.location.assign('/subpages/login.html');
        return;
    }

    try {
        const profile = await checkUserId(userId);
        state.accounts = accountsFromProfile(profile);
    } catch (error) {
        console.error('advanced_stats_profile_load_failed', error);
        state.accounts = [];
        show(elements['advanced-stats-no-accounts'], false);
        show(elements['advanced-stats-profile-error'], true);
        setPageStatus('', '');
        renderAccountSelector();
        return;
    }

    show(elements['advanced-stats-profile-error'], false);

    if (!state.accounts.length) {
        show(elements['advanced-stats-no-accounts'], true);
        setPageStatus('', '');
        renderAccountSelector();
        return;
    }

    state.playerTag = selectInitialAccount(state.accounts);
    writeStorage(ACCOUNT_STORAGE_KEY, state.playerTag);
    renderAccountSelector();
    await refreshTrackingAndData();
}

function bindEvents() {
    elements['advanced-stats-account']?.addEventListener('change', async event => {
        state.playerTag = normalizeTag(event.target.value);
        state.period = PERIOD_DEFAULT;
        state.category = 'ALL';
        state.nextCursor = null;
        state.battles = [];
        state.unitCatalog = [];
        state.units = [];
        writeStorage(ACCOUNT_STORAGE_KEY, state.playerTag);
        syncPeriodButtons();
        elements['advanced-stats-unit-category'].value = 'ALL';
        await refreshTrackingAndData();
    });

    elements['advanced-stats-open-profile']?.addEventListener('click', () => {
        document.querySelector('#profile-btn')?.click();
    });
    elements['advanced-stats-profile-retry']?.addEventListener('click', retryProfileLoad);
    elements['advanced-stats-start']?.addEventListener('click', () => runTrackingAction(startAdvancedStatsTracking));
    elements['advanced-stats-pause']?.addEventListener('click', () => runTrackingAction(pauseAdvancedStatsTracking));
    elements['advanced-stats-resume']?.addEventListener('click', () => runTrackingAction(resumeAdvancedStatsTracking));
    elements['advanced-stats-refresh']?.addEventListener('click', refreshTrackingAndData);
    elements['advanced-stats-stop']?.addEventListener('click', async () => {
        if (!window.confirm(t('advancedStats.confirmStop'))) return;
        await runTrackingAction(stopAdvancedStatsTracking);
    });
    elements['advanced-stats-delete']?.addEventListener('click', deleteTrackingData);

    elements['advanced-stats-periods']?.addEventListener('click', async event => {
        const button = event.target.closest('[data-period]');
        if (!button || button.dataset.period === state.period) return;
        state.period = button.dataset.period;
        state.nextCursor = null;
        state.battles = [];
        syncPeriodButtons();
        await loadStatistics();
    });

    elements['advanced-stats-unit-category']?.addEventListener('change', async event => {
        state.category = event.target.value || 'ALL';
        await loadUnitsOnly();
    });

    elements['advanced-stats-load-more']?.addEventListener('click', loadMoreBattles);

    window.addEventListener('clashtools:language-changed', () => {
        renderTracking();
        renderStatistics();
        renderAccountSelector();
    });
}

async function retryProfileLoad() {
    if (state.busy) return;
    setBusy(true);
    show(elements['advanced-stats-profile-error'], false);
    setPageStatus('advancedStats.loadingTracking');
    try {
        const profile = await checkUserId(getCurrentUserId());
        state.accounts = accountsFromProfile(profile);
        if (!state.accounts.length) {
            show(elements['advanced-stats-no-accounts'], true);
            setPageStatus('', '');
            return;
        }
        show(elements['advanced-stats-no-accounts'], false);
        state.playerTag = selectInitialAccount(state.accounts);
        writeStorage(ACCOUNT_STORAGE_KEY, state.playerTag);
        await refreshTrackingAndData({ preserveBusy: true });
    } catch (error) {
        console.error('advanced_stats_profile_load_failed', error);
        show(elements['advanced-stats-profile-error'], true);
        setPageStatus('', '');
    } finally {
        setBusy(false);
        renderAccountSelector();
    }
}

async function runTrackingAction(action) {
    if (!state.playerTag || state.busy) return;
    setBusy(true);
    setDataStatus('advancedStats.loadingTracking');
    try {
        await action(state.playerTag);
        await refreshTrackingAndData({ preserveBusy: true });
    } catch (error) {
        console.error('advanced_stats_action_failed', error);
        setDataStatus(error?.code === 'ADVANCED_STATS_ROLLOUT_RESTRICTED'
            ? 'advancedStats.rolloutRestricted'
            : 'advancedStats.actionFailed');
    } finally {
        setBusy(false);
        renderAccountSelector();
    }
}

async function deleteTrackingData() {
    if (!state.playerTag || state.busy) return;
    if (!window.confirm(t('advancedStats.confirmDelete'))) return;
    const typed = window.prompt(t('advancedStats.deletePrompt'));
    if (typed !== t('advancedStats.deleteKeyword')) return;

    setBusy(true);
    try {
        await deleteAdvancedStatsData(state.playerTag);
        clearStatisticsState();
        await refreshTrackingAndData({ preserveBusy: true });
    } catch (error) {
        console.error('advanced_stats_delete_failed', error);
        setDataStatus('advancedStats.actionFailed');
    } finally {
        setBusy(false);
        renderAccountSelector();
    }
}

async function refreshTrackingAndData({ preserveBusy = false } = {}) {
    if (!state.playerTag) return;
    const version = ++state.requestVersion;
    if (!preserveBusy) setBusy(true);
    setPageStatus('advancedStats.loadingTracking');

    try {
        const tracking = await getAdvancedStatsTracking(state.playerTag);
        if (version !== state.requestVersion) return;
        state.tracking = tracking;
        renderTracking();
        setPageStatus('', '');

        const status = String(tracking?.status || 'DISABLED').toUpperCase();
        const hasHistory = Number(tracking?.battlesProcessed || 0) > 0;
        if (tracking?.trackingExists && (status !== 'INITIALIZING' || hasHistory)) {
            await loadStatistics({ requestVersion: version, manageBusy: false });
        } else {
            clearStatisticsState();
            renderStatistics();
        }
    } catch (error) {
        if (version !== state.requestVersion) return;
        console.error('advanced_stats_tracking_load_failed', error);
        state.tracking = null;
        setPageStatus('advancedStats.loadFailed');
        show(elements['advanced-stats-not-tracking'], false);
        show(elements['advanced-stats-initializing'], false);
        show(elements['advanced-stats-content'], false);
    } finally {
        if (!preserveBusy) {
            setBusy(false);
            renderAccountSelector();
        }
    }
}

function renderTracking() {
    const tracking = state.tracking;
    const status = String(tracking?.status || 'DISABLED').toUpperCase();
    const exists = Boolean(tracking?.trackingExists);
    const hasHistory = Number(tracking?.battlesProcessed || 0) > 0;

    show(elements['advanced-stats-no-accounts'], false);
    show(elements['advanced-stats-not-tracking'], !exists || status === 'DISABLED');
    show(elements['advanced-stats-initializing'], exists && status === 'INITIALIZING' && !hasHistory);
    show(elements['advanced-stats-content'], exists && status !== 'DISABLED' && (status !== 'INITIALIZING' || hasHistory));

    if (!exists || status === 'DISABLED') return;

    elements.trackingBar?.setAttribute('data-status', status);
    elements['advanced-stats-tracking-title'].textContent = statusLabel(status);
    const account = activeAccount();
    const playerName = tracking.playerName || account?.name || state.playerTag;
    elements['advanced-stats-player-line'].textContent = `${playerName} · ${state.playerTag}`;
    elements['advanced-stats-started-at'].textContent = formatDateTime(tracking.trackingStartedAt, t('advancedStats.pending'));
    elements['advanced-stats-updated-at'].textContent = formatDate(tracking.lastSuccessfulPollAt, t('advancedStats.never'));
    elements['advanced-stats-battles-processed'].textContent = formatNumber(tracking.battlesProcessed || 0);

    const canPause = ['ACTIVE', 'DEGRADED'].includes(status);
    const canResume = ['PAUSED', 'STOPPED', 'ERROR'].includes(status);
    const canStop = !['STOPPED'].includes(status);
    show(elements['advanced-stats-pause'], canPause);
    show(elements['advanced-stats-resume'], canResume);
    show(elements['advanced-stats-stop'], canStop);

    renderTrackingWarning(status, tracking);
}

function statusLabel(status) {
    const key = {
        ACTIVE: 'advancedStats.active',
        INITIALIZING: 'advancedStats.initializingTitle',
        PAUSED: 'advancedStats.paused',
        DEGRADED: 'advancedStats.degraded',
        STOPPED: 'advancedStats.stopped',
        ERROR: 'advancedStats.error'
    }[status] || 'advancedStats.statusUnknown';
    return t(key);
}

function renderTrackingWarning(status, tracking) {
    const warning = elements['advanced-stats-warning'];
    const hasGap = Boolean(tracking?.hasPotentialGap || tracking?.gapStartedAt);
    const statusWarning = ['PAUSED', 'DEGRADED', 'STOPPED', 'ERROR'].includes(status);
    show(warning, hasGap || statusWarning);
    if (!hasGap && !statusWarning) return;

    let titleKey = 'advancedStats.gapTitle';
    let textKey = 'advancedStats.gapText';
    if (status === 'DEGRADED') { titleKey = 'advancedStats.degraded'; textKey = 'advancedStats.degradedText'; }
    else if (status === 'PAUSED') { titleKey = 'advancedStats.paused'; textKey = 'advancedStats.pausedText'; }
    else if (status === 'STOPPED') { titleKey = 'advancedStats.stopped'; textKey = 'advancedStats.stoppedText'; }
    else if (status === 'ERROR') { titleKey = 'advancedStats.error'; textKey = 'advancedStats.errorText'; }

    elements['advanced-stats-warning-title'].textContent = t(titleKey);
    elements['advanced-stats-warning-text'].textContent = t(textKey);
    const completeSince = tracking?.dataCompleteSince;
    elements['advanced-stats-complete-since'].textContent = completeSince
        ? `${t('advancedStats.dataCompleteSince')}: ${formatDate(completeSince)}`
        : '';
}

async function loadStatistics({ requestVersion = ++state.requestVersion, manageBusy = true } = {}) {
    if (!state.playerTag) return;
    if (manageBusy) setBusy(true);
    setDataStatus('advancedStats.loadingData');

    const requests = await Promise.allSettled([
        getAdvancedStatsOverview(state.playerTag, state.period),
        getAdvancedStatsUnits(state.playerTag, state.period, 'ALL'),
        getAdvancedStatsArmies(state.playerTag, state.period, 12),
        getAdvancedStatsTrends(state.playerTag, state.period),
        getAdvancedStatsBattles(state.playerTag, state.period, { limit: BATTLE_PAGE_SIZE })
    ]);

    if (requestVersion !== state.requestVersion) return;
    const [overview, units, armies, trends, battles] = requests;

    if (overview.status === 'fulfilled') state.overview = overview.value;
    if (units.status === 'fulfilled') {
        state.unitCatalog = arrayValue(units.value?.items);
        state.units = filteredUnits();
    }
    if (armies.status === 'fulfilled') state.armies = arrayValue(armies.value?.items);
    if (trends.status === 'fulfilled') state.trends = arrayValue(trends.value?.points);
    if (battles.status === 'fulfilled') {
        state.battles = arrayValue(battles.value?.items);
        state.nextCursor = battles.value?.nextCursor || null;
        state.hasMore = Boolean(battles.value?.hasMore && state.nextCursor);
    }

    renderStatistics();
    const sectionNames = ['summary', 'units', 'armies', 'trends', 'battles'];
    const failedSections = sectionNames.filter((name, index) => requests[index].status === 'rejected');
    sectionNames.forEach(name => {
        document.getElementById(`advanced-stats-${name}-section`)
            ?.setAttribute('data-load-error', String(failedSections.includes(name)));
    });
    const failedLabels = failedSections.map(name => t(`advancedStats.section.${name}`)).join(', ');
    setDataStatus('', failedSections.length
        ? t('advancedStats.partialLoadFailed', { sections: failedLabels })
        : t('advancedStats.updatedNow'));

    if (manageBusy) {
        setBusy(false);
        renderAccountSelector();
    }
}

async function loadUnitsOnly() {
    if (!state.playerTag || state.busy) return;
    state.units = filteredUnits();
    renderUnits();
}

function filteredUnits() {
    if (state.category === 'ALL') return [...state.unitCatalog];
    return state.unitCatalog.filter(unit => String(unit?.category || '').toUpperCase() === state.category);
}

async function loadMoreBattles() {
    if (!state.nextCursor || !state.playerTag || state.busy) return;
    setBusy(true);
    try {
        const response = await getAdvancedStatsBattles(state.playerTag, state.period, {
            limit: BATTLE_PAGE_SIZE,
            cursor: state.nextCursor
        });
        state.battles.push(...arrayValue(response?.items));
        state.nextCursor = response?.nextCursor || null;
        state.hasMore = Boolean(response?.hasMore && state.nextCursor);
        renderBattles();
    } catch (error) {
        console.error('advanced_stats_battles_more_failed', error);
        setDataStatus('advancedStats.loadFailed');
    } finally {
        setBusy(false);
        renderAccountSelector();
    }
}

function clearStatisticsState() {
    state.overview = null;
    state.unitCatalog = [];
    state.units = [];
    state.armies = [];
    state.trends = [];
    state.battles = [];
    state.nextCursor = null;
    state.hasMore = false;
}

function renderStatistics() {
    syncPeriodButtons();
    renderOverview();
    renderUnits();
    renderArmies();
    renderTrends();
    renderBattles();
}

function syncPeriodButtons() {
    elements['advanced-stats-periods']?.querySelectorAll('[data-period]').forEach(button => {
        const active = button.dataset.period === state.period;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

function renderOverview() {
    const data = state.overview?.data || state.overview || {};
    const summary = data.summary || {};
    const favorites = data.favorites || {};
    text('advanced-stats-kpi-attacks', formatNumber(summary.attacks || 0));
    text('advanced-stats-kpi-stars', formatDecimal(summary.averageStars));
    text('advanced-stats-kpi-three-star', formatPercent(summary.threeStarRate));
    text('advanced-stats-kpi-destruction', formatPercent(summary.averageDestruction));
    renderFavorite('troop', favorites.troop);
    renderFavorite('spell', favorites.spell);
    renderFavorite('siege', favorites.siege);
    renderFavoriteArmy(favorites.army);
}

function renderFavorite(kind, favorite) {
    const name = elements[`advanced-stats-favorite-${kind}`];
    const meta = elements[`advanced-stats-favorite-${kind}-meta`];
    if (!favorite) {
        name.textContent = t('advancedStats.noFavorite');
        meta.textContent = '';
        return;
    }
    name.textContent = favorite.name || favorite.key || t('advancedStats.noFavorite');
    meta.textContent = t('advancedStats.usedInAttacks', { count: formatNumber(favorite.battlesPresent || 0) });
}

function renderFavoriteArmy(favorite) {
    const name = elements['advanced-stats-favorite-army'];
    const meta = elements['advanced-stats-favorite-army-meta'];
    if (!favorite) {
        name.textContent = t('advancedStats.noFavorite');
        meta.textContent = '';
        return;
    }
    name.textContent = armyPresentation(favorite.army).label;
    meta.textContent = `${formatNumber(favorite.battleCount || 0)} ${t('advancedStats.attacks').toLowerCase()} · ${formatDecimal(favorite.averageStars)}★`;
}

function renderUnits() {
    const body = elements['advanced-stats-units'];
    body.replaceChildren();
    state.units.forEach(unit => {
        const row = document.createElement('tr');
        [
            unit.name || unit.key || '—',
            formatNumber(unit.totalQuantity || 0),
            formatNumber(unit.battlesPresent || 0),
            formatPercent(unit.usageRate)
        ].forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.append(cell);
        });
        body.append(row);
    });
    show(elements['advanced-stats-units-empty'], state.units.length === 0);
    show(document.querySelector('.advanced-stats__table-wrap'), state.units.length > 0);
}

function renderArmies() {
    const root = elements['advanced-stats-armies'];
    root.replaceChildren();
    state.armies.forEach((army, index) => {
        const card = document.createElement('article');
        card.className = 'advanced-stats__army-card';
        const header = document.createElement('header');
        const title = document.createElement('strong');
        const presentation = armyPresentation(army.army);
        title.textContent = `${index + 1}. ${presentation.label}`;
        const uses = document.createElement('span');
        uses.textContent = t('advancedStats.armyUses', { count: formatNumber(army.battleCount || 0) });
        header.append(title, uses);
        card.append(header);

        const chips = document.createElement('div');
        chips.className = 'advanced-stats__army-units';
        presentation.units.forEach(label => {
            const chip = document.createElement('span');
            chip.className = 'advanced-stats__unit-chip';
            chip.textContent = label;
            chips.append(chip);
        });
        if (presentation.hiddenCount) {
            const more = document.createElement('span');
            more.className = 'advanced-stats__unit-chip';
            more.textContent = `+${formatNumber(presentation.hiddenCount)}`;
            chips.append(more);
        }
        card.append(chips);

        const metrics = document.createElement('div');
        metrics.className = 'advanced-stats__army-metrics';
        metrics.textContent = `${formatDecimal(army.averageStars)}★ · ${formatPercent(army.averageDestruction)}`;
        card.append(metrics);
        root.append(card);
    });
    show(elements['advanced-stats-armies-empty'], state.armies.length === 0);
}

function renderTrends() {
    const root = elements['advanced-stats-trend-chart'];
    root.replaceChildren();
    const points = state.trends;
    show(root, points.length > 0);
    show(elements['advanced-stats-trend-empty'], points.length === 0);
    if (!points.length) return;

    points.forEach(point => {
        const day = document.createElement('div');
        day.className = 'advanced-stats__trend-day';
        const bar = document.createElement('div');
        bar.className = 'advanced-stats__trend-bar';
        const destruction = Math.max(0, Math.min(100, Number(point.averageDestruction || 0)));
        bar.style.height = `${Math.max(4, destruction)}%`;
        bar.title = `${formatDate(point.date)} · ${formatNumber(point.attacks || 0)} ${t('advancedStats.attacks').toLowerCase()} · ${formatDecimal(point.averageStars)}★ · ${formatPercent(destruction)}`;
        const stars = document.createElement('span');
        stars.textContent = `${formatDecimal(point.averageStars)}★`;
        bar.append(stars);
        const label = document.createElement('small');
        label.textContent = formatShortDate(point.date);
        day.append(bar, label);
        root.append(day);
    });
}

function renderBattles() {
    const root = elements['advanced-stats-battles'];
    root.replaceChildren();
    state.battles.forEach(battle => root.append(battleElement(battle)));
    show(elements['advanced-stats-battles-empty'], state.battles.length === 0);
    show(elements['advanced-stats-load-more'], state.battles.length > 0 && state.hasMore);
}

function battleElement(battle) {
    const item = document.createElement('article');
    item.className = 'advanced-stats__battle';

    const main = document.createElement('div');
    main.className = 'advanced-stats__battle-main';
    const opponent = document.createElement('strong');
    opponent.textContent = battle.opponentName || battle.opponentPlayerTag || t('advancedStats.opponent');
    const time = document.createElement('small');
    time.textContent = formatDateTime(battle.battleAt);
    main.append(opponent, time);

    const score = document.createElement('div');
    score.className = 'advanced-stats__battle-score';
    const stars = document.createElement('strong');
    stars.textContent = `${Number(battle.stars || 0)}★`;
    const destruction = document.createElement('span');
    destruction.textContent = formatPercent(battle.destructionPercentage);
    score.append(stars, destruction);

    const meta = document.createElement('div');
    meta.className = 'advanced-stats__battle-meta';
    const pieces = [];
    if (battle.opponentTownHall) pieces.push(`TH${battle.opponentTownHall}`);
    meta.textContent = pieces.join(' · ');

    item.append(main, score, meta);

    const units = arrayValue(battle.units);
    if (units.length) {
        const army = document.createElement('div');
        army.className = 'advanced-stats__battle-army';
        units.slice(0, 14).forEach(unit => {
            const chip = document.createElement('span');
            chip.className = 'advanced-stats__unit-chip';
            chip.textContent = `${formatNumber(unit.quantity || 1)}× ${unit.name || unit.key || unit.category}`;
            army.append(chip);
        });
        item.append(army);
    }
    return item;
}

function armyPresentation(army) {
    return presentArmy(army, state.unitCatalog, t('advancedStats.armyComposition'));
}

function arrayValue(value) {
    return Array.isArray(value) ? value : [];
}

function text(id, value) {
    const element = elements[id];
    if (element) element.textContent = value;
}

function formatNumber(value) {
    return new Intl.NumberFormat(getLanguage()).format(Number(value || 0));
}

function formatDecimal(value) {
    return new Intl.NumberFormat(getLanguage(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatPercent(value) {
    return `${new Intl.NumberFormat(getLanguage(), { maximumFractionDigits: 1 }).format(Number(value || 0))}%`;
}

function asDate(value) {
    if (!value) return null;
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value, fallback = '—') {
    const date = asDate(value);
    if (!date) return fallback;
    return new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDate(value, fallback = '—') {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium' }).format(date) : fallback;
}

function formatShortDate(value) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat(getLanguage(), { month: 'short', day: 'numeric' }).format(date) : '';
}

const initialLoad = initialize();
if (typeof window.clashtoolsRegisterInitialLoad === 'function') {
    window.clashtoolsRegisterInitialLoad(initialLoad);
}
