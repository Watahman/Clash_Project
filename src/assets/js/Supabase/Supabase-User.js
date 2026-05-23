import * as config from "../Data/config.js";
import { databaseRequestWithBody } from "./Supabase-Client.js";

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
    return databaseRequestWithBody(path, data)
}

export async function getUserBases(userId) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_BASES
    const data = {
        userId: userId
    };
    return databaseRequestWithBody(path, data)
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
    return databaseRequestWithBody(path, data)
}

export async function addBaseToUser(userId, base) {
    const path = config._BASE_URL + config._EXT_SUPA_USER_ADD_ACCOUNT
    const data = {
        userId: userId,
        base: base
    };
    return databaseRequestWithBody(path, data)
}