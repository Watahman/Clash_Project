import { getCurrentCwlPlayerContext } from './operation-board-player-context.js';
import { createOperationBoardHistoryController } from './operation-board-history-controller.js';
import { getHistoricalCwlPlayerContext } from './historical-cwl-season-model.js';
import { renderHistoryOverview } from './operation-board-renderer.js';

export function createOperationBoardHistoryPage({
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
                                                }) {
    let latestOverview = null;
    let controller;
    const renderOverview = overview => {
        renderHistoryOverview(refs, overview, getClan(), {
            selectSeason: season => controller.selectSeason(season)
        });
    };
    controller = createOperationBoardHistoryController({
        refs,
        getClan,
        getCurrentReport,
        onCurrent: report => {
            setLatestReport(report);
            latestOverview = null;
            renderLatestReport();
            setState('ready');
        },
        onHistorical: report => {
            setLatestReport(report);
            latestOverview = null;
            setActiveTab('summary');
            renderLatestReport();
            setState('ready');
        },
        onOverview: overview => {
            setLatestReport(null);
            latestOverview = overview;
            setActiveTab(null);
            renderOverview(overview);
            setState('ready');
        },
        onLoading: mode => {
            setLatestReport(null);
            latestOverview = null;
            clearBoard();
            setState('loading');
            setHelp(
                mode === 'overview'
                    ? 'Loading multi-season CWL history…'
                    : 'Loading the selected CWL season…'
            );
        },
        onError: (error, mode) => {
            console.error(error);
            const current = getCurrentReport();
            if (current) {
                setLatestReport(current);
                renderLatestReport();
            }
            setState('error', true);
            setHelp(
                mode === 'historical' && Number(error?.status) === 404
                    ? 'No retrievable CWL data exists for this clan in that season.'
                    : 'Historical CWL data is currently unavailable.',
                true
            );
        }
    });
    return {
        ...controller,
        refreshLabels() {
            controller.refreshLabels();
            if (controller.getMode() !== 'overview' || !latestOverview) {
                return false;
            }
            renderOverview(latestOverview);
            return true;
        },
        getPlayerContext(tag) {
            const report = getLatestReport();
            return report?.mode === 'historical'
                ? getHistoricalCwlPlayerContext(report, tag)
                : getCurrentCwlPlayerContext(report, tag);
        }
    };
}
