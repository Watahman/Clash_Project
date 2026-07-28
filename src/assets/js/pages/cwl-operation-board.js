import { syncAuthSession } from '../auth/auth-client.js';
import { initPlayerPerformancePopover } from '../cwl/cwl-player-performance-popover.js';
import { initI18n, t } from '../i18n/i18n.js';
import { exportOperationReport } from '../operation-board/operation-board-import-export.js';
import { createOperationBoardImportController } from '../operation-board/operation-board-import-controller.js';
import { renderBoardContext } from '../operation-board/operation-board-context-renderer.js';
import { bindOperationBoardEvents } from '../operation-board/operation-board-page-events.js';
import { enrichWithHistoricalPerformance } from '../operation-board/operation-board-performance.js';
import { createOperationBoardHistoryPage } from '../operation-board/operation-board-history-page.js';
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
let currentReport = null;
let syncState = 'idle';
let lastSyncAt = null;
let requestToken = 0;
let planSelectToken = 0;
let reportController;
let activeTab = null;
let activeBoardKey = '';
let historyController;
let importController;

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
    currentReport = null;
    historyController?.resetForClan();
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
    if (selectedClan) {
        currentReport = null;
        historyController?.resetForClan();
        void refreshClanReport(selectedClan);
    }
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
    currentReport = null;
    historyController?.resetForClan();
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
        currentReport = { ...buildReport(raw), predictionState: 'loading' };
        latestReport = currentReport;
        renderLatestReport();
        setState('ready');
        void historyController?.syncForCurrentReport(currentReport);
        void enrichPredictions(latestReport, token, signal);
    } catch (error) {
        if (error?.name === 'AbortError' || token !== requestToken) return;
        if (error instanceof NoActiveCwlError || error?.code === 'NO_ACTIVE_CWL') {
            await openHistoryOverview();
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
        if (token !== requestToken || signal.aborted) return;
        if (currentReport === report) currentReport = enriched;
        if (latestReport !== report) return;
        latestReport = enriched;
        renderLatestReport();
    } catch (error) {
        if (token !== requestToken || signal.aborted) return;
        console.error(error);
        if (currentReport === report) {
            currentReport = { ...report, predictionState: 'unavailable' };
        }
        if (latestReport === report) {
            latestReport = currentReport;
            renderLatestReport();
        }
    }
}

async function openHistoryOverview() {
    clearReport(false);
    currentReport = null;
    renderPhase(refs, 'unknown');
    setState('idle');
    setHelp(refs, 'Loading CWL history…');
    await historyController?.syncForCurrentReport(
        null,
        { defaultToOverview: true }
    );
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
    applyOperationTabState(
        refs,
        activeTab,
        historyController?.getMode() || latestReport?.mode || 'current'
    );
    if (focus) {
        refs.tabButtons.find(button => button.dataset.opTab === activeTab)?.focus();
    }
}

function refreshLabels() {
    if (historyController?.refreshLabels()) return;
    refreshBoardLabels(
        refs,
        latestReport,
        selectedClan,
        syncState,
        lastSyncAt,
        activeTab
    );
}

export function applyImportedJson(data) {
    return importController.applyImportedJson(data);
}

async function init() {
    refs = initOperationBoardRefs();
    initI18n();
    initPlayerPerformancePopover({
        getCurrentContext: tag => historyController?.getPlayerContext(tag)
    });
    historyController = createOperationBoardHistoryPage({
        refs,
        getClan: () => selectedClan,
        getCurrentReport: () => currentReport,
        getLatestReport: () => latestReport,
        setLatestReport: report => { latestReport = report; },
        renderLatestReport,
        setActiveTab: tab => { activeTab = tab; },
        setState,
        setHelp: (message, error = false) => setHelp(refs, message, error),
        clearBoard: () => clearBoard(refs, selectedClan, false)
    });
    importController = createOperationBoardImportController({
        refs,
        planStore,
        setSelectedPlan: plan => { selectedPlan = plan; },
        setSelectedClan: clan => { selectedClan = clan; },
        setLatestReport: report => { latestReport = report; },
        setCurrentReport: report => { currentReport = report; },
        cancelReportLoad,
        renderLatestReport,
        renderClanSelector,
        clearReport,
        setState,
        setHelp: (message, error = false) => setHelp(refs, message, error)
    });
    await Promise.resolve(syncAuthSession()).catch(() => null);
    profileHTML();
    bindOperationBoardEvents(refs, {
        selectPlan,
        selectClan,
        selectSeason: season => historyController.selectSeason(season),
        getMode: () => historyController.getMode(),
        refresh: () => {
            if (!selectedClan) return;
            if (historyController.getMode() === 'current') {
                void refreshClanReport(selectedClan);
            } else {
                void historyController.refresh();
            }
        },
        filterRoster: () =>
            renderFilteredRoster(refs, latestReport, selectedClan),
        exportReport: () => exportOperationReport(latestReport),
        importFile: file => importController.importJsonFile(file),
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
