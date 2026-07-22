import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";
import { cacheKeys } from "../cache/cache-keys.js";
import { CACHE_STALE, CACHE_TTL } from "../cache/cache-policy.js";
import { clearCachePrefix, removeCached } from "../cache/local-cache.js";

function invalidateGroup(groupId) {
    if (!groupId) return;
    removeCached(cacheKeys.groupInfo(groupId));
    removeCached(cacheKeys.groupMembers(groupId));
    removeCached(cacheKeys.groupClans(groupId));
    clearCachePrefix(`groups.polls:${encodeURIComponent(groupId)}:`);
}

function invalidateUserGroups(userId) {
    if (userId) removeCached(cacheKeys.groupsOfUser(userId));
}

export async function createGroup(name, ownerId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_MAKE
    const data = {
        name: name
    };
    return databaseRequestWithBody(path, data).then(result => {
        invalidateUserGroups(ownerId);
        return result;
    })
}

export async function getGroupsOfUser(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GROUPS
    return databaseRequestWithBody(path, {}, {
        key: cacheKeys.groupsOfUser(userId),
        ttlMs: CACHE_TTL.GROUPS,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getGroupInfo(groupId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_INFO
    const data = {
        groupId: groupId
    };
    return databaseRequestWithBody(path, data, {
        key: cacheKeys.groupInfo(groupId),
        ttlMs: CACHE_TTL.GROUP_INFO,
        staleMs: CACHE_STALE.MEDIUM
    })
}

export async function getGroupMembers(groupId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_MEMBERS
    const data = {
        groupId: groupId
    };
    return databaseRequestWithBody(path, data, {
        key: cacheKeys.groupMembers(groupId),
        ttlMs: CACHE_TTL.GROUP_MEMBERS,
        staleMs: CACHE_STALE.SHORT
    })
}

export async function getGroupMemberActivity(groupId, requestOptions = {}) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_MEMBER_ACTIVITY;
    return databaseRequestWithBody(path, { groupId }, {
        key: cacheKeys.groupMemberActivity(groupId),
        ttlMs: CACHE_TTL.GROUP_MEMBER_ACTIVITY,
        staleMs: CACHE_STALE.SHORT
    }, requestOptions);
}

export async function joinGroup(userId, groupCode) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_JOIN
    const data = {
        groupCode: groupCode
    };
    return databaseRequestWithBody(path, data).then(result => {
        invalidateUserGroups(userId);
        clearCachePrefix('groups.info:');
        clearCachePrefix('groups.members:');
        return result;
    })
}

export async function leaveGroup(userId, groupCode) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_LEAVE
    const data = {
        groupCode: groupCode
    };
    return databaseRequestWithBody(path, data).then(result => {
        invalidateUserGroups(userId);
        clearCachePrefix('groups.info:');
        clearCachePrefix('groups.members:');
        return result;
    })
}

export async function getGroupClans(groupId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_CLANS_GET;
    return databaseRequestWithBody(path, { groupId }, {
        key: cacheKeys.groupClans(groupId),
        ttlMs: CACHE_TTL.GROUP_CLANS,
        staleMs: CACHE_STALE.MEDIUM
    });
}

export async function addGroupClan(groupId, clan) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_CLAN_ADD;
    return databaseRequestWithBody(path, {
        groupId,
        clanTag: clan.tag,
        clanName: clan.name,
        badgeUrl: clan.badgeUrl || null
    }).then(result => {
        invalidateGroup(groupId);
        return result;
    });
}

export async function removeGroupClan(groupId, clanTag) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_CLAN_REMOVE;
    return databaseRequestWithBody(path, { groupId, clanTag }).then(result => {
        invalidateGroup(groupId);
        return result;
    });
}
