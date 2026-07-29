import { hasRequiredCoverage } from '../auto-plan/cwl-auto-plan-minimum.js';

export function hasRequiredClanCoverage(clan, players, roleLocks = {}) {
    return hasRequiredCoverage(
        clan,
        players
            .filter(player => player.currentClanId === clan.id)
            .map(player => ({
                player,
                kind: player.currentRole === 'reserve' ? 'reserve' : 'minimum'
            })),
        roleLocks
    );
}

export function preservesRequiredClanCoverage(input, beforePlayers, afterPlayers) {
    return input.clans.every(clan =>
        !hasRequiredClanCoverage(clan, beforePlayers, input.locks.roles)
        || hasRequiredClanCoverage(clan, afterPlayers, input.locks.roles)
    );
}

export function activePlayerCount(players, clanId, roleLocks = {}) {
    return players.filter(player =>
        player.currentClanId === clanId
        && player.currentRole !== 'reserve'
        && roleLocks[player.tag] !== 'reserve'
    ).length;
}

export function coverageGain(clan, assignedPlayers, player, roleLocks = {}) {
    if (roleLocks[player.tag] === 'reserve') return 0;
    return Array.from({ length: 7 }, (_, index) => index + 1)
        .filter(day => availableActiveCount(assignedPlayers, day, roleLocks) < clan.capacity)
        .filter(day => isAvailable(player, day))
        .length;
}

function availableActiveCount(players, day, roleLocks) {
    return players.filter(player =>
        player.currentRole !== 'reserve'
        && roleLocks[player.tag] !== 'reserve'
        && isAvailable(player, day)
    ).length;
}

function isAvailable(player, day) {
    const days = player.availability?.availableDays;
    return !Array.isArray(days) || days.includes(day);
}
