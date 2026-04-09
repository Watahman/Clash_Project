import * as config from "../Data/config.js"
import { fetchRequest } from "./API-Communication.js"

export function getClanCurrentWarLeagueGroupRequest(clanTag, callback) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR_LEAGUEGROUP;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

export function getClanWarLeagueWarRequest(warTag, callback) {
    const path = config._BASE_URL + config._EXT_CLAN_WARLEAGUES_WARS;
    const body = JSON.stringify({
        wartTag: warTag
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

export function getClanWarLogRequest(clanTag, callback) {
    const path = config._BASE_URL + config._EXT_CLAN_WAR_LOG;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

//configure parameters
export function getClanSearchRequest(callback) {
    const path = config._BASE_URL + config._EXT_CLAN_SEARCH;
    const body = JSON.stringify({
        // fill this with all the possible parameters on the clash api website
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

export function getClanCurrentWarRequest(clanTag, callback) {
    const path = config._BASE_URL + config._EXT_CLAN_CURRENTWAR;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

// real clan info
export function getClanInfoRequest(clanTag, callback) {
    const path = config._BASE_URL + config._EXT_CLAN_INFO;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

export function getClanMembersRequest(clanTag, callback) {
    const path = config._BASE_URL + config._EXT_CLAN_MEMBERS;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

export function getClanCapitalRaidSeasonsRequest(clanTag, callback) {
    const path = config._BASE_URL + config._EXT_CLAN_CAPITALRAIDSEASONS;
    const body = JSON.stringify({
        clanTag: clanTag
    })

    fetchRequest(path, body, (data) => {callback(data)})
}