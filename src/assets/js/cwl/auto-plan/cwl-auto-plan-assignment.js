import {
    compareClanPriority,
    comparePlayerScores,
    leagueProfile,
    scorePlayerForClan
} from './cwl-auto-plan-scoring.js';
import { fillRequiredLineups } from './cwl-auto-plan-minimum.js';
import { normalizePlayerPriority } from '../cwl-plan-schema.js';

export function assignPlayersGlobally({
    players,
    clans,
    assignmentLocks = {},
    roleLocks = {}
}) {
    const orderedClans = [...clans].sort(compareClanPriority);
    const clanById = new Map(orderedClans.map(clan => [clan.id, clan]));
    const buckets = new Map(orderedClans.map(clan => [clan.id, []]));
    const free = [];
    const available = [];

    [...players].sort(byTag).forEach(player => {
        const hasLock = Object.hasOwn(assignmentLocks, player.tag);
        const lockedClanId = hasLock ? assignmentLocks[player.tag] : undefined;
        if (hasLock && lockedClanId == null) {
            free.push({ player, kind: 'locked-free', hardLocked: true });
        } else if (hasLock && clanById.has(lockedClanId)) {
            buckets.get(lockedClanId).push({
                player,
                kind: 'locked',
                hardLocked: true,
                score: scorePlayerForClan(player, clanById.get(lockedClanId))
            });
        } else if (isEligible(player)) {
            available.push(player);
        } else {
            free.push({ player, kind: 'ineligible', hardLocked: false });
        }
    });

    fillRequiredLineups(orderedClans, buckets, available, roleLocks);
    addLimitedReserves(orderedClans, buckets, available, roleLocks);
    available.forEach(player => free.push({ player, kind: 'free', hardLocked: false }));

    return { buckets, free: free.sort((a, b) => byTag(a.player, b.player)) };
}

function addLimitedReserves(clans, buckets, available, roleLocks) {
    let progress = true;
    while (available.length && progress) {
        progress = false;
        for (const clan of clans) {
            const entries = buckets.get(clan.id);
            const profile = leagueProfile(clan);
            if (entries.filter(entry =>
                entry.kind === 'reserve' || roleLocks[entry.player.tag] === 'reserve'
            ).length >= profile.reserveCap) {
                continue;
            }
            const best = peekBestPlayer(available, clan);
            const weakest = weakestActive(entries);
            if (!best || (weakest && best.score.fit < weakest.score.fit - 25)) continue;
            if (best.score.townHall < profile.targetTownHall - 3) continue;
            removePlayer(available, best.player.tag);
            entries.push({ ...best, kind: 'reserve', hardLocked: false });
            progress = true;
        }
    }
}

export function classifyClanRoles(clan, entries, roleLocks = {}) {
    const profile = leagueProfile(clan);
    const reserveEntries = entries.filter(entry => entry.kind === 'reserve');
    const activeEntries = entries.filter(entry => entry.kind !== 'reserve')
        .sort(compareRoleCandidates);
    const hasDepth = activeEntries.length > clan.capacity;
    const rotationPositions = hasDepth
        ? determineRotationPositions(clan, activeEntries, profile)
        : 0;
    const rotationCount = hasDepth ? Math.min(
        activeEntries.length,
        rotationPositions + Math.max(1, activeEntries.length - clan.capacity)
    ) : 0;
    const coreCount = Math.max(0, activeEntries.length - rotationCount);

    const classified = [
        ...activeEntries.map((entry, index) => ({
            ...entry,
            role: index < coreCount ? 'core' : 'rotation'
        })),
        ...reserveEntries.map(entry => ({ ...entry, role: 'reserve' }))
    ];
    classified.forEach(entry => {
        if (roleLocks[entry.player.tag]) entry.role = roleLocks[entry.player.tag];
    });
    rebalanceRoles(classified, clan.capacity, profile.reserveCap, roleLocks);
    return {
        players: classified,
        rotationPositions: Math.min(
            profile.rotationPositions,
            classified.filter(entry => entry.role === 'rotation').length
        )
    };
}

function compareRoleCandidates(left, right) {
    const leftStability = left.player.currentRole === 'core' ? 2.5 : 0;
    const rightStability = right.player.currentRole === 'core' ? 2.5 : 0;
    return (right.score.fit + rightStability) - (left.score.fit + leftStability)
        || comparePlayerScores(left, right);
}

function determineRotationPositions(clan, active, profile) {
    const strongest = active[0]?.score.fit ?? 0;
    const weakest = active.at(-1)?.score.fit ?? strongest;
    const spread = strongest - weakest;
    const availabilityNeed = active.some(entry =>
        entry.player.availability?.state === 'partial'
    );
    if (profile.rank === 4 && spread > profile.rotationTolerance && !availabilityNeed) {
        return 0;
    }
    return Math.min(profile.rotationPositions, Math.max(1, active.length - clan.capacity + 1));
}

function rebalanceRoles(players, capacity, reserveCap, roleLocks) {
    const reserves = players.filter(entry => entry.role === 'reserve');
    reserves.sort(comparePlayerScores);
    while (reserves.length > reserveCap) {
        const candidateIndex = reserves.findLastIndex(entry =>
            roleLocks[entry.player.tag] !== 'reserve'
        );
        if (candidateIndex < 0) break;
        const [candidate] = reserves.splice(candidateIndex, 1);
        candidate.role = 'rotation';
    }
    let active = players.filter(entry => entry.role !== 'reserve');
    if (active.length >= capacity) return;
    const promotable = players
        .filter(entry => entry.role === 'reserve' && !roleLocks[entry.player.tag])
        .sort(comparePlayerScores);
    while (active.length < capacity && promotable.length) {
        const candidate = promotable.shift();
        candidate.role = 'rotation';
        active.push(candidate);
    }
}

function peekBestPlayer(available, clan) {
    return available
        .map(player => ({ player, score: scorePlayerForClan(player, clan) }))
        .sort(comparePlayerScores)[0] || null;
}

function removePlayer(players, tag) {
    const index = players.findIndex(player => player.tag === tag);
    if (index >= 0) players.splice(index, 1);
}

function weakestActive(entries) {
    return entries
        .filter(entry => entry.kind !== 'reserve')
        .sort(comparePlayerScores)
        .at(-1);
}

function isEligible(player) {
    return player.availability?.state !== 'no'
        && normalizePlayerPriority(player.playerPriority) !== 'exclude';
}

function byTag(left, right) {
    return String(left.tag).localeCompare(String(right.tag));
}
