import {
    compareWarScores
} from './operation-board-live-baseline.js';
import { buildLiveView, getCurrentWarContext } from './operation-board-live-model.js';
import {
    buildSideAttackPlan
} from './operation-board-live-recommendations.js';
import {
    clamp,
    number
} from './operation-board-utils.js';

const DEFAULT_SIMULATIONS = 2000;

export function buildProjectedOutcome(
    report,
    { simulations = DEFAULT_SIMULATIONS } = {}
) {
    const live = buildLiveView(report);
    const context = getCurrentWarContext(report);
    if (!live || !context.side) return null;
    if (context.state === 'completed') {
        return {
            own: score(live.own),
            opponent: score(live.opponent),
            status: outcomeStatus(live.own, live.opponent),
            winProbability: null,
            probabilityState: 'completed'
        };
    }

    const attacksPerMember = context.war?.attacksPerMember;
    const ownPlan = buildSideAttackPlan(
        report,
        context.side.self,
        context.side.opponent,
        attacksPerMember
    );
    const opponentPlan = buildSideAttackPlan(
        report,
        context.side.opponent,
        context.side.self,
        attacksPerMember
    );
    const own = projectedScore(
        live.own,
        ownPlan,
        context.side.opponent?.members?.length
    );
    const opponent = projectedScore(
        live.opponent,
        opponentPlan,
        context.side.self?.members?.length
    );
    const coverage = probabilityCoverage(ownPlan, opponentPlan);
    const probability = coverage.sufficient
        ? simulateWar({
            own: live.own,
            opponent: live.opponent,
            ownPlan,
            opponentPlan,
            ownBaseCount: context.side.opponent?.members?.length,
            opponentBaseCount: context.side.self?.members?.length,
            simulations,
            seed: seedFor(live)
        })
        : null;

    return {
        own,
        opponent,
        status: probability == null
            ? outcomeStatus(own, opponent)
            : probability >= 60
                ? 'favorable'
                : probability <= 40 ? 'unfavorable' : 'close',
        winProbability: probability,
        probabilityState: probability == null ? 'insufficient' : 'ready',
        coverage,
        ownPlan,
        opponentPlan
    };
}

export function probabilityCoverage(ownPlan, opponentPlan) {
    const assignments = [...ownPlan, ...opponentPlan];
    if (!assignments.length) {
        return {
            sufficient: false,
            covered: 0,
            total: 0,
            historicalAttacks: 0
        };
    }
    const covered = assignments.filter(
        assignment => assignment.probabilityEligible
    ).length;
    const samples = new Map();
    assignments.forEach(assignment => {
        if (!assignment.probabilityEligible) return;
        samples.set(
            assignment.attacker.tag,
            assignment.historicalAttackCount
        );
    });
    const historicalAttacks = Array.from(samples.values()).reduce(
        (sum, count) => sum + count,
        0
    );
    return {
        sufficient: covered / assignments.length >= 0.75
            && historicalAttacks >= 20,
        covered,
        total: assignments.length,
        historicalAttacks
    };
}

export function simulateWar({
    own,
    opponent,
    ownPlan,
    opponentPlan,
    ownBaseCount,
    opponentBaseCount,
    simulations = DEFAULT_SIMULATIONS,
    seed = 1
}) {
    const random = seededRandom(seed);
    let wins = 0;
    let draws = 0;
    const count = Math.max(100, number(simulations, DEFAULT_SIMULATIONS));
    for (let index = 0; index < count; index += 1) {
        const ownFinal = simulateSide(
            own,
            ownPlan,
            ownBaseCount,
            random
        );
        const opponentFinal = simulateSide(
            opponent,
            opponentPlan,
            opponentBaseCount,
            random
        );
        const comparison = compareWarScores(ownFinal, opponentFinal);
        if (comparison > 0) wins += 1;
        else if (comparison === 0) draws += 1;
    }
    return Math.round(((wins + draws * 0.5) / count) * 100);
}

function projectedScore(current, plan, baseCount) {
    const stars = plan.reduce(
        (sum, attack) => sum + attack.expectedNetStars,
        number(current.stars, 0)
    );
    const destruction = plan.reduce(
        (sum, attack) =>
            sum + attack.expectedDestructionImprovement
                / Math.max(1, number(baseCount, 1)),
        number(current.destruction, 0)
    );
    return {
        stars: clamp(
            stars,
            0,
            Math.max(number(current.stars, 0), number(baseCount, 0) * 3)
        ),
        destruction: clamp(destruction, 0, 100)
    };
}

function simulateSide(current, plan, baseCount, random) {
    const result = score(current);
    const bases = new Map();
    for (const attack of plan) {
        const base = bases.get(attack.target.tag) || {
            stars: attack.target.bestStars,
            destruction: attack.target.bestDestruction
        };
        const stars = sampleStars(attack.distribution, random());
        const destruction = sampleDestruction(
            attack.expectedDestruction,
            stars,
            random()
        );
        if (stars > base.stars) {
            result.stars += stars - base.stars;
            base.stars = stars;
        }
        if (destruction > base.destruction) {
            result.destruction +=
                (destruction - base.destruction)
                    / Math.max(1, number(baseCount, 1));
            base.destruction = destruction;
        }
        bases.set(attack.target.tag, base);
    }
    result.destruction = clamp(result.destruction, 0, 100);
    return result;
}

function sampleStars(distribution, roll) {
    let cumulative = 0;
    for (let stars = 0; stars < distribution.length; stars += 1) {
        cumulative += distribution[stars];
        if (roll <= cumulative) return stars;
    }
    return 3;
}

function sampleDestruction(expected, stars, roll) {
    if (stars === 3) return 100;
    const sampled = number(expected, 70) + (roll - 0.5) * 24;
    if (stars === 0) return clamp(sampled, 0, 49.9);
    return clamp(sampled, 50, 99.9);
}

function outcomeStatus(own, opponent) {
    const starDifference = number(own.stars, 0) - number(opponent.stars, 0);
    if (starDifference >= 0.75) return 'favorable';
    if (starDifference <= -0.75) return 'unfavorable';
    const destructionDifference =
        number(own.destruction, 0) - number(opponent.destruction, 0);
    if (destructionDifference >= 1.5) return 'favorable';
    if (destructionDifference <= -1.5) return 'unfavorable';
    return 'close';
}

function score(value) {
    return {
        stars: number(value?.stars, 0),
        destruction: number(value?.destruction, 0)
    };
}

function seedFor(live) {
    const value = `${live.own.tag}|${live.opponent.tag}|${live.day}`;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
        value += 0x6D2B79F5;
        let result = value;
        result = Math.imul(result ^ result >>> 15, result | 1);
        result ^= result + Math.imul(result ^ result >>> 7, result | 61);
        return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
}
