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
    // playerTag kan een object zijn (van getClanMembers) of een string (directe input)
    const tag = typeof playerTag === "object" ? playerTag.tag : playerTag;

    return playerAPI.getPlayerInfoRequest(tag).then(data => {
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

export function getClanMembersBasicData(clanTag) {
    return clanAPI.getClanInfoRequest(clanTag).then(clanData => {
        const clanName = clanData.name;
        return clanAPI.getClanMembersRequest(clanTag).then(membersData => {
            const items = Array.isArray(membersData?.items) ? membersData.items : [];
            return items.map(clanMember => ({
                name: clanMember.name,
                tag: clanMember.tag,
                townHallLevel: clanMember.townHallLevel,
                role: clanMember.role,
                clanName
            }));
        });
    });
}

export function getPlayerBasicData(playerTag) {
    const tag = typeof playerTag === "object" ? playerTag.tag : playerTag;
    return playerAPI.getPlayerInfoRequest(tag).then(data => ({
        name: data.name,
        tag: data.tag,
        townHallLevel: data.townHallLevel,
        role: data.role ?? null,
        clanName: data.clan?.name ?? null,
        clanTag: data.clan?.tag ?? null
    }));
}

function processBatch(members, startIndex = 0, results = []) {
    const batch = members.slice(startIndex, startIndex + 50);

    return Promise.all(
        batch.map(member => {
            const tag = typeof member === "object" ? member.tag : member;
            return playerAPI.getPlayerLeagueHistoryRequest(tag).then(data => {
                member.leagueHistory = data;
                return member;
            }).catch(() => {
                member.leagueHistory = null;
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
