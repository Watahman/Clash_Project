import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js?v=20260829-public-auth-v1";
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";
import { clearCachePrefix, invalidateUserCache, removeCached } from "../cache/local-cache.js?v=20260829-public-auth-v1";

export async function getUserInfo(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_INFO
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data, {
        key: cacheKeys.userCheck(userId),
        ttlMs: CACHE_TTL.USER_INFO,
        staleMs: CACHE_STALE.MEDIUM
    })
}

export async function getUserBases(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_BASES
    return databaseRequestWithBody(path, {}, {
        key: cacheKeys.userAccounts(userId),
        ttlMs: CACHE_TTL.USER_ACCOUNTS,
        staleMs: CACHE_STALE.MEDIUM
    })
}

export async function checkUserId(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_IDCHECK
    return databaseRequestWithBody(path, {}, {
        key: cacheKeys.userInfo(userId),
        ttlMs: CACHE_TTL.USER_INFO,
        staleMs: CACHE_STALE.MEDIUM
    })
}

export async function addBaseToUser(userId, base, playerToken) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_ADD_ACCOUNT
    const data = {
        base: base,
        playerToken: playerToken
    };
    return databaseRequestWithBody(path, data).then(async result => {
        await invalidateUserCache(userId);
        await Promise.all([
            clearCachePrefix('users.'),
            clearCachePrefix('groups.')
        ]);
        removeCached(cacheKeys.userInfo(userId));
        removeCached(cacheKeys.userCheck(userId));
        removeCached(cacheKeys.userAccounts(userId));
        return result;
    })
}

export async function updateUserName(userId, name) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_UPDATE_NAME;
    const data = { name };
    return databaseRequestWithBody(path, data).then(async result => {
        await Promise.all([
            removeCached(cacheKeys.userInfo(userId)),
            removeCached(cacheKeys.userCheck(userId)),
            clearCachePrefix('friends.'),
            clearCachePrefix('groups.')
        ]);
        return result;
    });
}
