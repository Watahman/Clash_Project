import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import { getLanguage, t } from '../i18n/i18n.js?v=20260914-achievement-collection-v2';
import { achievementChronicleLocales } from '../i18n/achievement-chronicle-locales.js?v=20260914-achievement-collection-v2';

export function hubText(key, fallback = key, params = {}) {
    const fullKey = key.startsWith('achievements.hub.') ? key : `achievements.hub.${key}`;
    const localeValue = achievementChronicleLocales[getLanguage()]?.[fullKey]
        || achievementChronicleLocales.en?.[fullKey];
    let value = localeValue || t(fullKey, params);
    if (value === fullKey) value = fallback;
    Object.entries(params).forEach(([param, replacement]) => {
        value = value.replaceAll(`{${param}}`, replacement ?? '');
    });
    return value;
}

function generalText(key, fallback, params = {}) {
    const value = t(key, params);
    return value === key ? fallback : value;
}

export function achievementStateText(state) {
    if (state === 'unknown') return hubText('progressUnavailable', 'Progress unavailable');
    if (state === 'locked') return hubText('badgeLocked', 'Badge locked');
    if (state === 'in_progress') return generalText('achievements.inProgress', 'In progress');
    if (state === 'complete') return generalText('achievements.completed', 'Complete');
    return achievementChronicleLocales[getLanguage()]?.['achievements.chronicle.unlocked']
        || achievementChronicleLocales.en?.['achievements.chronicle.unlocked']
        || 'Unlocked';
}

export function badgeTierText(state) {
    return state === 'unlocked' || state === 'complete'
        ? achievementStateText('unlocked')
        : hubText('badgeLocked', 'Badge locked');
}

export function achievementTierText(number) {
    const name = generalText('achievements.tiers', 'Tier');
    return `${name} ${number}`;
}

export function achievementLabel() {
    return generalText('achievements.achievementsLabel', 'Achievements');
}

function label(value, fallback = '') {
    const result = String(value ?? '').trim();
    return result || fallback;
}

function keyOf(category) {
    const value = category?.key ?? category?.categoryKey ?? category?.id ?? category?.category;
    return label(value, 'other').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function categoryTitle(category) {
    return label(category?.title ?? category?.name ?? category?.label ?? category?.categoryLabel,
        hubText('categoryDetails', 'Category details'));
}

function familiesOf(category) {
    return [
        ...(Array.isArray(category?.progressionFamilies) ? category.progressionFamilies : []),
        ...(Array.isArray(category?.standaloneFamilies) ? category.standaloneFamilies : [])
    ];
}

function familyTitle(family) {
    return label(family?.title ?? family?.name, achievementLabel());
}

function tiersOf(family) {
    if (Array.isArray(family?.tiers) && family.tiers.length) return family.tiers;
    return [family];
}

export function stateOf(value) {
    const state = label(value?.state).toLowerCase();
    if (state === 'complete' || value?.complete === true) return 'complete';
    if (state === 'unknown' || value?.sourceAvailable === false || value?.progressKnown === false) return 'unknown';
    if (state === 'unlocked' || value?.unlocked === true || (value?.unlockedTiers?.length || 0) > 0) return 'unlocked';
    if (state === 'in_progress' || state === 'in-progress' || Number(value?.progressRatio) > 0 || Number(value?.progress) > 0) return 'in_progress';
    return 'locked';
}

function completionFields(category) {
    return category?.completion && typeof category.completion === 'object' ? category.completion : {};
}

export function countsFor(category) {
    const families = familiesOf(category);
    const tiers = families.flatMap(tiersOf);
    const completion = completionFields(category);
    const explicitTotal = Number(category?.totalCount ?? category?.totalAchievements ?? category?.familyCount
        ?? category?.total ?? completion.total);
    const explicitUnlocked = Number(category?.completedCount ?? category?.completedAchievements
        ?? category?.completedFamilyCount ?? category?.completedFamilies ?? category?.unlockedCount
        ?? category?.unlocked ?? completion.completed ?? completion.unlocked);
    const total = Number.isFinite(explicitTotal) && explicitTotal >= 0 ? explicitTotal : tiers.length;
    const unlocked = Number.isFinite(explicitUnlocked) && explicitUnlocked >= 0
        ? Math.min(total, explicitUnlocked)
        : tiers.filter(tier => stateOf(tier) === 'complete' || stateOf(tier) === 'unlocked').length;
    const explicitPercent = category?.completionPercent ?? category?.completionPercentage
        ?? category?.progressPercent ?? category?.percentage ?? completion.percent;
    const hasUnknown = families.some(family => stateOf(family) === 'unknown'
        || tiersOf(family).some(tier => stateOf(tier) === 'unknown'));
    const percentValue = Number(explicitPercent);
    const percent = Number.isFinite(percentValue)
        ? Math.max(0, Math.min(100, percentValue <= 1 ? percentValue * 100 : percentValue))
        : total > 0 && !hasUnknown ? (unlocked / total) * 100 : null;
    return { total, unlocked, percent };
}

function progressText(counts) {
    return hubText('categoryProgress', '{unlocked} / {total} complete', {
        unlocked: counts.unlocked, total: counts.total
    });
}

function badgeDefinitionOf(category) {
    const definition = category?.badgeDefinition ?? category?.badge;
    return definition && typeof definition === 'object' ? definition : {};
}

export function badgeInfo(category) {
    const definition = badgeDefinitionOf(category);
    const rawState = label(definition.state ?? definition.status ?? category?.badgeState).toLowerCase();
    const ratio = Number(definition.percentage ?? definition.progress ?? definition.ratio);
    const unlocked = definition.unlocked === true || definition.confirmedUnlocked === true
        || ['unlocked', 'complete', 'completed', 'earned'].includes(rawState)
        || ratio >= 100 || countsFor(category).percent === 100;
    const state = unlocked ? 'unlocked' : 'locked';
    return {
        label: label(definition.label ?? definition.displayLabel,
            'Completion badge'),
        state,
        tier: state
    };
}

function directImage(source, title) {
    const image = document.createElement('img');
    image.className = `achievement-family-image ${/\.svg(?:$|\?)/i.test(source)
        ? 'achievement-vector-image' : 'achievement-raster-image'}`;
    image.src = source;
    image.alt = '';
    image.title = title;
    image.width = 32;
    image.height = 32;
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
}

function familyImage(source, title) {
    if (typeof source === 'string') {
        if (source.includes('/') || /\.(?:svg|png|jpe?g|webp)(?:\?|$)/i.test(source)) return directImage(source, title);
        return achievementFamilyImage({ familyKey: source, title }, title);
    }
    return achievementFamilyImage(source || {}, title);
}

function makeJourney(family) {
    const journey = document.createElement('div');
    const title = familyTitle(family);
    journey.className = 'achievement-hub-journey';
    journey.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, 'achievement');
    journey.setAttribute('role', 'listitem');
    journey.setAttribute('aria-label', `${title}: ${hubText('journey', 'Journey')}`);
    const heading = document.createElement('strong');
    heading.className = 'achievement-hub-journey-title';
    heading.textContent = title;
    const track = document.createElement('div');
    track.className = 'achievement-hub-journey-track';
    track.setAttribute('role', 'list');
    tiersOf(family).slice(0, 4).forEach((tier, index, tiers) => {
        const node = document.createElement('span');
        node.className = 'achievement-hub-journey-node';
        node.dataset.state = stateOf(tier);
        node.setAttribute('role', 'listitem');
        node.setAttribute('aria-label', `${familyTitle(tier)}: ${achievementStateText(stateOf(tier))}`);
        const emblem = document.createElement('span');
        emblem.className = 'achievement-hub-journey-emblem';
        emblem.append(familyImage(tier, familyTitle(tier)));
        node.append(emblem);
        if (index < tiers.length - 1) {
            const connector = document.createElement('i');
            connector.className = 'achievement-hub-journey-connector';
            connector.setAttribute('aria-hidden', 'true');
            node.append(connector);
        }
        track.append(node);
    });
    journey.append(heading, track);
    return journey;
}

function makeBadge(category) {
    const badge = badgeInfo(category);
    const element = document.createElement('span');
    element.className = 'achievement-badge achievement-hub-badge';
    element.dataset.state = badge.state;
    element.setAttribute('aria-label', `${badge.label}: ${badgeTierText(badge.state)}`);
    const crest = document.createElement('span');
    crest.className = 'achievement-hub-badge-crest';
    crest.setAttribute('aria-hidden', 'true');
    crest.textContent = badge.state === 'unlocked' ? '✓' : '◇';
    const copy = document.createElement('span');
    copy.className = 'achievement-badge-copy';
    copy.append(document.createElement('strong'), document.createElement('small'));
    copy.firstChild.textContent = badge.label;
    copy.lastChild.textContent = badgeTierText(badge.state);
    element.append(crest, copy);
    return element;
}

function makeModuleHeading(category, title) {
    const heading = document.createElement('header');
    heading.className = 'achievement-hub-module-heading';
    const icon = document.createElement('span');
    icon.className = 'achievement-hub-category-icon';
    icon.append(familyImage(category?.icon ?? category?.iconFamily ?? category, title));
    const titleCopy = document.createElement('div');
    titleCopy.className = 'achievement-hub-module-title';
    titleCopy.append(document.createElement('h3'), document.createElement('p'));
    titleCopy.firstChild.textContent = title;
    titleCopy.lastChild.textContent = label(category?.description);
    heading.append(icon, titleCopy, makeBadge(category));
    return heading;
}

function makeModuleProgress(category, title, counts) {
    const progress = document.createElement('div');
    progress.className = 'achievement-hub-progress';
    const copy = document.createElement('div');
    copy.className = 'achievement-hub-progress-copy';
    copy.append(document.createElement('strong'), document.createElement('span'));
    copy.firstChild.textContent = progressText(counts);
    copy.lastChild.textContent = counts.percent === null ? '—'
        : hubText('completion', '{percent}% complete', { percent: Math.round(counts.percent) });
    const track = document.createElement('div');
    track.className = 'achievement-hub-progress-track';
    track.dataset.known = String(counts.percent !== null);
    track.style.setProperty('--achievement-progress', `${counts.percent ?? 0}%`);
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-label', `${title} — ${hubText('progress', 'Progress')}`);
    if (counts.percent === null) track.setAttribute('aria-valuetext', hubText('progressUnavailable', 'Progress unavailable'));
    else track.setAttribute('aria-valuenow', String(Math.round(counts.percent)));
    track.append(document.createElement('span'));
    progress.append(copy, track);
    return progress;
}

function makeModulePreview(category) {
    const families = Array.isArray(category?.progressionFamilies) ? category.progressionFamilies.slice(0, 2) : [];
    if (!families.length) return null;
    const preview = document.createElement('div');
    preview.className = 'achievement-hub-preview';
    preview.setAttribute('role', 'list');
    families.forEach(family => preview.append(makeJourney(family)));
    return preview;
}

export function renderAchievementHubModule(category, options = {}) {
    const key = keyOf(category);
    const title = categoryTitle(category);
    const counts = countsFor(category);
    const module = document.createElement('button');
    module.className = 'achievement-hub-module';
    module.type = 'button';
    module.dataset.achievementCategory = key;
    module.dataset.progressKnown = String(counts.percent !== null);
    module.setAttribute('aria-label', `${title} — ${hubText('viewDetails', 'View details')}`);
    module.append(makeModuleHeading(category, title), makeModuleProgress(category, title, counts));
    const preview = makeModulePreview(category);
    if (preview) module.append(preview);
    if (typeof options.onCategorySelect === 'function') module.addEventListener('click', () => options.onCategorySelect(category, key));
    return module;
}

export function renderAchievementHub(container, categories, options = {}) {
    if (!container) return null;
    container.replaceChildren();
    container.classList.remove('achievement-category-detail');
    container.classList.add('achievement-hub');
    const list = Array.isArray(categories) ? categories : [];
    list.forEach(category => container.append(renderAchievementHubModule(category, options)));
    if (!list.length) {
        const empty = document.createElement('p');
        empty.className = 'achievement-hub-empty';
        empty.textContent = label(options.emptyMessage, hubText('noCategories', 'No achievement categories are available yet.'));
        container.append(empty);
    }
    return container;
}
