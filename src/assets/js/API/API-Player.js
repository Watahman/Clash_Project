import * as config from "../Data/config.js"
import {fetchClashAPIRequest} from "./API-Client.js"
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";

export async function getPlayerInfoRequest(playerID){
    const path = config._BASE_URL + config._EXT_PLAYER_INFO;
    const body = JSON.stringify({
        playerID: playerID
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashPlayer(playerID),
        ttlMs: CACHE_TTL.CLASH_PLAYER,
        staleMs: CACHE_STALE.MEDIUM
    })
}

export async function getPlayerBattleLogRequest(playerID) {
    const path = config._BASE_URL + config._EXT_PLAYER_BATTLE_LOG;
    const body = JSON.stringify({
        playerID: playerID
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashPlayerBattleLog(playerID),
        ttlMs: CACHE_TTL.CLASH_WAR_LIVE,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function postPlayerVerifyTokenRequest(playerID, playerToken){
    const path = config._BASE_URL + config._EXT_PLAYER_VERIFY_TOKEN;
    const body = JSON.stringify({
        playerID: playerID,
        playerToken: playerToken
    })
    return fetchClashAPIRequest(path, body)
}

export async function getPlayerLeagueHistoryRequest(playerID){
    const path = config._BASE_URL + config._EXT_PLAYER_LEAGUE_HISTORY;
    const body = JSON.stringify({
        playerID: playerID
    })

    return fetchClashAPIRequest(path, body, {
        key: cacheKeys.clashPlayerLeagueHistory(playerID),
        ttlMs: CACHE_TTL.CLASH_PLAYER_SLOW,
        staleMs: CACHE_STALE.LONG
    })
}
