import * as config from "../Data/config.js"
import {fetchClashAPIRequest} from "./API-Client.js"
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";

export async function getClanCurrentWarLeagueGroupRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR_LEAGUEGROUP;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanLeagueGroup(clanTag),
        ttlMs: CACHE_TTL.CLASH_LEAGUE_GROUP,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getClanWarLeagueWarRequest(warTag) {
    const path = config._BASE_URL + config._EXT_CLAN_WARLEAGUES_WARS;
    const body = JSON.stringify({
        warTag: warTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanWar(warTag),
        ttlMs: CACHE_TTL.CLASH_WAR_LIVE,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getClanWarLogRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_WAR_LOG;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanWarLog(clanTag),
        ttlMs: CACHE_TTL.CLASH_WAR_ENDED,
        staleMs: CACHE_STALE.MEDIUM
    })
}

//configure parameters
export async function getClanSearchRequest() {
    const path = config._BASE_URL + config._EXT_CLAN_SEARCH;
    const body = JSON.stringify({
        // fill this with all the possible parameters on the clash api website
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanCurrentWar(clanTag),
        ttlMs: CACHE_TTL.CLASH_WAR_LIVE,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getClanCurrentWarRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanInfo(clanTag),
        ttlMs: CACHE_TTL.CLASH_CLAN_INFO,
        staleMs: CACHE_STALE.LONG
    })
}

// real clan info
export async function getClanInfoRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_INFO;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashClanMembers(clanTag),
        ttlMs: CACHE_TTL.CLASH_CLAN_MEMBERS,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getClanMembersRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_MEMBERS;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body)
}

export async function getClanCapitalRaidSeasonsRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_CAPITALRAIDSEASONS;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body)
}
