import { normalizeTag } from '../operation-board/operation-board-utils.js';

export function assignmentState(assignment, report) {
    const war = report?.wars?.[0];
    const own = war?.clan?.tag === report?.clan?.tag ? war.clan : war?.opponent;
    const member = own?.members?.find(player =>
        normalizeTag(player.tag) === normalizeTag(assignment.playerTag)
    );
    const attack = member?.attacks?.[assignment.attackSlot - 1];
    if (!attack) return 'planned';
    if (['base', 'cleanup'].includes(assignment.type)
        && Number(assignment.targetPosition)
        && targetPosition(war, report.clan.tag, attack.defenderTag)
            !== Number(assignment.targetPosition)) {
        return 'changed';
    }
    return 'completed';
}

function targetPosition(war, clanTag, defenderTag) {
    const opponent = war?.clan?.tag === clanTag ? war.opponent : war.clan;
    return opponent?.members?.find(player =>
        normalizeTag(player.tag) === normalizeTag(defenderTag)
    )?.mapPosition;
}
