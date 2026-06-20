import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";
import { cacheKeys } from "../cache/cache-keys.js";
import { clearCachePrefix, removeCached } from "../cache/local-cache.js";

function invalidateGroupRoleCaches(groupId, ...userIds) {
    removeCached(cacheKeys.groupInfo(groupId));
    removeCached(cacheKeys.groupMembers(groupId));
    clearCachePrefix(`groups.polls:${encodeURIComponent(groupId)}:`);
    userIds.filter(Boolean).forEach(userId => removeCached(cacheKeys.groupsOfUser(userId)));
}

export async function setGroupMemberRole(groupId, actorId, targetUserId, role) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_MEMBER_ROLE_SET;
    return databaseRequestWithBody(path, { groupId, actorId, targetUserId, role }).then(result => {
        invalidateGroupRoleCaches(groupId, actorId, targetUserId);
        return result;
    });
}

export async function transferGroupLeadership(groupId, actorId, targetUserId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_LEADERSHIP_TRANSFER;
    return databaseRequestWithBody(path, { groupId, actorId, targetUserId }).then(result => {
        invalidateGroupRoleCaches(groupId, actorId, targetUserId);
        return result;
    });
}
