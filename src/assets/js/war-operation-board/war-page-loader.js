import { getClanCurrentWarRequest, getClanWarLogRequest } from '../API/API-Clan.js';
import { competeT as t } from '../operation-board/compete-locales.js';
import { enrichWithHistoricalPerformance } from '../operation-board/operation-board-performance.js?v=20260729-2';
import { getWarAssignments } from '../Supabase/Supabase-WarAssignments.js';
import { fixtureWar, setEmptyState } from './war-page-utils.js';
import { buildWarHistory } from './war-history-model.js';
import {
    ActiveCwlWarError,
    buildWarBoardReport
} from './war-report-model.js';

export function createWarLoadController({
    refs,
    getSelectedTag,
    getFixture = () => null,
    setStatus,
    renderCurrent,
    selectHistoryTab,
    fetchCurrentWar = getClanCurrentWarRequest,
    fetchWarLog = getClanWarLogRequest,
    fetchAssignments = getWarAssignments,
    enrichReport = enrichWithHistoricalPerformance,
    buildReport = buildWarBoardReport,
    buildHistory = buildWarHistory,
    setEmpty = setEmptyState
}) {
    let controller = null;
    let requestToken = 0;
    let report = null;
    let historyData = null;
    let assignments = [];
    let lastEmptyCopy = null;

    function getState() {
        return { report, historyData, assignments };
    }

    function replaceAssignment(saved) {
        assignments = assignments.filter(item =>
            !(item.playerTag === saved.playerTag
                && item.attackSlot === saved.attackSlot)
        ).concat(saved);
    }

    function removeAssignment(assignmentId) {
        assignments = assignments.filter(item => item.id !== assignmentId);
    }

    function cancel() {
        requestToken += 1;
        controller?.abort();
    }

    function beginLoad(forceRefresh) {
        controller?.abort();
        controller = new AbortController();
        const token = ++requestToken;
        clearState();
        showLoading(forceRefresh);
        return { token, signal: controller.signal, fixture: getFixture() };
    }

    function clearState() {
        report = null;
        historyData = null;
        assignments = [];
    }

    function showLoading(forceRefresh) {
        refs.refresh.disabled = true;
        refs.content.classList.remove('is-refreshing');
        refs.content.hidden = true;
        refs.empty.hidden = false;
        setEmptyCopy(
            forceRefresh ? 'war.refreshingTitle' : 'war.loadingTitle',
            forceRefresh ? 'war.refreshingCopy' : 'war.loadingCopy'
        );
        setStatus(t(forceRefresh ? 'war.refreshingCurrent' : 'war.loadingCurrent'));
    }

    async function load(forceRefresh = false) {
        if (!getSelectedTag()) return;
        const { token, signal, fixture } = beginLoad(forceRefresh);
        try {
            const [rawWar, rawHistory] = await loadSource(
                fixture,
                getSelectedTag(),
                signal,
                forceRefresh
            );
            if (!isCurrent(token, signal)) return;
            report = buildReport(rawWar, getSelectedTag());
            historyData = buildHistory(rawHistory, getSelectedTag());
            assignments = await loadAssignments(report, fixture);
            if (!isCurrent(token, signal)) return;
            showReport();
            if (!report.wars.length) return showHistoryOnly();
            setStatus(t('war.statusSynced'));
            if (fixture) return;
            await enrichLoadedReport(report, token, signal);
        } catch (error) {
            handleLoadError(error, token);
        } finally {
            finishLoad(token);
        }
    }

    async function loadSource(fixture, clanTag, signal, forceRefresh) {
        if (fixture) return [fixtureWar(fixture), fixture.data?.warLog || []];
        return Promise.all([
            fetchCurrentWar(clanTag, { signal, forceRefresh }),
            fetchWarLog(clanTag, { signal, forceRefresh })
        ]);
    }

    async function loadAssignments(currentReport, fixture) {
        if (fixture || !currentReport.warKey) return [];
        return fetchAssignments(currentReport.clan.tag, currentReport.warKey)
            .catch(() => []);
    }

    function showReport() {
        lastEmptyCopy = null;
        refs.empty.hidden = true;
        refs.content.hidden = false;
        renderCurrent();
    }

    function showHistoryOnly() {
        setStatus(t('war.statusHistoryAvailable'));
        selectHistoryTab();
    }

    async function enrichLoadedReport(initialReport, token, signal) {
        try {
            const enriched = await enrichReport(initialReport);
            if (!isCurrent(token, signal)) return;
            report = enriched;
            renderCurrent();
        } catch (error) {
            if (!isCurrent(token, signal)) return;
            setStatus(t('war.historyUnavailable'), true);
        }
    }

    function handleLoadError(error, token) {
        if (error?.name === 'AbortError' || token !== requestToken) return;
        clearState();
        refs.empty.hidden = false;
        refs.content.hidden = true;
        if (error instanceof ActiveCwlWarError || error?.code === 'ACTIVE_CWL_WAR') {
            setStatus(t('war.activeCwlStatus'), true, true);
            setEmptyCopy('war.activeCwlTitle', 'war.activeCwlCopy', true);
            return;
        }
        setStatus(t('war.currentUnavailable'), true);
        setEmptyCopy('war.currentUnavailable', 'war.tryRefresh');
    }

    function setEmptyCopy(titleKey, copyKey, cwlLink = false) {
        lastEmptyCopy = { titleKey, copyKey, cwlLink };
        setEmpty(refs.empty, t(titleKey), t(copyKey), cwlLink);
    }

    function refreshLabels() {
        if (!lastEmptyCopy) return;
        setEmptyCopy(
            lastEmptyCopy.titleKey,
            lastEmptyCopy.copyKey,
            lastEmptyCopy.cwlLink
        );
    }

    function finishLoad(token) {
        if (token !== requestToken) return;
        refs.refresh.disabled = false;
        refs.content.classList.remove('is-refreshing');
    }

    function isCurrent(token, signal) {
        return token === requestToken && !signal.aborted;
    }

    return {
        cancel,
        getState,
        load,
        removeAssignment,
        refreshLabels,
        replaceAssignment
    };
}
