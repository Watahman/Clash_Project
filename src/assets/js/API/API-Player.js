import * as config from "../Data/config.js"
import { fetchRequest } from "./API-Communication.js"

export function getPlayerInfoRequest(playerID, callback){
    const path = config._BASE_URL + config._EXT_PLAYER_INFO;
    const body = JSON.stringify({
        playerID: playerID
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

export function getPlayerBattleLogRequest(playerID, callback) {
    const path = config._BASE_URL + config._EXT_PLAYER_BATTLE_LOG;
    const body = JSON.stringify({
        playerID: playerID
    })

    fetchRequest(path, body, (data) => {callback(data)})
}

export function postPlayerVerifyTokenRequest(playerID, playerToken, callback){
    const path = config._BASE_URL + config._EXT_PLAYER_VERIFY_TOKEN;
    const body = JSON.stringify({
        playerID: playerID,
        playerToken: playerToken
    })
    console.log(body)
    fetchRequest(path, body, (data) => {callback(data)})
}

export function getPlayerLeagueHistoryRequest(playerID, callback){
    const path = config._BASE_URL + config._EXT_PLAYER_LEAGUE_HISTORY;
    const body = JSON.stringify({
        playerID: playerID
    })

    fetchRequest(path, body, (data) => {callback(data)})
}