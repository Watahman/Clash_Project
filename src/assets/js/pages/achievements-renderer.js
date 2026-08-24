import { applyI18n, getLanguage, t } from '../i18n/i18n.js';
import {
    buildAchievementSummary,
    filterAchievementFamilies
} from '../achievements/achievement-view-model.js';
import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';

const SOURCE_ORDER = Object.freeze([
    'live_profile', 'base_data', 'base_history', 'advanced_stats', 'war', 'cwl_history', 'raid_history',
    'legend_history', 'clashking_history', 'clan_profile', 'clashpanel', 'clan_family', 'mixed'
]);
const SOURCE_FALLBACKS = Object.freeze({
    live_profile: 'Live profile', base_data: 'Base data', base_history: 'Snapshot history', advanced_stats: 'Advanced Stats', war: 'Regular war', cwl_history: 'CWL history',
    raid_history: 'Raid history', legend_history: 'Legend / Ranked history', clashking_history: 'ClashKing history', clan_profile: 'Clan profile',
    clashpanel: 'ClashPanel usage', clan_family: 'Clan Family', mixed: 'Combined sources'
});

function translated(key, fallback = key, params = {}) {
    const value = t(key, params);
    return value === key ? fallback : value;
}

function sourceLabel(source) { return translated(`achievements.source.${source}`, SOURCE_FALLBACKS[source] || source); }
function rarityLabel(rarity) { const value = String(rarity || 'common').toLowerCase(); return translated(`achievements.${value}`, value[0].toUpperCase() + value.slice(1)); }
function categoryLabel(state, category) {
    const exact = state.families.find(family => family.category === category)?.categoryLabel;
    const fallback = exact || category.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    return translated(`achievements.category.${category}`, fallback);
}
function number(value, fallback = '—') {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return fallback;
    return new Intl.NumberFormat(getLanguage()).format(Number(value));
}
function date(value, unixSeconds = false) {
    if (!value) return t('achievements.notImported');
    const result = new Date(unixSeconds ? Number(value) * 1000 : value);
    return Number.isNaN(result.getTime()) ? t('achievements.unknown') : new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(result);
}

export function renderAccountSelector(refs, state) {
    refs.accountSelect.replaceChildren();
    if (!state.accounts.length) {
        refs.accountSelect.append(new Option(t('achievements.noLinkedAccounts'), ''));
        refs.accountSelect.disabled = true;
        refs.refreshButton.disabled = true;
        refs.importToggle.disabled = true;
        return;
    }
    state.accounts.forEach(account => refs.accountSelect.append(new Option(accountLabel(account), account.tag)));
    state.selectedTag = state.accounts.some(account => account.tag === state.selectedTag) ? state.selectedTag : state.accounts[0].tag;
    refs.accountSelect.value = state.selectedTag;
    refs.accountSelect.disabled = state.loading || state.accounts.length < 2;
    refs.refreshButton.disabled = state.loading;
    refs.importToggle.disabled = false;
}

function accountLabel(account) {
    const name = account.name || t('achievements.accountFallback');
    const townHall = account.townHallLevel ? ` / TH${account.townHallLevel}` : '';
    return `${name}${townHall} / ${account.tag}`;
}

function localizeFamilies(state) {
    return state.families.map(family => {
        const title = translated(`achievements.family.${family.familyKey}.title`, family.title);
        const description = translated(`achievements.family.${family.familyKey}.description`, family.description);
        return { ...family, title, description, tiers: family.tiers.map(tier => ({ ...tier, title })) };
    });
}

export function renderSummary(refs, state) {
    refs.progressPanel.hidden = !state.accounts.length;
    const summary = buildAchievementSummary(state.families);
    const hasCatalog = state.families.length > 0;
    if (!hasCatalog) {
        refs.summaryLevel.textContent = '—';
        refs.summaryLevelCopy.textContent = translated('achievements.waitingForData', 'Waiting for data');
        refs.summaryXp.textContent = '—';
        refs.summaryUnlocked.textContent = '—';
        refs.summaryCompleted.textContent = '—';
        refs.summaryLevelProgress.dataset.known = 'false';
        refs.summaryLevelProgress.removeAttribute('aria-valuenow');
        refs.summaryLevelProgress.setAttribute('aria-valuetext', translated('achievements.waitingForData', 'Waiting for data'));
        refs.summaryLevelProgress.querySelector('span')?.style.setProperty('width', '0%');
        refs.summaryImported.textContent = state.latestSnapshot ? date(state.latestSnapshot.imported_at || state.latestSnapshot.source_timestamp, !state.latestSnapshot.imported_at) : t('achievements.notImported');
        renderFeatured(refs, state);
        return;
    }
    refs.summaryLevel.textContent = String(summary.level.level);
    const progress = Math.round(summary.level.progress * 100);
    refs.summaryLevelProgress.style.setProperty('--achievement-level-progress', `${progress}%`);
    refs.summaryLevelProgress.setAttribute('aria-valuenow', String(progress));
    refs.summaryLevelProgress.dataset.known = 'true';
    refs.summaryLevelProgress.removeAttribute('aria-valuetext');
    refs.summaryLevelProgress.querySelector('span')?.style.setProperty('width', `${progress}%`);
    refs.summaryLevelCopy.textContent = t('achievements.levelProgress', {
        current: number(summary.totalXp - summary.level.floorXp), total: number(summary.level.nextXp - summary.level.floorXp), level: summary.level.level + 1
    });
    refs.summaryXp.textContent = number(summary.totalXp);
    refs.summaryUnlocked.textContent = `${number(summary.unlockedTierCount)}/${number(summary.totalTierCount)}`;
    refs.summaryCompleted.textContent = `${number(summary.completedFamilies)}/${number(summary.familyCount)}`;
    refs.summaryImported.textContent = state.latestSnapshot
        ? date(state.latestSnapshot.imported_at || state.latestSnapshot.source_timestamp, !state.latestSnapshot.imported_at)
        : t('achievements.notImported');
    renderFeatured(refs, state);
}

function renderFeatured(refs, state) {
    const candidates = localizeFamilies(state).filter(family => family.sourceAvailable && !family.complete && family.currentTier?.target > 0)
        .sort((left, right) => right.progressRatio - left.progressRatio || left.title.localeCompare(right.title, getLanguage())).slice(0, 3);
    refs.featured.replaceChildren();
    if (!candidates.length) { refs.featured.hidden = true; return; }
    refs.featured.hidden = false;
    const title = document.createElement('strong');
    title.textContent = t('achievements.inProgress');
    refs.featured.append(title);
    candidates.forEach(family => {
        const item = document.createElement('span');
        item.append(achievementFamilyImage(family, categoryLabel(state, family.category)), document.createTextNode(family.title));
        item.title = `${number(family.currentTier.progress)} / ${family.currentTier.thresholdText || number(family.currentTier.target)}`;
        refs.featured.append(item);
    });
}

export function renderSources(refs, state) {
    refs.sourceList.replaceChildren();
    const summary = buildAchievementSummary(state.families);
    refs.sourceSummary.textContent = state.accounts.length && state.families.length
        ? translated('achievements.availableNow', `${summary.availableFamilies}/${summary.familyCount} measurable now`, { available: summary.availableFamilies, total: summary.familyCount })
        : state.accounts.length ? translated('achievements.waitingForData', 'Waiting for data')
        : translated('achievements.linkForSources', 'Link an account to activate sources');
    SOURCE_ORDER.forEach(source => {
        const info = state.sources?.[source] || {};
        const waiting = state.accounts.length > 0 && state.families.length === 0;
        const item = document.createElement('article');
        item.className = 'achievement-source-item';
        item.dataset.available = String(info.available === true);
        item.dataset.loading = String(waiting || source === 'cwl_history' && state.deepLoading);
        const dot = document.createElement('i');
        dot.setAttribute('aria-hidden', 'true');
        const copy = document.createElement('span');
        copy.append(document.createElement('strong'), document.createElement('small'));
        copy.firstChild.textContent = sourceLabel(source);
        copy.lastChild.textContent = waiting
            ? translated('achievements.waitingForData', 'Waiting for data')
            : source === 'cwl_history' && state.deepLoading
            ? translated('achievements.sourceLoading', 'Loading history...')
            : String(info.detail || translated(info.available ? 'achievements.sourceReady' : 'achievements.sourceMissing', info.available ? 'Ready' : 'Not available yet'));
        item.append(dot, copy); refs.sourceList.append(item);
    });
}

export function renderFilterOptions(refs, state) {
    const families = localizeFamilies(state);
    const availableCategories = new Set(families.map(family => family.category));
    refs.category.replaceChildren(new Option(t('achievements.allCategories'), 'all'));
    [...availableCategories].sort((a, b) => categoryLabel(state, a).localeCompare(categoryLabel(state, b), getLanguage()))
        .forEach(category => refs.category.append(new Option(categoryLabel(state, category), category)));
    refs.category.value = availableCategories.has(state.filters.category) ? state.filters.category : 'all';
    state.filters.category = refs.category.value;

    const availableSources = new Set(families.map(family => family.source));
    refs.source.replaceChildren(new Option(translated('achievements.allSources', 'All data sources'), 'all'));
    SOURCE_ORDER.filter(source => availableSources.has(source)).forEach(source => refs.source.append(new Option(sourceLabel(source), source)));
    refs.source.value = availableSources.has(state.filters.source) ? state.filters.source : 'all';
    state.filters.source = refs.source.value;
}

function tierMarker(tier) {
    const marker = document.createElement('span');
    marker.className = 'achievement-tier-marker';
    marker.dataset.rarity = tier.rarity;
    marker.dataset.unlocked = String(tier.unlocked);
    marker.textContent = tier.tierLabel || String(tier.tier);
    marker.title = tier.progressKnown ? `${tier.tierLabel}: ${number(tier.progress)} / ${tier.thresholdText || number(tier.target)}` : translated('achievements.waitingForSource', 'Waiting for this data source');
    return marker;
}

export function achievementCard(family, state) {
    const card = document.createElement('article');
    card.className = 'achievement-card';
    card.dataset.state = family.state;
    card.dataset.rarity = family.currentTier?.rarity || family.highestUnlocked?.rarity || 'common';
    card.dataset.sourceAvailable = String(family.sourceAvailable);
    const heading = document.createElement('header');
    const icon = achievementFamilyImage(family, categoryLabel(state, family.category));
    const copy = document.createElement('div');
    const title = document.createElement('h3'); title.textContent = family.title;
    const meta = document.createElement('p'); meta.textContent = `${categoryLabel(state, family.category)} / ${sourceLabel(family.source)}`;
    copy.append(title, meta);
    const badge = document.createElement('span'); badge.className = 'achievement-rarity-badge'; badge.textContent = family.complete ? t('achievements.complete') : rarityLabel(family.currentTier?.rarity);
    heading.append(icon, copy, badge);
    const description = document.createElement('p'); description.className = 'achievement-card-description'; description.textContent = family.description;
    const tierRow = document.createElement('div'); tierRow.className = 'achievement-tier-row'; family.tiers.forEach(tier => tierRow.append(tierMarker(tier)));
    const current = family.currentTier;
    const progressCopy = document.createElement('div'); progressCopy.className = 'achievement-progress-copy';
    progressCopy.append(newElement('strong', family.complete ? t('achievements.allTiersUnlocked') : current?.tierLabel || family.title), newElement('span', progressText(family)));
    const track = document.createElement('div'); track.className = 'achievement-progress-track'; track.dataset.known = String(family.sourceAvailable); track.setAttribute('role', 'progressbar'); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-label', family.title);
    if (family.sourceAvailable) {
        const fill = document.createElement('span');
        fill.style.width = `${Math.round(family.progressRatio * 100)}%`;
        track.append(fill);
        track.setAttribute('aria-valuemax', String(current?.target || 1));
        track.setAttribute('aria-valuenow', String(Math.min(current?.progress || 0, current?.target || 1)));
    } else {
        track.dataset.known = 'false';
        track.setAttribute('aria-valuetext', translated('achievements.waitingForSource', 'Waiting for this data source'));
        track.append(newElement('small', translated('achievements.waitingForSource', 'Waiting for this data source')));
    }
    const footer = document.createElement('footer');
    const status = newElement('span', statusText(family)); status.className = 'achievement-status-label';
    const xp = newElement('strong', family.complete ? `+${number(family.totalXp)} XP` : t('achievements.nextXp', { xp: number(current?.xp) })); footer.append(status, xp);
    card.append(heading, description, tierRow, progressCopy, track, footer);
    return card;
}

function progressText(family) {
    const current = family.currentTier;
    if (!family.sourceAvailable) return current?.hasStoredProgress ? `${t('achievements.lastKnown')}: ${number(current.progress)}` : translated('achievements.waitingForSource', 'Waiting for this data source');
    return family.complete ? t('achievements.xpEarned', { xp: number(family.totalXp) }) : t('achievements.progressValue', { progress: number(current?.progress), target: current?.thresholdText || number(current?.target) });
}

function statusText(family) {
    if (family.complete) return t('achievements.completed');
    if (!family.sourceAvailable) return translated('achievements.waitingForData', 'Waiting for data');
    if (family.unlockedTiers.length > 1) return t('achievements.tiersUnlocked', { count: number(family.unlockedTiers.length) });
    if (family.unlockedTiers.length === 1) return t('achievements.oneTierUnlocked');
    return family.currentTier?.progress > 0 ? t('achievements.inProgress') : t('achievements.notStarted');
}

function newElement(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }

export function renderAchievements(refs, state, pageSize) {
    refs.grid.replaceChildren();
    const families = localizeFamilies(state);
    const filtered = filterAchievementFamilies(families, state.filters);
    refs.resultsCount.textContent = translated('achievements.resultsCountExpanded', `${filtered.length} matching · ${families.length} total achievements`, { visible: filtered.length, total: families.length });
    refs.loadMore.hidden = true;
    if (!state.accounts.length) return showEmpty(refs, 'accounts', t('achievements.linkAccountTitle'), t('achievements.linkAccountText'));
    if (state.loading) return showEmpty(refs, 'loading', translated('achievements.waitingForData', 'Waiting for data'), translated('achievements.loading', 'Loading achievement progress...'));
    if (!families.length) return showEmpty(refs, 'catalog', translated('achievements.catalogEmptyTitle', 'Achievements could not be loaded'), translated('achievements.catalogEmptyText', 'Refresh the page.'));
    if (!filtered.length) return showEmpty(refs, 'filters', t('achievements.noMatchTitle'), t('achievements.noMatchText'));
    refs.emptyState.hidden = true; refs.grid.hidden = false;
    filtered.slice(0, state.visibleLimit).forEach(family => refs.grid.append(achievementCard(family, state)));
    const remaining = filtered.length - Math.min(filtered.length, state.visibleLimit);
    refs.loadMore.hidden = remaining <= 0;
    refs.loadMore.textContent = translated('achievements.showMore', `Show more (${remaining} remaining)`, { count: remaining });
}

function showEmpty(refs, reason, title, copy) {
    refs.emptyState.dataset.reason = reason; refs.emptyState.hidden = false; refs.grid.hidden = true;
    refs.emptyState.querySelector('h2').textContent = title; refs.emptyState.querySelector('p').textContent = copy;
}

export function renderAll(refs, state, pageSize) {
    applyI18n(document);
    renderAccountSelector(refs, state);
    renderSummary(refs, state);
    renderSources(refs, state);
    renderFilterOptions(refs, state);
    renderAchievements(refs, state, pageSize);
}

export { SOURCE_ORDER };
