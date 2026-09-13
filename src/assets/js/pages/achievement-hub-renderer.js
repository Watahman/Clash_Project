import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import { getLanguage, t } from '../i18n/i18n.js?v=20260913-achievement-hub-v1';
import { achievementChronicleLocales } from '../i18n/achievement-chronicle-locales.js?v=20260913-achievement-hub-v1';

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
    if (state === 'unknown') return hubText('unknownProgress', 'Waiting for data');
    if (state === 'locked') return hubText('badgeLocked', 'Badge locked');
    if (state === 'in_progress') return generalText('achievements.inProgress', 'In progress');
    if (state === 'complete') return generalText('achievements.completed', 'Complete');
    return achievementChronicleLocales[getLanguage()]?.['achievements.chronicle.unlocked']
        || achievementChronicleLocales.en?.['achievements.chronicle.unlocked']
        || 'Unlocked';
}

export function badgeTierText(state) {
    const key = { bronze: 'badgeBronze', silver: 'badgeSilver', gold: 'badgeGold', master: 'badgeMaster' }[state];
    return key ? hubText(key, state) : achievementStateText(state);
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
    return label(category?.title ?? category?.name ?? category?.label ?? category?.categoryLabel, hubText('categoryDetails', 'Category details'));
}

function familiesOf(category) {
    return [
        ...(Array.isArray(category?.progressionFamilies) ? category.progressionFamilies : []),
        ...(Array.isArray(category?.standaloneFamilies) ? category.standaloneFamilies : [])
    ];
}

function familyTitle(family) { return label(family?.title ?? family?.name, achievementLabel()); }

function tiersOf(family) {
    if (Array.isArray(family?.tiers) && family.tiers.length) return family.tiers;
    return [family];
}

function stateOf(value) {
    const state = label(value?.state).toLowerCase();
    if (state === 'complete' || value?.complete === true) return 'complete';
    if (state === 'unknown' || value?.sourceAvailable === false || value?.progressKnown === false) return 'unknown';
    if (state === 'unlocked' || value?.unlocked === true || (value?.unlockedTiers?.length || 0) > 0) return 'unlocked';
    if (state === 'in_progress' || state === 'in-progress' || Number(value?.progressRatio) > 0 || Number(value?.progress) > 0) return 'in_progress';
    return 'locked';
}

function countsFor(category) {
    const families = familiesOf(category);
    const tiers = families.flatMap(tiersOf);
    const explicitTotal = Number(category?.totalAchievements ?? category?.totalCount ?? category?.familyCount ?? category?.total);
    const explicitUnlocked = Number(category?.unlockedAchievements ?? category?.unlockedCount ?? category?.completedFamilyCount ?? category?.completedFamilies ?? category?.unlocked);
    const total = Number.isFinite(explicitTotal) && explicitTotal >= 0 ? explicitTotal : tiers.length;
    const unlocked = Number.isFinite(explicitUnlocked) && explicitUnlocked >= 0
        ? Math.min(total, explicitUnlocked)
        : tiers.filter(tier => stateOf(tier) === 'complete' || stateOf(tier) === 'unlocked').length;
    const explicitPercent = category?.completionPercent ?? category?.progressPercent ?? category?.percentage;
    const hasUnknown = families.some(family => stateOf(family) === 'unknown' || tiersOf(family).some(tier => stateOf(tier) === 'unknown'));
    const percentValue = Number(explicitPercent);
    const percent = Number.isFinite(percentValue)
        ? Math.max(0, Math.min(100, percentValue <= 1 ? percentValue * 100 : percentValue))
        : total > 0 && !hasUnknown ? (unlocked / total) * 100 : null;
    return { total, unlocked, percent };
}

function progressText(counts) {
    if (counts.percent === null) return hubText('unknownProgress', 'Waiting for data');
    return hubText('categoryProgress', '{unlocked} / {total} complete', {
        unlocked: counts.unlocked, total: counts.total
    });
}

function badgeInfo(category) {
    const badge = category?.badge && typeof category.badge === 'object' ? category.badge : {};
    const rawState = label(badge.state ?? badge.status, category?.badgeState ?? 'locked').toLowerCase();
    const state = rawState === 'none' ? 'locked' : rawState;
    const tier = label(badge.tier ?? badge.level, state === 'locked' ? 'locked' : state);
    return {
        label: label(badge.label ?? badge.name, hubText('categoryReward', 'Completion reward')),
        state: state || 'locked',
        tier: tier || 'locked'
    };
}

function makeJourney(family, options = {}) {
    const journey = document.createElement('div');
    journey.className = 'achievement-hub-journey';
    journey.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, 'achievement');
    journey.setAttribute('role', 'list');
    journey.setAttribute('aria-label', familyTitle(family));
    const tiers = tiersOf(family).slice(0, options.maxTiers ?? 4);
    tiers.forEach((tier, index) => {
        const node = document.createElement('span');
        node.className = 'achievement-hub-journey-node';
        node.dataset.state = stateOf(tier);
        node.setAttribute('role', 'listitem');
        node.setAttribute('aria-label', `${familyTitle(tier)}: ${achievementStateText(stateOf(tier))}`);
        node.append(achievementFamilyImage(tier, familyTitle(tier)));
        if (index < tiers.length - 1) {
            const connector = document.createElement('i');
            connector.className = 'achievement-hub-journey-connector';
            connector.setAttribute('aria-hidden', 'true');
            node.append(connector);
        }
        journey.append(node);
    });
    return journey;
}

function makeBadge(category) {
    const badge = badgeInfo(category);
    const element = document.createElement('span');
    element.className = 'achievement-badge achievement-hub-badge';
    element.dataset.state = badge.state;
    element.dataset.tier = badge.tier;
    element.setAttribute('aria-label', `${badge.label}: ${badgeTierText(badge.state)}`);
    const mark = document.createElement('span');
    mark.className = 'achievement-badge-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = badge.state === 'locked' ? '◇' : '◆';
    const copy = document.createElement('span');
    copy.className = 'achievement-badge-copy';
    copy.append(document.createElement('strong'), document.createElement('small'));
    copy.firstChild.textContent = badge.label;
    copy.lastChild.textContent = badgeTierText(badge.tier);
    element.append(mark, copy);
    return element;
}

function makeModuleHeading(category, title) {
    const heading = document.createElement('header');
    heading.className = 'achievement-hub-module-heading';
    const icon = document.createElement('span');
    icon.className = 'achievement-hub-category-icon';
    icon.append(achievementFamilyImage(category.iconFamily || category, title));
    const titleCopy = document.createElement('div');
    titleCopy.className = 'achievement-hub-module-title';
    titleCopy.append(document.createElement('h3'), document.createElement('p'));
    titleCopy.firstChild.textContent = title;
    titleCopy.lastChild.textContent = label(category?.description, hubText('categoryPreview', 'Category preview'));
    heading.append(icon, titleCopy, makeBadge(category));
    return heading;
}

function makeModuleProgress(category, title, counts) {
    const progress = document.createElement('div');
    progress.className = 'achievement-hub-progress';
    const progressCopy = document.createElement('div');
    progressCopy.className = 'achievement-hub-progress-copy';
    progressCopy.append(document.createElement('strong'), document.createElement('span'));
    progressCopy.firstChild.textContent = progressText(counts);
    progressCopy.lastChild.textContent = counts.percent === null
        ? hubText('unknownProgress', 'Waiting for data')
        : hubText('completion', '{percent}% complete', { percent: Math.round(counts.percent) });
    const track = document.createElement('div');
    track.className = 'achievement-hub-progress-track';
    track.style.setProperty('--achievement-progress', `${counts.percent ?? 0}%`);
    if (counts.percent !== null) {
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', '100');
        track.setAttribute('aria-valuenow', String(Math.round(counts.percent)));
        track.setAttribute('aria-label', `${title} — ${hubText('progress', 'Progress')}`);
    } else {
        track.dataset.known = 'false';
        track.setAttribute('aria-label', `${title}: ${hubText('unknownProgress', 'Waiting for data')}`);
    }
    const fill = document.createElement('span');
    track.append(fill);
    progress.append(progressCopy, track);
    return progress;
}

function makeModulePreview(category) {
    const preview = document.createElement('div');
    preview.className = 'achievement-hub-preview';
    const progression = Array.isArray(category?.progressionFamilies) ? category.progressionFamilies : [];
    const standalone = Array.isArray(category?.standaloneFamilies) ? category.standaloneFamilies : [];
    progression.slice(0, 2).forEach(family => preview.append(makeJourney(family)));
    standalone.slice(0, 2).forEach(family => preview.append(makeJourney(family, { maxTiers: 1 })));
    if (!preview.childElementCount) {
        const empty = document.createElement('span');
        empty.className = 'achievement-hub-preview-empty';
        empty.textContent = hubText('categoryPreview', 'Category preview');
        preview.append(empty);
    }
    return preview;
}

function makeModuleAction(category, key, options) {
    const action = document.createElement('button');
    action.className = 'achievement-hub-cta';
    action.type = 'button';
    action.dataset.achievementCategory = key;
    action.setAttribute('aria-label', `${hubText('viewDetails', 'View details')}: ${categoryTitle(category)}`);
    action.append(document.createElement('span'), document.createElement('span'));
    action.firstChild.textContent = hubText('viewDetails', 'View details');
    action.lastChild.textContent = '→';
    if (typeof options.onCategorySelect === 'function') action.addEventListener('click', () => options.onCategorySelect(category, key));
    return action;
}

export function renderAchievementHubModule(category, options = {}) {
    const key = keyOf(category);
    const title = categoryTitle(category);
    const counts = countsFor(category);
    const module = document.createElement('article');
    module.className = 'achievement-hub-module';
    module.setAttribute('role', 'listitem');
    module.dataset.achievementCategory = key;
    module.dataset.progressKnown = String(counts.percent !== null);
    module.append(
        makeModuleHeading(category, title),
        makeModuleProgress(category, title, counts),
        makeModulePreview(category),
        makeModuleAction(category, key, options)
    );
    return module;
}

export function renderAchievementHub(container, categories, options = {}) {
    if (!container) return null;
    container.replaceChildren();
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

export { badgeInfo, countsFor, stateOf };
