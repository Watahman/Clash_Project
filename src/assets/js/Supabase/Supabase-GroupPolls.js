import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";

export async function getGroupPolls(groupId, userId) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLLS_GET;
    return databaseRequestWithBody(path, { groupId, userId });
}

export async function createGroupPoll(groupId, userId, title, rounds = 7) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLL_CREATE;
    return databaseRequestWithBody(path, { groupId, userId, title, rounds });
}

export async function answerGroupPoll(groupId, userId, pollId, accounts) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLL_ANSWER;
    return databaseRequestWithBody(path, { groupId, userId, pollId, accounts });
}

export async function setGroupPollStatus(groupId, userId, pollId, status) {
    const path = config._BASE_URL + config._EXT_SUPA_GROUP_POLL_STATUS;
    return databaseRequestWithBody(path, { groupId, userId, pollId, status });
}
