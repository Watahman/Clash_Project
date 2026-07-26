import { syncAuthSession } from '../auth/auth-client.js';
import { initI18n, t } from '../i18n/i18n.js';
import { exportOperationReport, normalizeImportedReport, readOperationReportFile } from '../operation-board/operation-board-import-export.js';
import { renderBoardContext } from '../operation-board/operation-board-context-renderer.js';
import { bindOperationBoardEvents } from '../operation-board/operation-board-page-events.js';
import { enrichWithHistoricalPerformance } from '../operation-board/operation-board-performance.js';
import { initOperationBoardRefs } from '../operation-board/operation-board-page-refs.js';
import { createOperationPlanStore } from '../operation-board/operation-board-plan-store.js';
import { getPlanClans, normalizePlan } from '../operation-board/operation-board-plan-model.js';
import { buildReport } from '../operation-board/operation-board-report-model.js';
import {
    clearBoard, refreshBoardLabels, renderBoard, renderFilteredRoster,
    renderPhase, renderSyncState, setHelp
} from '../operation-board/operation-board-renderer.js';
import {
    renderClanLoading, renderClanOptions, renderPlanError, renderPlanLoading,
    renderPlanOptions, renderPlanRequired, renderStandaloneMode
} from '../operation-board/operation-board-source-controls.js';
import { loadOperationSource, NoActiveCwlError } from '../operation-board/operation-board-source.js';
import { applyOperationTabState, getBoardIdentity, getDefaultOperationTab, hasUsableBoardData } from '../operation-board/operation-board-tabs.js';
import { looksLikeClashTag, normalizeTag } from '../operation-board/operation-board-utils.js';
import { profileHTML } from '../profile/profile_popup.js';
import { getCurrentUserId } from '../utils/user.js';
let refs;
const planStore = createOperationPlanStore();
let selectedPlan = null;
let selectedClan = null;
let latestReport = null;
let syncState = 'idle';
let lastSyncAt = null;
let requestToken = 0;
let planSelectToken = 0;
let reportController;
let activeTab = null;
let activeBoardKey = '';

function setState(state, isError = false) {
    syncState = isError ? 'error' : state;
    if (syncState === 'ready' || syncState === 'imported') lastSyncAt = new Date();
    renderSyncState(refs, syncState, lastSyncAt);
    if (latestReport) {
        renderBoardContext(
            refs,
            latestReport,
            selectedClan,
            { lastSyncAt, syncState }
        );
    }
}

async function loadPlans() {
    const userId = getCurrentUserId();
    renderPlanLoading(refs, userId);
    if (!userId) return;
    try {
        const plans = await planStore.load(userId);
        renderPlanOptions(refs, plans);
    } catch (error) {
        console.error(error);
        renderPlanError(refs);
    }
}

async function selectPlan(planId) {
    const token = ++planSelectToken;
    cancelReportLoad();
    selectedPlan = null;
    selectedClan = null;
    clearReport();
    renderClanLoading(refs);
    if (!planId) {
        renderPlanRequired(refs);
        return;
    }
    const full = await planStore.resolve(planId);
    if (token !== planSelectToken) return;
    selectedPlan = normalizePlan(full);
    renderClanSelector(selectedPlan, token);
}

function renderClanSelector(plan, token = planSelectToken) {
    const clans = renderClanOptions(
        refs,
        plan,
        () => token === planSelectToken
    );
    if (!clans.length) setHelp(refs, t('op.noClansInPlan'));
}

function selectClan(clanTag) {
    selectedClan = getPlanClans(selectedPlan)
        .find(clan => clan.tag === clanTag) || null;
    if (selectedClan) void refreshClanReport(selectedClan);
}

function loadStandaloneClan() {
    const clanTag = normalizeTag(refs.standaloneInput.value);
    if (!clanTag || !looksLikeClashTag(clanTag)) {
        setHelp(refs, t('op.standaloneInvalid'), true);
        return;
    }
    selectedPlan = null;
    selectedClan = {
        tag: clanTag,
        name: clanTag,
        players: [],
        standalone: true
    };
    planSelectToken += 1;
    renderStandaloneMode(refs);
    void refreshClanReport(selectedClan);
}

async function refreshClanReport(clan) {
    const token = ++requestToken;
    reportController?.abort();
    reportController = new AbortController();
    const { signal } = reportController;
    setState('loading');
    setHelp(refs, t('op.loadingLive'));
    clearReport(false);
    try {
        const raw = await loadOperationSource({
            clan,
            plan: selectedPlan,
            signal
        });
        if (token !== requestToken || signal.aborted) return;
        selectedClan = raw.clan;
        latestReport = { ...buildReport(raw), predictionState: 'loading' };
        renderLatestReport();
        setState('ready');
        void enrichPredictions(latestReport, token, signal);
    } catch (error) {
        if (error?.name === 'AbortError' || token !== requestToken) return;
        if (error instanceof NoActiveCwlError || error?.code === 'NO_ACTIVE_CWL') {
            showNoActiveCwl();
            return;
        }
        console.error(error);
        setState('error', true);
        setHelp(refs, t('op.loadError'), true);
    }
}

async function enrichPredictions(report, token, signal) {
    try {
        const enriched = await enrichWithHistoricalPerformance(report);
        if (token !== requestToken || signal.aborted || latestReport !== report) return;
        latestReport = enriched;
        renderLatestReport();
    } catch (error) {
        if (token !== requestToken || signal.aborted) return;
        console.error(error);
        if (latestReport === report) {
            latestReport = { ...report, predictionState: 'unavailable' };
            renderLatestReport();
        }
    }
}

function showNoActiveCwl() {
    clearReport(false);
    renderPhase(refs, 'unknown');
    setState('idle');
    setHelp(refs, t('op.noActiveCwl'), true);
}

function cancelReportLoad() {
    requestToken += 1;
    reportController?.abort();
}

function clearReport(resetPhase = true) {
    latestReport = null;
    clearBoard(refs, selectedClan, resetPhase);
}

function renderLatestReport() {
    if (!latestReport) return;
    const boardKey = getBoardIdentity(latestReport, selectedClan);
    if (!hasUsableBoardData(latestReport)) {
        activeTab = null;
    } else if (boardKey !== activeBoardKey) {
        activeBoardKey = boardKey;
        activeTab = getDefaultOperationTab(latestReport);
    } else if (!activeTab) {
        activeTab = getDefaultOperationTab(latestReport);
    }
    renderBoard(
        refs,
        latestReport,
        selectedClan,
        { activeTab, lastSyncAt, syncState }
    );
}

function selectBoardTab(tab, focus = false) {
    if (!latestReport) return;
    activeTab = tab;
    applyOperationTabState(refs, activeTab);
    if (focus) {
        refs.tabButtons.find(button => button.dataset.opTab === activeTab)?.focus();
    }
}

function refreshLabels() {
    refreshBoardLabels(
        refs,
        latestReport,
        selectedClan,
        syncState,
        lastSyncAt,
        activeTab
    );
}

async function importJsonFile(file) {
    if (!file) return;
    try {
        applyImportedJson(await readOperationReportFile(file));
        setHelp(refs, t('op.importOk'));
    } catch (error) {
        console.error(error);
        setHelp(refs, t('op.importInvalid'), true);
    } finally {
        refs.importFile.value = '';
    }
}

export function applyImportedJson(data) {
    const report = normalizeImportedReport(data);
    if (report) {
        cancelReportLoad();
        latestReport = report;
        selectedPlan = data.plan ? normalizePlan(data.plan) : selectedPlan;
        selectedClan = data.clan || selectedClan;
        renderLatestReport();
        setState('imported');
        return;
    }
    const importedPlan = normalizePlan(data.plan || data);
    if (!importedPlan?.info) throw new Error('Unsupported JSON format');
    const id = importedPlan.id || 'imported-json-plan';
    const plan = { ...importedPlan, id };
    planStore.add(plan);
    selectedPlan = plan;
    if (!Array.from(refs.planSelect.options).some(item => item.value === id)) {
        const importedOption = document.createElement('option');
        importedOption.value = id;
        importedOption.textContent =
            `${plan.name} (${t('op.imported')})`;
        refs.planSelect.appendChild(importedOption);
    }
    refs.planSelect.value = id;
    renderClanSelector(plan);
    const clans = getPlanClans(plan);
    if (clans.length) {
        refs.clanSelect.value = clans[0].tag;
        selectedClan = clans[0];
        clearReport(false);
        setHelp(refs, t('op.importPlanOk'));
    }
    setState('imported');
}

async function init() {
    refs = initOperationBoardRefs();
    initI18n();
    await Promise.resolve(syncAuthSession()).catch(() => null);
    profileHTML();
    bindOperationBoardEvents(refs, {
        selectPlan,
        selectClan,
        refresh: () => selectedClan && refreshClanReport(selectedClan),
        filterRoster: () =>
            renderFilteredRoster(refs, latestReport, selectedClan),
        exportReport: () => exportOperationReport(latestReport),
        importFile: importJsonFile,
        loadStandalone: loadStandaloneClan,
        selectTab: selectBoardTab,
        refreshLabels
    });
    clearReport(false);
    refreshLabels();
    await loadPlans();
    renderPhase(refs, 'unknown');
    setState('idle');
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
