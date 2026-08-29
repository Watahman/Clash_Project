import { initPlayerPerformancePopover } from '../cwl/cwl-player-performance-popover.js?v=20260829-public-auth-v1';
import { initI18n, t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { exportOperationReport } from '../operation-board/operation-board-import-export.js?v=20260829-public-auth-v1';
import { createCwlOperationBoardBootstrap } from '../operation-board/cwl-operation-board-bootstrap.js?v=20260829-public-auth-v1';
import { createCwlOperationBoardPageControllers } from '../operation-board/cwl-operation-board-page-controllers.js?v=20260829-public-auth-v1';
import { bindOperationBoardEvents } from '../operation-board/operation-board-page-events.js';
import { initOperationBoardRefs } from '../operation-board/operation-board-page-refs.js';
import { createOperationBoardAutoRefresh } from '../operation-board/operation-board-auto-refresh.js?v=20260829-public-auth-v1';
import { createOperationBoardAccess } from '../operation-board/operation-board-access.js?v=20260829-public-auth-v1';
import { createOperationPlanStore } from '../operation-board/operation-board-plan-store.js?v=20260829-public-auth-v1';
import { createCwlOperationBoardPageState } from '../operation-board/cwl-operation-board-page-state.js?v=20260829-public-auth-v1';
import { initCompeteI18n } from '../operation-board/compete-locales.js?v=20260829-public-auth-v1';
import { getPlanClans, normalizePlan } from '../operation-board/operation-board-plan-model.js?v=20260829-public-auth-v1';
import {
    renderClanOptions,
    renderPlanError,
    renderPlanLoading,
    renderPlanOptions,
    renderPlanRequired,
    renderStandaloneMode
} from '../operation-board/operation-board-source-controls.js?v=20260829-public-auth-v1';
import { renderFilteredRoster, renderPhase, setHelp } from '../operation-board/operation-board-renderer.js?v=20260829-public-auth-v1';
import { looksLikeClashTag, normalizeTag } from '../operation-board/operation-board-utils.js';
import { getCurrentUserId } from '../utils/user.js';

let refs;
const planStore = createOperationPlanStore();
let pageState;
let sourceBootstrap;
let autoRefresh;
let reportLoader;
let importController;
const operationAccess = createOperationBoardAccess({
    isFixture: () => sourceBootstrap?.usesFixture(),
    onAuthUnavailable: error => {
        console.error(error);
        if (refs) setHelp(refs, t('auth.sessionUnavailable'), true);
    }
});

function loadPlans() {
    return operationAccess.loadProtectedPlans({
        getFallbackUserId: getCurrentUserId,
        load: userId => planStore.load(userId),
        onLoading: userId => renderPlanLoading(refs, userId),
        onLoaded: plans => renderPlanOptions(refs, plans),
        onError: error => {
            console.error(error);
            renderPlanError(refs);
        }
    });
}

async function selectPlan(planId) {
    const token = pageState.startPlanSelection();
    if (!planId) {
        renderPlanRequired(refs);
        return;
    }
    const authorization = await operationAccess.requireProtectedAction(
        'saved-plan',
        () => planStore.resolve(planId)
    );
    if (!authorization.executed || !pageState.isPlanSelectionCurrent(token)) return;
    pageState.setSelectedPlan(normalizePlan(authorization.result));
    sourceBootstrap?.setMode('plan');
    renderClanSelector(pageState.getSelectedPlan(), token);
}

function renderClanSelector(plan, token = pageState.getPlanSelectToken()) {
    const clans = renderClanOptions(
        refs,
        plan,
        () => pageState.isPlanSelectionCurrent(token)
    );
    if (!clans.length) setHelp(refs, t('op.noClansInPlan'));
}

function selectClan(clanTag) {
    const clan = getPlanClans(pageState.getSelectedPlan())
        .find(candidate => candidate.tag === clanTag) || null;
    pageState.setSelectedClan(clan);
    if (!clan) return;
    autoRefresh?.resumeForLiveSource();
    pageState.setCurrentReport(null);
    pageState.getRuntime('historyController')?.resetForClan();
    void refreshClanReport(clan);
}

function loadStandaloneClan() {
    const clanTag = normalizeTag(refs.standaloneInput.value);
    if (!clanTag || !looksLikeClashTag(clanTag)) {
        setHelp(refs, t('op.standaloneInvalid'), true);
        return;
    }
    pageState.setSelectedPlan(null);
    pageState.setSelectedClan({
        tag: clanTag,
        name: clanTag,
        players: [],
        standalone: true
    });
    autoRefresh?.resumeForLiveSource();
    pageState.invalidatePlanSelection();
    pageState.setCurrentReport(null);
    pageState.getRuntime('historyController')?.resetForClan();
    renderStandaloneMode(refs);
    sourceBootstrap?.setMode('direct');
    void refreshClanReport(pageState.getSelectedClan());
}

function changeSourceMode(mode) {
    pageState.resetSourceState();
    if (mode === 'plan') {
        preparePlanSource();
        return;
    }
    prepareDirectSource();
}

function preparePlanSource() {
    refs.standaloneInput.value = '';
    refs.planSelect.value = '';
    renderPlanRequired(refs);
    setHelp(refs, t('op.help'));
    if (!hasLoadedPlans()) void loadPlans();
    refs.planSelect.focus();
}

function prepareDirectSource() {
    renderStandaloneMode(refs);
    refs.standaloneInput.value = '';
    setHelp(refs, t('op.standaloneHelp'));
    refs.standaloneInput.focus();
}

function hasLoadedPlans() {
    return Array.from(refs.planSelect.options || []).some(
        option => option.value && !option.disabled
    );
}

function refreshClanReport(clan, forceRefresh = false) {
    return reportLoader?.refreshClanReport(clan, forceRefresh);
}

export function applyImportedJson(data) {
    return importController.applyImportedJson(data);
}

async function init() {
    refs = initOperationBoardRefs();
    pageState = createCwlOperationBoardPageState({
        refs,
        planStore,
        operationAccess
    });
    sourceBootstrap = createCwlOperationBoardBootstrap({
        refs,
        renderClanSelector,
        refreshClanReport,
        loadPlans,
        setSelectedPlan: pageState.setSelectedPlan,
        setSelectedClan: pageState.setSelectedClan,
        setHelp: (message, error = false) => setHelp(refs, message, error),
        onSourceModeChange: changeSourceMode,
        onSourceModeRequest: mode => operationAccess.requestSourceMode(mode)
    });
    pageState.setRuntime({ sourceBootstrap });
    await sourceBootstrap.loadFixture();
    autoRefresh = createOperationBoardAutoRefresh({
        refs,
        getSelectedClan: pageState.getSelectedClan,
        getHistoryMode: () => pageState.getRuntime('historyController')?.getMode(),
        getSyncState: pageState.getSyncState,
        getLastSyncAt: pageState.getLastSyncAt,
        refresh: () => void refreshClanReport(pageState.getSelectedClan())
    });
    pageState.setRuntime({ autoRefresh });
    initI18n();
    initCompeteI18n(document, pageState.refreshLabels);
    initPlayerPerformancePopover({
        getCurrentContext: tag => pageState.getRuntime('historyController')?.getPlayerContext(tag)
    });
    const controllers = createCwlOperationBoardPageControllers({
        refs,
        planStore,
        pageState,
        renderClanSelector,
        setHelp: (message, error = false) => setHelp(refs, message, error),
        autoRefresh
    });
    pageState.setRuntime(controllers);
    importController = controllers.importController;
    reportLoader = controllers.reportLoader;
    pageState.setRuntime({ reportLoader });
    await operationAccess.resolveInitialState({ fixture: sourceBootstrap.usesFixture() });
    pageState.initializeAuthIdentity(operationAccess.getAuthState());
    if (!sourceBootstrap.usesFixture()) {
        operationAccess.bindAuthTransitions(nextState => {
            if (pageState.handleAuthTransition(nextState)) void loadPlans();
        });
    }
    bindOperationBoardEvents(refs, {
        selectPlan,
        selectClan,
        selectSeason: season => pageState.getRuntime('historyController').selectSeason(season),
        getMode: () => pageState.getRuntime('historyController').getMode(),
        refresh: () => {
            const clan = pageState.getSelectedClan();
            if (!clan) return;
            if (pageState.getRuntime('historyController').getMode() === 'current') {
                void refreshClanReport(clan, true);
            } else {
                void pageState.getRuntime('historyController').refresh();
            }
        },
        toggleAutoRefresh: () => autoRefresh.toggle(),
        filterRoster: () => renderFilteredRoster(
            refs,
            pageState.getLatestReport(),
            pageState.getSelectedClan()
        ),
        exportReport: () => exportOperationReport(pageState.getLatestReport()),
        importFile: file => importController.importJsonFile(file),
        loadStandalone: loadStandaloneClan,
        selectTab: pageState.selectBoardTab,
        refreshLabels: pageState.refreshLabels
    });
    sourceBootstrap.bindSourceMode();
    pageState.clearReport(false);
    pageState.refreshLabels();
    const queryTag = normalizeTag(new URLSearchParams(location.search).get('clan') || '');
    await operationAccess.initializeSource({
        sourceBootstrap,
        queryTag,
        isDirectTag: looksLikeClashTag,
        prepareDirectSource,
        loadDirect: tag => {
            refs.standaloneInput.value = tag;
            loadStandaloneClan();
        }
    });
    renderPhase(refs, 'unknown');
    pageState.setState('idle');
    autoRefresh.sync();
    autoRefresh.start();
}

const initialPageLoad = init();
window.clashtoolsRegisterInitialLoad?.(initialPageLoad);
