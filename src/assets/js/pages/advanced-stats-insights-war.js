import { t } from '../i18n/i18n.js?v=20260916-advanced-insights-v1';
import { hasValue, readField } from './advanced-stats-insights-data.js?v=20260916-advanced-insights-v1';

const UNKNOWN = '—';
const MODES = Object.freeze([
    ['regular', 'advancedStats.attackCategoryRegular'],
    ['cwl', 'advancedStats.insightsCwl']
]);
const SUMMARY_FIELDS = Object.freeze([
    ['attacks', 'advancedStats.insightsAttacks', ['attackCount', 'attacks', 'playerAttacks']],
    ['available', 'advancedStats.insightsAvailable', ['availableAttacks']],
    ['used', 'advancedStats.insightsUsed', ['usedAttacks']],
    ['missed', 'advancedStats.insightsMissed', ['missedAttacks']],
    ['avgStars', 'advancedStats.insightsAverageStars', ['avgStars', 'averageStars']],
    ['avgDestruction', 'advancedStats.insightsAverageDestruction', ['avgDestruction', 'averageDestruction']],
    ['tripleRate', 'advancedStats.insightsTripleRate', ['tripleRate', 'threeStarRate']]
]);

function modesFor(payload) {
    return payload?.modes && typeof payload.modes === 'object' ? payload.modes : payload;
}

function formatValue(value) {
    if (!hasValue(value)) return UNKNOWN;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
    }
    if (typeof value === 'object') return formatValue(value.label ?? value.name ?? value.value);
    return String(value);
}

function statusLabel(value, block) {
    const status = String(value || '').toLowerCase().replaceAll('-', '_');
    if (['ready', 'complete', 'available'].includes(status)) return t('advancedStats.coverageAvailable');
    if (['partial', 'degraded'].includes(status)) return t('advancedStats.coveragePartial');
    if (['no_data', 'nohistory', 'no_history'].includes(status)) return t('advancedStats.insightsEmptyTitle');
    if (['error'].includes(status)) return t('advancedStats.insightsErrorTitle');
    if (['unavailable', 'unsupported'].includes(status)) return t('advancedStats.coverageUnavailable');
    if (SUMMARY_FIELDS.some(([, , aliases]) => hasValue(readField(block, aliases)))) {
        return t('advancedStats.coverageAvailable');
    }
    return t('advancedStats.coverageUnknown');
}

function metricValue(doc, value) {
    if (hasValue(value)) return doc.createTextNode(formatValue(value));
    const unknown = doc.createElement('span');
    unknown.dataset.state = 'unknown';
    unknown.setAttribute('aria-label', t('advancedStats.coverageUnknown'));
    unknown.textContent = UNKNOWN;
    return unknown;
}

function metricText(value, key, block) {
    const formatted = formatValue(value);
    if (key !== 'tripleRate' || !hasValue(value)) return formatted;
    const three = block?.starBuckets?.three;
    const attacks = readField(block, ['attackCount', 'attacks', 'playerAttacks']);
    if (!hasValue(three) || !hasValue(attacks)) return typeof value === 'number' ? `${formatted}%` : formatted;
    return `${typeof value === 'number' ? `${formatted}%` : formatted} (${formatValue(three)}/${formatValue(attacks)} ${t('advancedStats.insightsAttacks').toLowerCase()})`;
}

function summaryCard(doc, mode, block) {
    const card = doc.createElement('article');
    card.className = 'advanced-stats__insights-summary-card';
    card.dataset.insightsMode = mode;
    const state = String(block?.status || '').toLowerCase();
    if (state) card.dataset.state = state;
    const heading = doc.createElement('header');
    const title = doc.createElement('h3');
    title.textContent = t(MODES.find(([key]) => key === mode)?.[1] || 'advancedStats.insightsMode');
    const status = doc.createElement('span');
    status.textContent = statusLabel(block?.status, block);
    heading.append(title, status);
    const metrics = doc.createElement('dl');
    const hasMetrics = SUMMARY_FIELDS.some(([, , aliases]) => hasValue(readField(block, aliases)));
    if (!hasMetrics) {
        const copy = doc.createElement('p');
        copy.className = 'advanced-stats__insights-no-summary';
        copy.textContent = t('advancedStats.insightsModeNoSummary');
        card.append(heading, copy);
        return card;
    }
    SUMMARY_FIELDS.forEach(([key, labelKey, aliases]) => {
        const item = doc.createElement('div');
        const label = doc.createElement('dt');
        label.textContent = t(labelKey);
        const value = doc.createElement('dd');
        const raw = readField(block, aliases);
        value.append(hasValue(raw) ? doc.createTextNode(metricText(raw, key, block)) : metricValue(doc, raw));
        item.append(label, value);
        metrics.append(item);
    });
    card.append(heading, metrics);
    return card;
}

function trendPoints(block) {
    const trend = block?.trend;
    if (Array.isArray(trend)) return trend;
    for (const key of ['points', 'rows', 'data']) {
        if (Array.isArray(trend?.[key])) return trend[key];
    }
    return [];
}

function trendItem(doc, point) {
    const item = doc.createElement('li');
    const label = doc.createElement('strong');
    label.textContent = formatValue(readField(point, ['period', 'date', 'season', 'bucket']));
    const values = doc.createElement('span');
    [['attackCount', 'advancedStats.insightsAttacks', ['attackCount', 'attacks']], ['avgStars', 'advancedStats.insightsAverageStars', ['avgStars', 'averageStars']], ['avgDestruction', 'advancedStats.insightsAverageDestruction', ['avgDestruction', 'averageDestruction']], ['tripleRate', 'advancedStats.insightsTripleRate', ['tripleRate', 'threeStarRate']]].forEach(([, key, aliases]) => {
        const value = readField(point, aliases);
        if (!hasValue(value)) return;
        const part = doc.createElement('span');
        part.textContent = `${t(key)}: ${formatValue(value)}`;
        values.append(part);
    });
    if (!values.children.length) return null;
    item.append(label, values);
    return item;
}

function trendBlock(doc, mode, points) {
    const block = doc.createElement('div');
    block.className = 'advanced-stats__insights-trend-mode';
    const heading = doc.createElement('h4');
    heading.textContent = t(MODES.find(([key]) => key === mode)?.[1] || 'advancedStats.insightsMode');
    const list = doc.createElement('ol');
    points.map(point => trendItem(doc, point)).filter(Boolean).forEach(item => list.append(item));
    if (!list.children.length) return null;
    block.append(heading, list);
    return block;
}

export function renderWarSummary(doc, content, payload) {
    const modes = modesFor(payload);
    const blocks = MODES.map(([mode]) => modes?.[mode]).filter(block => block && typeof block === 'object');
    if (!blocks.length) return;
    const summary = doc.createElement('section');
    summary.className = 'advanced-stats__insights-summary';
    const title = doc.createElement('h3');
    title.textContent = t('advancedStats.insightsSummary');
    summary.append(title);
    const cards = doc.createElement('div');
    cards.className = 'advanced-stats__insights-summary-grid';
    MODES.forEach(([mode]) => {
        if (modes?.[mode] && typeof modes[mode] === 'object') cards.append(summaryCard(doc, mode, modes[mode]));
    });
    summary.append(cards);
    content.append(summary);
}

export function renderWarTrends(doc, content, payload) {
    const modes = modesFor(payload);
    const trendBlocks = MODES.map(([mode]) => trendBlock(doc, mode, trendPoints(modes?.[mode]))).filter(Boolean);
    if (!trendBlocks.length) return;
    const trends = doc.createElement('section');
    trends.className = 'advanced-stats__insights-trends';
    const title = doc.createElement('h3');
    title.textContent = t('advancedStats.insightsTrend');
    trends.append(title, ...trendBlocks);
    content.append(trends);
}
