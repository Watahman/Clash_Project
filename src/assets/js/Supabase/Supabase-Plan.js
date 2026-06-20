import * as config from "../Data/config.js";
import {databaseRequestWithBody} from "./Supabase-Client.js";
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";
import { removeCached, setCached } from "../cache/local-cache.js";

export async function setPlanToDatabase(userId, planId, name, planInfo) {
    const path = config._BASE_URL + config._EXT_SUPA_CWLPLANNER_DATA_SET
    const data = {
        userId: userId,
        planId: planId,
        name: name,
        planInfo: planInfo,
    };
    return databaseRequestWithBody(path, data).then(result => {
        const savedPlanId = result?.uuid || result?.id || planId;
        removeCached(cacheKeys.plansOfUser(userId));
        if (savedPlanId) {
            setCached(cacheKeys.plan(savedPlanId), {
                id: savedPlanId,
                uuid: savedPlanId,
                name,
                info: planInfo
            }, CACHE_TTL.PLANS, CACHE_STALE.SHORT, 'supabase');
        }
        return result;
    })
}

export async function getPlanFromDatabase(planId) {
    const path = config._BASE_URL + config._EXT_SUPA_CWLPLANNER_DATA_GET
    const data = {
        planId: planId
    };
    return databaseRequestWithBody(path, data, {
        key: cacheKeys.plan(planId),
        ttlMs: CACHE_TTL.PLANS,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getAllPlansFromDatabase(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_CWLPLANNER_DATA_GET_ALL
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data, {
        key: cacheKeys.plansOfUser(userId),
        ttlMs: CACHE_TTL.PLANS,
        staleMs: CACHE_STALE.SHORT
    })
}
