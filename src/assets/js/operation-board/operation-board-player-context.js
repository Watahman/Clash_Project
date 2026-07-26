import { normalizeTag, number } from './operation-board-utils.js';

export function getCurrentCwlPlayerContext(report, playerTag) {
    const tag = normalizeTag(playerTag);
    const player = (report?.roster || []).find(item =>
        normalizeTag(item.tag) === tag
    );
    if (!player) return null;
    return {
        attacksUsed: number(player.attacksUsed, 0),
        availableAttacks: number(player.availableAttacks, 0),
        stars: number(player.stars, 0),
        avgDestruction: number(player.destruction, 0),
        missed: number(player.missed, 0),
        roundsPlayed: Object.values(player.dayStats || {}).filter(stat =>
            stat?.warParticipant
            && ['live', 'completed'].includes(stat.state)
        ).length
    };
}
