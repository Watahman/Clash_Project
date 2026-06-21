export function normalizeTag(tag) {
    const clean = String(tag || '').trim().toUpperCase();
    if (!clean) return '';
    return clean.startsWith('#') ? clean : `#${clean}`;
}

export function normalizeKeyPart(value) {
    return encodeURIComponent(String(value || '').trim());
}

export const cacheKeys = Object.freeze({
    userInfo: userId => `users.info:${normalizeKeyPart(userId)}`,
    userCheck: userId => `users.check:${normalizeKeyPart(userId)}`,
    userAccounts: userId => `users.accounts:${normalizeKeyPart(userId)}`,
    friends: userId => `friends.list:${normalizeKeyPart(userId)}`,
    friendsPending: userId => `friends.pending:${normalizeKeyPart(userId)}`,
    friendsRequests: userId => `friends.requests:${normalizeKeyPart(userId)}`,
    groupsOfUser: userId => `groups.ofUser:${normalizeKeyPart(userId)}`,
    groupInfo: groupId => `groups.info:${normalizeKeyPart(groupId)}`,
    groupMembers: groupId => `groups.members:${normalizeKeyPart(groupId)}`,
    groupClans: groupId => `groups.clans:${normalizeKeyPart(groupId)}`,
    groupPolls: (groupId, userId = 'user') => `groups.polls:${normalizeKeyPart(groupId)}:${normalizeKeyPart(userId)}`,
    plansOfUser: userId => `plans.ofUser:${normalizeKeyPart(userId)}`,
    plan: planId => `plans.detail:${normalizeKeyPart(planId)}`,
    clashPlayer: tag => `clash.player:${normalizeKeyPart(normalizeTag(tag))}`,
    clashPlayerBattleLog: tag => `clash.playerBattleLog:${normalizeKeyPart(normalizeTag(tag))}`,
    clashPlayerLeagueHistory: tag => `clash.playerLeagueHistory:${normalizeKeyPart(normalizeTag(tag))}`,
    clashClanInfo: tag => `clash.clan:${normalizeKeyPart(normalizeTag(tag))}`,
    clashClanMembers: tag => `clash.clanMembers:${normalizeKeyPart(normalizeTag(tag))}`,
    clashClanCurrentWar: tag => `clash.currentWar:${normalizeKeyPart(normalizeTag(tag))}`,
    clashClanLeagueGroup: tag => `clash.leagueGroup:${normalizeKeyPart(normalizeTag(tag))}`,
    clashClanWar: tag => `clash.leagueWar:${normalizeKeyPart(normalizeTag(tag))}`,
    clashClanWarLog: tag => `clash.warLog:${normalizeKeyPart(normalizeTag(tag))}`
});
