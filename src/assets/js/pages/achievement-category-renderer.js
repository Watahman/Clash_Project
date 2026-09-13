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
} from './achievement-hub-renderer.js';

function label(value, fallback = '') {
    const result = String(value ?? '').trim();
    return result || fallback;
}

function keyOf(category) {
    const value = category?.key ?? category?.categoryKey ?? category?.id ?? category?.category;
    return label(value, 'other').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function titleOf(category) {
    return label(category?.title ?? category?.name ?? category?.label ?? category?.categoryLabel, hubText('categoryDetails', 'Category details'));
}

function familyTitle(family) { return label(family?.title ?? family?.name, achievementLabel()); }

function tiersOf(family) {
    if (Array.isArray(family?.tiers) && family.tiers.length) return family.tiers;
    return [family];
}

function statusLabel(state) {
    return achievementStateText(state);
}

function progressRatio(value) {
    if (value?.progressKnown === false || value?.sourceAvailable === false) return null;
    const explicit = Number(value?.progressRatio ?? value?.ratio);
    if (Number.isFinite(explicit)) return Math.max(0, Math.min(1, explicit <= 1 ? explicit : explicit / 100));
    const progress = Number(value?.progress);
    const target = Number(value?.target ?? value?.threshold);
    return Number.isFinite(progress) && Number.isFinite(target) && target > 0
        ? Math.max(0, Math.min(1, progress / target))
        : stateOf(value) === 'complete' || stateOf(value) === 'unlocked' ? 1 : 0;
}

function progressCopy(value) {
    const state = stateOf(value);
    if (state === 'unknown') return hubText('unknownProgress', 'Waiting for data');
    const ratio = progressRatio(value);
    if (ratio === null) return hubText('unknownProgress', 'Waiting for data');
    const progress = value?.progress ?? value?.currentProgress;
    const target = value?.target ?? value?.threshold;
    if (progress !== undefined && target !== undefined && Number.isFinite(Number(progress)) && Number.isFinite(Number(target))) {
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
    const icon = document.createElement('span');
    icon.className = 'achievement-category-icon';
    icon.append(achievementFamilyImage(category.iconFamily || category, title));
    const copy = document.createElement('div');
    copy.append(document.createElement('p'), document.createElement('h1'));
    copy.firstChild.textContent = label(category?.eyebrow, hubText('categoryDetails', 'Category details'));
    copy.lastChild.textContent = title;
    heading.append(icon, copy);
    const summary = document.createElement('div');
    summary.className = 'achievement-category-summary';
    summary.append(document.createElement('strong'), document.createElement('span'));
    summary.firstChild.textContent = counts.percent === null
        ? hubText('unknownProgress', 'Waiting for data')
        : hubText('categoryProgress', '{unlocked} / {total} complete', { unlocked: counts.unlocked, total: counts.total });
    summary.lastChild.textContent = counts.percent === null
        ? hubText('unknownProgress', 'Waiting for data')
        : hubText('completion', '{percent}% complete', { percent: Math.round(counts.percent) });
    header.append(heading, summary, makeBadge(category));
    return header;
}

function makeTierNode(tier, index, total, family, options) {
    const state = stateOf(tier);
    const item = document.createElement('li');
    item.className = 'achievement-progression-tier';
    item.dataset.state = state;
    item.dataset.tier = String(tier?.tier ?? index + 1);
    item.setAttribute('role', 'listitem');
    const node = document.createElement('div');
    node.className = 'achievement-progression-node';
    node.append(achievementFamilyImage(tier, familyTitle(tier)));
    const copy = document.createElement('div');
    copy.className = 'achievement-progression-tier-copy';
    copy.append(document.createElement('strong'), document.createElement('span'), document.createElement('small'));
    copy.firstChild.textContent = label(tier?.tierLabel, achievementTierText(tier?.tier ?? index + 1));
    copy.children[1].textContent = familyTitle(tier);
    copy.lastChild.textContent = `${statusLabel(state)} · ${progressCopy(tier)}`;
    node.append(copy);
    item.append(node);
    if (index < total - 1) {
        const connector = document.createElement('i');
        connector.className = 'achievement-progression-connector';
        connector.setAttribute('aria-hidden', 'true');
        item.append(connector);
    }
    if (typeof options.onAchievementSelect === 'function') item.addEventListener('click', () => options.onAchievementSelect(tier, family));
    return item;
}

function makeProgressionFamily(family, options) {
    const article = document.createElement('article');
    article.className = 'achievement-progression-path';
    article.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, 'achievement');
    const heading = document.createElement('header');
    heading.append(achievementFamilyImage(family, familyTitle(family)), document.createElement('div'));
    heading.lastChild.append(document.createElement('h3'), document.createElement('p'));
    heading.lastChild.firstChild.textContent = familyTitle(family);
    heading.lastChild.lastChild.textContent = label(family?.description, hubText('detailIntro', 'Follow real progression chains and independent challenges in this category.'));
    const track = document.createElement('ol');
    track.className = 'achievement-progression-track';
    track.setAttribute('role', 'list');
    const tiers = tiersOf(family);
    tiers.forEach((tier, index) => track.append(makeTierNode(tier, index, tiers.length, family, options)));
    article.append(heading, track);
    return article;
}

function makeStandaloneFamily(family, options) {
    const state = stateOf(family);
    const article = document.createElement('article');
    article.className = 'achievement-standalone-challenge';
    article.dataset.state = state;
    article.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, 'achievement');
    article.append(achievementFamilyImage(family, familyTitle(family)), document.createElement('div'));
    article.lastChild.append(document.createElement('h3'), document.createElement('p'), document.createElement('small'));
    article.lastChild.firstChild.textContent = familyTitle(family);
    article.lastChild.children[1].textContent = label(family?.description, hubText('detailIntro', 'Follow real progression chains and independent challenges in this category.'));
    article.lastChild.lastChild.textContent = `${statusLabel(state)} · ${progressCopy(family)}`;
    if (typeof options.onAchievementSelect === 'function') article.addEventListener('click', () => options.onAchievementSelect(family, family));
    return article;
}

function makeSection(title, intro, className) {
    const section = document.createElement('section');
    section.className = `achievement-category-section ${className}`;
    section.append(document.createElement('header'));
    section.firstChild.append(document.createElement('h2'), document.createElement('p'));
    section.firstChild.firstChild.textContent = title;
    section.firstChild.lastChild.textContent = intro;
    return section;
}

function renderProgressionSection(category, options) {
    const section = makeSection(
        hubText('progression', 'Progression chains'),
        hubText('detailIntro', 'Follow real progression chains and independent challenges in this category.'),
        'achievement-category-progression'
    );
    const content = document.createElement('div');
    content.className = 'achievement-category-section-content';
    const families = Array.isArray(category?.progressionFamilies) ? category.progressionFamilies : [];
    families.forEach(family => content.append(makeProgressionFamily(family, options)));
    if (!families.length) content.append(emptySection(hubText('detailEmpty', 'This category has no achievements to show yet.')));
    section.append(content);
    return section;
}

function renderStandaloneSection(category, options) {
    const section = makeSection(
        hubText('standalone', 'Standalone achievements'),
        hubText('detailIntro', 'Follow real progression chains and independent challenges in this category.'),
        'achievement-category-standalone'
    );
    const content = document.createElement('div');
    content.className = 'achievement-category-section-content';
    const families = Array.isArray(category?.standaloneFamilies) ? category.standaloneFamilies : [];
    families.forEach(family => content.append(makeStandaloneFamily(family, options)));
    if (!families.length) content.append(emptySection(hubText('detailEmpty', 'This category has no achievements to show yet.')));
    section.append(content);
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
    container.classList.add('achievement-category-detail');
    container.dataset.achievementCategory = keyOf(category);
    container.append(
        makeCategoryHeader(category || {}, options),
        renderProgressionSection(category || {}, options),
        renderStandaloneSection(category || {}, options)
    );
    return container;
}

export const renderAchievementCategoryDetail = renderAchievementCategory;
