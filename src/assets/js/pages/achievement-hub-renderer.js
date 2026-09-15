import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import { getLanguage, t } from '../i18n/i18n.js?v=20260914-achievement-polish-v1';
import { achievementChronicleLocales } from '../i18n/achievement-chronicle-locales.js?v=20260914-achievement-trophy-wall-v1';
import { stateForValue } from '../achievements/achievement-progress-semantics.js?v=20260914-achievement-reconciled-v1';
import { badgeInfo, countsFor, familiesOf, tiersOf } from './achievement-hub-state.js?v=20260914-achievement-reconciled-v1';

export { badgeInfo, countsFor };

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
    if (state === 'unknown') return generalText('achievements.waitingForData', 'Waiting for data');
    if (state === 'locked') return hubText('masteryLocked', 'Locked');
    if (state === 'in_progress' || state === 'progressing') return generalText('achievements.inProgress', 'In progress');
    if (state === 'complete') return generalText('achievements.completed', 'Complete');
    return achievementChronicleLocales[getLanguage()]?.['achievements.chronicle.unlocked']
        || achievementChronicleLocales.en?.['achievements.chronicle.unlocked'] || 'Unlocked';
}

export function achievementTierStateText(state) {
    return achievementStateText(state);
}

export function badgeTierText(state) {
    if (state === 'unknown') return achievementStateText('unknown');
    return state === 'unlocked' || state === 'complete'
        ? achievementStateText('unlocked') : hubText('masteryLocked', 'Locked');
}

export function achievementTierText(number) {
    return `${generalText('achievements.tiers', 'Tier')} ${number}`;
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
        hubText('categoryDetails', 'Collection details'));
}

function familyTitle(family) {
    return label(family?.title ?? family?.name, achievementLabel());
}

export function stateOf(value) {
    return stateForValue(value);
}

export function masteryStateOf(category) {
    const counts = countsFor(category);
    if (counts.percent === null) return 'unknown';
    if (counts.total > 0 && counts.percent >= 100) return 'unlocked';
    return counts.unlocked > 0 ? 'progressing' : 'locked';
}

export function masteryStateText(state) {
    const key = state === 'progressing' ? 'masteryProgressing'
        : state === 'unlocked' ? 'masteryUnlocked'
            : state === 'unknown' ? 'masteryUnknown' : 'masteryLocked';
    return hubText(key, state === 'progressing' ? 'In progress' : state === 'unlocked' ? 'Unlocked'
        : state === 'unknown' ? 'Waiting for data' : 'Locked');
}

function masteryLabel(category) {
    const badge = category?.badge ?? category?.badgeDefinition;
    return label(badge?.name ?? badge?.label ?? badge?.displayLabel,
        hubText('masteryReward', 'Mastery reward'));
}

export function familyProgress(family) {
    const tiers = tiersOf(family);
    const states = tiers.map(stateOf);
    const unknown = stateOf(family) === 'unknown' || states.includes('unknown');
    const unlocked = states.filter(state => state === 'complete' || state === 'unlocked').length;
    const total = tiers.length;
    const percent = !unknown && total ? Math.round((unlocked / total) * 100) : null;
    const state = unknown ? 'unknown' : unlocked === total ? 'complete'
        : unlocked || states.includes('in_progress') ? 'in_progress' : 'locked';
    return { total, unlocked, percent, state };
}

function progressText(progress) {
    if (progress.percent === null) return masteryStateText('unknown');
    return hubText('familyProgress', '{unlocked} / {total} achievements', progress);
}

function completionText(progress) {
    return progress.percent === null ? '' : hubText('completion', '{percent}% complete', { percent: progress.percent });
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

function makeMasteryMark(state) {
    const mark = document.createElement('span');
    mark.className = 'achievement-mastery-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = state === 'unlocked' ? '◆' : state === 'progressing' ? '◈' : state === 'unknown' ? '·' : '◇';
    return mark;
}

export function renderMasteryReward(category, { compact = false } = {}) {
    const state = masteryStateOf(category);
    const reward = document.createElement('div');
    reward.className = `achievement-mastery-reward${compact ? ' achievement-mastery-reward--compact' : ''}`;
    reward.dataset.state = state;
    reward.dataset.reward = 'mastery';
    reward.setAttribute('role', 'img');
    reward.setAttribute('aria-label', `${masteryLabel(category)} — ${masteryStateText(state)}`);
    const medal = document.createElement('span');
    medal.className = 'achievement-mastery-medal';
    medal.append(makeMasteryMark(state));
    const copy = document.createElement('span');
    copy.className = 'achievement-mastery-copy';
    copy.append(document.createElement('small'), document.createElement('strong'), document.createElement('span'));
    copy.firstChild.textContent = hubText('masteryReward', 'Mastery reward');
    copy.children[1].textContent = masteryLabel(category);
    copy.lastChild.textContent = masteryStateText(state);
    reward.append(medal, copy);
    return reward;
}

function makeProgress(category, title, counts) {
    const progress = document.createElement('div');
    progress.className = 'achievement-trophy-progress';
    const copy = document.createElement('div');
    copy.className = 'achievement-trophy-progress-copy';
    copy.append(document.createElement('strong'), document.createElement('span'));
    copy.firstChild.textContent = hubText('categoryProgress', '{unlocked} / {total} complete', counts);
    copy.lastChild.textContent = counts.percent === null ? masteryStateText('unknown')
        : hubText('completion', '{percent}% complete', { percent: Math.round(counts.percent) });
    const track = document.createElement('div');
    track.className = 'achievement-trophy-progress-track';
    track.dataset.known = String(counts.percent !== null);
    track.style.setProperty('--achievement-progress', `${counts.percent ?? 0}%`);
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-label', `${title} — ${hubText('progress', 'Progress')}`);
    if (counts.percent === null) track.setAttribute('aria-valuetext', masteryStateText('unknown'));
    else track.setAttribute('aria-valuenow', String(Math.round(counts.percent)));
    track.append(document.createElement('span'));
    progress.append(copy, track);
    return progress;
}

function makeCollectionCrest(category, title) {
    const crest = document.createElement('span');
    crest.className = 'achievement-trophy-panel-crest';
    crest.append(familyImage(category?.icon ?? category?.iconFamily ?? category, title));
    return crest;
}

function makeFamilyPreview(category) {
    const preview = document.createElement('div');
    preview.className = 'achievement-trophy-preview';
    preview.setAttribute('aria-label', hubText('collectionPreview', 'Collection preview'));
    familiesOf(category).slice(0, 5).forEach(family => {
        const item = document.createElement('span');
        item.className = 'achievement-trophy-preview-medal';
        item.dataset.state = stateOf(family);
        item.title = familyTitle(family);
        item.append(familyImage(family, familyTitle(family)));
        preview.append(item);
    });
    return preview;
}

export function renderAchievementHubModule(category, options = {}) {
    const key = keyOf(category);
    const title = categoryTitle(category);
    const counts = countsFor(category);
    const masteryState = masteryStateOf(category);
    const module = document.createElement('button');
    module.className = 'achievement-hub-module achievement-trophy-panel';
    module.type = 'button';
    module.dataset.achievementCategory = key;
    module.dataset.masteryState = masteryState;
    module.dataset.progressKnown = String(counts.percent !== null);
    module.setAttribute('aria-label', `${title} — ${hubText('viewDetails', 'View collection')}`);
    const heading = document.createElement('span');
    heading.className = 'achievement-trophy-panel-heading';
    heading.append(makeCollectionCrest(category, title));
    const copy = document.createElement('span');
    copy.className = 'achievement-trophy-panel-copy';
    copy.append(document.createElement('strong'), document.createElement('small'));
    copy.firstChild.textContent = title;
    copy.lastChild.textContent = label(category?.description, hubText('collectionDescription', 'A collection of earned milestones.'));
    heading.append(copy);
    module.append(heading, renderMasteryReward(category, { compact: true }), makeProgress(category, title, counts), makeFamilyPreview(category));
    if (typeof options.onCategorySelect === 'function') module.addEventListener('click', () => options.onCategorySelect(category, key));
    return module;
}

export function renderAchievementHub(container, categories, options = {}) {
    if (!container) return null;
    container.replaceChildren();
    container.classList.remove('achievement-category-detail', 'achievement-mastery-cabinet');
    container.classList.add('achievement-hub', 'achievement-trophy-wall');
    const list = Array.isArray(categories) ? categories : [];
    list.forEach(category => container.append(renderAchievementHubModule(category, options)));
    if (!list.length) {
        const empty = document.createElement('p');
        empty.className = 'achievement-hub-empty';
        empty.textContent = label(options.emptyMessage, hubText('noCategories', 'No collections are available yet.'));
        container.append(empty);
    }
    return container;
}
