import { applyI18n, getLanguage, t } from '../i18n/i18n.js?v=20260914-achievement-polish-v1';
import {
    buildAchievementSummary,
    filterAchievementFamilies
} from '../achievements/achievement-view-model.js?v=20260914-achievement-polish-v1';
import { categoryByKey } from './achievement-category-model.js?v=20260914-achievement-polish-v1';
import { hubTranslated, localizeAchievementCollections } from './achievement-collection-localizer.js?v=20260914-achievement-polish-v1';
import { achievementFamilyImage } from './achievement-asset-view.js?v=20260824-achievement-raster-color-1';
import { achievementChronicleLocales } from '../i18n/achievement-chronicle-locales.js?v=20260914-achievement-polish-v1';
import { renderAchievementHub } from './achievement-hub-renderer.js?v=20260914-achievement-polish-v1';
import { renderAchievementCategory } from './achievement-category-renderer.js?v=20260914-achievement-polish-v1';

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

function applyAchievementHubI18n(root = document) {
    root.querySelectorAll('[data-chronicle-i18n]').forEach(element => {
        const key = element.dataset.chronicleI18n;
        const value = achievementChronicleLocales[getLanguage()]?.[key] || achievementChronicleLocales.en?.[key];
        if (value) element.textContent = value;
    });
    root.querySelectorAll('[data-chronicle-i18n-aria-label]').forEach(element => {
        const key = element.dataset.chronicleI18nAriaLabel;
        const value = achievementChronicleLocales[getLanguage()]?.[key] || achievementChronicleLocales.en?.[key];
        if (value) element.setAttribute('aria-label', value);
    });
}

function categoryForFilters(category, filters) {
    const matches = filterAchievementFamilies(category.families, { ...filters, category: 'all' });
    const matched = new Set(matches);
    return {
        ...category,
        families: matches,
        progressionFamilies: category.progressionFamilies.filter(family => matched.has(family)),
        standaloneFamilies: category.standaloneFamilies.filter(family => matched.has(family))
    };
}

function hasActiveFilters(filters = {}) {
    return Boolean(String(filters.search || '').trim())
        || String(filters.rarity || 'all') !== 'all'
        || String(filters.status || 'all') !== 'all';
}

function renderFilterResults(refs, state, visibleCount) {
    const active = hasActiveFilters(state.filters);
    refs.resultsCount.hidden = !active;
    refs.resultsCount.textContent = active
        ? hubTranslated('achievements.hub.filterResults', '{count} matching achievements', { count: visibleCount })
        : '';
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
    const rarity = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    const status = ['all', 'in_progress', 'unlocked', 'complete', 'locked', 'unknown'];
    if (!rarity.includes(state.filters.rarity)) state.filters.rarity = 'all';
    if (!status.includes(state.filters.status)) state.filters.status = 'all';
    refs.rarity.value = state.filters.rarity;
    refs.status.value = state.filters.status;
}

function showHub(refs, categories, state) {
    refs.filterDialog.hidden = true;
    refs.filterDialog.open = false;
    refs.hubSummary.textContent = hubTranslated('achievements.hub.summary', 'Choose a collection to explore its journey.');
    renderAchievementHub(refs.grid, categories, {
        emptyMessage: hubTranslated('achievements.hub.noCategories', 'No achievement categories are available yet.')
    });
    refs.grid.querySelectorAll('.achievement-hub-module[data-achievement-category]').forEach(panel => {
        panel.tabIndex = 0;
    });
    if (state.focusTarget === 'overview') refs.libraryTitle.focus({ preventScroll: true });
    state.focusTarget = '';
}

function showCategory(refs, category, state) {
    refs.filterDialog.hidden = false;
    refs.hubSummary.textContent = hubTranslated('achievements.hub.detailIntro', 'Follow real paths and independent challenges in this collection.');
    const filtered = categoryForFilters(category, state.filters);
    renderAchievementCategory(refs.grid, filtered, {
        backLabel: hubTranslated('achievements.hub.backToHub', 'Back to Achievement Hub')
    });
    if (state.focusTarget === 'detail') {
        const heading = refs.grid.querySelector('.achievement-category-title h1');
        heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
    }
    state.focusTarget = '';
}

export function renderAchievements(refs, state) {
    refs.grid.replaceChildren();
    const families = localizeFamilies(state);
    const filtered = filterAchievementFamilies(families, state.filters);
    const categories = localizeAchievementCollections(families);
    const selected = categoryByKey(categories, state.selectedCategory);
    renderFilterResults(refs, state, filtered.length);
    if (!state.accounts.length) return showEmpty(refs, 'accounts', t('achievements.linkAccountTitle'), t('achievements.linkAccountText'));
    if (state.loading) return showEmpty(refs, 'loading', translated('achievements.waitingForData', 'Waiting for data'), translated('achievements.loading', 'Loading achievement progress...'));
    if (!families.length) return showEmpty(refs, 'catalog', translated('achievements.catalogEmptyTitle', 'Achievements could not be loaded'), translated('achievements.catalogEmptyText', 'Refresh the page.'));
    const selectedFamilies = selected ? categoryForFilters(selected, state.filters).families : [];
    if (selected && !selectedFamilies.length && !hasActiveFilters(state.filters)) {
        refs.emptyState.hidden = true; refs.grid.hidden = false;
        return showCategory(refs, selected, state);
    }
    if (!filtered.length || selected && !selectedFamilies.length) {
        return showEmpty(refs, 'filters', t('achievements.noMatchTitle'), t('achievements.noMatchText'), Boolean(selected));
    }
    refs.emptyState.hidden = true; refs.grid.hidden = false;
    if (state.selectedCategory && !selected) {
        state.selectedCategory = '';
        return showHub(refs, categories, state);
    }
    if (selected) showCategory(refs, selected, state);
    else showHub(refs, categories, state);
}

function showEmpty(refs, reason, title, copy, keepDetailFilters = false) {
    refs.emptyState.dataset.reason = reason; refs.emptyState.hidden = false; refs.grid.hidden = true;
    refs.filterDialog.hidden = !keepDetailFilters;
    refs.emptyState.querySelector('h2').textContent = title; refs.emptyState.querySelector('p').textContent = copy;
}

export function renderAll(refs, state) {
    applyI18n(document);
    applyAchievementHubI18n(document);
    renderAccountSelector(refs, state);
    renderSummary(refs, state);
    renderSources(refs, state);
    renderFilterOptions(refs, state);
    renderAchievements(refs, state);
}

export { SOURCE_ORDER };
