import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import {
    arrayValue,
    dateGapDays,
    formatDate,
    formatDecimal,
    formatNumber,
    formatPercent,
    formatShortDate
} from './advanced-stats-formatters.js?v=20260829-public-auth-v1';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_WIDTH = 720;
const CHART_HEIGHT = 240;
const CHART_PADDING = { top: 18, right: 18, bottom: 34, left: 18 };

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

function svgElement(tag, attributes = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    return element;
}

function attackValue(point) {
    const rawValue = point?.attacks;
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    const value = Number(rawValue);
    return Number.isFinite(value) ? Math.max(0, value) : null;
}

function chartY(value, maximum) {
    const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const safeMaximum = Math.max(1, maximum);
    return CHART_PADDING.top + ((safeMaximum - value) / safeMaximum) * plotHeight;
}

function trendScale(points) {
    const highest = points.reduce((current, point) => Math.max(current, attackValue(point) ?? 0), 0);
    const maximum = Math.max(1, Math.ceil(highest));
    return { maximum, midpoint: maximum === 1 ? 0.5 : Math.ceil(maximum / 2) };
}

export function trendLabel(point, attacksKnown, attacks) {
    const attackCount = attacksKnown ? attacks : attackValue(point);
    const attackLabel = t(attackCount === 1 ? 'advancedStats.attack' : 'advancedStats.attacks').toLowerCase();
    return `${formatDate(point?.date)} · ${formatNumber(attackCount)} ${attackLabel} · ${formatDecimal(point?.averageStars)} · ${formatPercent(point?.averageDestruction)}`;
}

export function createTrendValue(point, index, { x = 0, y = 0, maxValue } = {}) {
    const attacks = attackValue(point);
    const scaleMaximum = Math.max(1, maxValue ?? attacks ?? 1);
    const label = trendLabel(point, attacks !== null, attacks);
    const value = svgElement('circle', {
        class: 'advanced-stats__trend-point',
        cx: x,
        cy: y,
        r: 4
    });
    value.tabIndex = 0;
    value.setAttribute('role', 'meter');
    value.setAttribute('aria-label', label);
    value.setAttribute('aria-valuemin', '0');
    value.setAttribute('aria-valuemax', String(scaleMaximum));
    value.setAttribute('aria-valuetext', label);
    if (attacks !== null) value.setAttribute('aria-valuenow', String(attacks));
    value.dataset.known = String(attacks !== null);

    const tooltip = svgElement('title', {
        class: 'advanced-stats__trend-tooltip',
        id: `advanced-stats-trend-tooltip-${index}`
    });
    tooltip.textContent = label;
    value.setAttribute('aria-describedby', tooltip.id);
    value.append(tooltip);
    return value;
}

function createTrendGap(gap, x) {
    const missing = svgElement('line', {
        class: 'advanced-stats__trend-gap',
        x1: x,
        x2: x,
        y1: CHART_PADDING.top,
        y2: CHART_HEIGHT - CHART_PADDING.bottom
    });
    missing.setAttribute('role', 'img');
    missing.setAttribute('aria-label', t('advancedStats.noTrendData'));
    missing.dataset.gap = String(gap);
    missing.title = t('advancedStats.noTrendData');
    return missing;
}

function createTrendLine(points, xForIndex, maximum) {
    const path = svgElement('path', { class: 'advanced-stats__trend-line' });
    const segments = [];
    let segment = [];
    const flush = () => {
        if (segment.length) segments.push(segment.join(' '));
        segment = [];
    };

    points.forEach((point, index) => {
        const value = attackValue(point);
        if (value === null) {
            flush();
            return;
        }
        segment.push(`${segment.length ? 'L' : 'M'} ${xForIndex(index)} ${chartY(value, maximum)}`);
    });
    flush();
    path.setAttribute('d', segments.join(' '));
    return path;
}

function appendChartGuides(svg, scale) {
    [0, scale.midpoint, scale.maximum].forEach(value => {
        const y = chartY(value, scale.maximum);
        svg.append(svgElement('line', {
            class: 'advanced-stats__trend-grid-line',
            x1: CHART_PADDING.left,
            x2: CHART_WIDTH - CHART_PADDING.right,
            y1: y,
            y2: y
        }));
        const label = svgElement('text', {
            class: 'advanced-stats__trend-grid-label',
            x: 0,
            y: y + 3
        });
        label.textContent = formatNumber(value);
        svg.append(label);
    });
}

function appendTrendDay(svg, point, index, x, showLabel, maximum) {
    const day = svgElement('g', { class: 'advanced-stats__trend-day' });
    day.append(createTrendValue(point, index, { maxValue: maximum, x, y: chartY(attackValue(point) ?? 0, maximum) }));
    if (showLabel) {
        const label = svgElement('text', {
            class: 'advanced-stats__trend-day-label',
            x,
            y: CHART_HEIGHT - 8,
            'text-anchor': 'middle'
        });
        label.textContent = formatShortDate(point?.date);
        day.append(label);
    }
    svg.append(day);
}

export function renderTrends(elements, state) {
    const root = elements.trendChart;
    const points = arrayValue(state.trends);
    root.replaceChildren();
    setVisibility(root, points.length > 0);
    setVisibility(elements.trendEmpty, points.length === 0);
    if (!points.length) return;

    const scale = trendScale(points);
    const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const xForIndex = index => points.length === 1
        ? CHART_PADDING.left + plotWidth / 2
        : CHART_PADDING.left + (index / (points.length - 1)) * plotWidth;
    const svg = svgElement('svg', {
        class: 'advanced-stats__trend-svg',
        viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
        role: 'img',
        'aria-label': t('advancedStats.trendsTitle')
    });
    appendChartGuides(svg, scale);
    svg.append(createTrendLine(points, xForIndex, scale.maximum));

    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    let previousDate = null;
    points.forEach((point, index) => {
        const gap = dateGapDays(previousDate, point?.date);
        if (gap) svg.append(createTrendGap(gap, xForIndex(index)));
        appendTrendDay(svg, point, index, xForIndex(index), index % labelStep === 0 || index === points.length - 1, scale.maximum);
        previousDate = point?.date;
    });
    root.append(svg);
}
