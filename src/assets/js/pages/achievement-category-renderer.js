import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import {
    achievementLabel,
    achievementStateText,
    achievementTierText,
    badgeInfo,
    badgeTierText,
    countsFor,
    hubText,
    stateOf
} from './achievement-hub-renderer.js?v=20260914-achievement-collection-v2';

function label(value, fallback = '') {
    const result = String(value ?? '').trim();
    return result || fallback;
}

function keyOf(category) {
    const value = category?.key ?? category?.categoryKey ?? category?.id ?? category?.category;
    return label(value, 'other').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function titleOf(category) {
    return label(category?.title ?? category?.name ?? category?.label ?? category?.categoryLabel,
        hubText('categoryDetails', 'Category details'));
}

function familyTitle(family) { return label(family?.title ?? family?.name, achievementLabel()); }

function tiersOf(family) {
    return Array.isArray(family?.tiers) && family.tiers.length ? family.tiers : [family];
}

function progressRatio(value) {
    if (value?.progressKnown === false || value?.sourceAvailable === false) return null;
    const explicit = Number(value?.progressRatio ?? value?.ratio);
    if (Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit <= 1 ? explicit : explicit / 100));
    const progress = Number(value?.progress ?? value?.currentProgress);
    const target = Number(value?.target ?? value?.threshold);
    return Number.isFinite(progress) && Number.isFinite(target) && target > 0
        ? Math.max(0, Math.min(1, progress / target))
        : stateOf(value) === 'complete' || stateOf(value) === 'unlocked' ? 1 : 0;
}

function thresholdOf(value) {
    return label(value?.thresholdText ?? value?.threshold ?? value?.target, '—');
}

function progressCopy(value) {
    const state = stateOf(value);
    if (state === 'unknown') return hubText('progressUnavailable', 'Progress unavailable');
    const ratio = progressRatio(value);
    if (ratio === null) return hubText('progressUnavailable', 'Progress unavailable');
    const progress = value?.progress ?? value?.currentProgress;
    const target = value?.target ?? value?.threshold;
    if (progress !== undefined && target !== undefined && Number.isFinite(Number(progress))) {
        return `${progress} / ${target}`;
    }
    return hubText('completion', '{percent}% complete', { percent: Math.round(ratio * 100) });
}

function makeBadge(category) {
    const badge = badgeInfo(category);
    const element = document.createElement('div');
    element.className = 'achievement-category-badge achievement-badge';
    element.dataset.state = badge.state;
    element.dataset.tier = badge.tier;
    element.setAttribute('aria-label', `${badge.label}: ${badgeTierText(badge.tier)}`);
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

function makeBackButton(category, options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'achievement-category-back';
    button.dataset.achievementBack = 'true';
    button.setAttribute('aria-label', hubText('backToHub', 'Back to Achievement Hub'));
    button.append(document.createElement('span'), document.createElement('span'));
    button.firstChild.textContent = '←';
    button.lastChild.textContent = label(options.backLabel, hubText('backToHub', 'Back to Achievement Hub'));
    if (typeof options.onBack === 'function') button.addEventListener('click', () => options.onBack(category));
    return button;
}

function makeCategoryHeader(category, options) {
    const title = titleOf(category);
    const counts = countsFor(category);
    const header = document.createElement('header');
    header.className = 'achievement-category-header';
    header.append(makeBackButton(category, options));
    const heading = document.createElement('div');
    heading.className = 'achievement-category-title';
    const crest = document.createElement('span');
    crest.className = 'achievement-category-icon achievement-category-crest';
    crest.append(achievementFamilyImage(category.iconFamily || category, title));
    const copy = document.createElement('div');
    copy.append(document.createElement('p'), document.createElement('h1'));
    copy.firstChild.textContent = label(category?.eyebrow, hubText('categoryDetails', 'Category details'));
    copy.lastChild.textContent = title;
    heading.append(crest, copy);
    const summary = document.createElement('div');
    summary.className = 'achievement-category-summary';
    summary.append(document.createElement('strong'), document.createElement('span'));
    summary.firstChild.textContent = counts.percent === null
        ? hubText('progressUnavailable', 'Progress unavailable')
        : hubText('categoryProgress', '{unlocked} / {total} complete', counts);
    summary.lastChild.textContent = counts.percent === null
        ? hubText('progressUnavailable', 'Progress unavailable')
        : hubText('completion', '{percent}% complete', { percent: Math.round(counts.percent) });
    header.append(heading, summary, makeBadge(category));
    return header;
}

function bindNode(button, tier, family, options) {
    if (typeof options.onAchievementSelect !== 'function') return;
    button.addEventListener('click', () => options.onAchievementSelect(tier, family));
}

function makeNodeButton(tier, family, state, value, tierLabel, threshold, options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'achievement-progression-node achievement-map-node-button';
    button.setAttribute('aria-label', `${familyTitle(family)} — ${tierLabel}. ${achievementStateText(state)}. ${progressCopy(value)}.`);
    const emblem = document.createElement('span');
    emblem.className = 'achievement-map-node-emblem';
    emblem.append(achievementFamilyImage(tier, familyTitle(family)));
    const copy = document.createElement('span');
    copy.className = 'achievement-progression-tier-copy';
    copy.append(document.createElement('strong'), document.createElement('span'), document.createElement('small'));
    copy.firstChild.textContent = tierLabel;
    copy.children[1].textContent = threshold;
    copy.lastChild.textContent = `${achievementStateText(state)} · ${progressCopy(value)}`;
    button.append(emblem, copy);
    bindNode(button, tier, family, options);
    return button;
}

function makeTierNode(tier, index, total, family, options, standalone = false) {
    const tierState = stateOf(tier);
    const state = tierState === 'locked' && stateOf(family) === 'unknown' ? 'unknown' : tierState;
    const value = state === 'unknown' && tierState !== 'unknown'
        ? { ...tier, state: 'unknown', sourceAvailable: false, progressKnown: false }
        : tier;
    const tierLabel = label(tier?.tierLabel, achievementTierText(tier?.tier ?? index + 1));
    const threshold = thresholdOf(tier);
    const item = document.createElement('li');
    item.className = standalone
        ? 'achievement-map-node achievement-map-standalone-node'
        : 'achievement-progression-tier achievement-map-node';
    item.dataset.state = state;
    item.dataset.tier = String(tier?.tier ?? index + 1);
    item.dataset.sourceAvailable = String(value?.sourceAvailable !== false && value?.progressKnown !== false);
    item.append(makeNodeButton(tier, family, state, value, tierLabel, threshold, options));
    if (index < total - 1) {
        const connector = document.createElement('i');
        connector.className = 'achievement-progression-connector achievement-map-path';
        connector.setAttribute('aria-hidden', 'true');
        item.append(connector);
    }
    return item;
}

function makeTrackHeader(family) {
    const heading = document.createElement('header');
    heading.className = 'achievement-map-track-heading';
    heading.append(document.createElement('div'), document.createElement('p'));
    heading.firstChild.append(document.createElement('h3'));
    heading.firstChild.firstChild.textContent = familyTitle(family);
    heading.lastChild.textContent = label(family?.description, '');
    if (!heading.lastChild.textContent) heading.removeChild(heading.lastChild);
    return heading;
}

function makeProgressionFamily(family, index, options) {
    const article = document.createElement('article');
    const layout = label(family?.orientation ?? family?.layout, index % 2 ? 'vertical' : 'horizontal');
    article.className = 'achievement-progression-path achievement-map-track-shell';
    article.setAttribute('role', 'listitem');
    article.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, 'achievement');
    article.dataset.layout = layout === 'vertical' ? 'vertical' : 'horizontal';
    const track = document.createElement('ol');
    track.className = 'achievement-progression-track achievement-map-track';
    track.setAttribute('role', 'list');
    const tiers = tiersOf(family);
    tiers.forEach((tier, tierIndex) => track.append(makeTierNode(tier, tierIndex, tiers.length, family, options)));
    article.append(makeTrackHeader(family), track);
    return article;
}

function makeStandaloneFamily(family, index, options) {
    const article = document.createElement('article');
    const state = stateOf(family);
    const tier = tiersOf(family)[0] || family;
    article.className = 'achievement-standalone-challenge achievement-map-constellation';
    article.setAttribute('role', 'listitem');
    article.dataset.state = state;
    article.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, `achievement-${index}`);
    article.append(makeTrackHeader(family));
    article.append(makeTierNode(tier, 0, 1, family, options, true));
    return article;
}

function makeMap(category, options) {
    const section = document.createElement('section');
    section.className = 'achievement-category-section achievement-category-map';
    section.setAttribute('aria-labelledby', 'achievement-map-title');
    const heading = document.createElement('header');
    heading.append(document.createElement('h2'), document.createElement('p'));
    heading.firstChild.id = 'achievement-map-title';
    heading.firstChild.textContent = hubText('mapTitle', 'Achievement map');
    heading.lastChild.textContent = hubText('mapIntro', 'Earned paths and independent challenges in one journey.');
    const map = document.createElement('div');
    map.className = 'achievement-map-layer';
    map.setAttribute('role', 'list');
    map.setAttribute('aria-label', heading.firstChild.textContent);
    const progression = Array.isArray(category?.progressionFamilies) ? category.progressionFamilies : [];
    const standalone = Array.isArray(category?.standaloneFamilies) ? category.standaloneFamilies : [];
    progression.forEach((family, index) => map.append(makeProgressionFamily(family, index, options)));
    standalone.forEach((family, index) => map.append(makeStandaloneFamily(family, index, options)));
    if (!map.childElementCount) map.append(emptySection(hubText('detailEmpty', 'This category has no achievements to show yet.')));
    section.append(heading, map);
    return section;
}

function emptySection(message) {
    const empty = document.createElement('p');
    empty.className = 'achievement-category-empty';
    empty.textContent = message;
    return empty;
}

export function renderAchievementCategory(container, category, options = {}) {
    if (!container) return null;
    container.replaceChildren();
    container.classList.remove('achievement-hub');
    container.classList.add('achievement-category-detail');
    container.dataset.achievementCategory = keyOf(category);
    container.append(makeCategoryHeader(category || {}, options), makeMap(category || {}, options));
    return container;
}

export const renderAchievementCategoryDetail = renderAchievementCategory;
