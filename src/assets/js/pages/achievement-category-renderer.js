import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import {
    achievementLabel,
    achievementStateText,
    achievementTierStateText,
    achievementTierText,
    countsFor,
    familyProgress,
    hubText,
    masteryStateOf,
    masteryStateText,
    renderMasteryReward,
    stateOf
} from './achievement-hub-renderer.js?v=20260914-achievement-trophy-wall-v1';
import { tiersOf } from './achievement-hub-state.js?v=20260914-achievement-reconciled-v1';
const label = (value, fallback = '') => String(value ?? '').trim() || fallback;
function keyOf(category) {
    const value = category?.key ?? category?.categoryKey ?? category?.familyKey ?? category?.family_key
        ?? category?.id ?? category?.category;
    return label(value, 'other').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}
function titleOf(category) {
    return label(category?.title ?? category?.name ?? category?.label ?? category?.categoryLabel,
        hubText('categoryDetails', 'Collection details'));
}
function familyTitle(family) {
    return label(family?.title ?? family?.name, achievementLabel());
}

function thresholdOf(value) {
    return label(value?.thresholdText ?? value?.threshold_text ?? value?.target ?? value?.threshold, '—');
}

function progressCopy(value) {
    const state = stateOf(value);
    if (state === 'unknown') return masteryStateText('unknown');
    const progress = value?.progress ?? value?.currentProgress ?? value?.current_progress;
    const target = value?.target ?? value?.threshold;
    if (progress !== undefined && target !== undefined && Number.isFinite(Number(progress))) {
        return `${progress} / ${target}`;
    }
    return achievementStateText(state);
}

function medalState(tier, family) {
    const state = stateOf(tier);
    return state === 'locked' && stateOf(family) === 'unknown' ? 'unknown' : state;
}

function makeBackButton(options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'achievement-category-back';
    button.dataset.achievementBack = 'true';
    button.setAttribute('aria-label', label(options.backLabel, hubText('backToHub', 'Back to Trophy Wall')));
    button.append(document.createElement('span'), document.createElement('span'));
    button.firstChild.textContent = '←';
    button.lastChild.textContent = label(options.backLabel, hubText('backToHub', 'Back to Trophy Wall'));
    if (typeof options.onBack === 'function') button.addEventListener('click', options.onBack);
    return button;
}

function makeCategorySummary(category) {
    const counts = countsFor(category);
    const summary = document.createElement('div');
    summary.className = 'achievement-category-summary';
    summary.append(document.createElement('strong'), document.createElement('span'));
    summary.firstChild.textContent = counts.percent === null
        ? masteryStateText('unknown') : hubText('categoryProgress', '{unlocked} / {total} complete', counts);
    summary.lastChild.textContent = counts.percent === null
        ? '' : hubText('completion', '{percent}% complete', { percent: Math.round(counts.percent) });
    return summary;
}

function makeCategoryHeader(category, options) {
    const title = titleOf(category);
    const header = document.createElement('header');
    header.className = 'achievement-category-header';
    header.append(makeBackButton(options));
    const heading = document.createElement('div');
    heading.className = 'achievement-category-title';
    const crest = document.createElement('span');
    crest.className = 'achievement-category-icon achievement-category-crest';
    crest.append(achievementFamilyImage(category?.iconFamily ? { familyKey: category.iconFamily } : category, title));
    const copy = document.createElement('div');
    copy.append(document.createElement('p'), document.createElement('h1'));
    copy.firstChild.textContent = label(category?.eyebrow, hubText('masteryCabinet', 'Mastery Cabinet'));
    copy.lastChild.textContent = title;
    heading.append(crest, copy);
    const reward = renderMasteryReward(category);
    reward.classList.add('achievement-category-badge', 'achievement-badge');
    header.append(heading, makeCategorySummary(category), reward);
    header.dataset.masteryState = masteryStateOf(category);
    return header;
}

function makeTooltip(tier, family, id) {
    const tooltip = document.createElement('aside');
    tooltip.className = 'achievement-medal-tooltip';
    tooltip.id = id;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h4');
    title.textContent = label(tier?.title, achievementTierText(tier?.tier ?? 1));
    const description = document.createElement('p');
    description.textContent = label(tier?.description, family?.description);
    const details = document.createElement('dl');
    const row = (name, value) => {
        const item = document.createElement('div');
        item.append(document.createElement('dt'), document.createElement('dd'));
        item.firstChild.textContent = name;
        item.lastChild.textContent = value;
        return item;
    };
    details.append(row(hubText('progress', 'Progress'), progressCopy(tier)));
    tooltip.append(title, description, details);
    return tooltip;
}

function closeTooltip(item) {
    item.classList.remove('is-open');
    const button = item.querySelector('button');
    const tooltip = item.querySelector('[role="tooltip"]');
    button?.setAttribute('aria-expanded', 'false');
    tooltip?.setAttribute('aria-hidden', 'true');
}

function bindTooltip(item, scope) {
    const button = item.querySelector('button');
    const tooltip = item.querySelector('[role="tooltip"]');
    if (!button || !tooltip) return;
    button.addEventListener('click', () => {
        const open = item.classList.contains('is-open');
        scope.querySelectorAll('.achievement-medal-item.is-open').forEach(closeTooltip);
        if (!open) {
            item.classList.add('is-open');
            button.setAttribute('aria-expanded', 'true');
            tooltip.setAttribute('aria-hidden', 'false');
        }
    });
    button.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        closeTooltip(item);
        button.focus({ preventScroll: true });
    });
}

function makeMedal(tier, family, index, options, scope, familyIndex) {
    const state = medalState(tier, family);
    const item = document.createElement('li');
    item.className = 'achievement-medal-item';
    item.dataset.state = state;
    item.dataset.tier = String(tier?.tier ?? index + 1);
    item.dataset.sourceAvailable = String(tier?.sourceAvailable !== false
        && tier?.source_available !== false && tier?.progressKnown !== false && tier?.progress_known !== false);
    const tooltipId = `achievement-medal-tip-${keyOf(family)}-${familyIndex}-${index}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'achievement-medal';
    button.dataset.achievementSelect = 'true';
    button.setAttribute('aria-controls', tooltipId);
    button.setAttribute('aria-describedby', tooltipId);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', `${familyTitle(family)} — ${label(tier?.tierLabel, achievementTierText(tier?.tier ?? index + 1))}. ${achievementTierStateText(state)}. ${progressCopy(tier)}.`);
    const emblem = document.createElement('span');
    emblem.className = 'achievement-medal-emblem';
    emblem.append(achievementFamilyImage(tier, familyTitle(family)));
    const copy = document.createElement('span');
    copy.className = 'achievement-medal-copy';
    copy.append(document.createElement('strong'), document.createElement('small'));
    copy.firstChild.textContent = label(tier?.tierLabel, achievementTierText(tier?.tier ?? index + 1));
    copy.lastChild.textContent = state === 'unknown' ? masteryStateText('unknown') : thresholdOf(tier);
    button.append(emblem, copy);
    if (typeof options.onAchievementSelect === 'function') {
        button.addEventListener('click', () => options.onAchievementSelect(tier, family));
    }
    item.append(button, makeTooltip(tier, family, tooltipId));
    bindTooltip(item, scope);
    return item;
}

function makeFamilyHeading(family) {
    const heading = document.createElement('header');
    heading.className = 'achievement-family-heading';
    const title = document.createElement('h3');
    title.textContent = familyTitle(family);
    const description = document.createElement('p');
    description.textContent = label(family?.description);
    const progress = familyProgress(family);
    const count = document.createElement('strong');
    count.textContent = progressText(progress);
    const percent = document.createElement('span');
    percent.textContent = completionText(progress);
    heading.append(title, description, document.createElement('div'));
    heading.lastChild.className = 'achievement-family-progress';
    heading.lastChild.append(count, percent);
    return heading;
}

function progressText(progress) {
    return progress.percent === null ? masteryStateText('unknown')
        : hubText('familyProgress', '{unlocked} / {total} achievements', progress);
}

function completionText(progress) {
    return progress.percent === null ? '' : hubText('completion', '{percent}% complete', { percent: progress.percent });
}

function makeProgressionFamily(family, index, options, scope) {
    const article = document.createElement('article');
    article.className = 'achievement-family-showcase';
    article.dataset.structure = 'progression';
    article.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, `family-${index}`);
    article.dataset.state = familyProgress(family).state;
    article.setAttribute('role', 'listitem');
    article.append(makeFamilyHeading(family));
    const medals = document.createElement('ol');
    medals.className = 'achievement-medal-rail';
    medals.setAttribute('role', 'list');
    const tiers = tiersOf(family);
    tiers.forEach((tier, tierIndex) => {
        const item = makeMedal(tier, family, tierIndex, options, scope, index);
        medals.append(item);
        if (tierIndex < tiers.length - 1) {
            const connector = document.createElement('li');
            connector.className = 'achievement-medal-connector';
            connector.dataset.state = stateOf(tiers[tierIndex + 1]);
            connector.setAttribute('aria-hidden', 'true');
            medals.append(connector);
        }
    });
    article.append(medals);
    return article;
}

function makeStandaloneFamily(family, familyIndex, options, scope) {
    const article = document.createElement('article');
    article.className = 'achievement-family-group';
    article.dataset.structure = 'standalone';
    article.dataset.family = label(family?.familyKey ?? family?.key ?? family?.id, `family-${familyIndex}`);
    article.dataset.state = familyProgress(family).state;
    article.append(makeFamilyHeading(family));
    const medals = document.createElement('ol');
    medals.className = 'achievement-medal-grid';
    medals.setAttribute('role', 'list');
    tiersOf(family).forEach((tier, tierIndex) => medals.append(
        makeMedal(tier, family, tierIndex, options, scope, familyIndex)
    ));
    article.append(medals);
    return article;
}

function makeShowcase(category, options) {
    const section = document.createElement('section');
    section.className = 'achievement-category-showcase';
    section.setAttribute('aria-labelledby', 'achievement-sets-title');
    const heading = document.createElement('header');
    heading.append(document.createElement('h2'), document.createElement('p'));
    heading.firstChild.id = 'achievement-sets-title';
    heading.firstChild.textContent = hubText('setsTitle', 'Achievement sets');
    heading.lastChild.textContent = hubText('setsIntro', 'Collectible medals grouped by real achievement families.');
    const list = document.createElement('div');
    list.className = 'achievement-family-showcase-list';
    list.setAttribute('role', 'list');
    const progression = Array.isArray(category?.progressionFamilies) ? category.progressionFamilies : [];
    const standalone = Array.isArray(category?.standaloneFamilies) ? category.standaloneFamilies : [];
    progression.forEach((family, index) => list.append(makeProgressionFamily(family, index, options, list)));
    if (standalone.length) {
        const standaloneSection = document.createElement('section');
        standaloneSection.className = 'achievement-standalone-showcase';
        standaloneSection.dataset.structure = 'standalone';
        standaloneSection.setAttribute('aria-labelledby', 'achievement-standalone-title');
        const title = document.createElement('h3');
        title.id = 'achievement-standalone-title';
        title.textContent = hubText('standalone', 'Independent challenges');
        const intro = document.createElement('p');
        intro.textContent = hubText('standaloneIntro', 'Individual collectible achievements with no validated progression chain.');
        standaloneSection.append(title, intro);
        const groups = document.createElement('div');
        groups.className = 'achievement-standalone-groups';
        standalone.forEach((family, index) => groups.append(makeStandaloneFamily(family, index, options, list)));
        standaloneSection.append(groups);
        list.append(standaloneSection);
    }
    if (!list.childElementCount) {
        const empty = document.createElement('p');
        empty.className = 'achievement-category-empty';
        empty.textContent = hubText('detailEmpty', 'This collection has no achievements to show yet.');
        list.append(empty);
    }
    section.append(heading, list);
    return section;
}

export function renderAchievementCategory(container, category, options = {}) {
    if (!container) return null;
    container.replaceChildren();
    container.classList.remove('achievement-hub');
    container.classList.add('achievement-category-detail', 'achievement-mastery-cabinet');
    container.dataset.achievementCategory = keyOf(category);
    container.append(makeCategoryHeader(category || {}, options), makeShowcase(category || {}, options));
    return container;
}

export const renderAchievementCategoryDetail = renderAchievementCategory;
