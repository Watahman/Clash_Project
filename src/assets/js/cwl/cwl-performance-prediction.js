import { compareMatchupStrength } from './cwl-matchup-difficulty.js';

const DEFAULT_STARS = 2;
const DEFAULT_DESTRUCTION = 70;

function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function normalizeTag(tag = '') {
    const clean = String(tag || '').trim().toUpperCase();
    if (!clean || clean === '#0') return '';
    return clean.startsWith('#') ? clean : `#${clean}`;
}

function getWarSide(war, clanTag) {
    const selected = normalizeTag(clanTag);
    if (normalizeTag(war?.clan?.tag) === selected) return { self: war.clan, opponent: war.opponent };
    if (normalizeTag(war?.opponent?.tag) === selected) return { self: war.opponent, opponent: war.clan };
    return null;
}

function strengthOf(member = {}, insight = {}, includeArmyProgress = false) {
    return {
        townHall: number(member?.townhallLevel || member?.townHallLevel || insight?.townHall, 0),
        progression: includeArmyProgress ? number(insight?.progression, 0.5) : 0.5
    };
}

function findOpponent(member, opponents = []) {
    const position = number(member?.mapPosition, 0);
    return opponents.find(opponent => number(opponent?.mapPosition, 0) === position)
        || opponents[Math.max(0, position - 1)]
        || opponents[0]
        || {};
}

function playerForm(player = {}, insight = {}) {
    const attacks = number(player.attacksUsed, 0);
    const warStars = attacks ? number(player.stars, 0) / attacks : null;
    const warDestruction = attacks ? number(player.destruction, DEFAULT_DESTRUCTION) : null;
    const rankedStars = insight?.offense?.stars;
    const rankedDestruction = insight?.offense?.destruction;
    const currentAttackRate = player.availableAttacks
        ? clamp(number(player.attacksUsed, 0) / number(player.availableAttacks, 1), 0, 1)
        : null;
    const historicalAttackRate = insight?.historical?.reliability == null
        ? null
        : clamp(number(insight.historical.reliability, 0) / 100, 0, 1);
    const attackRate = currentAttackRate == null
        ? historicalAttackRate ?? 0.95
        : historicalAttackRate == null
            ? currentAttackRate
            : currentAttackRate * 0.7 + historicalAttackRate * 0.3;
    return {
        stars: warStars == null
            ? number(rankedStars, DEFAULT_STARS)
            : rankedStars == null ? warStars : warStars * 0.72 + rankedStars * 0.28,
        destruction: warDestruction == null
            ? number(rankedDestruction, DEFAULT_DESTRUCTION)
            : rankedDestruction == null ? warDestruction : warDestruction * 0.72 + rankedDestruction * 0.28,
        attackRate
    };
}

function predictMatchup(player, member, opponent, insight, opponentInsight) {
    const form = playerForm(player, insight);
    const attacker = strengthOf(member, insight, true);
    const defender = strengthOf(opponent, opponentInsight);
    const comparison = compareMatchupStrength(attacker, defender);
    const opponentDefenseStars = opponentInsight?.defense?.stars;
    const opponentDefenseDestruction = opponentInsight?.defense?.destruction;
    const familiarity = number(insight?.army?.share, 0.5);
    const progression = number(insight?.progression, 0.5);
    const expectedStarsBeforeDifficulty = opponentDefenseStars == null
        ? form.stars
        : form.stars * 0.76 + opponentDefenseStars * 0.24;
    const expectedDestructionBeforeDifficulty = opponentDefenseDestruction == null
        ? form.destruction
        : form.destruction * 0.76 + opponentDefenseDestruction * 0.24;
    const attackProbability = clamp(form.attackRate * 0.72 + 0.26, 0.55, 0.99);
    const readinessStars = (progression - 0.5) * 0.22 + (familiarity - 0.5) * 0.16;
    const readinessDestruction = (progression - 0.5) * 5 + (familiarity - 0.5) * 3;
    return {
        stars: clamp(expectedStarsBeforeDifficulty + comparison.starAdjustment + readinessStars, 0, 3),
        destruction: clamp(expectedDestructionBeforeDifficulty + comparison.destructionAdjustment + readinessDestruction, 0, 100),
        attackProbability,
        difficultyMultiplier: comparison.difficultyMultiplier
    };
}

function buildWarPerformance(report, insightByTag) {
    const performance = new Map();
    const ensure = tag => {
        const normalized = normalizeTag(tag);
        if (!performance.has(normalized)) {
            performance.set(normalized, {
                adjustedStars: 0,
                attacks: 0,
                difficultyTotal: 0,
                defenses: 0,
                concededStars: 0,
                concededDestruction: 0
            });
        }
        return performance.get(normalized);
    };

    (report.wars || []).forEach(war => {
        const side = getWarSide(war, report.clan?.tag);
        if (!side) return;
        const ownMembers = Array.isArray(side.self?.members) ? side.self.members : [];
        const opponents = Array.isArray(side.opponent?.members) ? side.opponent.members : [];
        const opponentByTag = new Map(opponents.map(member => [normalizeTag(member.tag), member]));
        const ownByTag = new Map(ownMembers.map(member => [normalizeTag(member.tag), member]));

        ownMembers.forEach(member => {
            const player = ensure(member.tag);
            (member.attacks || []).forEach(attack => {
                const defender = opponentByTag.get(normalizeTag(attack.defenderTag)) || {};
                const comparison = compareMatchupStrength(
                    strengthOf(member, insightByTag.get(normalizeTag(member.tag)), true),
                    strengthOf(defender, insightByTag.get(normalizeTag(defender.tag)))
                );
                player.attacks += 1;
                player.adjustedStars += number(attack.stars, 0) * comparison.difficultyMultiplier;
                player.difficultyTotal += comparison.difficultyMultiplier;
            });
        });

        opponents.forEach(member => {
            (member.attacks || []).forEach(attack => {
                const defenderTag = normalizeTag(attack.defenderTag);
                if (!ownByTag.has(defenderTag)) return;
                const player = ensure(defenderTag);
                player.defenses += 1;
                player.concededStars += number(attack.stars, 0);
                player.concededDestruction += number(attack.destructionPercentage, 0);
            });
        });
    });
    return performance;
}

function applyPerformanceToRoster(roster, insightByTag, performance) {
    return roster.map(player => {
        const tag = normalizeTag(player.tag);
        const insight = insightByTag.get(tag) || {};
        const result = performance.get(tag) || {};
        const attacks = number(result.attacks, 0);
        const defenses = number(result.defenses, 0);
        const defenseStars = defenses ? number(result.concededStars, 0) / defenses : insight?.defense?.stars;
        const defenseDestruction = defenses ? number(result.concededDestruction, 0) / defenses : insight?.defense?.destruction;
        const defenseRating = defenseStars == null || defenseDestruction == null
            ? 0
            : clamp((3 - defenseStars) / 3, 0, 1) * 0.62 + clamp((100 - defenseDestruction) / 100, 0, 1) * 0.38;
        return {
            ...player,
            insight,
            difficultyAdjustedStars: attacks ? number(result.adjustedStars, 0) : number(player.stars, 0),
            attackDifficulty: {
                count: attacks,
                multiplier: attacks ? number(result.difficultyTotal, attacks) / attacks : null
            },
            defense: {
                count: defenses || number(insight?.defense?.count, 0),
                stars: defenseStars,
                destruction: defenseDestruction,
                rating: defenseRating
            }
        };
    });
}

function buildRoundPredictions(report, roster, insightByTag) {
    const rosterByTag = new Map(roster.map(player => [normalizeTag(player.tag), player]));
    const predictions = new Map();
    (report.wars || []).forEach(war => {
        const side = getWarSide(war, report.clan?.tag);
        if (!side) return;
        const day = Math.max(1, number(war._round, 1));
        const ownMembers = Array.isArray(side.self?.members) ? side.self.members : [];
        const opponents = Array.isArray(side.opponent?.members) ? side.opponent.members : [];
        if (!ownMembers.length || !opponents.length) return;
        const matchups = ownMembers.map(member => {
            const tag = normalizeTag(member.tag);
            const opponent = findOpponent(member, opponents);
            return predictMatchup(
                rosterByTag.get(tag) || { tag, townHall: member.townhallLevel },
                member,
                opponent,
                insightByTag.get(tag) || {},
                insightByTag.get(normalizeTag(opponent.tag)) || {}
            );
        });
        const expectedAttacks = matchups.reduce((sum, matchup) => sum + matchup.attackProbability, 0);
        const expectedStars = matchups.reduce((sum, matchup) => sum + matchup.stars * matchup.attackProbability, 0);
        const expectedDestruction = matchups.length
            ? matchups.reduce((sum, matchup) => sum + matchup.destruction * matchup.attackProbability, 0) / matchups.length
            : 0;
        predictions.set(day, {
            stars: expectedStars,
            destruction: expectedDestruction,
            attacksUsed: expectedAttacks,
            availableAttacks: ownMembers.length,
            sampleSize: matchups.length
        });
    });
    return predictions;
}

function applyCwlPredictions(report, insightByTag = new Map()) {
    const performance = buildWarPerformance(report, insightByTag);
    const roster = applyPerformanceToRoster(report.roster || [], insightByTag, performance);
    const predictions = buildRoundPredictions(report, roster, insightByTag);
    const rounds = (report.rounds || []).map(round => ({
        ...round,
        prediction: predictions.get(number(round.day, 0)) || null
    }));
    return { ...report, roster, rounds, predictionState: 'ready' };
}

function collectPredictionPlayerTags(report) {
    const tags = new Set();
    (report.wars || []).forEach(war => {
        const side = getWarSide(war, report.clan?.tag);
        [side?.self, side?.opponent].forEach(clan => {
            (clan?.members || []).forEach(member => {
                const tag = normalizeTag(member?.tag);
                if (tag) tags.add(tag);
            });
        });
    });
    return Array.from(tags);
}

export {
    applyCwlPredictions,
    collectPredictionPlayerTags
};
