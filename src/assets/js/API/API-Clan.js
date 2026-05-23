import * as config from "../Data/config.js"
import {fetchClashAPIRequest} from "./API-Client.js"

export async function getClanCurrentWarLeagueGroupRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR_LEAGUEGROUP;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body)
}

export async function getClanWarLeagueWarRequest(warTag) {
    const path = config._BASE_URL + config._EXT_CLAN_WARLEAGUES_WARS;
    const body = JSON.stringify({
        wartTag: warTag
    })

    return fetchClashAPIRequest(path, body)
}

export async function getClanWarLogRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_WAR_LOG;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body)
}

//configure parameters
export async function getClanSearchRequest() {
    const path = config._BASE_URL + config._EXT_CLAN_SEARCH;
    const body = JSON.stringify({
        // fill this with all the possible parameters on the clash api website
    })

    return fetchClashAPIRequest(path, body)
}

export async function getClanCurrentWarRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body)
}

// real clan info
export async function getClanInfoRequest(clanTag) {
    const path = config._BASE_URL + config._EXT_CLAN_INFO;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    return fetchClashAPIRequest(path, body)
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