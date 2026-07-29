import { buildDailySchedule } from '../auto-plan/cwl-auto-plan-schedule.js';
import {
    leagueProfile,
    scorePlayerForClan
} from '../auto-plan/cwl-auto-plan-scoring.js';
import {
    buildPlanState,
    recommendClanRoles
} from './cwl-optimize-plan-model.js';
import { calculateChangeCost } from './cwl-optimize-plan-cost.js';
import { hasRequiredClanCoverage } from './cwl-optimize-plan-coverage.js';

export function generateRefinementSuggestions(input, players, add) {
    improveLocalRoles(input, players, add);
    const crossClan = findCrossClanSwap(input, players);
    if (crossClan) add(crossClan);
    cleanSchedules(input, players, add);
}

function improveLocalRoles(input, players, add) {
    for (const clan of input.clans) {
        const assigned = clanPlayers(players, clan.id);
        if (!hasRequiredClanCoverage(clan, players, input.locks.roles)) continue;
        const recommendations = recommendClanRoles(clan, assigned, input.locks.roles);
        const cores = rankedForClan(assigned.filter(player =>
            player.currentRole === 'core'
            && recommendations.get(player.tag) !== 'core'
            && !input.locks.roles[player.tag]
        ), clan).reverse();
        const bench = rankedForClan(assigned.filter(player =>
            player.currentRole !== 'core'
            && recommendations.get(player.tag) === 'core'
            && !input.locks.roles[player.tag]
        ), clan);
        const limit = leagueProfile(clan).rank >= 3 ? 1 : 2;
        for (let index = 0; index < Math.min(limit, cores.length, bench.length); index += 1) {
            const outgoing = cores[index];
            const incoming = bench[index];
            const fitGain = scorePlayerForClan(incoming, clan).fit
                - scorePlayerForClan(outgoing, clan).fit;
            const reliabilityGain = reliability(incoming) - reliability(outgoing);
            const actions = roleSwapActions(clan, outgoing, incoming);
            const cost = calculateChangeCost(actions, new Map([[clan.id, clan]]));
            const benefit = fitGain + Math.max(0, reliabilityGain) * 0.12;
            if (benefit <= cost) continue;
            add({
                type: 'role-swap',
                clanIds: [clan.id],
                title: {
                    code: 'swap',
                    incomingName: incoming.name,
                    outgoingName: outgoing.name
                },
                actions,
                benefit: round(benefit, 1),
                changeCost: cost,
                reasons: [
                    { code: 'performance', value: round(fitGain, 1) },
                    ...(reliabilityGain > 3 ? [{
                        code: 'reliability',
                        from: round(reliability(outgoing), 0),
                        to: round(reliability(incoming), 0)
                    }] : [])
                ]
            });
        }
    }
}

function roleSwapActions(clan, outgoing, incoming) {
    const actions = [{
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
    if (outgoing.hasPlannedDays || incoming.hasPlannedDays) {
        actions.push(
            daysAction(clan, outgoing, incoming.plannedDays),
            daysAction(clan, incoming, outgoing.plannedDays)
        );
    }
    return actions;
}

function findCrossClanSwap(input, players) {
    const availableClans = input.clans.filter(clan =>
        !input.locks.startedClanIds.includes(clan.id)
        && hasRequiredClanCoverage(clan, players, input.locks.roles)
    );
    let best = null;
    for (let leftIndex = 0; leftIndex < availableClans.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < availableClans.length; rightIndex += 1) {
            const leftClan = availableClans[leftIndex];
            const rightClan = availableClans[rightIndex];
            for (const left of movablePlayers(input, players, leftClan.id)) {
                for (const right of movablePlayers(input, players, rightClan.id)) {
                    if (left.currentRole !== right.currentRole) continue;
                    const leftGain = scorePlayerForClan(right, leftClan).fit
                        - scorePlayerForClan(left, leftClan).fit;
                    const rightGain = scorePlayerForClan(left, rightClan).fit
                        - scorePlayerForClan(right, rightClan).fit;
                    const total = leftGain + rightGain;
                    const threshold = 12 + Math.max(
                        leagueProfile(leftClan).rank,
                        leagueProfile(rightClan).rank
                    ) * 2;
                    if (leftGain < -5 || rightGain < -5 || total < threshold) continue;
                    const candidate = crossClanSuggestion(
                        leftClan, rightClan, left, right, total
                    );
                    if (!best || candidate.benefit > best.benefit
                        || (candidate.benefit === best.benefit
                            && candidate.key.localeCompare(best.key) < 0)) {
                        best = candidate;
                    }
                }
            }
        }
    }
    return best;
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
        reasons: [
            { code: 'performance', value: round(benefit, 1) },
            { code: 'cross-clan-safe' }
        ]
    };
}

function cleanSchedules(input, players, add) {
    const currentState = buildPlanState({ ...input, players });
    for (const clan of input.clans) {
        if (!hasRequiredClanCoverage(clan, players, input.locks.roles)) continue;
        const current = currentState.clans.find(item => item.id === clan.id);
        const assigned = clanPlayers(players, clan.id);
        if (!assigned.some(player => player.hasPlannedDays)) continue;
        const classified = assigned.map(player => ({
            player,
            role: player.currentRole,
            score: scorePlayerForClan(player, clan)
        }));
        const optimized = buildDailySchedule(clan, classified, input.rounds);
        const structuralWarnings = current.warnings.filter(warning =>
            ['availability_conflict', 'incomplete_day', 'reserve_used'].includes(warning.code)
        ).length;
        const changeReduction = current.lineupChanges - optimized.changes;
        const performanceLoss = metricLoss(
            current.metrics.expectedPerformance,
            averageExpected(optimized.lineups)
        );
        if (!structuralWarnings && (changeReduction < 2 || performanceLoss > 0.15)) continue;
        const actions = assigned.flatMap(player => {
            const days = optimized.plannedDays[player.tag] || [];
            return sameDays(player.plannedDays, days)
                ? []
                : [daysAction(clan, player, days)];
        });
        if (!actions.length) continue;
        const cost = calculateChangeCost(actions, new Map([[clan.id, clan]]));
        const benefit = structuralWarnings * 24 + Math.max(0, changeReduction) * 4
            - Math.max(0, performanceLoss) * 12;
        if (!structuralWarnings && benefit <= cost) continue;
        add({
            type: 'schedule-cleanup',
            clanIds: [clan.id],
            title: { code: 'schedule' },
            actions,
            benefit: round(benefit, 1),
            changeCost: cost,
            reasons: [
                ...(changeReduction > 0 ? [{
                    code: 'lineup-changes',
                    from: current.lineupChanges,
                    to: optimized.changes
                }] : []),
                ...(structuralWarnings ? [{
                    code: 'risky-rounds',
                    count: structuralWarnings
                }] : []),
                { code: 'stability-loss', value: round(Math.max(0, performanceLoss), 2) }
            ]
        });
    }
}

function daysAction(clan, player, days) {
    return {
        type: 'days',
        playerTag: player.tag,
        clanId: clan.id,
        fromDays: [...player.plannedDays],
        days: [...days]
    };
}

function movablePlayers(input, players, clanId) {
    return clanPlayers(players, clanId).filter(player =>
        !Object.hasOwn(input.locks.assignments, player.tag)
    ).sort(byTag);
}

function clanPlayers(players, clanId) {
    return players.filter(player => player.currentClanId === clanId);
}

function rankedForClan(players, clan) {
    return [...players].sort((left, right) => {
        const difference = scorePlayerForClan(right, clan).fit
            - scorePlayerForClan(left, clan).fit;
        return difference || left.tag.localeCompare(right.tag);
    });
}

function reliability(player) {
    return Number.isFinite(Number(player.performance?.reliability))
        ? Number(player.performance.reliability)
        : 72;
}

function averageExpected(lineups) {
    const values = lineups.map(lineup => lineup.expectedStars).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function metricLoss(current, optimized) {
    return Number.isFinite(current) && Number.isFinite(optimized)
        ? current - optimized
        : 0;
}

function sameDays(left, right) {
    return left.length === right.length && left.every((day, index) => day === right[index]);
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}

function byTag(left, right) {
    return left.tag.localeCompare(right.tag);
}
