import { t } from '../i18n/i18n.js?v=20260811-2';
import {
    arrayValue,
    dateGapDays,
    formatDate,
    formatDecimal,
    formatNumber,
    formatPercent,
    formatShortDate
} from './advanced-stats-formatters.js?v=20260811-2';

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

export function trendLabel(point, destructionKnown, destruction) {
    const attacks = Number(point?.attacks) || 0;
    const attackLabel = t(attacks === 1 ? 'advancedStats.attack' : 'advancedStats.attacks').toLowerCase();
    return `${formatDate(point?.date)} · ${formatNumber(attacks)} ${attackLabel} · ${formatDecimal(point?.averageStars)} · ${formatPercent(destructionKnown ? destruction : null)}`;
}

export function createTrendValue(point, index) {
    const rawDestruction = point?.averageDestruction;
    const numericDestruction = rawDestruction === null || rawDestruction === undefined || rawDestruction === ''
        ? NaN : Number(rawDestruction);
    const destructionKnown = Number.isFinite(numericDestruction);
    const destruction = destructionKnown ? Math.max(0, Math.min(100, numericDestruction)) : 0;
    const label = trendLabel(point, destructionKnown, destruction);
    const value = document.createElement('div');
    value.className = 'advanced-stats__trend-bar';
    value.tabIndex = 0;
    value.setAttribute('role', 'meter');
    value.setAttribute('aria-label', label);
    value.setAttribute('aria-valuemin', '0');
    value.setAttribute('aria-valuemax', '100');
    value.setAttribute('aria-valuetext', label);
    if (destructionKnown) value.setAttribute('aria-valuenow', String(destruction));
    value.dataset.known = String(destructionKnown);
    value.style.height = `${Math.max(4, destruction)}%`;

    const tooltip = document.createElement('span');
    tooltip.className = 'advanced-stats__trend-tooltip';
    tooltip.id = `advanced-stats-trend-tooltip-${index}`;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = label;
    value.setAttribute('aria-describedby', tooltip.id);
    value.append(tooltip);
    return value;
}

function createTrendGap(gap) {
    const missing = document.createElement('span');
    missing.className = 'advanced-stats__trend-gap';
    missing.setAttribute('role', 'img');
    missing.setAttribute('aria-label', t('advancedStats.noTrendData'));
    missing.title = t('advancedStats.noTrendData');
    missing.style.flexBasis = `${Math.min(2.5, gap * 1.1)}rem`;
    return missing;
}

function createTrendDay(point, index) {
    const day = document.createElement('div');
    day.className = 'advanced-stats__trend-day';
    day.append(createTrendValue(point, index), document.createElement('small'));
    day.lastElementChild.textContent = formatShortDate(point?.date);
    return day;
}

export function renderTrends(elements, state) {
    const root = elements.trendChart;
    const points = arrayValue(state.trends);
    root.replaceChildren();
    setVisibility(root, points.length > 0);
    setVisibility(elements.trendEmpty, points.length === 0);

    let previousDate = null;
    points.forEach((point, index) => {
        const gap = dateGapDays(previousDate, point?.date);
        if (gap) root.append(createTrendGap(gap));
        root.append(createTrendDay(point, index));
        previousDate = point?.date;
    });
}
