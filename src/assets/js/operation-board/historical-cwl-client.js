import * as config from '../Data/config.js';
import { requestJson } from '../utils/request-json.js';
import { normalizeTag } from './operation-board-utils.js';

const seasonIndexCache = new Map();
const seasonDetailCache = new Map();
const overviewCache = new Map();

export async function loadHistoricalCwlSeasons(
    clanTag,
    { limit = 8, signal, forceRefresh = false } = {}
) {
    const tag = normalizeTag(clanTag);
    const key = `${tag}:${limit}`;
    if (!forceRefresh && seasonIndexCache.has(key)) {
        return seasonIndexCache.get(key);
    }
    const response = await get(config._EXT_CWL_HISTORY_SEASONS, {
        clanTag: tag,
        limit
    }, signal);
    const seasons = Array.isArray(response?.seasons) ? response.seasons : [];
    seasonIndexCache.set(key, seasons);
    return seasons;
}

export async function loadHistoricalCwlSeason(
    clanTag,
    season,
    { signal, forceRefresh = false } = {}
) {
    const tag = normalizeTag(clanTag);
    const key = `${tag}:${season}`;
    if (!forceRefresh && seasonDetailCache.has(key)) {
        return seasonDetailCache.get(key);
    }
    const response = await get(config._EXT_CWL_HISTORY, {
        clanTag: tag,
        season
    }, signal);
    const detail = response?.season || null;
    if (detail) seasonDetailCache.set(key, detail);
    return detail;
}

export async function loadHistoricalCwlOverview(
    clanTag,
    { limit = 8, signal, forceRefresh = false } = {}
) {
    const tag = normalizeTag(clanTag);
    const key = `${tag}:${limit}`;
    if (!forceRefresh && overviewCache.has(key)) {
        return overviewCache.get(key);
    }
    const response = await get(config._EXT_CWL_HISTORY_OVERVIEW, {
        clanTag: tag,
        limit
    }, signal);
    const seasons = Array.isArray(response?.seasons) ? response.seasons : [];
    overviewCache.set(key, seasons);
    seasons.forEach(detail => {
        if (detail?.season) {
            seasonDetailCache.set(`${tag}:${detail.season}`, detail);
        }
    });
    return seasons;
}

export function clearHistoricalCwlSessionCache() {
    seasonIndexCache.clear();
    seasonDetailCache.clear();
    overviewCache.clear();
}

async function get(path, params, signal) {
    const query = new URLSearchParams(params);
    return requestJson(
        `${config._BASE_URL}${path}?${query}`,
        {
            method: 'GET',
            signal,
            loading: 'background',
            timeoutMs: 45_000
        }
    );
}
