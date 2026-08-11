import { getLanguage, t } from '../i18n/i18n.js?v=20260809-4';
import { displayArmyUnits, isPlayerFacingUnitName, presentArmy } from './advanced-stats-army-view.js?v=20260809-4';
import { entityImage } from './progress-asset-view.js?v=20260809-4';
import {
    arrayValue,
    dateGapDays,
    formatDate,
    formatDateTime,
    formatDecimal,
    formatNumber,
    formatPercent,
    formatShortDate
} from './advanced-stats-formatters.js?v=20260809-4';

const STATUS_KEYS = Object.freeze({
    ACTIVE: 'advancedStats.active',
    INITIALIZING: 'advancedStats.initializingTitle',
    PAUSED: 'advancedStats.paused',
    DEGRADED: 'advancedStats.degraded',
    STOPPED: 'advancedStats.stopped',
    ERROR: 'advancedStats.error'
});

function show(element, visible) {
    if (element) element.hidden = !visible;
}

function text(elements, id, value) {
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
        const option = new Option(
            account.name === account.tag ? account.tag : `${account.name} · ${account.tag}`,
            account.tag,
            false,
            account.tag === state.playerTag
        );
        select.append(option);
    });
    select.disabled = state.accounts.length < 2 || state.busy;
}

export function renderTracking(elements, state) {
    const tracking = state.tracking;
    const status = safeStatus(tracking);
    const exists = Boolean(tracking?.trackingExists);
    const hasHistory = Number(tracking?.battlesProcessed || 0) > 0;
    const noAccounts = !state.accounts.length;
    const showSetup = !state.trackingError && !noAccounts && (!exists || status === 'DISABLED');
    const showInitializing = !state.trackingError && !noAccounts && exists && status === 'INITIALIZING' && !hasHistory;
    const showContent = !noAccounts && exists && status !== 'DISABLED' && !showInitializing;

    show(elements.noAccounts, noAccounts);
    show(elements.profileError, state.profileError === true);
    show(elements.trackingError, state.trackingError === true && !state.profileError && !noAccounts);
    show(elements.notTracking, showSetup);
    show(elements.initializing, showInitializing);
    show(elements.content, showContent);
    if (!showContent) return;

    elements.trackingBar.dataset.status = status;
    text(elements, 'trackingTitle', t(STATUS_KEYS[status] || 'advancedStats.statusUnknown'));
    const account = state.accounts.find(candidate => candidate.tag === state.playerTag);
    text(elements, 'playerLine', `${tracking.playerName || account?.name || state.playerTag} · ${state.playerTag}`);
    text(elements, 'startedAt', formatDateTime(tracking.trackingStartedAt));
    text(elements, 'updatedAt', formatDate(tracking.lastSuccessfulPollAt, t('advancedStats.never')));
    text(elements, 'battlesProcessed', formatNumber(tracking.battlesProcessed));

    show(elements.pause, ['ACTIVE', 'DEGRADED'].includes(status));
    show(elements.resume, ['PAUSED', 'STOPPED', 'ERROR'].includes(status));
    show(elements.stop, status !== 'STOPPED');
    renderTrackingWarning(elements, tracking, status, state);
}

function renderTrackingWarning(elements, tracking, status, state) {
    const statusWarning = state.trackingError || ['PAUSED', 'DEGRADED', 'STOPPED', 'ERROR'].includes(status);
    const hasGap = Boolean(tracking?.hasPotentialGap || tracking?.gapStartedAt);
    show(elements.warning, statusWarning || hasGap);
    if (!statusWarning && !hasGap) return;

    const titleKey = state.trackingError ? 'advancedStats.loadFailed' : status === 'DEGRADED' ? 'advancedStats.degraded'
        : status === 'PAUSED' ? 'advancedStats.paused'
            : status === 'STOPPED' ? 'advancedStats.stopped'
                : status === 'ERROR' ? 'advancedStats.error' : 'advancedStats.gapTitle';
    const copyKey = state.trackingError ? 'advancedStats.profileLoadFailedText' : status === 'DEGRADED' ? 'advancedStats.degradedText'
        : status === 'PAUSED' ? 'advancedStats.pausedText'
            : status === 'STOPPED' ? 'advancedStats.stoppedText'
                : status === 'ERROR' ? 'advancedStats.errorText' : 'advancedStats.gapText';
    text(elements, 'warningTitle', t(titleKey));
    text(elements, 'warningText', t(copyKey));
    text(elements, 'completeSince', tracking?.dataCompleteSince
        ? `${t('advancedStats.dataCompleteSince')}: ${formatDate(tracking.dataCompleteSince)}` : '');
}

export function renderOverview(elements, state) {
    const response = state.overview;
    const data = response?.data || response;
    const summary = data?.summary;
    const attacksKnown = summary && Number.isFinite(Number(summary.attacks));
    const attacks = attacksKnown ? Number(summary.attacks) : null;
    text(elements, 'kpiAttacks', attacksKnown ? formatNumber(attacks) : '—');
    text(elements, 'kpiStars', attacks > 0 ? formatDecimal(summary.averageStars) : '—');
    text(elements, 'kpiThreeStar', attacks > 0 ? formatPercent(summary.threeStarRate) : '—');
    text(elements, 'kpiDestruction', attacks > 0 ? formatPercent(summary.averageDestruction) : '—');

    const favorites = data?.favorites || {};
    renderFavorite(elements, 'troop', favorites.troop);
    renderFavorite(elements, 'spell', favorites.spell);
    renderFavorite(elements, 'siege', favorites.siege);
    renderFavoriteArmy(elements, favorites.army, state);
}

function renderFavorite(elements, kind, favorite) {
    const name = elements[`favorite${kind[0].toUpperCase()}${kind.slice(1)}`];
    const meta = elements[`favorite${kind[0].toUpperCase()}${kind.slice(1)}Meta`];
    const imageRoot = elements[`favorite${kind[0].toUpperCase()}${kind.slice(1)}Image`];
    if (!favorite || !isPlayerFacingUnitName(favorite.name || favorite.unitName)) {
        if (name) name.textContent = t('advancedStats.noFavorite');
        if (meta) meta.textContent = '';
        if (imageRoot) imageRoot.replaceChildren();
        return;
    }
    if (name) name.textContent = favorite.name || favorite.key;
    if (meta) meta.textContent = t('advancedStats.usedInAttacks', { count: formatNumber(favorite.battlesPresent) });
    if (imageRoot) imageRoot.replaceChildren(entityImage(favorite.name || favorite.key, { alt: '' }));
}

function renderFavoriteArmy(elements, favorite, state) {
    const name = elements.favoriteArmy;
    const meta = elements.favoriteArmyMeta;
    const imageRoot = elements.favoriteArmyImage;
    const presentation = favorite ? presentArmy(favorite.army, state.unitCatalog, t('advancedStats.armyComposition')) : null;
    if (!favorite || !presentation?.units.length) {
        if (name) name.textContent = t('advancedStats.noFavorite');
        if (meta) meta.textContent = '';
        if (imageRoot) imageRoot.replaceChildren();
        return;
    }
    if (name) name.textContent = presentation.label;
    if (meta) meta.textContent = `${formatNumber(favorite.battleCount)} ${t('advancedStats.attacks').toLowerCase()} · ${formatDecimal(favorite.averageStars)}`;
    if (imageRoot) {
        imageRoot.replaceChildren();
        displayArmyUnits(favorite.army, state.unitCatalog).slice(0, 5)
            .forEach(unit => imageRoot.append(entityImage(unit.name, { alt: '' })));
    }
}

export function renderUnits(elements, state) {
    const units = state.units;
    elements.units.replaceChildren();
    elements.unitsMobile.replaceChildren();
    units.forEach(unit => {
        const unitName = unit.name || unit.key || t('advancedStats.unit');
        const cell = document.createElement('div');
        cell.className = 'advanced-stats__unit-name';
        cell.append(entityImage(unitName, { alt: '' }), document.createTextNode(unitName));
        const row = document.createElement('tr');
        row.append(cellIn(cell), cellIn(formatNumber(unit.totalQuantity)), cellIn(formatNumber(unit.battlesPresent)), cellIn(formatPercent(unit.usageRate)));
        elements.units.append(row);

        const item = document.createElement('article');
        item.className = 'advanced-stats__unit-item';
        const heading = document.createElement('h3');
        heading.append(entityImage(unitName, { alt: '' }), document.createTextNode(unitName));
        const metrics = document.createElement('dl');
        [['advancedStats.quantity', formatNumber(unit.totalQuantity)], ['advancedStats.battlesPresent', formatNumber(unit.battlesPresent)], ['advancedStats.usageRate', formatPercent(unit.usageRate)]]
            .forEach(([label, value]) => { const wrap = document.createElement('div'); wrap.append(newElement('dt', t(label)), newElement('dd', value)); metrics.append(wrap); });
        item.append(heading, metrics);
        elements.unitsMobile.append(item);
    });
    const hasUnits = units.length > 0;
    show(elements.unitsTableWrap, hasUnits);
    show(elements.unitsEmpty, !hasUnits);
    if (!hasUnits) elements.unitsEmpty.textContent = state.sectionStates.units === 'error'
        ? t('advancedStats.loadFailed') : t('advancedStats.noUnits');
}

function cellIn(value) {
    const cell = document.createElement('td');
    if (value?.nodeType) cell.append(value); else cell.textContent = value;
    return cell;
}

function newElement(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
}

export function renderArmies(elements, state) {
    const root = elements.armies;
    root.replaceChildren();
    const visible = state.armies.map(army => ({ army, presentation: presentArmy(army.army, state.unitCatalog, t('advancedStats.armyComposition')) }))
        .filter(item => item.presentation.units.length);
    visible.forEach(({ army, presentation }, index) => {
        const card = document.createElement('article');
        card.className = 'advanced-stats__army-card';
        const heading = document.createElement('h3');
        heading.textContent = `${index + 1}. ${presentation.label}`;
        const meta = document.createElement('span');
        meta.textContent = t('advancedStats.armyUses', { count: formatNumber(army.battleCount) });
        const units = document.createElement('div');
        units.className = 'advanced-stats__army-units';
        displayArmyUnits(army.army, state.unitCatalog).slice(0, 14).forEach(unit => {
            const chip = document.createElement('span');
            chip.className = 'advanced-stats__unit-chip';
            chip.append(entityImage(unit.name, { alt: '' }), document.createTextNode(`${formatNumber(unit.quantity)}× ${unit.name}`));
            units.append(chip);
        });
        const metrics = document.createElement('p');
        metrics.textContent = `${formatDecimal(army.averageStars)} · ${formatPercent(army.averageDestruction)}`;
        card.append(headerRow(heading, meta), units, metrics);
        root.append(card);
    });
    show(elements.armiesEmpty, visible.length === 0);
    if (!visible.length) elements.armiesEmpty.textContent = state.sectionStates.armies === 'error'
        ? t('advancedStats.loadFailed') : t('advancedStats.noArmies');
}

function headerRow(title, meta) {
    const row = document.createElement('header');
    row.append(title, meta);
    return row;
}

export function renderTrends(elements, state) {
    const root = elements.trendChart;
    root.replaceChildren();
    const points = arrayValue(state.trends);
    show(root, points.length > 0);
    show(elements.trendEmpty, points.length === 0);
    let previousDate = null;
    points.forEach((point, index) => {
        const gap = dateGapDays(previousDate, point.date);
        if (gap) {
            const missing = document.createElement('span');
            missing.className = 'advanced-stats__trend-gap';
            missing.setAttribute('role', 'img');
            missing.setAttribute('aria-label', t('advancedStats.noTrendData'));
            missing.title = t('advancedStats.noTrendData');
            missing.style.flexBasis = `${Math.min(2.5, gap * 1.1)}rem`;
            root.append(missing);
        }
        const day = document.createElement('div');
        day.className = 'advanced-stats__trend-day';
        const value = document.createElement('button');
        value.type = 'button';
        value.className = 'advanced-stats__trend-bar';
        const destructionValue = Number(point.averageDestruction);
        const destructionKnown = Number.isFinite(destructionValue);
        const destruction = destructionKnown ? Math.max(0, Math.min(100, destructionValue)) : 0;
        value.dataset.known = String(destructionKnown);
        value.style.height = `${Math.max(4, destruction)}%`;
        const label = `${formatDate(point.date)} · ${formatNumber(point.attacks)} ${t('advancedStats.attacks').toLowerCase()} · ${formatDecimal(point.averageStars)} · ${formatPercent(destructionKnown ? destruction : null)}`;
        value.setAttribute('aria-label', label);
        const tooltip = document.createElement('span');
        tooltip.className = 'advanced-stats__trend-tooltip';
        tooltip.id = `advanced-stats-trend-tooltip-${index}`;
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = label;
        value.setAttribute('aria-describedby', tooltip.id);
        value.append(tooltip);
        day.append(value, newElement('small', formatShortDate(point.date)));
        root.append(day);
        previousDate = point.date;
    });
}

export function renderBattles(elements, state) {
    const root = elements.battles;
    root.replaceChildren();
    state.battles.forEach(battle => root.append(battleElement(battle)));
    show(elements.battlesEmpty, state.battles.length === 0);
    show(elements.loadMore, state.battles.length > 0 && state.hasMore);
}

function battleElement(battle) {
    const item = document.createElement('article');
    item.className = 'advanced-stats__battle';
    const main = document.createElement('div');
    main.className = 'advanced-stats__battle-main';
    main.append(newElement('strong', battle.opponentName || battle.opponentPlayerTag || t('advancedStats.opponent')),
        newElement('small', formatDateTime(battle.battleAt)));
    const score = document.createElement('div');
    score.className = 'advanced-stats__battle-score';
    const star = document.createElement('span');
    star.className = 'advanced-stats__battle-stars';
    star.append(newElement('span', formatNumber(battle.stars)), newElement('small', t('advancedStats.avgStars')));
    score.append(star, newElement('span', formatPercent(battle.destructionPercentage)));
    const meta = newElement('div', battle.opponentTownHall ? `TH${battle.opponentTownHall}` : t('advancedStats.pending'));
    meta.className = 'advanced-stats__battle-meta';
    item.append(main, score, meta);
    const units = arrayValue(battle.units).filter(unit => isPlayerFacingUnitName(unit?.name || unit?.unitName));
    if (units.length) {
        const army = document.createElement('div');
        army.className = 'advanced-stats__battle-army';
        units.slice(0, 12).forEach(unit => {
            const chip = document.createElement('span');
            chip.className = 'advanced-stats__unit-chip';
            chip.append(entityImage(unit.name || unit.key, { alt: '' }), document.createTextNode(`${formatNumber(unit.quantity)}× ${unit.name || unit.key}`));
            army.append(chip);
        });
        item.append(army);
    }
    return item;
}

export function renderStatistics(elements, state) {
    renderOverview(elements, state);
    renderUnits(elements, state);
    renderArmies(elements, state);
    renderTrends(elements, state);
    renderBattles(elements, state);
}

export function syncPeriodButtons(elements, period) {
    elements.periods?.querySelectorAll('[data-period]').forEach(button => {
        const active = button.dataset.period === period;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
    });
}
