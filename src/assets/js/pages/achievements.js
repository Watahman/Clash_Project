import { getAchievements, importAchievementBaseData } from '../Supabase/Supabase-Achievements.js';
import { checkUserId } from '../Supabase/Supabase-User.js';
import { getCurrentUserId } from '../utils/user.js';
import { applyI18n, getLanguage, t } from '../i18n/i18n.js?v=20260823-achievement-card-assets-1';
import {
    collectLinkedAccounts,
    normalizePlayerTag,
    parseBaseDataText,
    groupAchievementFamilies
} from '../achievements/achievement-view-model.js';
import { getAchievementsFixture } from './achievements-fixtures.js?v=20260811-1';
import {
    renderAll,
    renderSources,
    renderAchievements
} from './achievements-renderer.js?v=20260824-achievement-raster-color-1';

const PAGE_SIZE = 48;
const ACCOUNT_STORAGE_KEY = 'clashpanel_achievements_account';
const PARSE_ERROR_KEYS = new Map([
    ['Paste the copied JSON first.', 'achievements.pasteFirst'],
    ['This is not valid JSON.', 'achievements.invalidJson'],
    ['The copied data must be one JSON object.', 'achievements.objectRequired'],
    ['The JSON does not contain a player tag.', 'achievements.missingTag'],
    ['The JSON does not contain a valid timestamp.', 'achievements.invalidTimestamp'],
    ['The JSON does not look like complete Clash of Clans base data.', 'achievements.incompleteData']
]);

const state = {
    api: { getAchievements, importAchievementBaseData },
    accounts: [], selectedTag: '', families: [], latestSnapshot: null, history: {}, sources: {},
    parsedImport: null, loading: false, deepLoading: false, requestId: 0, visibleLimit: PAGE_SIZE,
    filters: { search: '', category: 'all', rarity: 'all', status: 'all', source: 'all' }
};
const refs = {};

function captureRefs() {
    const selectors = {
        accountSelect: '#achievement-account', refreshButton: '#achievement-refresh', pageStatus: '#achievement-page-status',
        importToggle: '#achievement-import-toggle', importPanel: '#achievement-import-panel', importForm: '#achievement-import-form',
        importText: '#achievement-json', importFile: '#achievement-json-file', pasteButton: '#achievement-paste', clearButton: '#achievement-clear',
        importButton: '#achievement-import-submit', importFeedback: '#achievement-import-feedback', importPreview: '#achievement-import-preview',
        sourceList: '#achievement-source-list', sourceSummary: '#achievement-source-summary', grid: '#achievement-grid', emptyState: '#achievement-empty-state',
        resultsCount: '#achievement-results-count', loadMore: '#achievement-load-more', search: '#achievement-search', category: '#achievement-category',
        rarity: '#achievement-rarity', status: '#achievement-status', source: '#achievement-source', progressPanel: '.achievement-progress-panel', summaryLevel: '#achievement-level',
        summaryLevelProgress: '#achievement-level-progress', summaryLevelCopy: '#achievement-level-copy', summaryXp: '#achievement-total-xp', summaryUnlocked: '#achievement-unlocked',
        summaryCompleted: '#achievement-completed', summaryImported: '#achievement-last-import', featured: '#achievement-featured'
    };
    Object.entries(selectors).forEach(([key, selector]) => { refs[key] = document.querySelector(selector); });
}

function readStorage(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
function writeStorage(key, value) { try { localStorage.setItem(key, value); } catch { /* preference only */ } }
function translated(key, fallback = key, params = {}) { const value = t(key, params); return value === key ? fallback : value; }
function setStatus(message = '', type = '') { refs.pageStatus.textContent = message; refs.pageStatus.dataset.state = type; refs.pageStatus.hidden = !message; }
function setImportFeedback(message = '', type = '') { refs.importFeedback.textContent = message; refs.importFeedback.dataset.state = type; refs.importFeedback.hidden = !message; }

function setImportPanelOpen(open, { focus = false } = {}) {
    const visible = Boolean(open && state.accounts.length);
    refs.importPanel.hidden = !visible;
    refs.importToggle.setAttribute('aria-expanded', String(visible));
    if (visible && focus) refs.importText.focus();
}

function updateMetadata() {
    document.title = t('achievements.metaTitle');
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = translated('achievements.metaDescriptionExpanded', meta.content);
}

function selectInitialAccount(accounts) {
    const queryTag = new URLSearchParams(window.location.search).get('playerTag');
    const preferred = [queryTag, readStorage(ACCOUNT_STORAGE_KEY)].map(normalizePlayerTag).filter(Boolean);
    return preferred.find(tag => accounts.some(account => account.tag === tag)) || accounts[0]?.tag || '';
}

function applyResponse(response) {
    state.families = groupAchievementFamilies(response?.achievements);
    state.latestSnapshot = response?.latestSnapshot || null;
    state.history = response?.history || {};
    state.sources = response?.sources || {};
}

function resetAccountData() {
    state.families = []; state.latestSnapshot = null; state.history = {}; state.sources = {};
    state.parsedImport = null; state.visibleLimit = PAGE_SIZE; state.deepLoading = false;
}

async function loadDeepHistory(tag, requestId) {
    if (!tag || requestId !== state.requestId) return;
    state.deepLoading = true; renderSources(refs, state);
    try {
        const response = await state.api.getAchievements(tag, { deepHistory: true, loading: 'background' });
        if (requestId !== state.requestId || tag !== state.selectedTag) return;
        applyResponse(response); renderAll(refs, state, PAGE_SIZE);
    } catch {
        if (requestId === state.requestId) {
            state.sources = { ...state.sources, cwl_history: { available: false, detail: translated('achievements.cwlHistoryUnavailable', 'CWL history is temporarily unavailable.') } };
            renderSources(refs, state);
        }
    } finally {
        if (requestId === state.requestId) { state.deepLoading = false; renderSources(refs, state); }
    }
}

async function loadSelectedAccount({ quiet = false, loadHistory = true } = {}) {
    const requestId = ++state.requestId;
    const tag = state.selectedTag;
    state.visibleLimit = PAGE_SIZE; state.deepLoading = false;
    if (!tag) { resetAccountData(); renderAll(refs, state, PAGE_SIZE); return; }
    state.loading = true;
    if (!quiet) setStatus(t('achievements.loading'));
    renderAll(refs, state, PAGE_SIZE);
    try {
        const response = await state.api.getAchievements(tag, { deepHistory: false });
        if (requestId !== state.requestId) return;
        applyResponse(response); setStatus(); renderAll(refs, state, PAGE_SIZE);
        if (loadHistory) void loadDeepHistory(tag, requestId);
    } catch (error) {
        if (requestId !== state.requestId) return;
        resetAccountData(); setStatus(error?.message || t('achievements.loadError'), 'error'); renderAll(refs, state, PAGE_SIZE);
    } finally {
        if (requestId === state.requestId) { state.loading = false; renderAll(refs, state, PAGE_SIZE); }
    }
}

function localizedParseError(result) { return t(PARSE_ERROR_KEYS.get(result.error) || 'achievements.incompleteData'); }

function updateImportPreview() {
    const result = parseBaseDataText(refs.importText.value);
    state.parsedImport = result.valid ? result : null;
    refs.importButton.disabled = !result.valid;
    refs.importPreview.hidden = !result.valid;
    if (!result.valid) { setImportFeedback(refs.importText.value.trim() ? localizedParseError(result) : ''); return; }
    if (state.selectedTag && normalizePlayerTag(result.tag) !== state.selectedTag) {
        state.parsedImport = null; refs.importButton.disabled = true;
        setImportFeedback(t('achievements.tagMismatch', { jsonTag: result.tag, selectedTag: state.selectedTag }), 'error');
    } else setImportFeedback(t('achievements.validData'), 'success');
    refs.importPreview.querySelector('[data-import-tag]').textContent = result.tag;
    refs.importPreview.querySelector('[data-import-time]').textContent = formatDate(result.timestamp, true);
    refs.importPreview.querySelector('[data-import-sections]').textContent = String(result.recognizedSections.length);
    refs.importPreview.querySelector('[data-import-items]').textContent = formatNumber(result.itemCount);
}

function formatNumber(value) { return new Intl.NumberFormat(getLanguage()).format(Number(value) || 0); }
function formatDate(value, unixSeconds = false) {
    const result = new Date(unixSeconds ? Number(value) * 1000 : value);
    return Number.isNaN(result.getTime()) ? t('achievements.unknown') : new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'medium', timeStyle: 'short' }).format(result);
}

async function submitImport(event) {
    event.preventDefault(); updateImportPreview();
    if (!state.parsedImport || !state.selectedTag) return;
    refs.importButton.disabled = true; setImportFeedback(t('achievements.analyzing'));
    try {
        const result = await state.api.importAchievementBaseData(state.parsedImport.data);
        state.selectedTag = normalizePlayerTag(result.playerTag || state.parsedImport.tag); writeStorage(ACCOUNT_STORAGE_KEY, state.selectedTag);
        const unlocked = Number(result.unlockedCount) || 0;
        clearImport(); setImportPanelOpen(false); await loadSelectedAccount({ quiet: true });
        const successMessage = t('achievements.importSuccess', { count: unlocked });
        setStatus(successMessage, 'success');
    } catch (error) { setImportFeedback(error?.message || t('achievements.importError'), 'error'); refs.importButton.disabled = false; }
}

function clearImport() {
    refs.importText.value = ''; refs.importFile.value = ''; state.parsedImport = null;
    refs.importButton.disabled = true; refs.importPreview.hidden = true; setImportFeedback();
}

async function readImportFile(file) {
    if (!file) return;
    if (file.size > 1_000_000) { setImportFeedback(t('achievements.fileTooLarge'), 'error'); return; }
    refs.importText.value = await file.text(); updateImportPreview();
}

async function pasteFromClipboard() {
    try { refs.importText.value = await navigator.clipboard.readText(); updateImportPreview(); refs.importText.focus(); }
    catch { setImportFeedback(t('achievements.clipboardBlocked'), 'error'); }
}

function resetVisibleAndRender() { state.visibleLimit = PAGE_SIZE; renderAchievements(refs, state, PAGE_SIZE); }

function bindEvents() {
    refs.accountSelect.addEventListener('change', () => {
        state.selectedTag = normalizePlayerTag(refs.accountSelect.value); writeStorage(ACCOUNT_STORAGE_KEY, state.selectedTag);
        clearImport(); setImportPanelOpen(false); void loadSelectedAccount();
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
    refs.loadMore.addEventListener('click', () => { state.visibleLimit += PAGE_SIZE; renderAchievements(refs, state, PAGE_SIZE); });
    refs.emptyState.querySelector('[data-empty-import]')?.addEventListener('click', () => setImportPanelOpen(true, { focus: true }));
    refs.emptyState.querySelector('[data-empty-profile]')?.addEventListener('click', () => document.querySelector('#workspace-profile-shortcut, #profile-btn')?.click());
    window.addEventListener('clashtools:language-changed', () => { applyI18n(document); renderAll(refs, state, PAGE_SIZE); updateImportPreview(); });
}

async function initialize() {
    captureRefs(); bindEvents(); applyI18n(document); updateMetadata();
    const fixture = await getAchievementsFixture().catch(error => { console.error('[achievements-fixture]', error); return null; });
    if (fixture) {
        state.api = fixture; state.accounts = fixture.accounts || []; state.selectedTag = state.accounts[0]?.tag || '';
        renderAll(refs, state, PAGE_SIZE);
        if (fixture.fixtureImportText) { setImportPanelOpen(true); refs.importText.value = fixture.fixtureImportText; updateImportPreview(); }
        if (state.selectedTag) await loadSelectedAccount({ quiet: true });
        return;
    }
    const userId = getCurrentUserId();
    if (!userId) { setStatus(t('achievements.sessionError'), 'error'); renderAll(refs, state, PAGE_SIZE); return; }
    try {
        state.accounts = collectLinkedAccounts(await checkUserId(userId)); state.selectedTag = selectInitialAccount(state.accounts);
        writeStorage(ACCOUNT_STORAGE_KEY, state.selectedTag); renderAll(refs, state, PAGE_SIZE);
        if (state.selectedTag) await loadSelectedAccount({ quiet: true });
    } catch (error) {
        state.accounts = []; resetAccountData(); setStatus(error?.message || t('achievements.accountsLoadError'), 'error'); renderAll(refs, state, PAGE_SIZE);
    }
}

const initialLoad = initialize();
window.clashtoolsRegisterInitialLoad?.(initialLoad);
