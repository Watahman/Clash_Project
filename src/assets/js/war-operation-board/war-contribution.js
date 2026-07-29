import { getWarSide, normalizeTag, number } from '../operation-board/operation-board-utils.js';

export function buildWarContributions(report) {
    const war = report?.wars?.[0];
    const side = getWarSide(war, report?.clan?.tag);
    if (!side) return [];
    const bestBefore = new Map();
    const attacks = (side.self.members || []).flatMap(member =>
        (member.attacks || []).map(attack => ({
            ...attack,
            attackerName: member.name,
            attackerTownHall: number(member.townhallLevel || member.townHallLevel),
            mapPosition: number(member.mapPosition)
        }))
    ).sort((a, b) => number(a.order, Number.MAX_SAFE_INTEGER)
        - number(b.order, Number.MAX_SAFE_INTEGER));
    const contribution = new Map();
    for (const attack of attacks) {
        const attackerTag = normalizeTag(attack.attackerTag);
        const targetTag = normalizeTag(attack.defenderTag);
        const previous = bestBefore.get(targetTag) || { stars: 0, destruction: 0 };
        const stars = number(attack.stars);
        const destruction = number(attack.destructionPercentage);
        const row = contribution.get(attackerTag) || {
            tag: attackerTag,
            name: attack.attackerName || attackerTag,
            townHall: attack.attackerTownHall,
            mapPosition: attack.mapPosition,
            attacks: [],
            stars: 0,
            netStars: 0,
            destructionTotal: 0
        };
        row.attacks.push({
            ...attack,
            netStars: Math.max(0, stars - previous.stars),
            destructionGain: stars === previous.stars
                ? Math.max(0, destruction - previous.destruction)
                : Math.max(0, destruction)
        });
        row.stars += stars;
        row.netStars += Math.max(0, stars - previous.stars);
        row.destructionTotal += destruction;
        contribution.set(attackerTag, row);
        if (stars > previous.stars
            || (stars === previous.stars && destruction > previous.destruction)) {
            bestBefore.set(targetTag, { stars, destruction });
        }
    }
    return (side.self.members || []).map((member, index) => {
        const tag = normalizeTag(member.tag);
        return contribution.get(tag) || {
            tag,
            name: member.name || tag,
            townHall: number(member.townhallLevel || member.townHallLevel),
            mapPosition: number(member.mapPosition, index + 1),
            attacks: [],
            stars: 0,
            netStars: 0,
            destructionTotal: 0
        };
    }).map(row => ({
        ...row,
        attacksUsed: row.attacks.length,
        avgDestruction: row.attacks.length
            ? row.destructionTotal / row.attacks.length
            : null
    })).sort((a, b) => a.mapPosition - b.mapPosition);
}

export function attacksByOrder(report) {
    return buildWarContributions(report)
        .flatMap(player => player.attacks)
        .sort((a, b) => number(a.order) - number(b.order));
}
