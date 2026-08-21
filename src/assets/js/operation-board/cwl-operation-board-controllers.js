import { createOperationBoardHistoryPage } from './operation-board-history-page.js';
import { createOperationBoardImportController } from './operation-board-import-controller.js';

export function createCwlOperationBoardControllers({
    refs,
    planStore,
    getClan,
    getCurrentReport,
    getLatestReport,
    setLatestReport,
    setSelectedPlan,
    setSelectedClan,
    setCurrentReport,
    setActiveTab,
    setState,
    setHelp,
    renderLatestReport,
    renderClanSelector,
    clearReport,
    cancelReportLoad,
    clearBoard,
    onImported
}) {
    const historyController = createOperationBoardHistoryPage({
        refs,
        getClan,
        getCurrentReport,
        getLatestReport,
        setLatestReport,
        renderLatestReport,
        setActiveTab,
        setState,
        setHelp,
        clearBoard
    });
    const importController = createOperationBoardImportController({
        refs,
        planStore,
        setSelectedPlan,
        setSelectedClan,
        setLatestReport,
        setCurrentReport,
        cancelReportLoad,
        renderLatestReport,
        renderClanSelector,
        clearReport,
        setState,
        setHelp,
        onImported
    });
    return { historyController, importController };
}
