import {
    leagueProfile,
    scorePlayerForClan
} from '../auto-plan/cwl-auto-plan-scoring.js';
import { recommendClanRoles } from './cwl-optimize-plan-model.js';
import { calculateChangeCost } from './cwl-optimize-plan-cost.js';
import { hasRequiredClanCoverage } from './cwl-optimize-plan-coverage.js';

export function generateRefinementSuggestions(input, players, add) {
    improveLocalRoles(input, players, add);
    const crossClan = findCrossClanSwap(input, players);
    if (crossClan) add(crossClan);
}

function improveLocalRoles(input, players, add) {
    for (const clan of input.clans) {
        if (!hasRequiredClanCoverage(clan, players, input.locks.roles)) continue;
        const assigned = clanPlayers(players, clan.id);
        const recommendations = recommendClanRoles(clan, assigned, input.locks.roles);
        const cores = mismatchedPlayers({
            assigned, recommendations, input, expected: 'core', reverse: true
        });
        const bench = mismatchedPlayers({
            assigned, recommendations, input, expected: 'bench', reverse: false
        });
        const limit = leagueProfile(clan).rank >= 3 ? 1 : 2;
        for (let index = 0; index < Math.min(limit, cores.length, bench.length); index += 1) {
            addRoleSwap(clan, cores[index], bench[index], add);
        }
    }
}

function mismatchedPlayers({ assigned, recommendations, input, expected, reverse }) {
    const players = assigned.filter(player => {
        if (input.locks.roles[player.tag]) return false;
        const recommended = recommendations.get(player.tag);
        return expected === 'core'
            ? player.currentRole === 'core' && recommended !== 'core'
            : player.currentRole !== 'core' && recommended === 'core';
    });
    const sorted = rankedForClan(players, input.clans.find(clan => (
        clan.id === players[0]?.currentClanId
    )));
    return reverse ? sorted.reverse() : sorted;
}

function addRoleSwap(clan, outgoing, incoming, add) {
    const fitGain = scorePlayerForClan(incoming, clan).fit
        - scorePlayerForClan(outgoing, clan).fit;
    const reliabilityGain = reliability(incoming) - reliability(outgoing);
    const actions = roleSwapActions(clan, outgoing, incoming);
    const cost = calculateChangeCost(actions, new Map([[clan.id, clan]]));
    const benefit = fitGain + Math.max(0, reliabilityGain) * 0.12;
    if (benefit <= cost) return;
    add({
        type: 'role-swap',
        clanIds: [clan.id],
        title: { code: 'swap', incomingName: incoming.name, outgoingName: outgoing.name },
        actions,
        benefit: round(benefit, 1),
        changeCost: cost,
        reasons: roleSwapReasons(fitGain, reliabilityGain, outgoing, incoming)
    });
}

function roleSwapActions(clan, outgoing, incoming) {
    return [{
        type: 'role',
        playerTag: outgoing.tag,
        clanId: clan.id,
        fromRole: outgoing.currentRole,
        role: incoming.currentRole
    }, {
        type: 'role',
        playerTag: incoming.tag,
        clanId: clan.id,
        fromRole: incoming.currentRole,
        role: 'core'
    }];
}

function roleSwapReasons(fitGain, reliabilityGain, outgoing, incoming) {
    return [
        { code: 'performance', value: round(fitGain, 1) },
        ...(reliabilityGain > 3 ? [{
            code: 'reliability',
            from: round(reliability(outgoing), 0),
            to: round(reliability(incoming), 0)
        }] : [])
    ];
}

function findCrossClanSwap(input, players) {
    const clans = input.clans.filter(clan => (
        !input.locks.startedClanIds.includes(clan.id)
        && hasRequiredClanCoverage(clan, players, input.locks.roles)
    ));
    let best = null;
    for (let leftIndex = 0; leftIndex < clans.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < clans.length; rightIndex += 1) {
            best = bestSwapForPair(input, players, clans[leftIndex], clans[rightIndex], best);
        }
    }
    return best;
}

function bestSwapForPair(input, players, leftClan, rightClan, currentBest) {
    let best = currentBest;
    for (const left of movablePlayers(input, players, leftClan.id)) {
        for (const right of movablePlayers(input, players, rightClan.id)) {
            const candidate = swapCandidate(leftClan, rightClan, left, right);
            if (!candidate) continue;
            if (!best || candidate.benefit > best.benefit
                || (candidate.benefit === best.benefit && candidate.key < best.key)) {
                best = candidate;
            }
        }
    }
    return best;
}

function swapCandidate(leftClan, rightClan, left, right) {
    if (left.currentRole !== right.currentRole) return null;
    const leftGain = scorePlayerForClan(right, leftClan).fit
        - scorePlayerForClan(left, leftClan).fit;
    const rightGain = scorePlayerForClan(left, rightClan).fit
        - scorePlayerForClan(right, rightClan).fit;
    const total = leftGain + rightGain;
    const threshold = 12 + Math.max(
        leagueProfile(leftClan).rank,
        leagueProfile(rightClan).rank
    ) * 2;
    return leftGain < -5 || rightGain < -5 || total < threshold
        ? null
        : crossClanSuggestion(leftClan, rightClan, left, right, total);
}

function crossClanSuggestion(leftClan, rightClan, left, right, benefit) {
    return {
        type: 'cross-clan-swap',
        clanIds: [leftClan.id, rightClan.id],
        key: `${left.tag}:${right.tag}`,
        benefit: round(benefit, 1),
        title: { code: 'swap', incomingName: right.name, outgoingName: left.name },
        actions: [
            { type: 'move', playerTag: left.tag, fromClanId: leftClan.id, toClanId: rightClan.id },
            { type: 'move', playerTag: right.tag, fromClanId: rightClan.id, toClanId: leftClan.id }
        ],
        reasons: [{ code: 'performance', value: round(benefit, 1) }, { code: 'cross-clan-safe' }]
    };
}

function movablePlayers(input, players, clanId) {
    return clanPlayers(players, clanId).filter(player => (
        !Object.hasOwn(input.locks.assignments, player.tag)
    )).sort((left, right) => left.tag.localeCompare(right.tag));
}

function clanPlayers(players, clanId) {
    return players.filter(player => player.currentClanId === clanId);
}

function rankedForClan(players, clan) {
    if (!clan) return [...players];
    return [...players].sort((left, right) => (
        scorePlayerForClan(right, clan).fit - scorePlayerForClan(left, clan).fit
        || left.tag.localeCompare(right.tag)
    ));
}

function reliability(player) {
    return Number.isFinite(Number(player.performance?.reliability))
        ? Number(player.performance.reliability)
        : 72;
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}
