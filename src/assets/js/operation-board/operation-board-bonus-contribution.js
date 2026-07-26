import { attackQuality, matchupDifficultyMultiplier } from '../cwl/cwl-matchup-difficulty.js';
import {
    getWarSide,
    normalizeTag,
    number
} from './operation-board-utils.js';

export function calculateCwlContributions(report = {}) {
    const players = new Map();
    (report.wars || []).forEach((war, warIndex) => {
        const side = getWarSide(war, report.clan?.tag);
        if (!side) return;
        const defenders = new Map(
            (side.opponent?.members || []).map(member => [
                normalizeTag(member.tag),
                member
            ])
        );
        const attacks = collectOrderedAttacks(
            side.self?.members || [],
            defenders,
            warIndex
        );
        const bestByBase = new Map();
        attacks.forEach(record => {
            const before = bestByBase.get(record.defenderTag)
                || { stars: 0, destruction: 0 };
            const netStars = Math.max(0, record.stars - before.stars);
            const destructionImprovement = record.stars === before.stars
                ? Math.max(0, record.destruction - before.destruction)
                : 0;
            const contributionQuality = 75 * (netStars / 3)
                + 25 * (destructionImprovement / 100);
            const stats = ensurePlayer(players, record);
            stats.attacks += 1;
            stats.stars += record.stars;
            stats.destruction += record.destruction;
            stats.netStars += netStars;
            stats.destructionImprovement += destructionImprovement;
            stats.performanceQuality += Math.min(
                100,
                attackQuality(record.stars, record.destruction)
                    * record.difficultyMultiplier
            );
            stats.contributionQuality += contributionQuality;
            stats.difficultyAdjustedStars += record.stars
                * record.difficultyMultiplier;
            stats.difficultyTotal += record.difficultyMultiplier;
            stats.hasOrderedAttacks = stats.hasOrderedAttacks && record.hasOrder;
            stats.details.push({
                ...record,
                before,
                netStars,
                destructionImprovement,
                contributionQuality
            });
            if (
                record.stars > before.stars
                || (
                    record.stars === before.stars
                    && record.destruction > before.destruction
                )
            ) {
                bestByBase.set(record.defenderTag, {
                    stars: record.stars,
                    destruction: record.destruction
                });
            }
        });
    });
    return players;
}

function collectOrderedAttacks(members, defenders, warIndex) {
    let encounter = 0;
    return members.flatMap(member => {
        const attacker = strengthOf(member);
        return (member.attacks || []).map(attack => {
            const defenderTag = normalizeTag(attack.defenderTag);
            const defender = defenders.get(defenderTag) || {};
            const rawOrder = Number(attack.order);
            encounter += 1;
            return {
                warIndex,
                encounter,
                order: Number.isFinite(rawOrder) ? rawOrder : encounter,
                hasOrder: Number.isFinite(rawOrder),
                attackerTag: normalizeTag(member.tag),
                attackerName: member.name || normalizeTag(member.tag),
                defenderTag,
                defenderPosition: number(defender.mapPosition, 0),
                stars: Math.min(3, Math.max(0, number(attack.stars, 0))),
                destruction: Math.min(
                    100,
                    Math.max(0, number(attack.destructionPercentage, 0))
                ),
                difficultyMultiplier: matchupDifficultyMultiplier(
                    attacker,
                    strengthOf(defender)
                )
            };
        });
    }).sort((a, b) =>
        a.order - b.order || a.encounter - b.encounter
    );
}

function ensurePlayer(players, record) {
    if (!players.has(record.attackerTag)) {
        players.set(record.attackerTag, {
            tag: record.attackerTag,
            name: record.attackerName,
            attacks: 0,
            stars: 0,
            destruction: 0,
            netStars: 0,
            destructionImprovement: 0,
            performanceQuality: 0,
            contributionQuality: 0,
            difficultyAdjustedStars: 0,
            difficultyTotal: 0,
            hasOrderedAttacks: true,
            details: []
        });
    }
    return players.get(record.attackerTag);
}

function strengthOf(member = {}) {
    return {
        townHall: number(member.townhallLevel || member.townHallLevel, 0),
        progression: 0.5
    };
}
