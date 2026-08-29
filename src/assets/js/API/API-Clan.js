import * as config from "../Data/config.js"
import {fetchClashAPIRequest} from "./API-Client.js?v=20260829-public-auth-v1"
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";

export async function getClanCurrentWarLeagueGroupRequest(clanTag, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR_LEAGUEGROUP;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanLeagueGroup(clanTag),
        ttlMs: CACHE_TTL.CLASH_LEAGUE_GROUP,
        staleMs: CACHE_STALE.SHORT
    }, requestOptions)
}

export async function getClanWarLeagueWarRequest(warTag, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_WARLEAGUES_WARS;
    const body = JSON.stringify({
        warTag: warTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanWar(warTag),
        ttlMs: CACHE_TTL.CLASH_WAR_LIVE,
        staleMs: CACHE_STALE.SHORT
    }, requestOptions)
}

export async function getClanWarLogRequest(clanTag, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_WAR_LOG;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanWarLog(clanTag),
        ttlMs: CACHE_TTL.CLASH_WAR_ENDED,
        staleMs: CACHE_STALE.MEDIUM
    }, requestOptions)
}

export async function getClanSearchRequest(filters = {}, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_SEARCH;
    const body = JSON.stringify(filters);

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanSearch(filters),
        ttlMs: CACHE_TTL.CLASH_CLAN_SEARCH,
        staleMs: CACHE_STALE.MEDIUM
    }, requestOptions)
}

export async function getClanCurrentWarRequest(clanTag, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanCurrentWar(clanTag),
        ttlMs: CACHE_TTL.CLASH_WAR_LIVE,
        staleMs: CACHE_STALE.SHORT
    }, requestOptions)
}

// real clan info
export async function getClanInfoRequest(clanTag, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_INFO;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanInfo(clanTag),
        ttlMs: CACHE_TTL.CLASH_CLAN_INFO,
        staleMs: CACHE_STALE.LONG
    }, requestOptions)
}

export async function getClanMembersRequest(clanTag, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_MEMBERS;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanMembers(clanTag),
        ttlMs: CACHE_TTL.CLASH_CLAN_MEMBERS,
        staleMs: CACHE_STALE.SHORT
    }, requestOptions)
}

export async function getClanCapitalRaidSeasonsRequest(clanTag, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_CLAN_CAPITALRAIDSEASONS;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanRaidSeasons(clanTag),
        ttlMs: CACHE_TTL.CLASH_RAID_SEASONS,
        staleMs: CACHE_STALE.MEDIUM
    }, requestOptions)
}
