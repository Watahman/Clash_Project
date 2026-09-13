import { t } from '../i18n/i18n.js?v=20260913-advanced-dashboard-v2';
import {
    arrayValue,
    formatDecimal,
    formatNumber,
    formatPercent
} from './advanced-stats-formatters.js?v=20260913-advanced-dashboard-v2';
import {
    aggregateMonthlyTrends,
    calendarMonthGap,
    formatMonthLabel,
    normalizeTrendMetric,
    trendMetricConfig,
    trendMetricValue
} from './advanced-stats-trends.js?v=20260913-advanced-dashboard-v2';
import { renderLootTrend } from './advanced-stats-loot.js?v=20260913-advanced-dashboard-v2';

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

function finiteMetric(point, metric) {
    const value = trendMetricValue(point, metric);
    return value === null ? null : Math.max(0, value);
}

function formatMetric(value, metric) {
    const config = trendMetricConfig(metric);
    if (config.format === 'decimal') return formatDecimal(value);
    if (config.format === 'percent') return formatPercent(value);
    return formatNumber(value);
}

function metricLabel(metric) {
    const safeMetric = normalizeTrendMetric(metric);
    const config = trendMetricConfig(safeMetric);
    const label = t(config.labelKey);
    if (label !== config.labelKey) return label;
    return safeMetric === 'attacks' ? 'Attacks'
        : safeMetric === 'averageStars' ? 'Average stars'
            : safeMetric === 'threeStarRate' ? '3-star rate' : 'Average destruction';
}

function chartY(value, maximum) {
    const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    const safeMaximum = Math.max(1, maximum);
    return CHART_PADDING.top + ((safeMaximum - value) / safeMaximum) * plotHeight;
}

export function trendScale(points, metric = 'attacks') {
    const config = trendMetricConfig(metric);
    const highest = points.reduce((current, point) => Math.max(current, finiteMetric(point, metric) ?? 0), 0);
    const maximum = config.maximum ?? Math.max(1, Math.ceil(highest));
    return { maximum, midpoint: maximum === 1 ? 0.5 : maximum / 2 };
}

export function trendLabel(point, attacksKnown, attacks, metric = 'attacks') {
    const safeMetric = normalizeTrendMetric(metric);
    const sample = attacksKnown ? attacks : trendMetricValue(point, 'attacks');
    const attackLabel = t(sample === 1 ? 'advancedStats.attack' : 'advancedStats.attacks');
    const sampleText = `${formatNumber(sample)} ${attackLabel.toLowerCase()}`;
    const valueText = formatMetric(finiteMetric(point, safeMetric), safeMetric);
    const context = safeMetric === 'attacks'
        ? ` · ${formatDecimal(point?.averageStars)} · ${formatPercent(point?.averageDestruction)}` : '';
    return `${formatMonthLabel(point?.date)} · ${metricLabel(safeMetric)}: ${valueText} · ${sampleText}${context}`;
}

export function createTrendValue(point, index, { x = 0, y = 0, maxValue, metric = 'attacks' } = {}) {
    const safeMetric = normalizeTrendMetric(metric);
    const valueNumber = finiteMetric(point, safeMetric);
    const sample = finiteMetric(point, 'attacks');
    const scaleMaximum = Math.max(1, maxValue ?? trendScale([point], safeMetric).maximum);
    const label = trendLabel(point, sample !== null, sample, safeMetric);
    const value = svgElement('circle', { class: 'advanced-stats__trend-point', cx: x, cy: y, r: 4 });
    value.tabIndex = 0;
    value.setAttribute('role', 'meter');
    value.setAttribute('aria-label', label);
    value.setAttribute('aria-valuemin', '0');
    value.setAttribute('aria-valuemax', String(scaleMaximum));
    value.setAttribute('aria-valuetext', label);
    if (valueNumber !== null) value.setAttribute('aria-valuenow', String(valueNumber));
    value.dataset.known = String(valueNumber !== null);
    value.dataset.metric = safeMetric;

    const tooltip = svgElement('title', { class: 'advanced-stats__trend-tooltip', id: `advanced-stats-trend-tooltip-${index}` });
    tooltip.textContent = label;
    value.setAttribute('aria-describedby', tooltip.id);
    value.append(tooltip);
    return value;
}

function createTrendGap(gap, x) {
    const missing = svgElement('line', {
        class: 'advanced-stats__trend-gap', x1: x, x2: x,
        y1: CHART_PADDING.top, y2: CHART_HEIGHT - CHART_PADDING.bottom
    });
    missing.setAttribute('role', 'img');
    missing.setAttribute('aria-label', t('advancedStats.noTrendData'));
    missing.dataset.gap = String(gap);
    missing.title = t('advancedStats.noTrendData');
    return missing;
}

export function trendLineSegments(points, metric = 'attacks') {
    const safeMetric = normalizeTrendMetric(metric);
    const segments = [];
    let segment = [];
    let previousDate = null;
    const flush = () => {
        if (segment.length) segments.push(segment);
        segment = [];
    };
    points.forEach((point, index) => {
        const value = finiteMetric(point, safeMetric);
        const gap = calendarMonthGap(previousDate, point?.date);
        if (value === null || gap > 0) flush();
        if (value !== null) segment.push({ index, value });
        previousDate = point?.date;
    });
    flush();
    return segments;
}

function createTrendLine(segment, xForIndex, maximum) {
    const path = svgElement('path', { class: 'advanced-stats__trend-line' });
    path.setAttribute('d', segment.map(({ index, value }, pointIndex) => `${pointIndex ? 'L' : 'M'} ${xForIndex(index)} ${chartY(value, maximum)}`).join(' '));
    return path;
}

function appendChartGuides(svg, scale, metric) {
    [0, scale.midpoint, scale.maximum].forEach(value => {
        const y = chartY(value, scale.maximum);
        svg.append(svgElement('line', {
            class: 'advanced-stats__trend-grid-line', x1: CHART_PADDING.left,
            x2: CHART_WIDTH - CHART_PADDING.right, y1: y, y2: y
        }));
        const label = svgElement('text', { class: 'advanced-stats__trend-grid-label', x: 0, y: y + 3 });
        label.textContent = formatMetric(value, metric);
        svg.append(label);
    });
}

function appendTrendMonth(svg, point, index, x, showLabel, scale, metric) {
    const month = svgElement('g', { class: 'advanced-stats__trend-day' });
    month.append(createTrendValue(point, index, {
        metric, maxValue: scale.maximum, x, y: chartY(finiteMetric(point, metric) ?? 0, scale.maximum)
    }));
    if (showLabel) {
        const label = svgElement('text', { class: 'advanced-stats__trend-day-label', x, y: CHART_HEIGHT - 8, 'text-anchor': 'middle' });
        label.textContent = formatMonthLabel(point?.date);
        month.append(label);
    }
    svg.append(month);
}

export function renderTrends(elements, state) {
    const root = elements.trendChart;
    const metric = normalizeTrendMetric(state.trendMetric);
    const points = aggregateMonthlyTrends(arrayValue(state.trends));
    root?.replaceChildren();
    renderLootTrend(elements.lootTrend, points, formatMonthLabel);
    setVisibility(root, points.length > 0);
    setVisibility(elements.trendEmpty, points.length === 0);
    if (!root || !points.length) return;

    const scale = trendScale(points, metric);
    const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
    const xForIndex = index => points.length === 1
        ? CHART_PADDING.left + plotWidth / 2
        : CHART_PADDING.left + (index / (points.length - 1)) * plotWidth;
    const svg = svgElement('svg', {
        class: 'advanced-stats__trend-svg', viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
        role: 'img', 'aria-label': t('advancedStats.trendsTitle')
    });
    svg.dataset.metric = metric;
    appendChartGuides(svg, scale, metric);
    trendLineSegments(points, metric).forEach(segment => svg.append(createTrendLine(segment, xForIndex, scale.maximum)));
    const labelStep = Math.max(1, Math.ceil(points.length / 8));
    let previousDate = null;
    points.forEach((point, index) => {
        const gap = calendarMonthGap(previousDate, point?.date);
        if (gap) svg.append(createTrendGap(gap, xForIndex(index)));
        appendTrendMonth(svg, point, index, xForIndex(index), index % labelStep === 0 || index === points.length - 1, scale, metric);
        previousDate = point?.date;
    });
    root.append(svg);
}
