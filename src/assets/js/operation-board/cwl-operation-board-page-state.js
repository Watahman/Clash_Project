import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import {
    renderClanLoading,
    renderPlanLoading,
    renderStandaloneMode
} from './operation-board-source-controls.js?v=20260829-public-auth-v1';
import {
    clearBoard,
    refreshBoardLabels,
    renderBoard,
    renderSyncState,
    setHelp
} from './operation-board-renderer.js?v=20260829-public-auth-v1';
import {
    applyOperationTabState,
    getBoardIdentity,
    getDefaultOperationTab,
    hasUsableBoardData
} from './operation-board-tabs.js';
import { renderBoardContext } from './operation-board-context-renderer.js?v=20260829-public-auth-v1';

export function createCwlOperationBoardPageState({
    refs,
    planStore,
    operationAccess
}) {
    let selectedPlan = null;
    let selectedClan = null;
    let latestReport = null;
    let currentReport = null;
    let syncState = 'idle';
    let lastSyncAt = null;
    let planSelectToken = 0;
    let activeTab = null;
    let activeBoardKey = '';
    let authGeneration = 0;
    const runtime = {
        autoRefresh: null,
        historyController: null,
        importController: null,
        reportLoader: null,
        sourceBootstrap: null
    };

    function getSelectedClan() {
        return selectedClan;
    }

    function getSelectedPlan() {
        return selectedPlan;
    }

    function setSelectedClan(clan) {
        selectedClan = clan;
    }

    function setSelectedPlan(plan) {
        selectedPlan = plan;
    }

    function setRuntime(values = {}) {
        Object.assign(runtime, values);
    }

    function getRuntime(name) {
        return runtime[name];
    }

    function setState(state, isError = false) {
        syncState = isError ? 'error' : state;
        if (syncState === 'ready' || syncState === 'imported') {
            lastSyncAt = new Date();
        }
        renderSyncState(refs, syncState, lastSyncAt);
        if (latestReport) {
            renderBoardContext(refs, latestReport, selectedClan, {
                lastSyncAt,
                syncState
            });
        }
    }

    function clearReport(resetPhase = true) {
        latestReport = null;
        clearBoard(refs, selectedClan, resetPhase);
    }

    function clearBoardOnly(resetPhase = true) {
        clearBoard(refs, selectedClan, resetPhase);
    }

    function startPlanSelection() {
        const token = ++planSelectToken;
        runtime.reportLoader?.cancelReportLoad();
        selectedPlan = null;
        selectedClan = null;
        currentReport = null;
        runtime.historyController?.resetForClan();
        clearReport();
        renderClanLoading(refs);
        return token;
    }

    function isPlanSelectionCurrent(token) {
        return token === planSelectToken;
    }

    function getPlanSelectToken() {
        return planSelectToken;
    }

    function invalidatePlanSelection() {
        planSelectToken += 1;
    }

    function resetSourceState() {
        runtime.reportLoader?.cancelReportLoad();
        selectedPlan = null;
        selectedClan = null;
        currentReport = null;
        latestReport = null;
        planSelectToken += 1;
        activeTab = null;
        activeBoardKey = '';
        runtime.historyController?.resetForClan();
        clearReport();
        setState('idle');
    }

    function resetPrivateState() {
        runtime.reportLoader?.cancelReportLoad();
        planSelectToken += 1;
        selectedPlan = null;
        selectedClan = null;
        currentReport = null;
        latestReport = null;
        syncState = 'idle';
        lastSyncAt = null;
        activeTab = null;
        activeBoardKey = '';
        runtime.historyController?.resetForClan();
        clearReport();
        renderSyncState(refs, syncState, lastSyncAt);
    }

    function initializeAuthIdentity(state) {
        const userId = state?.status === 'authenticated'
            ? state.session?.user?.id || ''
            : '';
        planStore.setIdentity(userId, authGeneration);
    }

    function handleAuthTransition(state) {
        const userId = state?.status === 'authenticated'
            ? state.session?.user?.id || ''
            : '';
        authGeneration += 1;
        planStore.setIdentity(userId, authGeneration);
        resetPrivateState();
        renderPlanLoading(refs, userId);
        runtime.sourceBootstrap?.setMode('direct');
        renderStandaloneMode(refs);
        setHelp(refs, t('op.standaloneHelp'));
        window.dispatchEvent(new CustomEvent('clashtools:planner-auth-state-changed', {
            detail: state
        }));
        if (userId && !runtime.sourceBootstrap?.usesFixture()) {
            return true;
        }
        return false;
    }

    function getAuthGeneration() {
        return authGeneration;
    }

    function getSyncState() {
        return syncState;
    }

    function getLastSyncAt() {
        return lastSyncAt;
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
        renderBoard(refs, latestReport, selectedClan, {
            activeTab,
            lastSyncAt,
            syncState
        });
    }

    function selectBoardTab(tab, focus = false) {
        if (!latestReport) return;
        activeTab = tab;
        applyOperationTabState(
            refs,
            activeTab,
            runtime.historyController?.getMode() || latestReport?.mode || 'current'
        );
        if (focus) {
            refs.tabButtons
                .find(button => button.dataset.opTab === activeTab)
                ?.focus();
        }
    }

    function setActiveTab(tab) {
        activeTab = tab;
    }

    function refreshLabels() {
        runtime.autoRefresh?.sync();
        if (runtime.historyController?.refreshLabels()) return;
        refreshBoardLabels(
            refs,
            latestReport,
            selectedClan,
            syncState,
            lastSyncAt,
            activeTab
        );
    }

    return {
        clearReport,
        clearBoard: clearBoardOnly,
        getAuthGeneration,
        getAuthState: operationAccess.getAuthState,
        getCurrentReport: () => currentReport,
        getLatestReport: () => latestReport,
        getLastSyncAt,
        getPlanSelectToken,
        getRuntime,
        getSelectedClan,
        getSelectedPlan,
        getSyncState,
        handleAuthTransition,
        initializeAuthIdentity,
        invalidatePlanSelection,
        isPlanSelectionCurrent,
        refreshLabels,
        renderLatestReport,
        resetPrivateState,
        resetSourceState,
        selectBoardTab,
        setCurrentReport: report => { currentReport = report; },
        setActiveTab,
        setLatestReport: report => { latestReport = report; },
        setRuntime,
        setSelectedClan,
        setSelectedPlan,
        setState,
        startPlanSelection
    };
}
