import * as config from "../Data/config.js";
import {databaseRequestWithBody} from "./Supabase-Client.js";

export async function setPlanToDatabase(userId, planId, name, planInfo) {
    const path = config._BASE_URL + config._EXT_SUPA_CWLPLANNER_DATA_SET
    const data = {
        userId: userId,
        planId: planId,
        name: name,
        planInfo: planInfo,
    };
    return databaseRequestWithBody(path, data)
}

export async function getPlanFromDatabase(name) {
    const path = config._BASE_URL + config._EXT_SUPA_CWLPLANNER_DATA_GET
    const data = {
        name: name
    };
    return databaseRequestWithBody(path, data)
}

export async function getAllPlansFromDatabase(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_CWLPLANNER_DATA_GET_ALL
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data)
}