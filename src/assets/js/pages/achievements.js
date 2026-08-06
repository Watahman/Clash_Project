import { checkUserId } from '../Supabase/Supabase-User.js';
import {
    getAchievements,
    importAchievementBaseData
} from '../Supabase/Supabase-Achievements.js';
import { getCurrentUserId } from '../utils/user.js';
import {
    buildAchievementSummary,
    collectLinkedAccounts,
    filterAchievementFamilies,
    groupAchievementFamilies,
    normalizePlayerTag,
    parseBaseDataText
} from '../achievements/achievement-view-model.js';

const CATEGORY_LABELS = {
    all: 'All categories',
    base: 'Home Village',
    progress: 'Progress',
    army: 'Army',
    equipment: 'Equipment',
    collection: 'Collection',
    builder_base: 'Builder Base',
    system: 'Data quality',
    other: 'Other'
};

const RARITY_LABELS = {
    common: 'Common',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary'
};

const state = {
    accounts: [],
    selectedTag: '',
    families: [],
    latestSnapshot: null,
    parsedImport: null,
    loading: false,
    error: '',
    filters: {
        search: '',
        category: 'all',
        rarity: 'all',
        status: 'all'
    }
};

const refs = {};

function captureRefs() {
    refs.accountSelect = document.querySelector('#achievement-account');
    refs.refreshButton = document.querySelector('#achievement-refresh');
    refs.importForm = document.querySelector('#achievement-import-form');
    refs.importToggle = document.querySelector('#achievement-import-toggle');
    refs.importPanel = document.querySelector('#achievement-import-panel');
    refs.importText = document.querySelector('#achievement-json');
    refs.importFile = document.querySelector('#achievement-json-file');
    refs.pasteButton = document.querySelector('#achievement-paste');
    refs.clearButton = document.querySelector('#achievement-clear');
    refs.importButton = document.querySelector('#achievement-import-submit');
    refs.importFeedback = document.querySelector('#achievement-import-feedback');
    refs.importPreview = document.querySelector('#achievement-import-preview');
    refs.pageStatus = document.querySelector('#achievement-page-status');
    refs.emptyState = document.querySelector('#achievement-empty-state');
    refs.grid = document.querySelector('#achievement-grid');
    refs.resultsCount = document.querySelector('#achievement-results-count');
    refs.search = document.querySelector('#achievement-search');
    refs.category = document.querySelector('#achievement-category');
    refs.rarity = document.querySelector('#achievement-rarity');
    refs.status = document.querySelector('#achievement-status');
    refs.summaryLevel = document.querySelector('#achievement-level');
    refs.summaryLevelProgress = document.querySelector('#achievement-level-progress');
    refs.summaryLevelCopy = document.querySelector('#achievement-level-copy');
    refs.summaryXp = document.querySelector('#achievement-total-xp');
    refs.summaryUnlocked = document.querySelector('#achievement-unlocked');
    refs.summaryCompleted = document.querySelector('#achievement-completed');
    refs.summaryImported = document.querySelector('#achievement-last-import');
}

function waitForShell() {
    if (document.body.dataset.shellReady === 'true') return Promise.resolve();
    return new Promise(resolve => {
        const observer = new MutationObserver(() => {
            if (document.body.dataset.shellReady !== 'true') return;
            observer.disconnect();
            resolve();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-shell-ready'] });
        window.setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 3000);
    });
}

async function integrateWorkspaceShell() {
    await waitForShell();
    const breadcrumb = document.querySelector('[data-workspace-current]');
    if (breadcrumb) {
        breadcrumb.removeAttribute('data-i18n');
        breadcrumb.textContent = 'Achievements';
    }

    const navigation = document.querySelector('#workspace-navigation');
    if (!navigation || navigation.querySelector('[data-workspace-nav="achievements"]')) return;
    const dashboardLink = navigation.querySelector('[data-workspace-nav="dashboard"]');
    const link = document.createElement('a');
    link.href = '/app/achievements';
    link.dataset.workspaceNav = 'achievements';
    link.setAttribute('aria-current', 'page');
    link.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" stroke-width="1.7" stroke-linejoin="round"/>
            <path d="M8 6H5v1.5A3.5 3.5 0 0 0 8.5 11M16 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 13v4m-3 3h6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Achievements</span>`;
    dashboardLink?.insertAdjacentElement('afterend', link);
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

function formatNumber(value) {
    return new Intl.NumberFormat().format(Number(value) || 0);
}

function formatDate(value, { unixSeconds = false } = {}) {
    if (!value) return 'Not imported yet';
    const date = unixSeconds
        ? new Date(Number(value) * 1000)
        : new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function accountLabel(account) {
    const name = account.name || 'Clash account';
    const townHall = account.townHallLevel ? ` · TH${account.townHallLevel}` : '';
    return `${name}${townHall} · ${account.tag}`;
}

function populateAccounts() {
    refs.accountSelect.replaceChildren();
    if (!state.accounts.length) {
        const option = new Option('No linked accounts', '');
        refs.accountSelect.append(option);
        refs.accountSelect.disabled = true;
        refs.refreshButton.disabled = true;
        return;
    }

    refs.accountSelect.disabled = false;
    refs.refreshButton.disabled = false;
    state.accounts.forEach(account => {
        refs.accountSelect.append(new Option(accountLabel(account), account.tag));
    });
    state.selectedTag = state.selectedTag && state.accounts.some(account => account.tag === state.selectedTag)
        ? state.selectedTag
        : state.accounts[0].tag;
    refs.accountSelect.value = state.selectedTag;
}

function renderSummary() {
    const summary = buildAchievementSummary(state.families);
    refs.summaryLevel.textContent = String(summary.level.level);
    refs.summaryLevelProgress.style.setProperty('--achievement-level-progress', `${summary.level.progress * 360}deg`);
    refs.summaryLevelCopy.textContent = `${formatNumber(summary.totalXp - summary.level.floorXp)} / ${formatNumber(summary.level.nextXp - summary.level.floorXp)} XP to level ${summary.level.level + 1}`;
    refs.summaryXp.textContent = formatNumber(summary.totalXp);
    refs.summaryUnlocked.textContent = `${summary.unlockedTierCount}/${summary.totalTierCount}`;
    refs.summaryCompleted.textContent = `${summary.completedFamilies}/${summary.familyCount}`;
    refs.summaryImported.textContent = state.latestSnapshot
        ? formatDate(state.latestSnapshot.imported_at || state.latestSnapshot.source_timestamp, {
            unixSeconds: !state.latestSnapshot.imported_at
        })
        : 'Not imported yet';
}

function categoryOptions() {
    const available = new Set(state.families.map(family => family.category));
    refs.category.replaceChildren(new Option(CATEGORY_LABELS.all, 'all'));
    [...available].sort().forEach(category => {
        refs.category.append(new Option(CATEGORY_LABELS[category] || category, category));
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
    category.textContent = CATEGORY_LABELS[family.category] || family.category;
    headingCopy.append(title, category);
    const badge = document.createElement('span');
    badge.className = 'achievement-rarity-badge';
    badge.textContent = family.complete
        ? 'Complete'
        : RARITY_LABELS[family.currentTier?.rarity] || 'Common';
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
    targetName.textContent = family.complete
        ? 'All tiers unlocked'
        : current?.title || family.title;
    const values = document.createElement('span');
    values.textContent = family.complete
        ? `${formatNumber(family.totalXp)} XP earned`
        : `${formatNumber(current?.progress)} / ${formatNumber(current?.target)}`;
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
    status.textContent = family.complete
        ? 'Completed'
        : family.unlockedTiers.length
            ? `${family.unlockedTiers.length} tier${family.unlockedTiers.length === 1 ? '' : 's'} unlocked`
            : family.currentTier?.progress > 0
                ? 'In progress'
                : 'Not started';
    const xp = document.createElement('strong');
    xp.textContent = family.complete
        ? `+${formatNumber(family.totalXp)} XP`
        : `Next: +${formatNumber(current?.xp)} XP`;
    footer.append(status, xp);

    card.append(heading, description, tierRow, progressHeader, progressTrack, footer);
    return card;
}

function renderAchievements() {
    refs.grid.replaceChildren();
    const visible = filterAchievementFamilies(state.families, state.filters);
    refs.resultsCount.textContent = `${visible.length} of ${state.families.length} achievement families`;

    if (!state.accounts.length) {
        refs.emptyState.hidden = false;
        refs.emptyState.dataset.reason = 'accounts';
        refs.emptyState.querySelector('h2').textContent = 'Link a Clash account first';
        refs.emptyState.querySelector('p').textContent = 'Achievements are stored per verified Clash account. Open your profile to link one.';
        refs.grid.hidden = true;
        return;
    }

    if (!state.families.length) {
        refs.emptyState.hidden = false;
        refs.emptyState.dataset.reason = 'import';
        refs.emptyState.querySelector('h2').textContent = 'Import your base data to begin';
        refs.emptyState.querySelector('p').textContent = 'Paste the JSON copied from the in-game settings. ClashPanel will calculate your first achievement progress immediately.';
        refs.grid.hidden = true;
        return;
    }

    if (!visible.length) {
        refs.emptyState.hidden = false;
        refs.emptyState.dataset.reason = 'filters';
        refs.emptyState.querySelector('h2').textContent = 'No achievements match';
        refs.emptyState.querySelector('p').textContent = 'Change the search or filters to see more achievement families.';
        refs.grid.hidden = true;
        return;
    }

    refs.emptyState.hidden = true;
    refs.grid.hidden = false;
    visible.forEach(family => refs.grid.append(achievementCard(family)));
}

function renderAll() {
    renderSummary();
    categoryOptions();
    renderAchievements();
}

async function loadSelectedAccount({ quiet = false } = {}) {
    if (!state.selectedTag) {
        state.families = [];
        state.latestSnapshot = null;
        renderAll();
        return;
    }

    state.loading = true;
    refs.refreshButton.disabled = true;
    if (!quiet) setStatus('Loading achievement progress…');
    try {
        const response = await getAchievements(state.selectedTag);
        state.families = groupAchievementFamilies(response?.achievements);
        state.latestSnapshot = response?.latestSnapshot || null;
        state.error = '';
        setStatus();
    } catch (error) {
        state.families = [];
        state.latestSnapshot = null;
        state.error = error?.message || 'Achievement progress could not be loaded.';
        setStatus(state.error, 'error');
    } finally {
        state.loading = false;
        refs.refreshButton.disabled = !state.accounts.length;
        renderAll();
    }
}

function updateImportPreview() {
    const result = parseBaseDataText(refs.importText.value);
    state.parsedImport = result.valid ? result : null;
    refs.importButton.disabled = !result.valid;
    refs.importPreview.hidden = !result.valid;

    if (!result.valid) {
        setImportFeedback(refs.importText.value.trim() ? result.error : '');
        return;
    }

    const mismatch = state.selectedTag && normalizePlayerTag(result.tag) !== state.selectedTag;
    if (mismatch) {
        state.parsedImport = null;
        refs.importButton.disabled = true;
        setImportFeedback(`This JSON belongs to ${result.tag}, but ${state.selectedTag} is selected.`, 'error');
    } else {
        setImportFeedback('Valid base data detected.', 'success');
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
        setImportFeedback('Clipboard access was blocked. Paste the JSON manually.', 'error');
    }
}

async function readImportFile(file) {
    if (!file) return;
    if (file.size > 1_000_000) {
        setImportFeedback('The selected file is too large.', 'error');
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
    setImportFeedback('Analyzing and saving your base data…');
    try {
        const result = await importAchievementBaseData(state.parsedImport.data);
        state.selectedTag = normalizePlayerTag(result.playerTag || state.parsedImport.tag);
        refs.accountSelect.value = state.selectedTag;
        const unlocked = Number(result.unlockedCount) || 0;
        refs.importText.value = '';
        refs.importFile.value = '';
        state.parsedImport = null;
        refs.importPreview.hidden = true;
        refs.importButton.disabled = true;
        await loadSelectedAccount({ quiet: true });
        setImportFeedback(`${unlocked} achievement tiers are now unlocked. Your snapshot was saved.`, 'success');
    } catch (error) {
        setImportFeedback(error?.message || 'The base data could not be imported.', 'error');
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
        const open = refs.importPanel.hidden;
        refs.importPanel.hidden = !open;
        refs.importToggle.setAttribute('aria-expanded', String(open));
        if (open) refs.importText.focus();
    });
    refs.importText.addEventListener('input', updateImportPreview);
    refs.importText.addEventListener('paste', () => window.setTimeout(updateImportPreview));
    refs.importFile.addEventListener('change', () => void readImportFile(refs.importFile.files?.[0]));
    refs.pasteButton.addEventListener('click', () => void pasteFromClipboard());
    refs.clearButton.addEventListener('click', clearImport);
    refs.importForm.addEventListener('submit', submitImport);

    refs.search.addEventListener('input', () => {
        state.filters.search = refs.search.value;
        renderAchievements();
    });
    for (const [ref, key] of [[refs.category, 'category'], [refs.rarity, 'rarity'], [refs.status, 'status']]) {
        ref.addEventListener('change', () => {
            state.filters[key] = ref.value;
            renderAchievements();
        });
    }

    refs.emptyState.querySelector('[data-empty-import]').addEventListener('click', () => {
        refs.importPanel.hidden = false;
        refs.importToggle.setAttribute('aria-expanded', 'true');
        refs.importText.focus();
    });
    refs.emptyState.querySelector('[data-empty-profile]').addEventListener('click', () => {
        document.querySelector('#workspace-profile-shortcut, #profile-btn')?.click();
    });
}

async function initialize() {
    captureRefs();
    bindEvents();
    await integrateWorkspaceShell();

    const userId = getCurrentUserId();
    if (!userId) {
        setStatus('Your session could not be loaded.', 'error');
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
        setStatus(error?.message || 'Your linked accounts could not be loaded.', 'error');
        renderAll();
    }
}

const initialLoad = initialize();
window.clashtoolsRegisterInitialLoad?.(initialLoad);
