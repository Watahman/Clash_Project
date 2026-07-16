import * as config from '../Data/config.js';
import { fetchClashAPIRequest } from './API-Client.js';
import { cacheKeys } from '../cache/cache-keys.js';
import { CACHE_STALE, CACHE_TTL } from '../cache/cache-policy.js';

function request(path, resource, body = {}, requestOptions = {}) {
    return fetchClashAPIRequest(
        config._BASE_URL + path,
        JSON.stringify(body),
        {
            key: cacheKeys.clashResource(resource, ...Object.values(body)),
            ttlMs: CACHE_TTL.CLASH_REFERENCE,
            staleMs: CACHE_STALE.LONG
        },
        requestOptions
    );
}

export const getLeaguesRequest = options =>
    request(config._EXT_LEAGUE_LEAGUES, 'leagues', {}, options);
export const getLeagueInfoRequest = (leagueID, options) =>
    request(config._EXT_LEAGUE_LEAGUE_INFO, 'league', { leagueID }, options);
export const getLeagueSeasonsRequest = (leagueID, options) =>
    request(config._EXT_LEAGUE_LEAGUE_SEASONS, 'league-seasons', { leagueID }, options);
export const getLeagueSeasonInfoRequest = (leagueID, seasonID, options) =>
    request(config._EXT_LEAGUE_LEAGUE_SEASON_INFO, 'league-season', { leagueID, seasonID }, options);
export const getLeagueTiersRequest = options =>
    request(config._EXT_LEAGUE_LEAGUETIERS, 'league-tiers', {}, options);
export const getLeagueTierInfoRequest = (leagueTierID, options) =>
    request(config._EXT_LEAGUE_LEAGUETIERS_INFO, 'league-tier', { leagueTierID }, options);
export const getCapitalLeaguesRequest = options =>
    request(config._EXT_LEAGUE_CAPITAL_LEAGUES, 'capital-leagues', {}, options);
export const getCapitalLeagueInfoRequest = (leagueID, options) =>
    request(config._EXT_LEAGUE_CAPITAL_LEAGUE_INFO, 'capital-league', { leagueID }, options);
export const getBuilderBaseLeaguesRequest = options =>
    request(config._EXT_LEAGUE_BUILDERBASE_LEAGUES, 'builder-leagues', {}, options);
export const getBuilderBaseLeagueInfoRequest = (leagueID, options) =>
    request(config._EXT_LEAGUE_BUILDERBASE_LEAGUE_INFO, 'builder-league', { leagueID }, options);
export const getWarLeaguesRequest = options =>
    request(config._EXT_LEAGUE_WARLEAGUES, 'war-leagues', {}, options);
export const getWarLeagueInfoRequest = (leagueID, options) =>
    request(config._EXT_LEAGUE_WARLEAGUE_INFO, 'war-league', { leagueID }, options);
export const getLeagueGroupInfoRequest = (leagueGroupTag, leagueSeasonID, options) =>
    request(
        config._EXT_LEAGUE_LEAGUEGROUP_INFO,
        'league-group',
        { leagueGroupTag, leagueSeasonID },
        options
    );
