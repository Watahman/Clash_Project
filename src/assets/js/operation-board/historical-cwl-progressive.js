import {
    buildHistoricalSeasonModel,
    buildHistoricalSeasonPreview,
    formatSeason
} from './historical-cwl-season-model.js?v=20260910-cwl-history-progressive';
import {
    buildHistoricalCwlOverview,
    getLeagueChangeForSeason
} from './historical-cwl-overview-model.js?v=20260910-cwl-history-progressive';
import { loadHistoricalCwlSeason } from './historical-cwl-client.js?v=20260910-cwl-history-progressive';
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

export function mergeHistoricalSeasonSummary(summary, detail) {
    const merged = { ...summary, ...detail };
    const fields = ['clan', 'stars', 'destruction', 'dataQuality'];
    fields.forEach(field => {
        if (isMissing(detail?.[field])) merged[field] = summary?.[field];
    });
    merged.season = summary?.season || detail?.season || '';
    merged.league = namedLeague(detail?.league)
        ? detail.league
        : summary?.league || detail?.league || null;
    merged.position = isMissing(detail?.position)
        ? summary?.position ?? null
        : detail.position;
    merged.record = mergeRecord(summary?.record || summary, detail);
    return merged;
}

export function validateHistoricalSeasonDetail(expectedSeason, detail) {
    if (detail?.season === expectedSeason) return detail;
    const error = new Error(
        `Historical season detail mismatch for ${expectedSeason}`
    );
    error.code = 'HISTORICAL_DETAIL_SEASON_MISMATCH';
    throw error;
}

export function hydrateHistoricalOverview(
    clanTag,
    summaries,
    {
        signal,
        concurrency = 3,
        onSeason,
        onError
    } = {}
) {
    const queue = uniqueSeasonSummaries(summaries);
    const workerCount = Math.min(
        3,
        Math.max(1, Number(concurrency) || 3),
        queue.length
    );
    if (!workerCount || signal?.aborted) return Promise.resolve();
    let cursor = 0;
    const worker = async () => {
        while (cursor < queue.length) {
            if (signal?.aborted) return;
            const summary = queue[cursor++];
            try {
                const detail = validateHistoricalSeasonDetail(
                    summary.season,
                    await loadHistoricalCwlSeason(
                        clanTag,
                        summary.season,
                        { signal }
                    )
                );
                if (signal?.aborted) return;
                onSeason?.(
                    mergeHistoricalSeasonSummary(summary, detail),
                    summary
                );
            } catch (error) {
                if (error?.name === 'AbortError' || signal?.aborted) return;
                onError?.(error, summary);
            }
        }
    };
    return Promise.all(
        Array.from({ length: workerCount }, () => worker())
    ).then(() => undefined);
}

export function createHistoricalOverviewHydrator({
    getClan,
    onSeason,
    onError
} = {}) {
    let controller = null;
    let token = 0;
    let clanTag = '';
    const cancel = () => {
        token += 1;
        controller?.abort();
        controller = null;
        clanTag = '';
    };
    const start = summaries => {
        const clan = getClan?.();
        if (!clan?.tag) return Promise.resolve();
        cancel();
        clanTag = String(clan.tag);
        const activeToken = token;
        controller = new AbortController();
        const signal = controller.signal;
        const isActive = () => activeToken === token
            && clanTag === String(getClan?.()?.tag || '')
            && !signal.aborted;
        const promise = hydrateHistoricalOverview(clan.tag, summaries, {
            signal,
            onSeason: (detail, summary) => {
                if (isActive()) onSeason?.(detail, summary);
            },
            onError: (error, summary) => {
                if (isActive()) onError?.(error, summary);
            }
        });
        promise.then(
            () => { if (activeToken === token) controller = null; },
            () => { if (activeToken === token) controller = null; }
        );
        return promise;
    };
    return { cancel, start };
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

function uniqueSeasonSummaries(summaries = []) {
    const unique = new Map();
    summaries.forEach(summary => {
        const season = String(summary?.season || '').trim();
        if (season && !unique.has(season)) unique.set(season, summary);
    });
    return Array.from(unique.values());
}

function mergeRecord(summaryRecord, detail) {
    const detailRecord = detail?.record || detail || {};
    const record = ['wins', 'losses', 'draws'].reduce((result, key) => {
        const summaryValue = finiteRecordValue(summaryRecord?.[key]);
        const value = summaryValue ?? finiteRecordValue(detailRecord[key]);
        if (value != null) result[key] = value;
        return result;
    }, {});
    return Object.keys(record).length ? record : null;
}

function finiteRecordValue(value) {
    if (isMissing(value)) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function namedLeague(league) {
    return Boolean(String(league?.name || '').trim());
}

function isMissing(value) {
    return value == null || value === '';
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
