import {
    leagueProfile,
    scorePlayerForClan
} from '../auto-plan/cwl-auto-plan-scoring.js';
import {
    normalizeOptimizationInput,
    recommendClanRoles
} from './cwl-optimize-plan-model.js';
import { generateRefinementSuggestions } from './cwl-optimize-plan-refinement.js';

export function generateOptimizationSuggestions(input) {
    const normalized = normalizeOptimizationInput(input);
    const working = normalized.players.map(player => ({
        ...player,
        plannedDays: [...player.plannedDays]
    }));
    const suggestions = [];
    let sequence = 0;
    const add = suggestion => {
        sequence += 1;
        const complete = {
            ...suggestion,
            id: `opt-${String(sequence).padStart(3, '0')}`
        };
        suggestions.push(complete);
        applyActions(working, complete.actions);
    };

    fillIncompleteClans(normalized, working, add);
    removeExcessDepth(normalized, working, add);
    generateRefinementSuggestions(normalized, working, add);
    return suggestions;
}

function fillIncompleteClans(input, players, add) {
    for (const clan of input.clans) {
        let active = clanPlayers(players, clan.id)
            .filter(player => player.currentRole !== 'reserve').length;
        while (active < clan.capacity) {
            const localReserve = rankedForClan(
                clanPlayers(players, clan.id).filter(player =>
                    player.currentRole === 'reserve'
                    && !input.locks.roles[player.tag]
                    && isEligible(player)
                ),
                clan
            )[0];
            if (localReserve) {
                add(rolePromotion(clan, localReserve, active));
                active += 1;
                continue;
            }
            const candidate = bestStructuralMove(input, players, clan);
            if (!candidate) break;
            add(moveToIncompleteClan(input, clan, candidate, active));
            active += 1;
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
    const candidates = players.filter(player => {
        if (Object.hasOwn(input.locks.assignments, player.tag)) return false;
        if (!player.currentClanId) return isEligible(player);
        if (input.locks.startedClanIds.includes(player.currentClanId)) return false;
        const source = input.clans.find(clan => clan.id === player.currentClanId);
        if (!source) return false;
        const sourcePlayers = clanPlayers(players, source.id);
        const sourceActive = sourcePlayers.filter(item => item.currentRole !== 'reserve');
        return sourcePlayers.length > source.capacity
            && sourceActive.length >= source.capacity
            && (player.currentRole === 'reserve' || sourceActive.length > source.capacity)
            && isEligible(player);
    });
    return rankedForClan(candidates, target)[0] || null;
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
        const excess = rankedForClan(
            assigned.filter(player =>
                recommendations.get(player.tag) === 'free'
                && !Object.hasOwn(input.locks.assignments, player.tag)
            ),
            clan
        ).reverse().slice(0, overflowCount);
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
        if (action.type === 'days') {
            player.plannedDays = [...action.days];
            player.hasPlannedDays = true;
        }
        if (action.type === 'free') {
            player.currentClanId = null;
            player.currentRole = '';
            player.plannedDays = [];
            player.hasPlannedDays = false;
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

function isEligible(player) {
    return player.availability?.state !== 'no'
        && (player.availability?.availableDays?.length ?? 7) > 0;
}
