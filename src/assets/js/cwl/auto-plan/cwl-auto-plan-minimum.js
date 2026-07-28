import {
    compareClanPriority,
    comparePlayerScores,
    scorePlayerForClan
} from './cwl-auto-plan-scoring.js';

export function fillRequiredLineups(clans, buckets, available, roleLocks = {}) {
    let madeProgress = true;
    while (available.length && madeProgress) {
        madeProgress = false;
        const needingPlayers = clans
            .filter(clan => !hasRequiredCoverage(
                clan,
                buckets.get(clan.id),
                roleLocks
            ))
            .sort((left, right) => {
                const coverage = activeEntryCount(buckets.get(left.id), roleLocks) / left.capacity
                    - activeEntryCount(buckets.get(right.id), roleLocks) / right.capacity;
                return coverage || compareClanPriority(left, right);
            });
        for (const clan of needingPlayers) {
            const best = takeBestCoveragePlayer(
                available,
                clan,
                buckets.get(clan.id),
                roleLocks
            );
            if (!best) continue;
            buckets.get(clan.id).push({ ...best, kind: 'minimum', hardLocked: false });
            madeProgress = true;
            if (!available.length) break;
        }
    }
}

export function hasRequiredCoverage(clan, entries = [], roleLocks = {}) {
    if (activeEntryCount(entries, roleLocks) < clan.capacity) return false;
    return Array.from({ length: 7 }, (_, index) => index + 1)
        .every(day => availableActiveCount(entries, day, roleLocks) >= clan.capacity);
}

export function activeEntryCount(entries = [], roleLocks = {}) {
    return entries.filter(entry =>
        entry.kind !== 'reserve' && roleLocks[entry.player.tag] !== 'reserve'
    ).length;
}

function takeBestCoveragePlayer(available, clan, entries, roleLocks) {
    const deficitDays = Array.from({ length: 7 }, (_, index) => index + 1)
        .filter(day => availableActiveCount(entries, day, roleLocks) < clan.capacity);
    const ranked = available.map(player => ({
        player,
        score: scorePlayerForClan(player, clan),
        stability: stabilityScore(player, clan),
        coverageGain: deficitDays.filter(day => isAvailable(player, day)).length
    })).sort((left, right) =>
        right.coverageGain - left.coverageGain
        || (right.score.fit + right.stability) - (left.score.fit + left.stability)
        || comparePlayerScores(left, right)
    );
    const best = ranked[0] || null;
    if (best) removePlayer(available, best.player.tag);
    return best;
}

function stabilityScore(player, clan) {
    const clanBonus = player.currentClanId === clan.id ? 3 : 0;
    const roleBonus = player.currentRole === 'core'
        ? 2.5
        : player.currentRole === 'rotation' ? 1 : 0;
    return clanBonus + roleBonus;
}

function availableActiveCount(entries, day, roleLocks) {
    return entries.filter(entry =>
        entry.kind !== 'reserve'
        && roleLocks[entry.player.tag] !== 'reserve'
        && isAvailable(entry.player, day)
    ).length;
}

function isAvailable(player, day) {
    const days = player.availability?.availableDays;
    return !Array.isArray(days) || days.includes(day);
}

function removePlayer(players, tag) {
    const index = players.findIndex(player => player.tag === tag);
    if (index >= 0) players.splice(index, 1);
}
