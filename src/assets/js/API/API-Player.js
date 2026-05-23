import * as config from "../Data/config.js"
import {fetchClashAPIRequest} from "./API-Client.js"

export async function getPlayerInfoRequest(playerID){
    const path = config._BASE_URL + config._EXT_PLAYER_INFO;
    const body = JSON.stringify({
        playerID: playerID
    })

    return fetchClashAPIRequest(path, body)
}

export async function getPlayerBattleLogRequest(playerID) {
    const path = config._BASE_URL + config._EXT_PLAYER_BATTLE_LOG;
    const body = JSON.stringify({
        playerID: playerID
    })

    return fetchClashAPIRequest(path, body)
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

    return fetchClashAPIRequest(path, body)
}