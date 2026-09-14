import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import {
    achievementLabel,
    achievementStateText,
    achievementTierStateText,
    achievementTierText,
    badgeInfo,
    badgeTierText,
    countsFor,
    hubText,
    stateOf
} from './achievement-hub-renderer.js?v=20260914-achievement-chronicle-v2';
import {
    applyNodePosition,
    bindAchievementTooltip,
    chronicleClusterGeometry,
    progressionSvg
} from './achievement-map-geometry.js?v=20260914-achievement-chronicle-v2';
import { progressRatioOf } from '../achievements/achievement-progress-semantics.js?v=20260914-achievement-reconciled-v1';
const label = (value, fallback = '') => String(value ?? '').trim() || fallback;
function keyOf(category) {
    const value = category?.key ?? category?.categoryKey ?? category?.familyKey ?? category?.family_key ?? category?.id ?? category?.category;
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
    const sharedRatio = progressRatioOf(value);
    if (sharedRatio !== null) return sharedRatio;
    const state = stateOf(value);
    return state === 'complete' || state === 'unlocked' ? 1 : null;
}
function thresholdOf(value) {
    return label(value?.thresholdText ?? value?.threshold ?? value?.target, '—');
}
function progressCopy(value) {
    const ratio = progressRatio(value);
    if (ratio === null || stateOf(value) === 'unknown') return hubText('progressUnavailable', 'Progress unavailable');
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
    element.dataset.reward = 'final';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', `${hubText('categoryReward', 'Completion reward')}: ${badge.label}. ${badgeTierText(badge.tier)}.`);
    const mark = document.createElement('span');
    mark.className = 'achievement-badge-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = badge.state === 'unlocked' ? '◆' : '◇';
    const copy = document.createElement('span');
    copy.className = 'achievement-badge-copy';
    copy.append(document.createElement('span'), document.createElement('strong'), document.createElement('small'));
    copy.firstChild.className = 'achievement-badge-kicker';
    copy.firstChild.textContent = hubText('categoryReward', 'Completion reward');
    copy.children[1].textContent = badge.label;
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
        ? achievementStateText('unknown') : hubText('categoryProgress', '{unlocked} / {total} complete', counts);
    summary.lastChild.textContent = counts.percent === null
        ? hubText('progressUnavailable', 'Progress unavailable')
        : hubText('completion', '{percent}% complete', { percent: Math.round(counts.percent) });
    header.append(heading, summary, makeBadge(category));
    return header;
}
function makeTooltip(tier, family, id, value) {
    const tooltip = document.createElement('aside');
    tooltip.className = 'achievement-map-tooltip';
    tooltip.id = id;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h4');
    const tierTitle = label(tier?.title);
    title.textContent = tierTitle && tierTitle !== familyTitle(family)
        ? tierTitle : achievementTierText(tier?.tier ?? 1);
    const description = document.createElement('p');
    description.textContent = label(tier?.description, family?.description);
    const details = document.createElement('dl');
    const row = (name, detail) => {
        const item = document.createElement('div');
        item.append(document.createElement('dt'), document.createElement('dd'));
        item.firstChild.textContent = name;
        item.lastChild.textContent = detail;
        return item;
    };
    details.append(row(hubText('progress', 'Progress'), progressCopy(value)));
    tooltip.append(title, description, details);
    return tooltip;
}
function nodeState(tier, family) {
    const tierState = stateOf(tier);
    return tierState === 'locked' && stateOf(family) === 'unknown' ? 'unknown' : tierState;
}
function makeNodeButton(tier, family, state, value, tierLabel, threshold, options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'achievement-progression-node achievement-map-node-button';
    button.setAttribute('aria-controls', value.tooltipId);
    button.setAttribute('aria-describedby', value.tooltipId);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `${familyTitle(family)} — ${tierLabel}. ${achievementTierStateText(state)}. ${progressCopy(value)}.`);
    const emblem = document.createElement('span');
    emblem.className = 'achievement-map-node-emblem';
    emblem.append(achievementFamilyImage(tier, familyTitle(family)));
    const copy = document.createElement('span');
    copy.className = 'achievement-progression-tier-copy';
    copy.append(document.createElement('strong'), document.createElement('span'));
    copy.firstChild.textContent = tierLabel;
    copy.lastChild.className = 'achievement-progression-tier-target';
    copy.children[1].textContent = threshold;
    button.append(emblem, copy);
    if (typeof options.onAchievementSelect === 'function') {
        button.addEventListener('click', () => options.onAchievementSelect(tier, family));
    }
    return button;
}
function makeTierStop(tier, index, family, options, scope, geometry, standalone = false) {
    const state = nodeState(tier, family);
    const value = state === 'unknown'
        ? { ...tier, state: 'unknown', sourceAvailable: false, progressKnown: false } : tier;
    const item = document.createElement('li');
    item.className = `${standalone ? 'achievement-map-standalone-node' : 'achievement-progression-tier'} achievement-map-node achievement-map-stop`;
    item.dataset.state = state;
    item.dataset.tier = String(tier?.tier ?? index + 1);
    item.dataset.sourceAvailable = String(value?.sourceAvailable !== false
        && value?.source_available !== false && value?.progressKnown !== false && value?.progress_known !== false);
    if (geometry) {
        applyNodePosition(item, geometry.positions[index], index);
        if (index === 0) item.dataset.edge = 'start';
        if (index === geometry.positions.length - 1) item.dataset.edge = 'end';
    }
    const tooltipId = `achievement-map-tip-${keyOf(family)}-${index}`;
    const button = makeNodeButton(tier, family, state, { ...value, tooltipId },
        label(tier?.tierLabel, achievementTierText(tier?.tier ?? index + 1)), thresholdOf(tier), options);
    item.append(button, makeTooltip(tier, family, tooltipId, value));
    bindAchievementTooltip(item, scope);
    return item;
}
function makeTrackHeading(family) {
    const heading = document.createElement('header');
    heading.className = 'achievement-map-track-heading';
    const title = document.createElement('h3');
    title.textContent = familyTitle(family);
    heading.append(title);
    const description = label(family?.description);
    if (description) {
        const copy = document.createElement('p');
        copy.textContent = description;
        heading.append(copy);
    }
    return heading;
}
function makeProgressionFamily(family, index, options) {
    const article = document.createElement('article');
    article.className = 'achievement-progression-path achievement-map-track-shell';
    article.setAttribute('role', 'listitem');
    article.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, 'achievement');
    article.dataset.structure = 'progression';
    article.dataset.arrangement = ['ribbon', 'drift', 'wave'][index % 3];
    const tiers = tiersOf(family);
    const geometry = chronicleClusterGeometry(tiers.length, index);
    const map = document.createElement('div');
    map.className = 'achievement-map-scroll';
    const canvas = document.createElement('ol');
    canvas.className = 'achievement-map-track achievement-progression-track';
    canvas.setAttribute('role', 'list');
    canvas.style.setProperty('--chronicle-map-width', `${geometry.width}px`);
    canvas.style.setProperty('--chronicle-map-height', `${geometry.height}px`);
    canvas.append(progressionSvg(geometry, tiers, tier => nodeState(tier, family)));
    tiers.forEach((tier, tierIndex) => {
        const stop = makeTierStop(tier, tierIndex, family, options, canvas, geometry);
        if (tierIndex < tiers.length - 1) stop.dataset.nextState = nodeState(tiers[tierIndex + 1], family);
        canvas.append(stop);
    });
    map.append(canvas);
    article.append(makeTrackHeading(family), map);
    return article;
}
function standaloneState(families) {
    const states = families.map(stateOf);
    if (states.includes('unknown')) return 'unknown';
    if (states.includes('in_progress')) return 'in_progress';
    if (states.length && states.every(state => state === 'complete' || state === 'unlocked')) return 'complete';
    return 'locked';
}
function makeStandaloneConstellation(families, options) {
    const section = document.createElement('section');
    section.className = 'achievement-standalone-challenge achievement-map-constellation';
    section.setAttribute('role', 'listitem');
    section.dataset.state = standaloneState(families);
    section.dataset.structure = 'standalone';
    section.append(makeTrackHeading({
        title: hubText('standaloneTitle', 'Independent challenges'),
        description: hubText('standaloneIntro', 'Achievements without a validated progression chain.')
    }));
    const groups = document.createElement('ol');
    groups.className = 'achievement-standalone-nodes';
    groups.setAttribute('role', 'list');
    families.forEach((family, familyIndex) => {
        const group = document.createElement('li');
        group.className = 'achievement-standalone-family';
        group.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, `achievement-${familyIndex}`);
        group.append(makeTrackHeading(family));
        const nodes = document.createElement('ol');
        nodes.className = 'achievement-standalone-family-nodes';
        nodes.setAttribute('role', 'list');
        tiersOf(family).forEach((tier, tierIndex) => nodes.append(
            makeTierStop(tier, tierIndex, family, options, section, null, true)
        ));
        group.append(nodes);
        groups.append(group);
    });
    section.append(groups);
    return section;
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
    if (standalone.length) map.append(makeStandaloneConstellation(standalone, options));
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
