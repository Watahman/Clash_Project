import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";

export async function setGroupMemberRole(groupId, actorId, targetUserId, role) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_MEMBER_ROLE_SET;
    return databaseRequestWithBody(path, { groupId, actorId, targetUserId, role });
}

export async function transferGroupLeadership(groupId, actorId, targetUserId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_LEADERSHIP_TRANSFER;
    return databaseRequestWithBody(path, { groupId, actorId, targetUserId });
}
