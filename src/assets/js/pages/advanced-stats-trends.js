import { getLanguage } from '../i18n/i18n.js?v=20260912-advanced-dashboard-v1';

const LOOT_FIELDS = Object.freeze(['goldLooted', 'elixirLooted', 'darkElixirLooted']);
const WEIGHTED_FIELDS = Object.freeze(['averageStars', 'averageDestruction']);
const STAR_SAMPLE_FIELDS = Object.freeze(['sampleSize', 'starKnownAttacks']);
const DESTRUCTION_SAMPLE_FIELDS = Object.freeze(['destructionSampleSize']);

export const TREND_METRICS = Object.freeze({
    attacks: Object.freeze({ field: 'attacks', labelKey: 'advancedStats.attacks', format: 'number', maximum: null }),
    averageStars: Object.freeze({ field: 'averageStars', labelKey: 'advancedStats.avgStars', format: 'decimal', maximum: 3 }),
    threeStarRate: Object.freeze({ field: 'threeStarRate', labelKey: 'advancedStats.threeStarRate', format: 'percent', maximum: 100 }),
    averageDestruction: Object.freeze({ field: 'averageDestruction', labelKey: 'advancedStats.avgDestruction', format: 'percent', maximum: 100 })
});

export function normalizeTrendMetric(value) {
    const key = String(value || '').trim();
    return Object.prototype.hasOwnProperty.call(TREND_METRICS, key) ? key : 'attacks';
}

export function trendMetricConfig(value) {
    return TREND_METRICS[normalizeTrendMetric(value)];
}

export function trendMetricValue(point, metric = 'attacks') {
    const raw = point?.[trendMetricConfig(metric).field];
    return finiteNumber(raw);
}

function finiteNumber(value) {
    if (value === null || value === undefined || typeof value === 'boolean') return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function roundMetric(value) {
    return Number(value.toFixed(2));
}

function monthIndex(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    return year * 12 + month - 1;
}

export function monthKeyForDate(value) {
    const text = String(value ?? '').trim();
    const calendarDate = text.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
    if (calendarDate) {
        const month = Number(calendarDate[2]);
        return month >= 1 && month <= 12 ? `${calendarDate[1]}-${calendarDate[2]}` : null;
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return null;
    const utcText = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`;
    const instant = new Date(utcText);
    if (Number.isNaN(instant.getTime())) return null;
    const year = instant.getUTCFullYear();
    const month = String(instant.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export function monthDate(monthKey) {
    return monthKey ? `${monthKey}-01` : null;
}

export function calendarMonthGap(previous, current) {
    const previousKey = monthKeyForDate(previous);
    const currentKey = monthKeyForDate(current);
    if (!previousKey || !currentKey) return 0;
    return Math.max(0, monthIndex(currentKey) - monthIndex(previousKey) - 1);
}

export function formatMonthLabel(value) {
    const key = monthKeyForDate(value);
    if (!key) return '';
    const [year, month] = key.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, 1));
    return new Intl.DateTimeFormat(getLanguage(), {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(date);
}

function createBucket(key) {
    const metrics = Object.fromEntries(WEIGHTED_FIELDS.map(field => [field, { total: 0, weight: 0 }]));
    metrics.threeStarRate = { total: 0, weight: 0 };
    return {
        key,
        attacks: 0,
        attacksKnown: false,
        loot: Object.fromEntries(LOOT_FIELDS.map(field => [field, { total: 0, known: false }])),
        metrics
    };
}

function addWeightedMetric(bucket, field, value, weight) {
    const metric = finiteNumber(value);
    if (metric === null || weight === null || weight <= 0) return;
    bucket.metrics[field].total += metric * weight;
    bucket.metrics[field].weight += weight;
}

function explicitSampleWeight(point, fields) {
    let hasExplicitSample = false;
    for (const field of fields) {
        if (!Object.prototype.hasOwnProperty.call(point || {}, field)) continue;
        hasExplicitSample = true;
        const sample = finiteNumber(point[field]);
        if (sample !== null) return Math.max(0, sample);
    }
    return hasExplicitSample ? 0 : null;
}

function metricWeight(point, sampleFields, fallback) {
    const explicit = explicitSampleWeight(point, sampleFields);
    return explicit === null ? fallback : explicit;
}

function addPoint(bucket, point) {
    const rawAttacks = finiteNumber(point?.attacks);
    const attacks = rawAttacks === null ? null : Math.max(0, rawAttacks);
    if (attacks !== null) {
        bucket.attacks += attacks;
        bucket.attacksKnown = true;
    }

    addWeightedMetric(bucket, 'averageStars', point?.averageStars,
        metricWeight(point, STAR_SAMPLE_FIELDS, attacks));
    addWeightedMetric(bucket, 'averageDestruction', point?.averageDestruction,
        metricWeight(point, DESTRUCTION_SAMPLE_FIELDS, attacks));
    const rate = finiteNumber(point?.threeStarRate);
    if (rate !== null) addWeightedMetric(bucket, 'threeStarRate', rate,
        metricWeight(point, STAR_SAMPLE_FIELDS, attacks));

    LOOT_FIELDS.forEach(field => {
        const value = finiteNumber(point?.[field]);
        if (value === null) return;
        bucket.loot[field].total += value;
        bucket.loot[field].known = true;
    });
}

function metricValue(bucket, field) {
    const metric = bucket.metrics[field];
    return metric.weight > 0 ? roundMetric(metric.total / metric.weight) : null;
}

function bucketPoint(bucket) {
    const point = {
        date: monthDate(bucket.key),
        attacks: bucket.attacksKnown ? bucket.attacks : null,
        averageStars: metricValue(bucket, 'averageStars'),
        averageDestruction: metricValue(bucket, 'averageDestruction'),
        threeStarRate: metricValue(bucket, 'threeStarRate')
    };
    LOOT_FIELDS.forEach(field => {
        point[field] = bucket.loot[field].known ? bucket.loot[field].total : null;
    });
    return point;
}

export function aggregateMonthlyTrends(points) {
    const buckets = new Map();
    (Array.isArray(points) ? points : []).forEach(point => {
        const key = monthKeyForDate(point?.date);
        if (!key) return;
        const bucket = buckets.get(key) ?? createBucket(key);
        addPoint(bucket, point);
        buckets.set(key, bucket);
    });
    return [...buckets.values()]
        .sort((left, right) => monthIndex(left.key) - monthIndex(right.key))
        .map(bucketPoint);
}
