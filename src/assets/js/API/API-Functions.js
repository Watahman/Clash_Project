import * as clanAPI from "./API-Clan.js"
import * as playerAPI from "./API-Player.js"

export function getClanMembersWithBattleData(clanTag) {
    return clanAPI.getClanInfoRequest(clanTag).then(clanData => {
        const clanName = clanData.name;
        return clanAPI.getClanMembersRequest(clanTag).then(membersData => {
            const clanMembers = membersData.items.map(clanMember => ({
                name: clanMember.name,
                tag: clanMember.tag,
                townHallLevel: clanMember.townHallLevel,
                role: clanMember.role,
                clanName: clanName
            }));
            return processBatch(clanMembers);
        });
    });
}

export function getPlayerWithBattleData(playerTag) {
    return playerAPI.getPlayerInfoRequest(playerTag).then(data => {
        const player = {
            name: data.name,
            tag: data.tag,
            townHallLevel: data.townHallLevel,
            role: data.role ?? null,
            clanName: data.clan?.name ?? null,
            clanTag: data.clan?.tag ?? null
        };
        return processBatch([player]);
    });
}

function processBatch(members, startIndex = 0, results = []) {
    const batch = members.slice(startIndex, startIndex + 50);

    return Promise.all(
        batch.map(member => {
            return playerAPI.getPlayerLeagueHistoryRequest(member.tag).then(data => {
                member.leagueHistory = data;
                return member;
            });
        })
    ).then(batchResults => {
        results.push(...batchResults);
        if (startIndex + 50 < members.length) {
            return processBatch(members, startIndex + 50, results);
        }
        return results;
    });
}