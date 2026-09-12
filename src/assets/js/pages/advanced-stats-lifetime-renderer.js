import { t } from '../i18n/i18n.js?v=20260912-advanced-dashboard-v1';
import { formatDecimal, formatNumber, formatPercent } from './advanced-stats-formatters.js?v=20260912-advanced-dashboard-v1';
import { formatMonthLabel } from './advanced-stats-trends.js?v=20260912-advanced-dashboard-v1';
import { presentArmy } from './advanced-stats-army-view.js?v=20260912-advanced-dashboard-v1';

const UNKNOWN = '—';
const CATEGORY_KEYS = Object.freeze(['regular', 'competitive', 'unknown']);

function objectValue(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function finite(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function firstValue(source, ...keys) {
    for (const key of keys) {
        const value = source?.[key];
        if (value !== undefined) return value;
    }
    return null;
}

function translated(key, fallback) {
    const value = t(key);
    return value === key ? fallback : value;
}

export function normalizeLifetime(value) {
    const response = objectValue(value) || {};
    const data = objectValue(response.data) || response;
    return {
        ...data,
        summary: objectValue(data.summary) || {},
        starDistribution: data.starDistribution ?? data.stars ?? {},
        categories: data.categories ?? data.categoryPerformance ?? {},
        favorites: objectValue(data.favorites) || {},
        availability: data.availability ?? response.availability ?? null,
        minimumPerformanceSample: finite(data.minimumPerformanceSample ?? data.minimumSample)
    };
}

export function presentLifetime(value) {
    const data = normalizeLifetime(value);
    const summary = data.summary;
    const totalStars = finite(firstValue(summary, 'totalStars', 'stars', 'starTotal'));
    const totalDestruction = finite(firstValue(summary, 'totalDestruction', 'destruction', 'destructionTotal'));
    const perfectAttacks = finite(firstValue(summary, 'perfectAttacks', 'perfectAttackCount'));
    const bestStreak = finite(firstValue(summary, 'bestThreeStarStreak', 'bestStreak', 'bestTripleStreak'));
    return {
        data,
        totalStars,
        totalDestruction,
        perfectAttacks,
        bestStreak,
        tripleCount: finite(firstValue(summary, 'threeStarCount', 'tripleCount', 'lifetimeThreeStarCount')),
        currentStreak: finite(firstValue(summary, 'currentThreeStarStreak', 'currentStreak', 'currentTripleStreak')),
        trackedDays: finite(firstValue(summary, 'trackedAttackDays', 'trackedDays', 'distinctAttackDays')),
        mostActiveMonth: data.mostActiveMonth ?? null,
        bestPerformanceMonth: data.bestPerformanceMonth ?? null
    };
}

function setText(element, value) {
    if (element) element.textContent = value;
}

function setVisibility(element, visible) {
    if (element) element.hidden = !visible;
}

function availableOrUnknown(value) {
    return value === null ? UNKNOWN : formatNumber(value);
}

function formatExact(value) {
    return Number.isInteger(value) ? formatNumber(value) : formatDecimal(value);
}

function availabilityText(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        const unavailable = Object.values(value).some(entry => entry?.available === false);
        if (unavailable) return translated('advancedStats.lifetimePartialAvailability', 'Some lifetime metrics are unavailable.');
    }
    return translated('advancedStats.lifetimeAvailability', 'Based on available tracked history.');
}

function unavailableValue(value, fallback) {
    return value === null ? translated('advancedStats.lifetimeUnavailable', fallback) : formatNumber(value);
}

function monthText(value) {
    const source = objectValue(value);
    const date = source?.month ?? source?.date ?? source?.monthKey ?? value;
    const label = formatMonthLabel(date);
    if (!source) return label || UNKNOWN;
    const attacks = finite(source.attacks ?? source.attackCount ?? source.count);
    const stars = finite(source.averageStars);
    const parts = [label || UNKNOWN];
    if (attacks !== null) parts.push(`${formatNumber(attacks)} ${t(attacks === 1 ? 'advancedStats.attack' : 'advancedStats.attacks').toLowerCase()}`);
    if (stars !== null) parts.push(formatDecimal(stars));
    return parts.join(' · ');
}

function categoryEntry(categories, key) {
    const source = Array.isArray(categories)
        ? categories.find(entry => String(entry?.category || entry?.type || '').toLowerCase() === key)
        : categories?.[key] ?? categories?.[key.toUpperCase()];
    return objectValue(source) || null;
}

function categoryText(entry) {
    if (!entry) return UNKNOWN;
    const average = finite(entry.averageStars ?? entry.avgStars);
    const rate = finite(entry.threeStarRate ?? entry.tripleRate);
    const attacks = finite(entry.attacks ?? entry.attackCount ?? entry.count);
    const parts = [];
    if (average !== null) parts.push(`${formatDecimal(average)} ${t('advancedStats.avgStars').toLowerCase()}`);
    if (rate !== null) parts.push(formatPercent(rate));
    if (attacks !== null) parts.push(`${formatNumber(attacks)} ${t(attacks === 1 ? 'advancedStats.attack' : 'advancedStats.attacks').toLowerCase()}`);
    return parts.join(' · ') || UNKNOWN;
}

function renderCategories(elements, categories) {
    CATEGORY_KEYS.forEach(key => {
        const root = elements.lifetimeCategory?.querySelector(`[data-category="${key}"]`)
            || document.getElementById(`advanced-stats-lifetime-category-${key}`);
        if (!root) return;
        const entry = categoryEntry(categories, key);
        setText(root.querySelector('[data-category-value]'), entry ? categoryText(entry) : UNKNOWN);
        const meta = root.querySelector('[data-category-meta]');
        const minimumSample = finite(entry?.minimumSample);
        const sampleSize = finite(entry?.sampleSize ?? entry?.attacks ?? entry?.attackCount);
        const label = minimumSample === null
            ? translated('advancedStats.sampleSize', 'Sample size')
            : translated('advancedStats.minimumSample', 'Minimum sample');
        const value = minimumSample ?? sampleSize;
        setText(meta, value === null ? '' : `${label}: ${formatNumber(value)}`);
    });
}

function favoriteLabel(value) {
    const source = objectValue(value);
    if (!source) return typeof value === 'string' ? value : '';
    const name = source.name || source.unitName || source.label;
    const count = finite(source.battlesPresent ?? source.battleCount ?? source.count);
    if (!name) return '';
    return count === null ? name : `${name} · ${formatNumber(count)}`;
}

function presentFavoriteArmy(favorites, mostUsedArmy, state) {
    for (const source of [favorites?.army, mostUsedArmy]) {
        if (!objectValue(source)) continue;
        const army = source.army || (Array.isArray(source.units) ? source : null);
        const presentation = presentArmy(army, state.unitCatalog || [], t('advancedStats.armyComposition'));
        if (presentation.units.length) return { presentation, source };
    }
    return null;
}

function renderFavorites(elements, favorites, mostUsedArmy, state) {
    const root = elements.lifetimeFavorites;
    const content = root?.querySelector('[data-lifetime-favorites-content]');
    if (!content) return;
    content.replaceChildren();
    const values = ['troop', 'spell', 'siege'].map(key => [key, favoriteLabel(favorites[key])]).filter(([, value]) => value);
    const army = presentFavoriteArmy(favorites, mostUsedArmy, state);
    if (army) {
        const count = finite(army.source.battlesPresent ?? army.source.battleCount ?? army.source.attacks);
        const suffix = count === null ? '' : ` · ${formatNumber(count)} ${t('advancedStats.attacks').toLowerCase()}`;
        values.push(['army', `${t('advancedStats.favoriteArmy')}: ${army.presentation.label}${suffix}`]);
    }
    if (!values.length) {
        content.append(document.createTextNode(t('advancedStats.noFavorite')));
        return;
    }
    values.forEach(([key, value]) => {
        const item = document.createElement('span');
        item.dataset.favoriteType = key;
        item.textContent = value;
        content.append(item);
    });
}

function renderSuccessfulArmy(elements, army, state) {
    const content = elements.lifetimeSuccessfulArmy?.querySelector('[data-lifetime-successful-army-content]');
    if (!content) return;
    content.replaceChildren();
    const source = objectValue(army);
    const sourceArmy = source?.army || (Array.isArray(source?.units) ? source : null);
    const presentation = source ? presentArmy(sourceArmy, state.unitCatalog || [], t('advancedStats.armyComposition')) : null;
    if (!presentation?.units?.length) {
        content.append(document.createTextNode(t('advancedStats.noFavorite')));
        return;
    }
    const label = document.createElement('strong');
    label.textContent = presentation.label;
    const meta = document.createElement('small');
    const attacks = finite(source.battleCount ?? source.attacks ?? source.sampleSize);
    const stars = finite(source.averageStars);
    meta.textContent = [attacks === null ? '' : `${formatNumber(attacks)} ${t('advancedStats.attacks').toLowerCase()}`, stars === null ? '' : formatDecimal(stars)].filter(Boolean).join(' · ');
    content.append(label, meta);
}

export function renderLifetime(elements, state) {
    const root = elements.lifetimeSection;
    if (!root) return;
    const presentation = presentLifetime(state.lifetime);
    const { data } = presentation;
    root.dataset.state = state.lifetimeState || (state.lifetime ? 'ready' : 'empty');
    setText(elements.lifetimeAvailability, availabilityText(data.availability));
    setText(elements.lifetimeTotalStars, availableOrUnknown(presentation.totalStars));
    setText(elements.lifetimeTotalDestruction, presentation.totalDestruction === null ? UNKNOWN : `${formatExact(presentation.totalDestruction)}%`);
    const unavailable = translated('advancedStats.lifetimeUnavailable', t('advancedStats.coverageUnavailable'));
    setText(elements.lifetimePerfectAttacks, unavailableValue(presentation.perfectAttacks, unavailable));
    setText(elements.lifetimeBestStreak, unavailableValue(presentation.bestStreak, unavailable));
    setText(elements.lifetimeTripleCount, availableOrUnknown(presentation.tripleCount));
    setText(elements.lifetimeTrackedDays, availableOrUnknown(presentation.trackedDays));
    setText(elements.lifetimeCurrentStreak, unavailableValue(presentation.currentStreak, unavailable));
    setText(elements.lifetimeMostActiveMonth, monthText(presentation.mostActiveMonth));
    setText(elements.lifetimeBestPerformanceMonth, monthText(presentation.bestPerformanceMonth));
    ['zero', 'one', 'two', 'three', 'unknown'].forEach(key => {
        const value = data.starDistribution?.[key] ?? data.starDistribution?.[Number({ zero: 0, one: 1, two: 2, three: 3 }[key])];
        setText(elements[`lifetimeStar${key[0].toUpperCase()}${key.slice(1)}`], availableOrUnknown(finite(value)));
    });
    renderCategories(elements, data.categories);
    renderFavorites(elements, data.favorites, data.mostUsedArmy, state);
    renderSuccessfulArmy(elements, data.mostSuccessfulArmy || data.successfulArmy, state);
}
