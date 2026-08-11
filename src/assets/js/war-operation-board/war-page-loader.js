import { getClanCurrentWarRequest, getClanWarLogRequest } from '../API/API-Clan.js';
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
        setEmpty(
            refs.empty,
            forceRefresh ? 'Refreshing current war' : 'Loading current war',
            'The board will show the latest official state when it is ready.'
        );
        setStatus(
            forceRefresh ? 'Refreshing live war data…' : 'Loading current war…'
        );
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
            setStatus('Live war data synced from the official Clash of Clans API.');
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
        refs.empty.hidden = true;
        refs.content.hidden = false;
        renderCurrent();
    }

    function showHistoryOnly() {
        setStatus(
            'This clan is not in a public regular Clan War. Recent history is still available.'
        );
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
            setStatus(
                error?.message || 'Historical performance could not be loaded.',
                true
            );
        }
    }

    function handleLoadError(error, token) {
        if (error?.name === 'AbortError' || token !== requestToken) return;
        clearState();
        refs.empty.hidden = false;
        refs.content.hidden = true;
        if (error instanceof ActiveCwlWarError || error?.code === 'ACTIVE_CWL_WAR') {
            setStatus(`${error.message} `, true, true);
            setEmpty(
                refs.empty,
                'This clan is in an active CWL war',
                'Regular War Board is for regular wars. Continue in CWL Tracker for the active league war.',
                true
            );
            return;
        }
        setStatus(error?.message || 'The current war could not be loaded.', true);
        setEmpty(
            refs.empty,
            'The current war is unavailable',
            error?.message || 'Try refreshing when the official API is available.'
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
        replaceAssignment
    };
}
