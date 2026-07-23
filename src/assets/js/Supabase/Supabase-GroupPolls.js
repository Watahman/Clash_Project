import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";
import { clearCachePrefix, removeCached } from "../cache/local-cache.js";

function invalidatePollCaches(groupId, userId) {
    clearCachePrefix(`groups.polls:${encodeURIComponent(groupId)}:`);
    removeCached(cacheKeys.groupInfo(groupId));
    if (userId) removeCached(cacheKeys.groupsOfUser(userId));
}

export async function getGroupPolls(groupId, userId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLLS_GET;
    return databaseRequestWithBody(path, { groupId }, {
        key: cacheKeys.groupPolls(groupId, userId),
        ttlMs: CACHE_TTL.GROUP_POLLS,
        staleMs: CACHE_STALE.SHORT
    });
}

export async function createGroupPoll(groupId, userId, title, rounds = 7) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLL_CREATE;
    return databaseRequestWithBody(path, { groupId, title, rounds }).then(result => {
        invalidatePollCaches(groupId, userId);
        removeCached(cacheKeys.notifications(userId));
        return result;
    });
}

export async function answerGroupPoll(groupId, userId, pollId, accounts) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLL_ANSWER;
    return databaseRequestWithBody(path, { groupId, pollId, accounts }).then(result => {
        invalidatePollCaches(groupId, userId);
        return result;
    });
}

export async function setGroupPollStatus(groupId, userId, pollId, status) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLL_STATUS;
    return databaseRequestWithBody(path, { groupId, pollId, status }).then(result => {
        invalidatePollCaches(groupId, userId);
        return result;
    });
}

export async function sendGroupPollReminder(groupId, pollId, userId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLL_REMIND;
    return databaseRequestWithBody(path, { groupId, pollId }).then(result => {
        if (userId) removeCached(cacheKeys.notifications(userId));
        return result;
    });
}
