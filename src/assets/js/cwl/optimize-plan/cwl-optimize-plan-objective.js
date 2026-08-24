import {
    leagueProfile,
    scorePlayerForClan
} from '../auto-plan/cwl-auto-plan-scoring.js';
import {
    buildPlanState,
    normalizeOptimizationInput,
    recommendClanRoles
} from './cwl-optimize-plan-model.js';
import {
    activePlayerCount,
    coverageGain,
    hasRequiredClanCoverage,
    preservesRequiredClanCoverage
} from './cwl-optimize-plan-coverage.js';
import { generateRefinementSuggestions } from './cwl-optimize-plan-refinement.js';

export function generateOptimizationSuggestions(input) {
    const normalized = normalizeOptimizationInput(input);
    const effectiveRoles = new Map(buildPlanState(normalized).clans.flatMap(clan =>
        clan.players.map(player => [player.tag, player.role])
    ));
    const working = normalized.players.map(player => ({
        ...player,
        currentRole: effectiveRoles.get(player.tag) || player.currentRole
    }));
    const suggestions = [];
    let sequence = 0;
    const add = suggestion => {
        const candidate = working.map(player => ({ ...player }));
        applyActions(candidate, suggestion.actions);
        if (!preservesRequiredClanCoverage(normalized, working, candidate)) return false;
        sequence += 1;
        const complete = {
            ...suggestion,
            id: `opt-${String(sequence).padStart(3, '0')}`
        };
        suggestions.push(complete);
        applyActions(working, complete.actions);
        return true;
    };

    fillIncompleteClans(normalized, working, add);
    removeExcessDepth(normalized, working, add);
    generateRefinementSuggestions(normalized, working, add);
    return suggestions;
}

function fillIncompleteClans(input, players, add) {
    for (const clan of input.clans) {
        while (!hasRequiredClanCoverage(clan, players, input.locks.roles)) {
            const assigned = clanPlayers(players, clan.id);
            const active = activePlayerCount(players, clan.id, input.locks.roles);
            const localReserve = rankedForCoverage(
                assigned.filter(player =>
                    player.currentRole === 'reserve'
                    && !input.locks.roles[player.tag]
                    && isEligible(player)
                ),
                clan,
                assigned,
                input.locks.roles
            )[0];
            if (localReserve) {
                if (!add(rolePromotion(clan, localReserve, active))) break;
                continue;
            }
            const candidate = bestStructuralMove(input, players, clan);
            if (!candidate) break;
            if (!add(moveToIncompleteClan(input, clan, candidate, active))) break;
        }
    }
}

function rolePromotion(clan, player, activeCount) {
    const role = activeCount < clan.capacity - 1 ? 'core' : 'rotation';
    return {
        type: 'structural',
        clanIds: [clan.id],
        title: { code: 'role', playerName: player.name, role },
        actions: [{
            type: 'role',
            playerTag: player.tag,
            clanId: clan.id,
            fromRole: player.currentRole,
            role
        }],
        reasons: [{ code: 'fills-roster', clanName: clan.name }]
    };
}

function bestStructuralMove(input, players, target) {
    if (input.locks.startedClanIds.includes(target.id)) return null;
    const targetPlayers = clanPlayers(players, target.id);
    const candidates = players.filter(player => {
        if (Object.hasOwn(input.locks.assignments, player.tag)) return false;
        if (!isEligible(player)
            || coverageGain(target, targetPlayers, player, input.locks.roles) <= 0) {
            return false;
        }
        if (!player.currentClanId) return true;
        if (input.locks.startedClanIds.includes(player.currentClanId)) return false;
        const source = input.clans.find(clan => clan.id === player.currentClanId);
        if (!source) return false;
        const sourcePlayers = clanPlayers(players, source.id);
        return sourcePlayers.length > source.capacity
            && hasRequiredClanCoverage(
                source,
                players.filter(item => item.tag !== player.tag),
                input.locks.roles
            );
    });
    return rankedForCoverage(
        candidates,
        target,
        targetPlayers,
        input.locks.roles
    )[0] || null;
}

function moveToIncompleteClan(input, clan, player, activeCount) {
    const fromClan = input.clans.find(item => item.id === player.currentClanId);
    const role = activeCount < clan.capacity - 1 ? 'core' : 'rotation';
    const actions = [{
        type: 'move',
        playerTag: player.tag,
        fromClanId: player.currentClanId,
        toClanId: clan.id
    }, {
        type: 'role',
        playerTag: player.tag,
        clanId: clan.id,
        fromRole: player.currentRole,
        role
    }];
    return {
        type: 'structural',
        clanIds: [clan.id, fromClan?.id].filter(Boolean),
        title: {
            code: 'move',
            playerName: player.name,
            fromClanName: fromClan?.name || 'Free roster',
            toClanName: clan.name
        },
        actions,
        reasons: [{ code: 'fills-roster', clanName: clan.name }]
    };
}

function removeExcessDepth(input, players, add) {
    for (const clan of input.clans) {
        if (input.locks.startedClanIds.includes(clan.id)) continue;
        const profile = leagueProfile(clan);
        const assigned = clanPlayers(players, clan.id);
        const overflowCount = Math.max(
            0,
            assigned.length - clan.capacity - profile.reserveCap
        );
        if (!overflowCount) continue;
        const recommendations = recommendClanRoles(clan, assigned, input.locks.roles);
        const candidates = rankedForClan(
            assigned.filter(player =>
                recommendations.get(player.tag) === 'free'
                && !Object.hasOwn(input.locks.assignments, player.tag)
            ),
            clan
        ).reverse().sort((left, right) =>
            Number(left.currentRole !== 'reserve') - Number(right.currentRole !== 'reserve')
        );
        const excess = [];
        for (const player of candidates) {
            if (excess.length >= overflowCount) break;
            const remaining = players.filter(item =>
                item.tag !== player.tag && !excess.some(entry => entry.tag === item.tag)
            );
            if (!hasRequiredClanCoverage(clan, remaining, input.locks.roles)) continue;
            excess.push(player);
        }
        excess.forEach(player => add({
            type: 'depth-cleanup',
            clanIds: [clan.id],
            title: { code: 'free', playerName: player.name },
            actions: [{
                type: 'free',
                playerTag: player.tag,
                clanId: clan.id
            }],
            reasons: [{
                code: 'reserve-cap',
                count: profile.reserveCap,
                format: clan.capacity
            }]
        }));
    }
}

function applyActions(players, actions) {
    actions.forEach(action => {
        const player = players.find(item => item.tag === action.playerTag);
        if (!player) return;
        if (action.type === 'move') player.currentClanId = action.toClanId;
        if (action.type === 'role') player.currentRole = action.role;
        if (action.type === 'free') {
            player.currentClanId = null;
            player.currentRole = '';
        }
    });
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

function rankedForCoverage(players, clan, assigned, roleLocks) {
    return [...players].sort((left, right) =>
        coverageGain(clan, assigned, right, roleLocks)
        - coverageGain(clan, assigned, left, roleLocks)
        || scorePlayerForClan(right, clan).fit - scorePlayerForClan(left, clan).fit
        || left.tag.localeCompare(right.tag)
    ).filter(player => coverageGain(clan, assigned, player, roleLocks) > 0);
}

function isEligible(player) {
    return player.availability?.state !== 'no';
}
