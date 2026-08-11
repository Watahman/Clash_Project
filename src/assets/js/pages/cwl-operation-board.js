import { syncAuthSession } from '../auth/auth-client.js';
import { initPlayerPerformancePopover } from '../cwl/cwl-player-performance-popover.js';
import { initI18n, t } from '../i18n/i18n.js';
import { exportOperationReport } from '../operation-board/operation-board-import-export.js';
import { createCwlOperationBoardBootstrap } from '../operation-board/cwl-operation-board-bootstrap.js';
import { createCwlOperationBoardControllers } from '../operation-board/cwl-operation-board-controllers.js';
import { createCwlOperationBoardReportLoader } from '../operation-board/cwl-operation-board-report-loader.js';
import { renderBoardContext } from '../operation-board/operation-board-context-renderer.js';
import { bindOperationBoardEvents } from '../operation-board/operation-board-page-events.js';
import { initOperationBoardRefs } from '../operation-board/operation-board-page-refs.js';
import { createOperationBoardAutoRefresh } from '../operation-board/operation-board-auto-refresh.js';
import { createOperationPlanStore } from '../operation-board/operation-board-plan-store.js';
import { initCompeteI18n } from '../operation-board/compete-locales.js';
import { getPlanClans, normalizePlan } from '../operation-board/operation-board-plan-model.js';
import {
    clearBoard, refreshBoardLabels, renderBoard, renderFilteredRoster,
    renderPhase, renderSyncState, setHelp
} from '../operation-board/operation-board-renderer.js';
import {
    renderClanLoading, renderClanOptions, renderPlanError, renderPlanLoading,
    renderPlanOptions, renderPlanRequired, renderStandaloneMode
} from '../operation-board/operation-board-source-controls.js';
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
let planSelectToken = 0;
let activeTab = null;
let activeBoardKey = '';
let historyController;
let importController;
let sourceBootstrap;
let autoRefresh;
let reportLoader;

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
    sourceBootstrap?.setMode('plan');
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
    sourceBootstrap?.setMode('direct');
    void refreshClanReport(selectedClan);
}

function refreshClanReport(clan) {
    return reportLoader?.refreshClanReport(clan);
}

function cancelReportLoad() {
    return reportLoader?.cancelReportLoad();
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
    autoRefresh?.sync();
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
    sourceBootstrap = createCwlOperationBoardBootstrap({
        refs,
        renderClanSelector,
        refreshClanReport,
        loadPlans,
        setSelectedPlan: plan => { selectedPlan = plan; },
        setSelectedClan: clan => { selectedClan = clan; },
        setHelp: (message, error = false) => setHelp(refs, message, error)
    });
    await sourceBootstrap.loadFixture();
    autoRefresh = createOperationBoardAutoRefresh({
        refs,
        getSelectedClan: () => selectedClan,
        getHistoryMode: () => historyController?.getMode(),
        getSyncState: () => syncState,
        getLastSyncAt: () => lastSyncAt,
        refresh: () => void refreshClanReport(selectedClan)
    });
    initI18n();
    initCompeteI18n(document, refreshLabels);
    initPlayerPerformancePopover({
        getCurrentContext: tag => historyController?.getPlayerContext(tag)
    });
    const controllers = createCwlOperationBoardControllers({
        refs,
        planStore,
        getClan: () => selectedClan,
        getCurrentReport: () => currentReport,
        getLatestReport: () => latestReport,
        setLatestReport: report => { latestReport = report; },
        setSelectedPlan: plan => { selectedPlan = plan; },
        setSelectedClan: clan => { selectedClan = clan; },
        setCurrentReport: report => { currentReport = report; },
        setActiveTab: tab => { activeTab = tab; },
        setState,
        setHelp: (message, error = false) => setHelp(refs, message, error),
        renderLatestReport,
        renderClanSelector,
        clearReport,
        cancelReportLoad,
        clearBoard: () => clearBoard(refs, selectedClan, false)
    });
    historyController = controllers.historyController;
    importController = controllers.importController;
    reportLoader = createCwlOperationBoardReportLoader({
        getSelectedPlan: () => selectedPlan,
        getHistoryController: () => historyController,
        setSelectedClan: clan => { selectedClan = clan; },
        setCurrentReport: report => { currentReport = report; },
        getCurrentReport: () => currentReport,
        setLatestReport: report => { latestReport = report; },
        getLatestReport: () => latestReport,
        setState,
        setHelp: (message, error = false) => setHelp(refs, message, error),
        clearReport,
        renderLatestReport,
        renderPhase: phase => renderPhase(refs, phase)
    });
    if (!sourceBootstrap.usesFixture()) {
        await Promise.resolve(syncAuthSession()).catch(() => null);
    }
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
        toggleAutoRefresh: () => autoRefresh.toggle(),
        filterRoster: () =>
            renderFilteredRoster(refs, latestReport, selectedClan),
        exportReport: () => exportOperationReport(latestReport),
        importFile: file => importController.importJsonFile(file),
        loadStandalone: loadStandaloneClan,
        selectTab: selectBoardTab,
        refreshLabels
    });
    sourceBootstrap.bindSourceMode();
    clearReport(false);
    refreshLabels();
    await sourceBootstrap.loadInitialSource();
    renderPhase(refs, 'unknown');
    setState('idle');
    autoRefresh.sync();
    autoRefresh.start();
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
