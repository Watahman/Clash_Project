import { getWarSide, normalizeTag, number } from '../operation-board/operation-board-utils.js';

export function buildWarMap(report, sideName = 'enemy') {
    const war = report?.wars?.[0];
    const side = getWarSide(war, report?.clan?.tag);
    if (!side) return [];
    const defending = sideName === 'own' ? side.self : side.opponent;
    const attacking = sideName === 'own' ? side.opponent : side.self;
    const attacks = (attacking.members || []).flatMap(member =>
        (member.attacks || []).map(attack => ({
            ...attack,
            attackerName: member.name,
            attackerTag: normalizeTag(member.tag),
            attackerTownHall: number(member.townhallLevel || member.townHallLevel)
        }))
    );
    return (defending.members || []).map((member, index) => {
        const received = attacks
            .filter(attack => normalizeTag(attack.defenderTag) === normalizeTag(member.tag))
            .sort((a, b) => number(a.order) - number(b.order));
        const best = received.reduce((current, attack) => {
            if (number(attack.stars) > current.stars
                || (number(attack.stars) === current.stars
                    && number(attack.destructionPercentage) > current.destruction)) {
                return {
                    stars: number(attack.stars),
                    destruction: number(attack.destructionPercentage)
                };
            }
            return current;
        }, { stars: 0, destruction: 0 });
        return {
            tag: normalizeTag(member.tag),
            name: member.name || normalizeTag(member.tag),
            townHall: number(member.townhallLevel || member.townHallLevel),
            mapPosition: number(member.mapPosition, index + 1),
            opponentAttacks: number(member.opponentAttacks, received.length),
            attacks: received,
            ...best,
            state: best.stars === 3
                ? 'cleared'
                : received.length ? 'damaged' : 'untouched'
        };
    }).sort((a, b) => a.mapPosition - b.mapPosition);
}
