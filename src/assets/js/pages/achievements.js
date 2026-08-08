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
    parsedImport: null,
    loading: false,
    filters: { search: '', category: 'all', rarity: 'all', status: 'all' }
};

const refs = {};

function captureRefs() {
    for (const [key, selector] of Object.entries({
        accountSelect: '#achievement-account', refreshButton: '#achievement-refresh', importForm: '#achievement-import-form',
        importToggle: '#achievement-import-toggle', importPanel: '#achievement-import-panel', importText: '#achievement-json',
        importFile: '#achievement-json-file', pasteButton: '#achievement-paste', clearButton: '#achievement-clear',
        importButton: '#achievement-import-submit', importFeedback: '#achievement-import-feedback', importPreview: '#achievement-import-preview',
        pageStatus: '#achievement-page-status', emptyState: '#achievement-empty-state', grid: '#achievement-grid',
        resultsCount: '#achievement-results-count', search: '#achievement-search', category: '#achievement-category',
        rarity: '#achievement-rarity', status: '#achievement-status', summaryLevel: '#achievement-level',
        summaryLevelProgress: '#achievement-level-progress', summaryLevelCopy: '#achievement-level-copy', summaryXp: '#achievement-total-xp',
        summaryUnlocked: '#achievement-unlocked', summaryCompleted: '#achievement-completed', summaryImported: '#achievement-last-import'
    })) refs[key] = document.querySelector(selector);
}

function translated(key, fallback = key, params = {}) {
    const value = t(key, params);
    return value === key ? fallback : value;
}

function updateDocumentMetadata() {
    document.title = t('achievements.metaTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = t('achievements.metaDescription');
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
        return;
    }
    refs.accountSelect.disabled = false;
    refs.refreshButton.disabled = false;
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
            tiers: family.tiers.map(tier => ({
                ...tier,
                title: `${title} ${['I', 'II', 'III', 'IV'][tier.tier - 1] || tier.tier}`
            })),
            currentTier: family.currentTier ? {
                ...family.currentTier,
                title: `${title} ${['I', 'II', 'III', 'IV'][family.currentTier.tier - 1] || family.currentTier.tier}`
            } : null,
            highestUnlocked: family.highestUnlocked ? {
                ...family.highestUnlocked,
                title: `${title} ${['I', 'II', 'III', 'IV'][family.highestUnlocked.tier - 1] || family.highestUnlocked.tier}`
            } : null
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

function categoryLabel(category) {
    return translated(`achievements.category.${category}`, category);
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

function tierMarker(tier) {
    const marker = document.createElement('span');
    marker.className = 'achievement-tier-marker';
    marker.dataset.rarity = tier.rarity;
    marker.dataset.unlocked = String(tier.unlocked);
    marker.title = `${tier.title}: ${formatNumber(tier.progress)} / ${formatNumber(tier.target)}`;
    marker.textContent = ['I', 'II', 'III', 'IV'][tier.tier - 1] || String(tier.tier);
    return marker;
}

function achievementCard(family) {
    const card = document.createElement('article');
    card.className = 'achievement-card';
    card.dataset.state = family.state;
    card.dataset.rarity = family.currentTier?.rarity || family.highestUnlocked?.rarity || 'common';

    const heading = document.createElement('header');
    const icon = document.createElement('span');
    icon.className = 'achievement-card-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = family.complete ? '★' : family.unlockedTiers.length ? '◆' : '◇';
    const headingCopy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = family.title;
    const category = document.createElement('p');
    category.textContent = categoryLabel(family.category);
    headingCopy.append(title, category);
    const badge = document.createElement('span');
    badge.className = 'achievement-rarity-badge';
    badge.textContent = family.complete ? t('achievements.complete') : t(`achievements.${family.currentTier?.rarity || 'common'}`);
    heading.append(icon, headingCopy, badge);

    const description = document.createElement('p');
    description.className = 'achievement-card-description';
    description.textContent = family.description;

    const tierRow = document.createElement('div');
    tierRow.className = 'achievement-tier-row';
    family.tiers.forEach(tier => tierRow.append(tierMarker(tier)));

    const current = family.currentTier;
    const progressHeader = document.createElement('div');
    progressHeader.className = 'achievement-progress-copy';
    const targetName = document.createElement('strong');
    targetName.textContent = family.complete ? t('achievements.allTiersUnlocked') : current?.title || family.title;
    const values = document.createElement('span');
    values.textContent = family.complete
        ? t('achievements.xpEarned', { xp: formatNumber(family.totalXp) })
        : t('achievements.progressValue', { progress: formatNumber(current?.progress), target: formatNumber(current?.target) });
    progressHeader.append(targetName, values);

    const progressTrack = document.createElement('div');
    progressTrack.className = 'achievement-progress-track';
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', String(current?.target || 1));
    progressTrack.setAttribute('aria-valuenow', String(Math.min(current?.progress || 0, current?.target || 1)));
    const progressBar = document.createElement('span');
    progressBar.style.width = `${Math.round(family.progressRatio * 100)}%`;
    progressTrack.append(progressBar);

    const footer = document.createElement('footer');
    const status = document.createElement('span');
    status.className = 'achievement-status-label';
    status.textContent = family.complete ? t('achievements.completed')
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
    const visible = filterAchievementFamilies(families, state.filters);
    refs.resultsCount.textContent = t('achievements.resultsCount', { visible: visible.length, total: families.length });

    const emptyTitle = refs.emptyState.querySelector('h2');
    const emptyText = refs.emptyState.querySelector('p');
    if (!state.accounts.length) {
        refs.emptyState.hidden = false;
        emptyTitle.textContent = t('achievements.linkAccountTitle');
        emptyText.textContent = t('achievements.linkAccountText');
        refs.grid.hidden = true;
        return;
    }
    if (!families.length) {
        refs.emptyState.hidden = false;
        emptyTitle.textContent = t('achievements.importEmptyTitle');
        emptyText.textContent = t('achievements.importEmptyText');
        refs.grid.hidden = true;
        return;
    }
    if (!visible.length) {
        refs.emptyState.hidden = false;
        emptyTitle.textContent = t('achievements.noMatchTitle');
        emptyText.textContent = t('achievements.noMatchText');
        refs.grid.hidden = true;
        return;
    }
    refs.emptyState.hidden = true;
    refs.grid.hidden = false;
    visible.forEach(family => refs.grid.append(achievementCard(family)));
}

function renderAll() {
    applyI18n(document);
    updateDocumentMetadata();
    populateAccounts();
    renderSummary();
    const families = localizedFamilies();
    categoryOptions(families);
    renderAchievements();
}

async function loadSelectedAccount({ quiet = false } = {}) {
    if (!state.selectedTag) {
        state.families = [];
        state.latestSnapshot = null;
        state.history = {};
        renderAll();
        return;
    }
    state.loading = true;
    refs.refreshButton.disabled = true;
    if (!quiet) setStatus(t('achievements.loading'));
    try {
        const response = await getAchievements(state.selectedTag);
        state.families = groupAchievementFamilies(response?.achievements);
        state.latestSnapshot = response?.latestSnapshot || null;
        state.history = response?.history || {};
        setStatus();
    } catch (error) {
        state.families = [];
        state.latestSnapshot = null;
        state.history = {};
        setStatus(error?.message || t('achievements.loadError'), 'error');
    } finally {
        state.loading = false;
        refs.refreshButton.disabled = !state.accounts.length;
        renderAll();
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
        setImportFeedback(successMessage, 'success');
    } catch (error) {
        setImportFeedback(error?.message || t('achievements.importError'), 'error');
        refs.importButton.disabled = false;
    }
}

function bindEvents() {
    refs.accountSelect.addEventListener('change', () => {
        state.selectedTag = normalizePlayerTag(refs.accountSelect.value);
        updateImportPreview();
        void loadSelectedAccount();
    });
    refs.refreshButton.addEventListener('click', () => void loadSelectedAccount());
    refs.importToggle.addEventListener('click', () => {
        setImportPanelOpen(refs.importPanel.hidden, { focus: true });
    });
    refs.importText.addEventListener('input', updateImportPreview);
    refs.importText.addEventListener('paste', () => window.setTimeout(updateImportPreview));
    refs.importFile.addEventListener('change', () => void readImportFile(refs.importFile.files?.[0]));
    refs.pasteButton.addEventListener('click', () => void pasteFromClipboard());
    refs.clearButton.addEventListener('click', clearImport);
    refs.importForm.addEventListener('submit', submitImport);
    refs.search.addEventListener('input', () => { state.filters.search = refs.search.value; renderAchievements(); });
    for (const [ref, key] of [[refs.category, 'category'], [refs.rarity, 'rarity'], [refs.status, 'status']]) {
        ref.addEventListener('change', () => { state.filters[key] = ref.value; renderAchievements(); });
    }
    refs.emptyState.querySelector('[data-empty-import]').addEventListener('click', () => {
        setImportPanelOpen(true, { focus: true });
    });
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
