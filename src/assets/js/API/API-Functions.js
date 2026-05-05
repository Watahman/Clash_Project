import * as clanAPI from "./API-Clan.js"
import * as playerAPI from "./API-Player.js"

export function getClanMembersWithBattleData(clanTag, callback) {
    let clanName;
    clanAPI.getClanInfoRequest(clanTag, (data) => {
        clanName = data.name;
    })

    let clanMembers = [];
    clanAPI.getClanMembersRequest(clanTag, (data) => {
        data.items.forEach(clanMember => {
            clanMembers.push({
                name: clanMember.name,
                tag: clanMember.tag,
                townHallLevel: clanMember.townHallLevel,
                role: clanMember.role,
                clanName: clanName
            });
        });

        processBatch(clanMembers, 0, callback);
    });
}

export function getPlayerWithBattleData(playerTag, callback) {
    let player = []
    playerAPI.getPlayerInfoRequest(playerTag, (data) => {
        console.log(data)
        player.push({
            name: data.name,
            tag: data.tag,
            townHallLevel: data.townHallLevel,
            role: data.role ?? null,
            clanName: data.clan?.name ?? null,
            clanTag: data.clan?.tag ?? null
        })

        processBatch(player, 0, callback);
    })

}

function processBatch(members, startIndex, callback) {
    const batch = members.slice(startIndex, startIndex + 1);

    let completed = 0;

    batch.forEach(member => {
        playerAPI.getPlayerLeagueHistoryRequest(member.tag, (data) => {
            member.leagueHistory = data;
            completed++;

            if (completed === batch.length) {
                callback(batch);

                if (startIndex + 1 < members.length) {
                    processBatch(members, startIndex + 1, callback);
                }
            }
        });
    });
}