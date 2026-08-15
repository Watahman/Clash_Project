import { t } from '../i18n/i18n.js?v=20260811-2';
import { displayArmyUnits, isPlayerFacingUnitName, presentArmy } from './advanced-stats-army-view.js?v=20260811-2';
import { entityImage } from './progress-asset-view.js?v=20260811-2';
import {
    formatDate,
    formatDateTime,
    formatDecimal,
    formatNumber,
    formatPercent
} from './advanced-stats-formatters.js?v=20260811-2';
import { renderArmies } from './advanced-stats-armies-renderer.js?v=20260814-advanced-stats-v3';
import { renderBattles } from './advanced-stats-battles-renderer.js?v=20260811-2';
import { renderTrends } from './advanced-stats-trends-renderer.js?v=20260814-advanced-stats-v3';
import { renderUnits } from './advanced-stats-units-renderer.js?v=20260814-advanced-stats-v3';
import { renderDashboardCoverage, renderHistoryAnalysis } from './advanced-stats-analysis-renderer.js?v=20260814-advanced-stats-v4';
import { normalizeAnalysis } from './advanced-stats-analysis.js?v=20260814-advanced-stats-v4';

const STATUS_KEYS = Object.freeze({
    ACTIVE: 'advancedStats.active',
    INITIALIZING: 'advancedStats.initializingTitle',
    PAUSED: 'advancedStats.paused',
    DEGRADED: 'advancedStats.degraded',
    STOPPED: 'advancedStats.stopped',
    ERROR: 'advancedStats.error'
});

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

function setElementText(elements, id, value) {
    if (elements[id]) elements[id].textContent = value;
}

function safeStatus(tracking) {
    return String(tracking?.status || 'DISABLED').toUpperCase();
}

export function renderAccountSelector(elements, state) {
    const select = elements.account;
    select.replaceChildren();
    if (!state.accounts.length) {
        select.append(new Option(t('advancedStats.noAccountsTitle'), ''));
        select.disabled = true;
        return;
    }
    state.accounts.forEach(account => {
        const label = account.name === account.tag ? account.tag : `${account.name} · ${account.tag}`;
        select.append(new Option(label, account.tag, false, account.tag === state.playerTag));
    });
    select.disabled = state.accounts.length < 2 || state.busy;
}

export function renderTracking(elements, state) {
    const tracking = state.tracking;
    const status = safeStatus(tracking);
    const exists = Boolean(tracking?.trackingExists);
    const hasHistory = Number(tracking?.battlesProcessed || 0) > 0;
    const analysis = state.analysis || normalizeAnalysis(tracking);
    const analysisPending = Boolean(state.analysisRequested || analysis.active || (analysis.error && !hasHistory));
    const noAccounts = !state.accounts.length;
    const showSetup = !state.trackingError && !noAccounts && !analysisPending && (!exists || status === 'DISABLED');
    const showInitializing = !state.trackingError && !noAccounts && analysisPending;
    const showContent = !noAccounts && exists && status !== 'DISABLED' && !showInitializing;

    setVisibility(elements.noAccounts, noAccounts);
    setVisibility(elements.profileError, state.profileError === true);
    setVisibility(elements.trackingError, state.trackingError === true && !state.profileError && !noAccounts);
    setVisibility(elements.notTracking, showSetup);
    setVisibility(elements.initializing, showInitializing);
    setVisibility(elements.content, showContent);
    renderHistoryAnalysis(elements, { ...state, analysis });
    renderDashboardCoverage(elements, { ...state, analysis });
    if (!showContent) return;

    elements.trackingBar.dataset.status = status;
    setElementText(elements, 'trackingTitle', t(STATUS_KEYS[status] || 'advancedStats.statusUnknown'));
    const account = state.accounts.find(candidate => candidate.tag === state.playerTag);
    setElementText(elements, 'playerLine', `${tracking.playerName || account?.name || state.playerTag} · ${state.playerTag}`);
    setElementText(elements, 'startedAt', formatDateTime(tracking.trackingStartedAt));
    setElementText(elements, 'updatedAt', formatDate(tracking.lastSuccessfulPollAt, t('advancedStats.never')));
    setElementText(elements, 'battlesProcessed', formatNumber(tracking.battlesProcessed));
    setVisibility(elements.pause, ['ACTIVE', 'DEGRADED'].includes(status));
    setVisibility(elements.resume, ['PAUSED', 'STOPPED', 'ERROR'].includes(status));
    setVisibility(elements.stop, status !== 'STOPPED');
    renderTrackingWarning(elements, tracking, status, state);
}

function renderTrackingWarning(elements, tracking, status, state) {
    const statusWarning = state.trackingError || ['PAUSED', 'DEGRADED', 'STOPPED', 'ERROR'].includes(status);
    const hasGap = Boolean(tracking?.hasPotentialGap || tracking?.gapStartedAt);
    setVisibility(elements.warning, statusWarning || hasGap);
    if (!statusWarning && !hasGap) return;

    const titleKey = state.trackingError ? 'advancedStats.loadFailed' : status === 'DEGRADED'
        ? 'advancedStats.degraded' : status === 'PAUSED' ? 'advancedStats.paused'
            : status === 'STOPPED' ? 'advancedStats.stopped' : status === 'ERROR'
                ? 'advancedStats.error' : 'advancedStats.gapTitle';
    const copyKey = state.trackingError ? 'advancedStats.profileLoadFailedText' : status === 'DEGRADED'
        ? 'advancedStats.degradedText' : status === 'PAUSED' ? 'advancedStats.pausedText'
            : status === 'STOPPED' ? 'advancedStats.stoppedText' : status === 'ERROR'
                ? 'advancedStats.errorText' : 'advancedStats.gapText';
    setElementText(elements, 'warningTitle', t(titleKey));
    setElementText(elements, 'warningText', t(copyKey));
    const completeSince = tracking?.dataCompleteSince
        ? `${t('advancedStats.dataCompleteSince')}: ${formatDate(tracking.dataCompleteSince)}` : '';
    setElementText(elements, 'completeSince', completeSince);
}

export function renderOverview(elements, state) {
    const data = state.overview?.data || state.overview;
    const summary = data?.summary;
    const rawAttacks = summary?.attacks;
    const attacksKnown = rawAttacks !== null && rawAttacks !== undefined && rawAttacks !== ''
        && Number.isFinite(Number(rawAttacks));
    const attacks = attacksKnown ? Number(rawAttacks) : null;
    const unknown = '—';
    setElementText(elements, 'kpiAttacks', attacksKnown ? formatNumber(attacks) : unknown);
    setElementText(elements, 'kpiStars', attacks > 0 ? formatDecimal(summary.averageStars) : unknown);
    setElementText(elements, 'kpiThreeStar', attacks > 0 ? formatPercent(summary.threeStarRate) : unknown);
    setElementText(elements, 'kpiDestruction', attacks > 0 ? formatPercent(summary.averageDestruction) : unknown);

    const favorites = data?.favorites || {};
    renderFavorite(elements, 'troop', favorites.troop);
    renderFavorite(elements, 'spell', favorites.spell);
    renderFavorite(elements, 'siege', favorites.siege);
    renderFavoriteArmy(elements, favorites.army, state);
}

function renderFavorite(elements, kind, favorite) {
    const title = kind[0].toUpperCase() + kind.slice(1);
    const name = elements[`favorite${title}`];
    const meta = elements[`favorite${title}Meta`];
    const imageRoot = elements[`favorite${title}Image`];
    const unitName = favorite?.name || favorite?.unitName;
    if (!favorite || !isPlayerFacingUnitName(unitName)) {
        setElementText(elements, `favorite${title}`, t('advancedStats.noFavorite'));
        setElementText(elements, `favorite${title}Meta`, '');
        imageRoot?.replaceChildren();
        return;
    }
    name.textContent = unitName;
    meta.textContent = t('advancedStats.usedInAttacks', { count: formatNumber(favorite.battlesPresent) });
    imageRoot?.replaceChildren(entityImage(unitName, { alt: '' }));
}

function renderFavoriteArmy(elements, favorite, state) {
    const presentation = favorite
        ? presentArmy(favorite.army, state.unitCatalog, t('advancedStats.armyComposition'))
        : null;
    if (!favorite || !presentation?.units.length) {
        setElementText(elements, 'favoriteArmy', t('advancedStats.noFavorite'));
        setElementText(elements, 'favoriteArmyMeta', '');
        elements.favoriteArmyImage?.replaceChildren();
        return;
    }
    elements.favoriteArmy.textContent = presentation.label;
    elements.favoriteArmyMeta.textContent = `${formatNumber(favorite.battleCount)} ${t('advancedStats.attacks').toLowerCase()} · ${formatDecimal(favorite.averageStars)}`;
    const imageRoot = elements.favoriteArmyImage;
    if (!imageRoot) return;
    imageRoot.replaceChildren();
    displayArmyUnits(favorite.army, state.unitCatalog).slice(0, 5)
        .forEach(unit => imageRoot.append(entityImage(unit.name, { alt: '' })));
}

export function renderStatistics(elements, state) {
    renderOverview(elements, state);
    renderUnits(elements, state);
    renderArmies(elements, state);
    renderTrends(elements, state);
    syncTrendValueSemantics(elements);
    renderBattles(elements, state);
}

function syncTrendValueSemantics(elements) {
    elements.trendChart?.querySelectorAll('[role="meter"]').forEach(value => {
        const label = value.getAttribute('aria-valuetext') || value.getAttribute('aria-label');
        if (label) value.setAttribute('aria-valuetext', label);
    });
}

export function syncPeriodButtons(elements, period) {
    elements.periods?.querySelectorAll('[data-period]').forEach(button => {
        const active = button.dataset.period === period;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}

export { renderArmies, renderBattles, renderTrends, renderUnits };
