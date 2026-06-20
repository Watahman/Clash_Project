import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";

export async function createGroup(name, ownerId, badge = 'shield') {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_MAKE
    const data = {
        name: name,
        ownerId: ownerId,
        badge: badge
    };
    return databaseRequestWithBody(path, data)
}

export async function getGroupsOfUser(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GROUPS
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data)
}

export async function getGroupInfo(groupId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_INFO
    const data = {
        groupId: groupId
    };
    return databaseRequestWithBody(path, data)
}

export async function getGroupMembers(groupId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_MEMBERS
    const data = {
        groupId: groupId
    };
    return databaseRequestWithBody(path, data)
}

export async function joinGroup(userId, groupCode) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_JOIN
    const data = {
        userId: userId,
        groupCode: groupCode
    };
    return databaseRequestWithBody(path, data)
}

export async function leaveGroup(userId, groupCode) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_LEAVE
    const data = {
        userId: userId,
        groupCode: groupCode
    };
    return databaseRequestWithBody(path, data)
}

export async function getGroupClans(groupId, userId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_CLANS_GET;
    return databaseRequestWithBody(path, { groupId, userId });
}

export async function addGroupClan(groupId, userId, clan) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_CLAN_ADD;
    return databaseRequestWithBody(path, {
        groupId,
        userId,
        clanTag: clan.tag,
        clanName: clan.name,
        badgeUrl: clan.badgeUrl || null
    });
}

export async function removeGroupClan(groupId, userId, clanTag) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_CLAN_REMOVE;
    return databaseRequestWithBody(path, { groupId, userId, clanTag });
}
