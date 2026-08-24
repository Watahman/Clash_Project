import { pollHistoryAnalysis } from './advanced-stats-analysis.js?v=20260814-advanced-stats-v4';

export async function waitForHistoricalAnalysis({
    state,
    version,
    tracking,
    renderPage,
    loadStatistics,
    setDataStatus,
    errorMessage
}) {
    const result = await pollHistoryAnalysis({
        fetchStatus: () => state.api.getTracking(state.playerTag),
        initial: tracking,
        isStale: () => version !== state.requestVersion,
        onUpdate: async (nextTracking, nextAnalysis) => {
            state.tracking = nextTracking;
            state.analysis = nextAnalysis;
            state.analysisRequested = nextAnalysis.active
                || (nextAnalysis.error && Number(nextTracking?.battlesProcessed || 0) === 0);
            renderPage();
        }
    });
    if (!result || version !== state.requestVersion) return;
    state.analysis = result;
    if (result.ready) {
        state.analysisRequested = false;
        renderPage();
        await loadStatistics({ requestVersion: version, manageBusy: false });
        return;
    }
    if (result.error) {
        state.analysisRequested = true;
        setDataStatus(errorMessage, 'error');
        renderPage();
    }
}

