import { createCwlOperationBoardControllers } from './cwl-operation-board-controllers.js?v=20260829-public-auth-v1';
import { createCwlOperationBoardReportLoader } from './cwl-operation-board-report-loader.js?v=20260829-public-auth-v1';
import { renderPhase } from './operation-board-renderer.js?v=20260829-public-auth-v1';

export function createCwlOperationBoardPageControllers({
    refs,
    planStore,
    pageState,
    renderClanSelector,
    setHelp,
    autoRefresh
}) {
    const controllers = createCwlOperationBoardControllers({
        refs,
        planStore,
        getClan: pageState.getSelectedClan,
        getCurrentReport: pageState.getCurrentReport,
        getLatestReport: pageState.getLatestReport,
        setLatestReport: pageState.setLatestReport,
        setSelectedPlan: pageState.setSelectedPlan,
        setSelectedClan: pageState.setSelectedClan,
        setCurrentReport: pageState.setCurrentReport,
        setActiveTab: pageState.setActiveTab,
        setState: pageState.setState,
        setHelp,
        renderLatestReport: pageState.renderLatestReport,
        renderClanSelector,
        clearReport: pageState.clearReport,
        cancelReportLoad: () => pageState.getRuntime('reportLoader')?.cancelReportLoad(),
        clearBoard: () => pageState.clearBoard(false),
        onImported: () => autoRefresh.pauseForImportedData()
    });
    const reportLoader = createCwlOperationBoardReportLoader({
        getSelectedPlan: pageState.getSelectedPlan,
        getHistoryController: () => pageState.getRuntime('historyController'),
        setSelectedClan: pageState.setSelectedClan,
        setCurrentReport: pageState.setCurrentReport,
        getCurrentReport: pageState.getCurrentReport,
        setLatestReport: pageState.setLatestReport,
        getLatestReport: pageState.getLatestReport,
        setState: pageState.setState,
        setHelp,
        clearReport: pageState.clearReport,
        renderLatestReport: pageState.renderLatestReport,
        renderPhase: phase => renderPhase(refs, phase)
    });
    return { ...controllers, reportLoader };
}
