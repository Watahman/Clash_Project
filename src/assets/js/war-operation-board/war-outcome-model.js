import { buildLiveView, getCurrentWarContext } from '../operation-board/operation-board-live-model.js';
import { collectDefenderStates } from '../operation-board/operation-board-live-baseline.js';
import { possibleImprovements } from '../operation-board/operation-board-win-condition.js';

export function buildMathematicalWarStatus(report) {
    const live = buildLiveView(report);
    const { side } = getCurrentWarContext(report);
    if (!live || !side) return null;
    const ownPotential = maximumStars(
        collectDefenderStates(side.self, side.opponent),
        live.own.remainingAttacks
    );
    const opponentPotential = maximumStars(
        collectDefenderStates(side.opponent, side.self),
        live.opponent.remainingAttacks
    );
    const ownMaximum = live.own.stars + ownPotential;
    const opponentMaximum = live.opponent.stars + opponentPotential;
    let status = 'open';
    if (live.own.stars > opponentMaximum) status = 'won';
    else if (live.opponent.stars > ownMaximum) status = 'lost';
    return {
        status,
        ownMaximum,
        opponentMaximum,
        ownPotential,
        opponentPotential
    };
}

function maximumStars(bases, attacks) {
    return possibleImprovements(bases, attacks).reduce(
        (maximum, outcome) => Math.max(maximum, outcome.stars),
        0
    );
}
