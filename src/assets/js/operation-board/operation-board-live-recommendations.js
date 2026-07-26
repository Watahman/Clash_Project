import { compareMatchupStrength } from '../cwl/cwl-matchup-difficulty.js';
import {
    collectCurrentCwlStats,
    collectDefenderStates,
    collectRemainingAttackSlots,
    getHistoricalPerformance
} from './operation-board-live-baseline.js';
import { getCurrentWarContext } from './operation-board-live-model.js';
import {
    clamp,
    number
} from './operation-board-utils.js';

export function buildImportantAttacks(report, limit = 4) {
    const context = getCurrentWarContext(report);
    if (!context.side || context.state === 'completed') return [];
    return buildSideAttackPlan(
        report,
        context.side.self,
        context.side.opponent,
        context.war?.attacksPerMember
    ).slice(0, Math.max(0, limit));
}

export function buildSideAttackPlan(
    report,
    attackingSide,
    defendingSide,
    attacksPerMember = 1
) {
    const slots = collectRemainingAttackSlots(
        attackingSide,
        attacksPerMember
    );
    if (!slots.length) return [];
    const allTargets = collectDefenderStates(attackingSide, defendingSide);
    const openTargets = allTargets.filter(target => target.bestStars < 3);
    const targets = openTargets.length ? openTargets : allTargets;
    const currentStats = collectCurrentCwlStats(report);
    const candidates = slots.flatMap(slot => targets.map(target =>
        matchupPrediction(report, slot, target, currentStats)
    )).sort(compareCandidateImpact);

    const selected = [];
    const usedSlots = new Set();
    const usedTargets = new Set();
    for (const candidate of candidates) {
        if (usedSlots.has(candidate.slotKey)) continue;
        if (usedTargets.has(candidate.target.tag)) continue;
        selected.push(candidate);
        usedSlots.add(candidate.slotKey);
        usedTargets.add(candidate.target.tag);
        if (selected.length === slots.length) break;
    }
    if (selected.length < slots.length) {
        for (const candidate of candidates) {
            if (usedSlots.has(candidate.slotKey)) continue;
            selected.push(candidate);
            usedSlots.add(candidate.slotKey);
            if (selected.length === slots.length) break;
        }
    }
    return selected;
}

function matchupPrediction(report, slot, target, currentStats) {
    const historical = getHistoricalPerformance(report, slot.tag);
    const current = currentStats.get(slot.tag);
    const confidence = historicalConfidence(historical);
    const comparison = compareMatchupStrength(
        { townHall: slot.townHall, progression: 0.5 },
        { townHall: target.townHall, progression: 0.5 }
    );
    const historicalDistribution = distributionFromHistorical(historical);
    const fallbackMean = fallbackExpectedStars(slot, target);
    const historicalMean = historicalDistribution
        ? distributionMean(historicalDistribution)
        : fallbackMean;
    const currentMean = current?.attacks
        ? current.stars / current.attacks
        : null;
    const currentWeight = currentMean == null
        ? 0
        : Math.min(0.25, current.attacks * 0.04);
    const desiredMean = clamp(
        historicalMean * (1 - currentWeight)
            + number(currentMean, historicalMean) * currentWeight
            + comparison.starAdjustment,
        0,
        3
    );
    const distribution = shiftDistributionMean(
        historicalDistribution || distributionAround(fallbackMean),
        desiredMean
    );
    const historicalDestruction = historical?.status === 'ready'
        ? historical.avgDestruction
        : null;
    const currentDestruction = current?.attacks
        ? current.destructionTotal / current.attacks
        : null;
    const destruction = clamp(
        number(historicalDestruction, fallbackDestruction(slot, target))
            * (1 - currentWeight)
            + number(currentDestruction, number(
                historicalDestruction,
                fallbackDestruction(slot, target)
            )) * currentWeight
            + comparison.destructionAdjustment,
        0,
        100
    );
    const expectedStars = distributionMean(distribution);
    const expectedNetStars = distribution.reduce(
        (total, probability, stars) =>
            total + probability * Math.max(0, stars - target.bestStars),
        0
    );
    const destructionImprovement =
        number(distribution[target.bestStars], 0)
        * Math.max(0, destruction - target.bestDestruction);
    const mapDistance = Math.abs(slot.mapPosition - target.mapPosition);
    const impact = expectedNetStars * 100
        + destructionImprovement * 0.3
        - Math.min(12, mapDistance) * 0.15;

    return {
        slotKey: slot.key,
        attacker: {
            tag: slot.tag,
            name: slot.name,
            townHall: slot.townHall,
            mapPosition: slot.mapPosition
        },
        target,
        expectedStars,
        expectedDestruction: destruction,
        expectedNetStars,
        expectedDestructionImprovement: destructionImprovement,
        difficulty: difficultyLabel(comparison.difficultyMultiplier),
        difficultyMultiplier: comparison.difficultyMultiplier,
        confidence,
        historicalAttackCount: number(historical?.attackCount, 0),
        probabilityEligible: confidence !== 'Low'
            && number(historical?.attackCount, 0) >= 5
            && Boolean(historicalDistribution),
        distribution,
        impact,
        reason: recommendationReason(
            expectedNetStars,
            comparison.difficultyMultiplier
        )
    };
}

function distributionFromHistorical(historical) {
    if (historical?.status !== 'ready') return null;
    const values = [
        number(historical.lowStarRate, NaN),
        number(historical.twoStarRate, NaN),
        number(historical.tripleRate, NaN)
    ];
    if (values.some(value => !Number.isFinite(value))) return null;
    const low = clamp(values[0] / 100, 0, 1);
    const two = clamp(values[1] / 100, 0, 1);
    const three = clamp(values[2] / 100, 0, 1);
    const total = Math.max(0.001, low + two + three);
    return [
        low * 0.18 / total,
        low * 0.82 / total,
        two / total,
        three / total
    ];
}

function distributionAround(mean) {
    const value = clamp(mean, 0, 3);
    const lower = Math.floor(value);
    const upper = Math.ceil(value);
    const distribution = [0, 0, 0, 0];
    if (lower === upper) distribution[lower] = 1;
    else {
        distribution[lower] = upper - value;
        distribution[upper] = value - lower;
    }
    return distribution;
}

function shiftDistributionMean(source, targetMean) {
    const distribution = [...source];
    let difference = clamp(targetMean, 0, 3) - distributionMean(distribution);
    const direction = Math.sign(difference);
    while (Math.abs(difference) > 0.0001) {
        const indexes = direction > 0 ? [0, 1, 2] : [3, 2, 1];
        const from = indexes.find(index => distribution[index] > 0.0001);
        if (from == null) break;
        const to = from + direction;
        const movement = Math.min(distribution[from], Math.abs(difference));
        distribution[from] -= movement;
        distribution[to] += movement;
        difference -= direction * movement;
    }
    return distribution;
}

function distributionMean(distribution) {
    return distribution.reduce(
        (sum, probability, stars) => sum + probability * stars,
        0
    );
}

function fallbackExpectedStars(attacker, target) {
    const townHallDelta = attacker.townHall - target.townHall;
    const mapPenalty = Math.min(
        0.18,
        Math.abs(attacker.mapPosition - target.mapPosition) * 0.015
    );
    return clamp(2.05 + townHallDelta * 0.32 - mapPenalty, 0.6, 2.85);
}

function fallbackDestruction(attacker, target) {
    return clamp(76 + (attacker.townHall - target.townHall) * 7, 45, 96);
}

function historicalConfidence(historical) {
    if (
        historical?.status !== 'ready'
        || number(historical.attackCount, 0) < 5
    ) return 'Low';
    return ['High', 'Medium'].includes(historical.confidence)
        ? historical.confidence
        : 'Low';
}

function difficultyLabel(multiplier) {
    if (multiplier >= 1.08) return 'Hard';
    if (multiplier <= 0.93) return 'Favorable';
    return 'Even';
}

function recommendationReason(netStars, difficultyMultiplier) {
    if (netStars >= 0.9) return 'highImpact';
    if (difficultyMultiplier <= 0.93) return 'goodMatchup';
    return 'bestAvailable';
}

function compareCandidateImpact(first, second) {
    return second.impact - first.impact
        || second.expectedNetStars - first.expectedNetStars
        || first.target.mapPosition - second.target.mapPosition;
}
