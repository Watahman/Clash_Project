import { t } from '../i18n/i18n.js';
import { enrichWithHistoricalPerformance } from './operation-board-performance.js';
import { buildReport } from './operation-board-report-model.js';
import { loadOperationSource, NoActiveCwlError } from './operation-board-source.js';

export function createCwlOperationBoardReportLoader({
    getSelectedPlan,
    getHistoryController,
    setSelectedClan,
    setCurrentReport,
    getCurrentReport,
    setLatestReport,
    getLatestReport,
    setState,
    setHelp,
    clearReport,
    renderLatestReport,
    renderPhase,
    loadSource = loadOperationSource,
    makeReport = buildReport,
    enrichReport = enrichWithHistoricalPerformance
}) {
    let requestToken = 0;
    let reportController;

    async function refreshClanReport(clan) {
        const token = ++requestToken;
        reportController?.abort();
        reportController = new AbortController();
        const { signal } = reportController;
        setState('loading');
        setHelp(t('op.loadingLive'));
        clearReport(false);
        try {
            const raw = await loadSource({
                clan,
                plan: getSelectedPlan(),
                signal
            });
            if (!isCurrent(token, signal)) return;
            const report = createReport(raw);
            setSelectedClan(raw.clan);
            setCurrentReport(report);
            setLatestReport(report);
            renderLatestReport();
            setState('ready');
            void getHistoryController()?.syncForCurrentReport(report);
            if (!raw.fixture) void enrichPredictions(report, token, signal);
        } catch (error) {
            await handleLoadError(error, token);
        }
    }

    function createReport(raw) {
        return {
            ...makeReport(raw),
            predictionState: raw.fixture
                ? raw.predictionState || 'unavailable'
                : 'loading'
        };
    }

    async function enrichPredictions(report, token, signal) {
        try {
            const enriched = await enrichReport(report);
            if (!isCurrent(token, signal)) return;
            if (getCurrentReport() === report) setCurrentReport(enriched);
            if (getLatestReport() !== report) return;
            setLatestReport(enriched);
            renderLatestReport();
        } catch (error) {
            if (!isCurrent(token, signal)) return;
            console.error(error);
            setUnavailable(report);
        }
    }

    function setUnavailable(report) {
        const current = { ...report, predictionState: 'unavailable' };
        if (getCurrentReport() === report) setCurrentReport(current);
        if (getLatestReport() !== report) return;
        setLatestReport(current);
        renderLatestReport();
    }

    async function handleLoadError(error, token) {
        if (error?.name === 'AbortError' || token !== requestToken) return;
        if (error instanceof NoActiveCwlError || error?.code === 'NO_ACTIVE_CWL') {
            return openHistoryOverview();
        }
        console.error(error);
        setState('error', true);
        setHelp(t('op.loadError'), true);
    }

    async function openHistoryOverview() {
        clearReport(false);
        setCurrentReport(null);
        renderPhase('unknown');
        setState('idle');
        setHelp('Loading CWL history…');
        await getHistoryController()?.syncForCurrentReport(
            null,
            { defaultToOverview: true }
        );
    }

    function cancelReportLoad() {
        requestToken += 1;
        reportController?.abort();
    }

    function isCurrent(token, signal) {
        return token === requestToken && !signal.aborted;
    }

    return {
        cancelReportLoad,
        refreshClanReport
    };
}
