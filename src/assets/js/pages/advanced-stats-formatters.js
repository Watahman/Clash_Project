import { getLanguage, t } from '../i18n/i18n.js?v=20260809-4';

export function formatNumber(value, fallback = '—') {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return fallback;
    return new Intl.NumberFormat(getLanguage()).format(Number(value));
}

export function formatDecimal(value, fallback = '—') {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return fallback;
    return new Intl.NumberFormat(getLanguage(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(value));
}

export function formatPercent(value, fallback = '—') {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return fallback;
    return `${new Intl.NumberFormat(getLanguage(), { maximumFractionDigits: 1 }).format(Number(value))}%`;
}

export function asDate(value) {
    if (!value) return null;
    const raw = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value, fallback = t('advancedStats.pending')) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(date) : fallback;
}

export function formatDate(value, fallback = '—') {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium' }).format(date) : fallback;
}

export function formatShortDate(value) {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat(getLanguage(), { month: 'short', day: 'numeric' }).format(date) : '';
}

export function dateGapDays(previous, current) {
    const left = asDate(previous);
    const right = asDate(current);
    if (!left || !right) return 0;
    return Math.max(0, Math.round((right - left) / 86_400_000) - 1);
}

export function arrayValue(value) {
    return Array.isArray(value) ? value : [];
}
