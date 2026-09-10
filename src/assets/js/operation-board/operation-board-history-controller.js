import {
    loadHistoricalCwlOverview,
    loadHistoricalCwlSeason,
    loadHistoricalCwlSeasons
} from './historical-cwl-client.js?v=20260910-cwl-history-progressive';
import {
    buildHistoricalCwlOverview
} from './historical-cwl-overview-model.js?v=20260910-cwl-history-progressive';
import { reconstructHistoricalLeagues } from './historical-cwl-league-reconstructor.js?v=20260827-cwl-league-history';
import {
    buildHistoricalOverviewFromSummaries,
    createHistoricalSeasonDetail,
    createHistoricalSeasonOption,
    createHistoricalSeasonPreview,
    isCurrentHistoricalDetail,
    loadHistoricalCurrentLeague,
    renderHistoricalSeasonOptions,
    setHistoricalDetailBusy
} from './historical-cwl-progressive.js?v=20260910-cwl-history-progressive';
import { competeT as t } from './compete-locales.js?v=20260910-cwl-history-progressive';
export function createOperationBoardHistoryController({
                                                          refs,
                                                          getClan,
                                                          getCurrentReport,
                                                          onCurrent,
                                                          onHistorical,
                                                          onHistoricalDetail,
                                                          onOverview,
                                                          onLoading,
                                                          onDetailLoading,
                                                          onDetailError,
                                                          onError
                                                      }) {
    let mode = 'current';
    let seasonIndex = [];
    let selectedSeason = 'current';
    let currentSeason = '';
    let currentLeague = null;
    let requestToken = 0;
    let controller;
    let detailController;
    let detailToken = 0;
    let detailRequestedTab = null;
    let detailSeason = '';
    let detailReport = null;
    const isDetailCurrent = (token, currentDetailToken) =>
        isCurrentHistoricalDetail(
            token, currentDetailToken, requestToken, detailToken,
            detailController?.signal
        );
    function resetDetailState() {
        if (detailRequestedTab) {
            setHistoricalDetailBusy(refs, detailRequestedTab, false);
        }
        detailToken += 1;
        detailController?.abort();
        detailController = null;
        detailRequestedTab = null;
        detailSeason = '';
        detailReport = null;
    }
    function resetForClan() {
        requestToken += 1;
        controller?.abort();
        resetDetailState();
        mode = 'current';
        seasonIndex = [];
        selectedSeason = 'current';
        currentSeason = '';
        currentLeague = null;
        if (!refs.seasonSelect) return;
        refs.seasonSelect.disabled = true;
        refs.seasonSelect.removeAttribute('aria-busy');
        refs.seasonSelect.replaceChildren(
            createHistoricalSeasonOption('current', t('cwl.currentSeason'), true)
        );
    }
    async function syncForCurrentReport(
        report,
        { defaultToOverview = false } = {}
    ) {
        currentSeason = report?.leagueGroup?.season || report?.season || '';
        const clan = getClan();
        if (!clan?.tag || !refs.seasonSelect) return;
        const token = ++requestToken;
        controller?.abort();
        resetDetailState();
        controller = new AbortController();
        refs.seasonSelect.disabled = true;
        refs.seasonSelect.setAttribute('aria-busy', 'true');
        try {
            const [loadedSeasons, officialLeague] = await Promise.all([
                loadHistoricalCwlSeasons(
                    clan.tag,
                    { limit: 24, signal: controller.signal }
                ),
                loadHistoricalCurrentLeague(report, clan.tag, controller.signal)
            ]);
            if (token !== requestToken) return;
            currentLeague = officialLeague;
            seasonIndex = reconstructHistoricalLeagues(
                loadedSeasons,
                currentLeague
            );
            renderHistoricalSeasonOptions(refs, seasonIndex, {
                hasCurrent: Boolean(report),
                currentSeason,
                selectedSeason,
                getClan,
                resetForClan
            });
            if (report) {
                selectedSeason = 'current';
                mode = 'current';
                refs.seasonSelect.value = 'current';
            } else if (defaultToOverview) {
                refs.seasonSelect.disabled = false;
                refs.seasonSelect.removeAttribute('aria-busy');
                renderOverviewFromSummaries(loadedSeasons, token);
            }
        } catch (error) {
            if (error?.name === 'AbortError' || token !== requestToken) return;
            seasonIndex = [];
            renderHistoricalSeasonOptions(refs, seasonIndex, {
                hasCurrent: Boolean(report),
                currentSeason,
                selectedSeason,
                getClan,
                resetForClan
            });
            if (!report) onError(error, 'historical');
        } finally {
            if (token === requestToken) {
                refs.seasonSelect.disabled = !report && !seasonIndex.length;
                refs.seasonSelect.removeAttribute('aria-busy');
            }
        }
    }
    function renderOverviewFromSummaries(loadedSeasons, token) {
        if (token !== requestToken) return;
        const { seasons, overview } = buildHistoricalOverviewFromSummaries(
            loadedSeasons,
            currentLeague
        );
        seasonIndex = seasons;
        selectedSeason = 'overview';
        mode = 'overview';
        refs.seasonSelect.value = 'overview';
        onOverview(overview);
    }
    async function selectSeason(value, { forceRefresh = false } = {}) {
        const clan = getClan();
        if (!clan?.tag) return;
        selectedSeason = value;
        if (refs.seasonSelect) refs.seasonSelect.value = value;
        if (value === 'current') {
            requestToken += 1;
            controller?.abort();
            resetDetailState();
            const report = getCurrentReport();
            if (report) {
                mode = 'current';
                onCurrent(report);
            }
            return;
        }
        const token = ++requestToken;
        controller?.abort();
        resetDetailState();
        controller = new AbortController();
        const targetMode = value === 'overview' ? 'overview' : 'historical';
        if (targetMode === 'overview') onLoading(targetMode);
        try {
            if (targetMode === 'overview') {
                const loadedSeasons = await loadHistoricalCwlOverview(
                    clan.tag,
                    {
                        limit: 24,
                        signal: controller.signal,
                        forceRefresh
                    }
                );
                if (token !== requestToken) return;
                const seasons = reconstructHistoricalLeagues(
                    loadedSeasons,
                    currentLeague
                );
                seasonIndex = seasons;
                mode = 'overview';
                onOverview(buildHistoricalCwlOverview(seasons));
                return;
            }
            const indexed = seasonIndex.find(item => item.season === value);
            if (token !== requestToken || !indexed) return;
            const report = createHistoricalSeasonPreview(
                indexed,
                clan,
                seasonIndex
            );
            mode = 'historical';
            onHistorical(report, { preview: true });
        } catch (error) {
            if (error?.name === 'AbortError' || token !== requestToken) return;
            if (targetMode === 'historical' && Number(error?.status) === 404) {
                seasonIndex = seasonIndex.filter(
                    item => item.season !== value
                );
                renderHistoricalSeasonOptions(refs, seasonIndex, {
                    hasCurrent: Boolean(getCurrentReport()),
                    currentSeason,
                    selectedSeason,
                    getClan,
                    resetForClan
                });
            }
            if (getCurrentReport()) {
                selectedSeason = 'current';
                mode = 'current';
                refs.seasonSelect.value = 'current';
            }
            onError(error, targetMode);
        }
    }
    async function ensureDetailForTab(tab, { forceRefresh = false } = {}) {
        if (!['league', 'roster'].includes(tab)) return;
        if (mode !== 'historical' || !selectedSeason || selectedSeason === 'current') {
            return;
        }
        const clan = getClan();
        if (!clan?.tag) return;
        if (!forceRefresh && detailReport?.season === selectedSeason) return;
        if (!forceRefresh && detailSeason === selectedSeason) return;
        detailRequestedTab = tab;
        detailSeason = selectedSeason;
        const token = requestToken;
        const currentDetailToken = ++detailToken;
        detailController?.abort();
        detailController = new AbortController();
        setHistoricalDetailBusy(refs, tab, true);
        onDetailLoading?.(tab);
        try {
            const data = await loadHistoricalCwlSeason(
                clan.tag,
                selectedSeason,
                {
                    signal: detailController.signal,
                    forceRefresh
                }
            );
            if (!isDetailCurrent(token, currentDetailToken)) return;
            if (!data) {
                const missing = new Error('Historical season details unavailable');
                missing.code = 'HISTORICAL_DETAIL_UNAVAILABLE';
                throw missing;
            }
            const indexed = seasonIndex.find(item => item.season === selectedSeason);
            const detail = createHistoricalSeasonDetail(
                data,
                indexed,
                seasonIndex
            );
            detailReport = detail;
            onHistoricalDetail?.(detail, tab);
        } catch (error) {
            if (!isDetailCurrent(token, currentDetailToken)) return;
            if (error?.name !== 'AbortError') onDetailError?.(error, tab);
        } finally {
            if (isDetailCurrent(token, currentDetailToken)) {
                setHistoricalDetailBusy(refs, tab, false);
            }
        }
    }

    return {
        resetForClan,
        syncForCurrentReport,
        selectSeason,
        ensureDetailForTab,
        refresh: () => mode === 'historical' && detailRequestedTab
            && detailSeason === selectedSeason
            ? ensureDetailForTab(detailRequestedTab, { forceRefresh: true })
            : selectSeason(selectedSeason, { forceRefresh: true }),
        refreshLabels: () => renderHistoricalSeasonOptions(refs, seasonIndex, {
            hasCurrent: Boolean(getCurrentReport()),
            currentSeason,
            selectedSeason,
            getClan,
            resetForClan
        }),
        getMode: () => mode,
        getSelectedSeason: () => selectedSeason,
        getSeasonIndex: () => [...seasonIndex]
    };
}
