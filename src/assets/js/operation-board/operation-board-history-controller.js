import {
    loadHistoricalCwlOverview,
    loadHistoricalCwlSeason,
    loadHistoricalCwlSeasons
} from './historical-cwl-client.js?v=20260826-cwl-cache-reset';
import {
    buildHistoricalCwlOverview,
    getLeagueChangeForSeason
} from './historical-cwl-overview-model.js';
import { reconstructHistoricalLeagues } from './historical-cwl-league-reconstructor.js?v=20260827-cwl-league-history';
import { getClanInfoRequest } from '../API/API-Clan.js?v=20260826-live-refresh';
import {
    buildHistoricalSeasonModel,
    formatSeason
} from './historical-cwl-season-model.js';
import { competeT as t } from './compete-locales.js';

export function createOperationBoardHistoryController({
                                                          refs,
                                                          getClan,
                                                          getCurrentReport,
                                                          onCurrent,
                                                          onHistorical,
                                                          onOverview,
                                                          onLoading,
                                                          onError
                                                      }) {
    let mode = 'current';
    let seasonIndex = [];
    let selectedSeason = 'current';
    let currentSeason = '';
    let currentLeague = null;
    let requestToken = 0;
    let controller;

    function resetForClan() {
        requestToken += 1;
        controller?.abort();
        mode = 'current';
        seasonIndex = [];
        selectedSeason = 'current';
        currentSeason = '';
        currentLeague = null;
        if (!refs.seasonSelect) return;
        refs.seasonSelect.disabled = true;
        refs.seasonSelect.replaceChildren(
            option('current', t('cwl.currentSeason'), true)
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
        controller = new AbortController();
        refs.seasonSelect.disabled = true;
        refs.seasonSelect.setAttribute('aria-busy', 'true');
        try {
            const [loadedSeasons, officialLeague] = await Promise.all([
                loadHistoricalCwlSeasons(
                    clan.tag,
                    { limit: 24, signal: controller.signal }
                ),
                loadCurrentLeague(report, clan.tag, controller.signal)
            ]);
            currentLeague = officialLeague;
            seasonIndex = reconstructHistoricalLeagues(
                loadedSeasons,
                currentLeague
            );
            if (token !== requestToken) return;
            renderOptions(Boolean(report));
            if (report) {
                selectedSeason = 'current';
                mode = 'current';
                refs.seasonSelect.value = 'current';
            } else if (defaultToOverview) {
                refs.seasonSelect.disabled = false;
                refs.seasonSelect.removeAttribute('aria-busy');
                await selectSeason('overview');
            }
        } catch (error) {
            if (error?.name === 'AbortError' || token !== requestToken) return;
            seasonIndex = [];
            renderOptions(Boolean(report));
            if (!report) onError(error, 'historical');
        } finally {
            if (token === requestToken) {
                refs.seasonSelect.disabled = !report && !seasonIndex.length;
                refs.seasonSelect.removeAttribute('aria-busy');
            }
        }
    }

    async function selectSeason(value, { forceRefresh = false } = {}) {
        const clan = getClan();
        if (!clan?.tag) return;
        selectedSeason = value;
        if (refs.seasonSelect) refs.seasonSelect.value = value;
        if (value === 'current') {
            const report = getCurrentReport();
            if (report) {
                mode = 'current';
                onCurrent(report);
            }
            return;
        }
        const token = ++requestToken;
        controller?.abort();
        controller = new AbortController();
        const targetMode = value === 'overview' ? 'overview' : 'historical';
        onLoading(targetMode);
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
                mode = 'overview';
                onOverview(buildHistoricalCwlOverview(seasons));
                return;
            }
            const data = await loadHistoricalCwlSeason(
                clan.tag,
                value,
                { signal: controller.signal, forceRefresh }
            );
            if (token !== requestToken || !data) return;
            const indexed = seasonIndex.find(item => item.season === value);
            const report = buildHistoricalSeasonModel({
                ...data,
                league: data.league?.name ? data.league : indexed?.league,
                position: data.position ?? indexed?.position ?? null
            });
            report.summary = {
                ...report.summary,
                leagueChange: getLeagueChangeForSeason(
                    report.season,
                    report.league,
                    seasonIndex,
                    {
                        position: report.position,
                        groupSize: data.standings?.length
                    }
                )
            };
            mode = 'historical';
            onHistorical(report);
        } catch (error) {
            if (error?.name === 'AbortError' || token !== requestToken) return;
            if (targetMode === 'historical' && Number(error?.status) === 404) {
                seasonIndex = seasonIndex.filter(
                    item => item.season !== value
                );
                renderOptions(Boolean(getCurrentReport()));
            }
            if (getCurrentReport()) {
                selectedSeason = 'current';
                mode = 'current';
                refs.seasonSelect.value = 'current';
            }
            onError(error, targetMode);
        }
    }

    function renderOptions(hasCurrent) {
        if (!getClan()?.tag) {
            resetForClan();
            return;
        }
        const options = [option('overview', t('cwl.overviewPhase'))];
        if (hasCurrent) {
            const label = currentSeason
                ? `${formatSeason(currentSeason)} · ${t('cwl.currentSeason')}`
                : t('cwl.currentSeason');
            options.push(option('current', label));
        }
        seasonIndex
            .filter(item => !hasCurrent || item.season !== currentSeason)
            .forEach(item => options.push(option(
                item.season,
                formatSeason(item.season)
            )));
        refs.seasonSelect.replaceChildren(...options);
        refs.seasonSelect.disabled = !options.length;
        const available = options.some(item => item.value === selectedSeason);
        refs.seasonSelect.value = available
            ? selectedSeason
            : hasCurrent ? 'current' : options[0]?.value || '';
    }

    return {
        resetForClan,
        syncForCurrentReport,
        selectSeason,
        refresh: () => selectSeason(selectedSeason, { forceRefresh: true }),
        refreshLabels: () => renderOptions(Boolean(getCurrentReport())),
        getMode: () => mode,
        getSelectedSeason: () => selectedSeason,
        getSeasonIndex: () => [...seasonIndex]
    };
}

async function loadCurrentLeague(report, clanTag, signal) {
    const known = report?.clanInfo?.warLeague;
    if (known?.name) return known;
    try {
        const clan = await getClanInfoRequest(clanTag, { signal });
        return clan?.warLeague?.name ? clan.warLeague : null;
    } catch (error) {
        if (error?.name === 'AbortError') throw error;
        return null;
    }
}

function option(value, label, disabled = false) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    element.disabled = disabled;
    return element;
}
