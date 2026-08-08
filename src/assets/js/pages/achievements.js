import { checkUserId } from '../Supabase/Supabase-User.js';
import { getAchievements, importAchievementBaseData } from '../Supabase/Supabase-Achievements.js';
import { getCurrentUserId } from '../utils/user.js';
import { applyI18n, getLanguage, t } from '../i18n/i18n.js';
import {
    buildAchievementSummary,
    collectLinkedAccounts,
    filterAchievementFamilies,
    groupAchievementFamilies,
    normalizePlayerTag,
    parseBaseDataText
} from '../achievements/achievement-view-model.js';

const PAGE_SIZE = 48;
const SOURCE_ORDER = [
    'live_profile', 'base_data', 'base_history', 'war', 'cwl_history',
    'raid_history', 'legend_history', 'clashking_history', 'clan_profile',
    'clashpanel', 'clan_family', 'mixed'
];
const SOURCE_FALLBACKS = {
    live_profile: 'Live profile',
    base_data: 'Base data',
    base_history: 'Snapshot history',
    war: 'Regular war',
    cwl_history: 'CWL history',
    raid_history: 'Raid history',
    legend_history: 'Legend / Ranked history',
    clashking_history: 'ClashKing history',
    clan_profile: 'Clan profile',
    clashpanel: 'ClashPanel usage',
    clan_family: 'Clan Family',
    mixed: 'Combined sources'
};
const PARSE_ERROR_KEYS = new Map([
    ['Paste the copied JSON first.', 'achievements.pasteFirst'],
    ['This is not valid JSON.', 'achievements.invalidJson'],
    ['The copied data must be one JSON object.', 'achievements.objectRequired'],
    ['The JSON does not contain a player tag.', 'achievements.missingTag'],
    ['The JSON does not contain a valid timestamp.', 'achievements.invalidTimestamp'],
    ['The JSON does not look like complete Clash of Clans base data.', 'achievements.incompleteData']
]);

const state = {
    accounts: [],
    selectedTag: '',
    families: [],
    latestSnapshot: null,
    history: {},
    sources: {},
    parsedImport: null,
    loading: false,
    deepLoading: false,
    requestId: 0,
    visibleLimit: PAGE_SIZE,
    filters: { search: '', category: 'all', rarity: 'all', status: 'all', source: 'all' }
};

const refs = {};

function ensureEnhancedUi() {
    const overview = document.querySelector('.achievement-overview');
    if (overview && !document.querySelector('#achievement-source-list')) {
        const section = document.createElement('section');
        section.className = 'achievement-source-overview';
        section.setAttribute('aria-labelledby', 'achievement-source-title');
        section.innerHTML = `
            <div class="achievement-source-heading">
                <div>
                    <p class="page-kicker">Data sources</p>
                    <h2 id="achievement-source-title">How your achievements are measured</h2>
                    <p>ClashPanel combines several sources. Missing data never counts as zero progress.</p>
                </div>
                <strong id="achievement-source-summary"></strong>
            </div>
            <div id="achievement-source-list" class="achievement-source-list"></div>`;
        overview.insertAdjacentElement('afterend', section);
    }

    const filters = document.querySelector('.achievement-filter-grid');
    if (filters && !document.querySelector('#achievement-source')) {
        const label = document.createElement('label');
        label.innerHTML = '<span class="sr-only">Data source</span><select id="achievement-source" aria-label="Data source"></select>';
        filters.append(label);
    }

    const grid = document.querySelector('#achievement-grid');
    if (grid && !document.querySelector('#achievement-load-more')) {
        const button = document.createElement('button');
        button.id = 'achievement-load-more';
        button.type = 'button';
        button.className = 'achievement-button achievement-button-secondary achievement-load-more';
        button.hidden = true;
        button.textContent = 'Show more achievements';
        grid.insertAdjacentElement('afterend', button);
    }
}

function captureRefs() {
    ensureEnhancedUi();
    for (const [key, selector] of Object.entries({
        accountSelect: '#achievement-account', refreshButton: '#achievement-refresh', importForm: '#achievement-import-form',
        importToggle: '#achievement-import-toggle', importPanel: '#achievement-import-panel', importText: '#achievement-json',
        importFile: '#achievement-json-file', pasteButton: '#achievement-paste', clearButton: '#achievement-clear',
        importButton: '#achievement-import-submit', importFeedback: '#achievement-import-feedback', importPreview: '#achievement-import-preview',
        pageStatus: '#achievement-page-status', emptyState: '#achievement-empty-state', grid: '#achievement-grid',
        resultsCount: '#achievement-results-count', search: '#achievement-search', category: '#achievement-category',
        rarity: '#achievement-rarity', status: '#achievement-status', source: '#achievement-source',
        sourceList: '#achievement-source-list', sourceSummary: '#achievement-source-summary', loadMore: '#achievement-load-more',
        summaryLevel: '#achievement-level', summaryLevelProgress: '#achievement-level-progress', summaryLevelCopy: '#achievement-level-copy',
        summaryXp: '#achievement-total-xp', summaryUnlocked: '#achievement-unlocked', summaryCompleted: '#achievement-completed',
        summaryImported: '#achievement-last-import'
    })) refs[key] = document.querySelector(selector);
}

function translated(key, fallback = key, params = {}) {
    const value = t(key, params);
    return value === key ? fallback : value;
}

function sourceLabel(source) {
    return translated(`achievements.source.${source}`, SOURCE_FALLBACKS[source] || source);
}

function rarityLabel(rarity) {
    const value = String(rarity || 'common').toLowerCase();
    const fallback = value.charAt(0).toUpperCase() + value.slice(1);
    return translated(`achievements.${value}`, fallback);
}

function updateDocumentMetadata() {
    document.title = t('achievements.metaTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = translated(
        'achievements.metaDescriptionExpanded',
        'Track the ClashPanel achievement catalog across live profile data, imported base snapshots, wars, CWL, raids and ClashPanel activity.'
    );
    const intro = document.querySelector('.achievement-hero-copy > p:last-child');
    if (intro) intro.textContent = translated(
        'achievements.introExpanded',
        'Track achievements across your Clash profile, imported base progress, wars, CWL, raids and ClashPanel activity. Missing history stays unknown instead of counting as zero.'
    );
    const familyLabel = document.querySelector('[data-i18n="achievements.families"]');
    if (familyLabel) familyLabel.textContent = translated('achievements.achievementsLabel', 'Achievements');
}

function setStatus(message = '', type = '') {
    refs.pageStatus.textContent = message;
    refs.pageStatus.dataset.state = type;
    refs.pageStatus.hidden = !message;
}

function setImportFeedback(message = '', type = '') {
    refs.importFeedback.textContent = message;
    refs.importFeedback.dataset.state = type;
    refs.importFeedback.hidden = !message;
}

function setImportPanelOpen(open, { focus = false } = {}) {
    if (!state.accounts.length) open = false;
    refs.importPanel.hidden = !open;
    refs.importToggle.setAttribute('aria-expanded', String(open));
    if (open && focus) refs.importText.focus();
}

function formatNumber(value) {
    return new Intl.NumberFormat(getLanguage()).format(Number(value) || 0);
}

function formatDate(value, { unixSeconds = false } = {}) {
    if (!value) return t('achievements.notImported');
    const date = unixSeconds ? new Date(Number(value) * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return t('achievements.unknown');
    return new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function accountLabel(account) {
    const name = account.name || t('achievements.accountFallback');
    const townHall = account.townHallLevel ? ` · TH${account.townHallLevel}` : '';
    return `${name}${townHall} · ${account.tag}`;
}

function populateAccounts() {
    refs.accountSelect.replaceChildren();
    if (!state.accounts.length) {
        refs.accountSelect.append(new Option(t('achievements.noLinkedAccounts'), ''));
        refs.accountSelect.disabled = true;
        refs.refreshButton.disabled = true;
        refs.importToggle.disabled = true;
        setImportPanelOpen(false);
        return;
    }
    refs.accountSelect.disabled = false;
    refs.refreshButton.disabled = state.loading;
    refs.importToggle.disabled = false;
    state.accounts.forEach(account => refs.accountSelect.append(new Option(accountLabel(account), account.tag)));
    state.selectedTag = state.selectedTag && state.accounts.some(account => account.tag === state.selectedTag)
        ? state.selectedTag : state.accounts[0].tag;
    refs.accountSelect.value = state.selectedTag;
}

function localizedFamilies() {
    return state.families.map(family => {
        const title = translated(`achievements.family.${family.familyKey}.title`, family.title);
        const description = translated(`achievements.family.${family.familyKey}.description`, family.description);
        return {
            ...family,
            title,
            description,
            tiers: family.tiers.map(tier => ({ ...tier, title })),
            currentTier: family.currentTier ? { ...family.currentTier, title } : null,
            highestUnlocked: family.highestUnlocked ? { ...family.highestUnlocked, title } : null
        };
    });
}

function renderSummary() {
    const summary = buildAchievementSummary(state.families);
    refs.summaryLevel.textContent = String(summary.level.level);
    refs.summaryLevelProgress.style.setProperty('--achievement-level-progress', `${summary.level.progress * 360}deg`);
    refs.summaryLevelCopy.textContent = t('achievements.levelProgress', {
        current: formatNumber(summary.totalXp - summary.level.floorXp),
        total: formatNumber(summary.level.nextXp - summary.level.floorXp),
        level: summary.level.level + 1
    });
    refs.summaryXp.textContent = formatNumber(summary.totalXp);
    refs.summaryUnlocked.textContent = `${summary.unlockedTierCount}/${summary.totalTierCount}`;
    refs.summaryCompleted.textContent = `${summary.completedFamilies}/${summary.familyCount}`;
    refs.summaryImported.textContent = state.latestSnapshot
        ? formatDate(state.latestSnapshot.imported_at || state.latestSnapshot.source_timestamp, { unixSeconds: !state.latestSnapshot.imported_at })
        : t('achievements.notImported');
}

function renderSources() {
    refs.sourceList.replaceChildren();
    const summary = buildAchievementSummary(state.families);
    refs.sourceSummary.textContent = state.accounts.length
        ? translated('achievements.availableNow', `${summary.availableFamilies}/${summary.familyCount} measurable now`, {
            available: summary.availableFamilies,
            total: summary.familyCount
        })
        : translated('achievements.linkForSources', 'Link an account to activate sources');

    SOURCE_ORDER.forEach(source => {
        const info = state.sources?.[source] || {};
        const item = document.createElement('article');
        item.className = 'achievement-source-item';
        item.dataset.available = String(info.available === true);
        if (source === 'cwl_history' && state.deepLoading) item.dataset.loading = 'true';
        const dot = document.createElement('i');
        dot.setAttribute('aria-hidden', 'true');
        const copy = document.createElement('span');
        const strong = document.createElement('strong');
        strong.textContent = sourceLabel(source);
        const small = document.createElement('small');
        small.textContent = source === 'cwl_history' && state.deepLoading
            ? translated('achievements.sourceLoading', 'Loading history…')
            : String(info.detail || translated(
                info.available ? 'achievements.sourceReady' : 'achievements.sourceMissing',
                info.available ? 'Ready' : 'Not available yet'
            ));
        copy.append(strong, small);
        item.append(dot, copy);
        refs.sourceList.append(item);
    });
}

function categoryLabel(category) {
    const exact = state.families.find(family => family.category === category)?.categoryLabel;
    return translated(`achievements.category.${category}`, exact || category.replaceAll('_', ' '));
}

function categoryOptions(families) {
    const available = new Set(families.map(family => family.category));
    refs.category.replaceChildren(new Option(t('achievements.allCategories'), 'all'));
    [...available].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), getLanguage())).forEach(category => {
        refs.category.append(new Option(categoryLabel(category), category));
    });
    refs.category.value = available.has(state.filters.category) ? state.filters.category : 'all';
    state.filters.category = refs.category.value;
}

function sourceOptions(families) {
    const available = new Set(families.map(family => family.source));
    refs.source.replaceChildren(new Option(translated('achievements.allSources', 'All data sources'), 'all'));
    SOURCE_ORDER.filter(source => available.has(source)).forEach(source => {
        refs.source.append(new Option(sourceLabel(source), source));
    });
    refs.source.value = available.has(state.filters.source) ? state.filters.source : 'all';
    state.filters.source = refs.source.value;
}

function tierMarker(tier) {
    const marker = document.createElement('span');
    marker.className = 'achievement-tier-marker';
    marker.dataset.rarity = tier.rarity;
    marker.dataset.unlocked = String(tier.unlocked);
    marker.title = tier.progressKnown
        ? `${tier.tierLabel}: ${formatNumber(tier.progress)} / ${tier.thresholdText || formatNumber(tier.target)}`
        : `${tier.tierLabel}: ${tier.thresholdText || translated('achievements.waitingForSource', 'Waiting for this data source')}`;
    marker.textContent = tier.tierLabel || String(tier.tier);
    return marker;
}

function achievementCard(family) {
    const card = document.createElement('article');
    card.className = 'achievement-card';
    card.dataset.state = family.state;
    card.dataset.rarity = family.currentTier?.rarity || family.highestUnlocked?.rarity || 'common';
    card.dataset.sourceAvailable = String(family.sourceAvailable);

    const heading = document.createElement('header');
    const icon = document.createElement('span');
    icon.className = 'achievement-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = family.complete ? '★' : family.unlockedTiers.length ? '◆' : '◇';
    const headingCopy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = family.title;
    const meta = document.createElement('p');
    meta.className = 'achievement-card-meta';
    const category = document.createElement('span');
    category.textContent = categoryLabel(family.category);
    const source = document.createElement('span');
    source.className = 'achievement-card-source';
    source.dataset.available = String(family.sourceAvailable);
    source.textContent = sourceLabel(family.source);
    meta.append(category, source);
    headingCopy.append(title, meta);
    const badge = document.createElement('span');
    badge.className = 'achievement-rarity-badge';
    badge.textContent = family.complete ? t('achievements.complete') : rarityLabel(family.currentTier?.rarity || 'common');
    heading.append(icon, headingCopy, badge);

    const description = document.createElement('p');
    description.className = 'achievement-card-description';
    description.textContent = family.description;

    const tierRow = document.createElement('div');
    tierRow.className = 'achievement-tier-row';
    if (family.tiers.length > 1) family.tiers.forEach(tier => tierRow.append(tierMarker(tier)));
    else tierRow.hidden = true;

    const current = family.currentTier;
    const currentHasStoredProgress = current?.hasStoredProgress === true && (current?.progress || 0) > 0;
    const progressHeader = document.createElement('div');
    progressHeader.className = 'achievement-progress-copy';
    const targetName = document.createElement('strong');
    targetName.textContent = family.complete
        ? t('achievements.allTiersUnlocked')
        : current?.tierLabel || family.title;
    const values = document.createElement('span');
    if (!family.sourceAvailable && currentHasStoredProgress) {
        values.textContent = `${translated('achievements.lastKnown', 'Last known')}: ${formatNumber(current?.progress)}`;
    } else if (!family.sourceAvailable) {
        values.textContent = current?.thresholdText
            ? `${translated('achievements.waitingForSource', 'Waiting for this data source')} · ${current.thresholdText}`
            : translated('achievements.waitingForSource', 'Waiting for this data source');
    } else {
        values.textContent = family.complete
            ? t('achievements.xpEarned', { xp: formatNumber(family.totalXp) })
            : t('achievements.progressValue', { progress: formatNumber(current?.progress), target: current?.thresholdText || formatNumber(current?.target) });
    }
    progressHeader.append(targetName, values);

    const progressTrack = document.createElement('div');
    progressTrack.className = 'achievement-progress-track';
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', String(family.sourceAvailable ? current?.target || 1 : 1));
    progressTrack.setAttribute('aria-valuenow', String(family.sourceAvailable ? Math.min(current?.progress || 0, current?.target || 1) : 0));
    const progressBar = document.createElement('span');
    progressBar.style.width = `${Math.round(family.progressRatio * 100)}%`;
    progressTrack.append(progressBar);

    const footer = document.createElement('footer');
    const status = document.createElement('span');
    status.className = 'achievement-status-label';
    status.textContent = family.complete
        ? t('achievements.completed')
        : !family.sourceAvailable && currentHasStoredProgress
            ? translated('achievements.sourceRequired', 'Data source required')
            : !family.sourceAvailable
                ? translated('achievements.waitingForData', 'Waiting for data')
                : family.unlockedTiers.length === 1 ? t('achievements.oneTierUnlocked')
                : family.unlockedTiers.length > 1 ? t('achievements.tiersUnlocked', { count: family.unlockedTiers.length })
                : family.currentTier?.progress > 0 ? t('achievements.inProgress') : t('achievements.notStarted');
    const xp = document.createElement('strong');
    xp.textContent = family.complete
        ? `+${formatNumber(family.totalXp)} XP`
        : t('achievements.nextXp', { xp: formatNumber(current?.xp) });
    footer.append(status, xp);

    card.append(heading, description, tierRow, progressHeader, progressTrack, footer);
    return card;
}

function renderAchievements() {
    refs.grid.replaceChildren();
    const families = localizedFamilies();
    const filtered = filterAchievementFamilies(families, state.filters);
    const visible = filtered.slice(0, state.visibleLimit);
    refs.resultsCount.textContent = translated(
        'achievements.resultsCountExpanded',
        `${filtered.length} matching · ${families.length} total achievements`,
        { visible: filtered.length, total: families.length }
    );

    const emptyTitle = refs.emptyState.querySelector('h2');
    const emptyText = refs.emptyState.querySelector('p');
    refs.loadMore.hidden = true;
    if (!state.accounts.length) {
        refs.emptyState.dataset.reason = 'accounts';
        refs.emptyState.hidden = false;
        emptyTitle.textContent = t('achievements.linkAccountTitle');
        emptyText.textContent = t('achievements.linkAccountText');
        refs.grid.hidden = true;
        return;
    }
    if (!families.length) {
        refs.emptyState.dataset.reason = 'catalog';
        refs.emptyState.hidden = false;
        emptyTitle.textContent = translated('achievements.catalogEmptyTitle', 'Achievements could not be loaded');
        emptyText.textContent = translated('achievements.catalogEmptyText', 'Refresh the page. Base-data import is not required for the achievement catalog to appear.');
        refs.grid.hidden = true;
        return;
    }
    if (!filtered.length) {
        refs.emptyState.dataset.reason = 'filters';
        refs.emptyState.hidden = false;
        emptyTitle.textContent = t('achievements.noMatchTitle');
        emptyText.textContent = t('achievements.noMatchText');
        refs.grid.hidden = true;
        return;
    }
    refs.emptyState.hidden = true;
    refs.grid.hidden = false;
    visible.forEach(family => refs.grid.append(achievementCard(family)));
    refs.loadMore.hidden = visible.length >= filtered.length;
    refs.loadMore.textContent = translated(
        'achievements.showMore',
        `Show more (${filtered.length - visible.length} remaining)`,
        { count: filtered.length - visible.length }
    );
}

function renderAll() {
    applyI18n(document);
    updateDocumentMetadata();
    populateAccounts();
    renderSummary();
    const families = localizedFamilies();
    categoryOptions(families);
    sourceOptions(families);
    renderSources();
    renderAchievements();
}

function applyAchievementResponse(response) {
    state.families = groupAchievementFamilies(response?.achievements);
    state.latestSnapshot = response?.latestSnapshot || null;
    state.history = response?.history || {};
    state.sources = response?.sources || {};
}

async function loadDeepHistory(tag, requestId) {
    if (!tag || requestId !== state.requestId) return;
    state.deepLoading = true;
    renderSources();
    try {
        const response = await getAchievements(tag, { deepHistory: true, loading: 'background' });
        if (requestId !== state.requestId || tag !== state.selectedTag) return;
        applyAchievementResponse(response);
        renderAll();
    } catch {
        if (requestId === state.requestId) {
            state.sources = {
                ...state.sources,
                cwl_history: { available: false, detail: translated('achievements.cwlHistoryUnavailable', 'CWL history is temporarily unavailable.') }
            };
            renderSources();
        }
    } finally {
        if (requestId === state.requestId) {
            state.deepLoading = false;
            renderSources();
        }
    }
}

async function loadSelectedAccount({ quiet = false, loadHistory = true } = {}) {
    const requestId = ++state.requestId;
    const tag = state.selectedTag;
    state.visibleLimit = PAGE_SIZE;
    if (!tag) {
        state.families = [];
        state.latestSnapshot = null;
        state.history = {};
        state.sources = {};
        renderAll();
        return;
    }
    state.loading = true;
    refs.refreshButton.disabled = true;
    if (!quiet) setStatus(t('achievements.loading'));
    try {
        const response = await getAchievements(tag, { deepHistory: false });
        if (requestId !== state.requestId) return;
        applyAchievementResponse(response);
        setStatus();
        renderAll();
        if (loadHistory) void loadDeepHistory(tag, requestId);
    } catch (error) {
        if (requestId !== state.requestId) return;
        state.families = [];
        state.latestSnapshot = null;
        state.history = {};
        state.sources = {};
        setStatus(error?.message || t('achievements.loadError'), 'error');
        renderAll();
    } finally {
        if (requestId === state.requestId) {
            state.loading = false;
            refs.refreshButton.disabled = !state.accounts.length;
        }
    }
}

function localizedParseError(result) {
    return t(PARSE_ERROR_KEYS.get(result.error) || 'achievements.incompleteData');
}

function updateImportPreview() {
    const result = parseBaseDataText(refs.importText.value);
    state.parsedImport = result.valid ? result : null;
    refs.importButton.disabled = !result.valid;
    refs.importPreview.hidden = !result.valid;
    if (!result.valid) {
        setImportFeedback(refs.importText.value.trim() ? localizedParseError(result) : '');
        return;
    }
    const mismatch = state.selectedTag && normalizePlayerTag(result.tag) !== state.selectedTag;
    if (mismatch) {
        state.parsedImport = null;
        refs.importButton.disabled = true;
        setImportFeedback(t('achievements.tagMismatch', { jsonTag: result.tag, selectedTag: state.selectedTag }), 'error');
    } else {
        setImportFeedback(t('achievements.validData'), 'success');
    }
    refs.importPreview.querySelector('[data-import-tag]').textContent = result.tag;
    refs.importPreview.querySelector('[data-import-time]').textContent = formatDate(result.timestamp, { unixSeconds: true });
    refs.importPreview.querySelector('[data-import-sections]').textContent = String(result.recognizedSections.length);
    refs.importPreview.querySelector('[data-import-items]').textContent = formatNumber(result.itemCount);
}

async function pasteFromClipboard() {
    try {
        refs.importText.value = await navigator.clipboard.readText();
        updateImportPreview();
        refs.importText.focus();
    } catch {
        setImportFeedback(t('achievements.clipboardBlocked'), 'error');
    }
}

async function readImportFile(file) {
    if (!file) return;
    if (file.size > 1_000_000) {
        setImportFeedback(t('achievements.fileTooLarge'), 'error');
        return;
    }
    refs.importText.value = await file.text();
    updateImportPreview();
}

function clearImport() {
    refs.importText.value = '';
    refs.importFile.value = '';
    state.parsedImport = null;
    refs.importButton.disabled = true;
    refs.importPreview.hidden = true;
    setImportFeedback();
}

async function submitImport(event) {
    event.preventDefault();
    updateImportPreview();
    if (!state.parsedImport) return;
    refs.importButton.disabled = true;
    setImportFeedback(t('achievements.analyzing'));
    try {
        const result = await importAchievementBaseData(state.parsedImport.data);
        state.selectedTag = normalizePlayerTag(result.playerTag || state.parsedImport.tag);
        refs.accountSelect.value = state.selectedTag;
        const unlocked = Number(result.unlockedCount) || 0;
        clearImport();
        setImportPanelOpen(false);
        await loadSelectedAccount({ quiet: true });
        const successMessage = t('achievements.importSuccess', { count: unlocked });
        setStatus(successMessage, 'success');
    } catch (error) {
        setImportFeedback(error?.message || t('achievements.importError'), 'error');
        refs.importButton.disabled = false;
    }
}

function resetVisibleAndRender() {
    state.visibleLimit = PAGE_SIZE;
    renderAchievements();
}

function bindEvents() {
    refs.accountSelect.addEventListener('change', () => {
        state.selectedTag = normalizePlayerTag(refs.accountSelect.value);
        clearImport();
        setImportPanelOpen(false);
        void loadSelectedAccount();
    });
    refs.refreshButton.addEventListener('click', () => void loadSelectedAccount());
    refs.importToggle.addEventListener('click', () => setImportPanelOpen(refs.importPanel.hidden, { focus: true }));
    refs.importText.addEventListener('input', updateImportPreview);
    refs.importText.addEventListener('paste', () => window.setTimeout(updateImportPreview));
    refs.importFile.addEventListener('change', () => void readImportFile(refs.importFile.files?.[0]));
    refs.pasteButton.addEventListener('click', () => void pasteFromClipboard());
    refs.clearButton.addEventListener('click', clearImport);
    refs.importForm.addEventListener('submit', submitImport);
    refs.search.addEventListener('input', () => { state.filters.search = refs.search.value; resetVisibleAndRender(); });
    for (const [ref, key] of [[refs.category, 'category'], [refs.rarity, 'rarity'], [refs.status, 'status'], [refs.source, 'source']]) {
        ref.addEventListener('change', () => { state.filters[key] = ref.value; resetVisibleAndRender(); });
    }
    refs.loadMore.addEventListener('click', () => {
        state.visibleLimit += PAGE_SIZE;
        renderAchievements();
    });
    refs.emptyState.querySelector('[data-empty-import]').addEventListener('click', () => setImportPanelOpen(true, { focus: true }));
    refs.emptyState.querySelector('[data-empty-profile]').addEventListener('click', () => {
        document.querySelector('#workspace-profile-shortcut, #profile-btn')?.click();
    });
    window.addEventListener('clashtools:language-changed', () => {
        renderAll();
        updateImportPreview();
    });
}

async function initialize() {
    captureRefs();
    bindEvents();
    updateDocumentMetadata();
    const userId = getCurrentUserId();
    if (!userId) {
        setStatus(t('achievements.sessionError'), 'error');
        renderAll();
        return;
    }
    try {
        const user = await checkUserId(userId);
        state.accounts = collectLinkedAccounts(user);
        populateAccounts();
        await loadSelectedAccount({ quiet: true });
    } catch (error) {
        state.accounts = [];
        populateAccounts();
        setStatus(error?.message || t('achievements.accountsLoadError'), 'error');
        renderAll();
    }
}

const initialLoad = initialize();
window.clashtoolsRegisterInitialLoad?.(initialLoad);
