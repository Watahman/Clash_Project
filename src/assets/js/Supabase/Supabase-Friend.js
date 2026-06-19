import * as config from "../Data/config.js";
import {databaseRequestWithBody} from "./Supabase-Client.js";

export async function addFriend(userId, friendCode) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_ADD_FRIEND
    const data = {
        userId: userId,
        friendCode: friendCode
    };
    return databaseRequestWithBody(path, data)
}

export async function getPendingFriendRequests(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GET_PENDING_FRIENDS
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data)
}

export async function getFriendRequests(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GET_FRIEND_REQUESTS
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data)
}

export async function getFriends(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_GET_FRIENDS
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data)
}

export async function acceptFriendRequest(userId, friendId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_ACCEPT_FRIEND
    const data = {
        userId: userId,
        friendId: friendId
    };
    return databaseRequestWithBody(path, data)
}

export async function rejectFriendRequest(userId, friendId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_REJECT_FRIEND
    const data = {
        userId: userId,
        friendId: friendId
    };
    return databaseRequestWithBody(path, data)
}