import {
    normalizeTag,
    number
} from './operation-board-utils.js';

export function compareWarScores(first = {}, second = {}) {
    const starDifference = number(first.stars, 0) - number(second.stars, 0);
    if (starDifference) return Math.sign(starDifference);
    const destructionDifference =
        number(first.destruction, 0) - number(second.destruction, 0);
    return Math.abs(destructionDifference) < 0.001
        ? 0
        : Math.sign(destructionDifference);
}

export function collectDefenderStates(attackingSide, defendingSide) {
    const defenders = Array.isArray(defendingSide?.members)
        ? defendingSide.members
        : [];
    const states = new Map(defenders.map((member, index) => {
        const tag = normalizeTag(member.tag) || `POSITION-${index + 1}`;
        return [tag, {
            tag,
            name: member.name || tag,
            mapPosition: number(member.mapPosition, index + 1),
            townHall: number(
                member.townhallLevel || member.townHallLevel,
                0
            ),
            bestStars: 0,
            bestDestruction: 0
        }];
    }));

    for (const member of attackingSide?.members || []) {
        for (const attack of member.attacks || []) {
            const target = states.get(normalizeTag(attack.defenderTag));
            if (!target) continue;
            const stars = number(attack.stars, 0);
            const destruction = number(attack.destructionPercentage, 0);
            if (
                stars > target.bestStars
                || (stars === target.bestStars
                    && destruction > target.bestDestruction)
            ) {
                target.bestStars = stars;
                target.bestDestruction = destruction;
            }
        }
    }
    return Array.from(states.values()).sort(
        (first, second) => first.mapPosition - second.mapPosition
    );
}

export function collectRemainingAttackSlots(side, attacksPerMember = 1) {
    const limit = Math.max(1, number(attacksPerMember, 1));
    return (side?.members || []).flatMap((member, memberIndex) => {
        const used = Array.isArray(member.attacks) ? member.attacks.length : 0;
        return Array.from(
            { length: Math.max(0, limit - used) },
            (_, slotIndex) => ({
                key: `${normalizeTag(member.tag) || memberIndex}:${used + slotIndex}`,
                member,
                tag: normalizeTag(member.tag),
                name: member.name || normalizeTag(member.tag) || '-',
                mapPosition: number(member.mapPosition, memberIndex + 1),
                townHall: number(
                    member.townhallLevel || member.townHallLevel,
                    0
                )
            })
        );
    });
}

export function collectCurrentCwlStats(report) {
    const stats = new Map();
    const wars = report?.leagueWars?.length
        ? report.leagueWars
        : report?.wars || [];
    for (const war of wars) {
        for (const side of [war?.clan, war?.opponent]) {
            for (const member of side?.members || []) {
                const tag = normalizeTag(member.tag);
                if (!tag) continue;
                const current = stats.get(tag) || {
                    attacks: 0,
                    stars: 0,
                    destructionTotal: 0
                };
                for (const attack of member.attacks || []) {
                    current.attacks += 1;
                    current.stars += number(attack.stars, 0);
                    current.destructionTotal += number(
                        attack.destructionPercentage,
                        0
                    );
                }
                stats.set(tag, current);
            }
        }
    }
    return stats;
}

export function getHistoricalPerformance(report, tag) {
    const normalized = normalizeTag(tag);
    const direct = report?.historicalPerformance?.[normalized];
    if (direct) return direct;
    return (report?.roster || []).find(player =>
        normalizeTag(player.tag) === normalized
    )?.insight?.historical || null;
}
