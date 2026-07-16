import * as config from '../Data/config.js';
import { fetchClashAPIRequest } from './API-Client.js';
import { cacheKeys } from '../cache/cache-keys.js';
import { CACHE_STALE, CACHE_TTL } from '../cache/cache-policy.js';

function request(path, resource, locationID = null, requestOptions = {}) {
    const body = locationID == null ? {} : { locationID };
    return fetchClashAPIRequest(
        config._BASE_URL + path,
        JSON.stringify(body),
        {
            key: cacheKeys.clashResource(resource, locationID || 'all'),
            ttlMs: resource.startsWith('ranking') ? CACHE_TTL.CLASH_RANKINGS : CACHE_TTL.CLASH_REFERENCE,
            staleMs: resource.startsWith('ranking') ? CACHE_STALE.MEDIUM : CACHE_STALE.LONG
        },
        requestOptions
    );
}

export const getLocationsRequest = options =>
    request(config._EXT_LOCATIONS, 'locations', null, options);
export const getLocationInfoRequest = (locationID, options) =>
    request(config._EXT_LOCATIONS_INFO, 'location', locationID, options);
export const getClanRankingsRequest = (locationID, options) =>
    request(config._EXT_LOCATIONS_RANKINGS_CLANS_INFO, 'ranking-clans', locationID, options);
export const getPlayerRankingsRequest = (locationID, options) =>
    request(config._EXT_LOCATIONS_RANKINGS_PLAYERS_INFO, 'ranking-players', locationID, options);
export const getBuilderPlayerRankingsRequest = (locationID, options) =>
    request(config._EXT_LOCATIONS_RANKINGS_PLAYERS_BUILDERBASE_INFO, 'ranking-builder-players', locationID, options);
export const getBuilderClanRankingsRequest = (locationID, options) =>
    request(config._EXT_LOCATIONS_RANKINGS_CLANS_BUILDERBASE_INFO, 'ranking-builder-clans', locationID, options);
export const getCapitalRankingsRequest = (locationID, options) =>
    request(config._EXT_LOCATIONS_RANKINGS_CAPITAL_INFO, 'ranking-capitals', locationID, options);
