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
    const active = assignedPlayers.filter(assigned =>
        assigned.currentRole !== 'reserve'
        && roleLocks[assigned.tag] !== 'reserve'
    ).length;
    return player.availability?.state === 'no' || active >= clan.capacity ? 0 : 1;
}
