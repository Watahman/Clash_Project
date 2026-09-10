import {
    buildHistoricalSeasonModel,
    buildHistoricalSeasonPreview,
    formatSeason
} from './historical-cwl-season-model.js?v=20260910-cwl-history-progressive';
import {
    buildHistoricalCwlOverview,
    getLeagueChangeForSeason
} from './historical-cwl-overview-model.js?v=20260910-cwl-history-progressive';
import { reconstructHistoricalLeagues } from './historical-cwl-league-reconstructor.js?v=20260827-cwl-league-history';
import { competeT as t } from './compete-locales.js?v=20260910-cwl-history-progressive';
import { getClanInfoRequest } from '../API/API-Clan.js?v=20260910-cwl-history-progressive';

export function createHistoricalSeasonPreview(data, clan, seasonIndex) {
    const preview = buildHistoricalSeasonPreview(data, clan);
    preview.summary.leagueChange = getLeagueChangeForSeason(
        preview.season,
        preview.league,
        seasonIndex,
        { position: preview.position }
    );
    return preview;
}

export function buildHistoricalOverviewFromSummaries(summaries, league) {
    const seasons = reconstructHistoricalLeagues(summaries, league);
    return { seasons, overview: buildHistoricalCwlOverview(seasons) };
}

export function createHistoricalSeasonDetail(data, indexed, seasonIndex) {
    const indexedRecord = historicalRecord(indexed);
    const detail = buildHistoricalSeasonModel({
        ...data,
        league: data.league?.name ? data.league : indexed?.league,
        position: indexed?.position ?? data.position ?? null,
        record: indexedRecord || data.record
    });
    detail.summary = {
        ...detail.summary,
        leagueChange: getLeagueChangeForSeason(
            detail.season,
            detail.league,
            seasonIndex,
            {
                position: detail.position,
                groupSize: data.standings?.length
            }
        )
    };
    return detail;
}

function historicalRecord(indexed) {
    if (!indexed) return null;
    const source = indexed.record || indexed;
    const values = [source.wins, source.losses, source.draws];
    if (!values.some(value => Number.isFinite(Number(value)))) return null;
    return {
        wins: Math.max(0, Number(source.wins) || 0),
        losses: Math.max(0, Number(source.losses) || 0),
        draws: Math.max(0, Number(source.draws) || 0)
    };
}

export function setHistoricalDetailBusy(refs, tab, busy) {
    refs.tabButtons?.forEach(button => {
        if (button.dataset.opTab === tab) {
            button.setAttribute('aria-busy', String(busy));
        }
    });
}

export function isCurrentHistoricalDetail(
    selectionToken,
    detailToken,
    activeSelectionToken,
    activeDetailToken,
    signal
) {
    return selectionToken === activeSelectionToken
        && detailToken === activeDetailToken
        && !signal?.aborted;
}

export function renderHistoricalSeasonOptions(
    refs,
    seasonIndex,
    { hasCurrent, currentSeason, selectedSeason, getClan, resetForClan }
) {
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

function option(value, label) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
}

export function createHistoricalSeasonOption(value, label, disabled = false) {
    const element = option(value, label);
    element.disabled = disabled;
    return element;
}

export async function loadHistoricalCurrentLeague(report, clanTag, signal) {
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
