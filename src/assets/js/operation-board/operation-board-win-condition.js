import { buildLiveView, getCurrentWarContext } from './operation-board-live-model.js';
import {
    collectDefenderStates,
    compareWarScores
} from './operation-board-live-baseline.js';
import { number } from './operation-board-utils.js';

const DESTRUCTION_MARGIN = 0.1;

export function buildWinCondition(report) {
    const live = buildLiveView(report);
    if (!live) return null;
    const { side } = getCurrentWarContext(report);
    const currentComparison = compareWarScores(live.own, live.opponent);
    const result = {
        state: currentComparison > 0
            ? 'leading'
            : currentComparison < 0 ? 'trailing' : 'tied',
        ownRemaining: live.own.remainingAttacks,
        opponentRemaining: live.opponent.remainingAttacks,
        maxStarImprovement: 0,
        maxFinalStars: live.own.stars,
        mathematicallyPossible: currentComparison > 0,
        requirement: currentRequirement(live),
        opponentCanRespond: live.opponent.remainingAttacks > 0
    };
    if (!side) return result;

    const bases = collectDefenderStates(side.self, side.opponent);
    const outcomes = possibleImprovements(
        bases,
        live.own.remainingAttacks
    );
    const best = [...outcomes].sort((first, second) =>
        second.stars - first.stars
        || second.destruction - first.destruction
    )[0] || { stars: 0, destruction: 0 };
    const canPass = outcomes.some(outcome => compareWarScores({
        stars: live.own.stars + outcome.stars,
        destruction: live.own.destruction + outcome.destruction
    }, live.opponent) > 0);

    return {
        ...result,
        maxStarImprovement: best.stars,
        maxFinalStars: live.own.stars + best.stars,
        mathematicallyPossible: currentComparison > 0 || canPass,
        targetCount: bases.length
    };
}

export function possibleImprovements(bases, remainingAttacks) {
    const attackLimit = Math.max(0, number(remainingAttacks, 0));
    const baseCount = Math.max(1, bases.length);
    const states = Array.from(
        { length: attackLimit + 1 },
        () => new Map()
    );
    states[0].set(0, 0);

    for (const base of bases) {
        const starGain = Math.max(0, 3 - number(base.bestStars, 0));
        const destructionGain =
            Math.max(0, 100 - number(base.bestDestruction, 0)) / baseCount;
        for (let used = attackLimit; used >= 1; used -= 1) {
            for (const [stars, destruction] of states[used - 1]) {
                const nextStars = stars + starGain;
                const nextDestruction = destruction + destructionGain;
                states[used].set(
                    nextStars,
                    Math.max(
                        states[used].get(nextStars) || 0,
                        nextDestruction
                    )
                );
            }
        }
    }

    const outcomes = new Map([[0, 0]]);
    states.forEach(state => state.forEach((destruction, stars) => {
        outcomes.set(stars, Math.max(outcomes.get(stars) || 0, destruction));
    }));
    return Array.from(outcomes, ([stars, destruction]) => ({
        stars,
        destruction
    }));
}

function currentRequirement(live) {
    const own = live.own;
    const opponent = live.opponent;
    const comparison = compareWarScores(own, opponent);
    if (comparison > 0) return { type: 'alreadyLeading' };

    const starsToMatch = Math.max(0, opponent.stars - own.stars);
    const destructionGap = Math.max(
        0,
        opponent.destruction - own.destruction + DESTRUCTION_MARGIN
    );
    if (starsToMatch === 0 && destructionGap === 0) {
        return { type: 'oneStar', stars: 1 };
    }
    if (destructionGap > 0) {
        return {
            type: 'matchAndDestruction',
            matchStars: opponent.stars,
            starsToMatch,
            destruction: destructionGap,
            alternativeStars: starsToMatch + 1
        };
    }
    return {
        type: 'stars',
        stars: Math.max(1, starsToMatch)
    };
}
