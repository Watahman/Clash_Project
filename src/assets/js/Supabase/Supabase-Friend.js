import * as config from "../Data/config.js";
import {databaseRequestWithBody} from "./Supabase-Client.js";
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";
import { removeCached } from "../cache/local-cache.js";

function invalidateFriendCaches(...userIds) {
    userIds.filter(Boolean).forEach(userId => {
        removeCached(cacheKeys.friends(userId));
        removeCached(cacheKeys.friendsPending(userId));
        removeCached(cacheKeys.friendsRequests(userId));
    });
}

export async function addFriend(userId, friendCode) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_ADD_FRIEND
    const data = {
        friendCode: friendCode
    };
    return databaseRequestWithBody(path, data).then(result => {
        invalidateFriendCaches(userId);
        return result;
    })
}

export async function getPendingFriendRequests(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GET_PENDING_FRIENDS
    return databaseRequestWithBody(path, {}, {
        key: cacheKeys.friendsPending(userId),
        ttlMs: CACHE_TTL.FRIEND_REQUESTS,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getFriendRequests(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GET_FRIEND_REQUESTS
    return databaseRequestWithBody(path, {}, {
        key: cacheKeys.friendsRequests(userId),
        ttlMs: CACHE_TTL.FRIEND_REQUESTS,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getFriends(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GET_FRIENDS
    return databaseRequestWithBody(path, {}, {
        key: cacheKeys.friends(userId),
        ttlMs: CACHE_TTL.FRIENDS,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function acceptFriendRequest(userId, friendId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_ACCEPT_FRIEND
    const data = {
        friendId: friendId
    };
    return databaseRequestWithBody(path, data).then(result => {
        invalidateFriendCaches(userId, friendId);
        return result;
    })
}

export async function rejectFriendRequest(userId, friendId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_REJECT_FRIEND
    const data = {
        friendId: friendId
    };
    return databaseRequestWithBody(path, data).then(result => {
        invalidateFriendCaches(userId, friendId);
        return result;
    })
}
