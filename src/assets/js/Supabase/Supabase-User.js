import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";
import { removeCached } from "../cache/local-cache.js";

export async function createUser(name, email, password) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_MAKE
    const data = {
        name: name,
        email: email,
        password: password
    };
    return databaseRequestWithBody(path, data)
}

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
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data, {
        key: cacheKeys.userAccounts(userId),
        ttlMs: CACHE_TTL.USER_ACCOUNTS,
        staleMs: CACHE_STALE.MEDIUM
    })
}

export async function checkUser(email, password) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_CHECK
    const data = {
        email: email,
        password: password
    };
    return databaseRequestWithBody(path, data)
}

export async function checkUserId(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_IDCHECK
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data, {
        key: cacheKeys.userInfo(userId),
        ttlMs: CACHE_TTL.USER_INFO,
        staleMs: CACHE_STALE.MEDIUM
    })
}

export async function addBaseToUser(userId, base) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_ADD_ACCOUNT
    const data = {
        userId: userId,
        base: base
    };
    return databaseRequestWithBody(path, data).then(result => {
        removeCached(cacheKeys.userInfo(userId));
        removeCached(cacheKeys.userCheck(userId));
        removeCached(cacheKeys.userAccounts(userId));
        return result;
    })
}

export async function updateUserName(userId, name) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_UPDATE_NAME;
    const data = { userId, name };
    return databaseRequestWithBody(path, data).then(result => {
        removeCached(cacheKeys.userInfo(userId));
        removeCached(cacheKeys.userCheck(userId));
        return result;
    });
}

export async function changeUserPassword(userId, currentPassword, newPassword) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_CHANGE_PASSWORD;
    const data = { userId, currentPassword, newPassword };
    return databaseRequestWithBody(path, data);
}
