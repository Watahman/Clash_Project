import { fillRequiredLineups, hasRequiredCoverage } from './cwl-auto-plan-minimum.js';
import {
    compareClanPriority,
    leagueProfile,
    scorePlayerForClan
} from './cwl-auto-plan-scoring.js';

const MAX_COMBINATIONS_PER_SIZE = 10000;

export function selectActiveClans({
    players,
    clans,
    assignmentLocks = {},
    roleLocks = {}
}) {
    const orderedClans = [...clans].sort(compareClanPriority);
    const validClanIds = new Set(orderedClans.map(clan => clan.id));
    const mandatoryIds = new Set(
        Object.values(assignmentLocks).filter(clanId => validClanIds.has(clanId))
    );
    const mandatory = orderedClans.filter(clan => mandatoryIds.has(clan.id));
    const optional = orderedClans.filter(clan => !mandatoryIds.has(clan.id));

    for (let size = orderedClans.length; size >= mandatory.length; size -= 1) {
        const optionalCount = size - mandatory.length;
        if (optionalCount > optional.length) continue;
        let best = null;
        let evaluated = 0;
        for (const combination of combinations(optional, optionalCount)) {
            if (evaluated >= MAX_COMBINATIONS_PER_SIZE) break;
            evaluated += 1;
            const selected = [...mandatory, ...combination].sort(compareClanPriority);
            const simulation = simulateSelection({
                players,
                clans: selected,
                assignmentLocks,
                roleLocks
            });
            if (!simulation?.complete) continue;
            if (!best || compareSelections(simulation, best) < 0) best = simulation;
        }
        if (best) {
            return {
                activeClans: best.clans,
                unusedClans: orderedClans.filter(clan =>
                    !best.clanIds.has(clan.id)
                ),
                forcedIncomplete: false
            };
        }
    }

    return {
        activeClans: mandatory,
        unusedClans: orderedClans.filter(clan => !mandatoryIds.has(clan.id)),
        forcedIncomplete: mandatory.length > 0
    };
}

function simulateSelection({
    players,
    clans,
    assignmentLocks,
    roleLocks
}) {
    const clanById = new Map(clans.map(clan => [clan.id, clan]));
    const buckets = new Map(clans.map(clan => [clan.id, []]));
    const available = [];

    [...players].sort(byTag).forEach(player => {
        const hasLock = Object.hasOwn(assignmentLocks, player.tag);
        const lockedClanId = hasLock ? assignmentLocks[player.tag] : undefined;
        if (hasLock && lockedClanId == null) return;
        if (hasLock && clanById.has(lockedClanId)) {
            buckets.get(lockedClanId).push({
                player,
                kind: 'locked',
                hardLocked: true,
                score: scorePlayerForClan(player, clanById.get(lockedClanId))
            });
        } else if (!hasLock && isEligible(player)) {
            available.push(player);
        }
    });

    fillRequiredLineups(clans, buckets, available, roleLocks);
    const complete = clans.every(clan =>
        hasRequiredCoverage(clan, buckets.get(clan.id), roleLocks)
    );
    const activeEntries = clans.flatMap(clan =>
        buckets.get(clan.id).filter(entry => roleLocks[entry.player.tag] !== 'reserve')
    );
    const total = Math.max(1, activeEntries.length);
    return {
        clans,
        clanIds: new Set(clans.map(clan => clan.id)),
        complete,
        averageFit: sum(activeEntries, entry => entry.score.fit) / total,
        historyRatio: sum(activeEntries, entry => Number(entry.score.hasHistory)) / total,
        reliability: sum(activeEntries, entry => entry.score.reliability) / total,
        performance: sum(activeEntries, entry => entry.score.performance) / total,
        stability: sum(activeEntries, entry =>
            Number(entry.player.currentClanId === clanForEntry(clans, buckets, entry)?.id)
        ),
        leagueRank: sum(clans, clan => leagueProfile(clan).rank),
        key: clans.map(clan => clan.tag).sort().join('|')
    };
}

function compareSelections(left, right) {
    return right.averageFit - left.averageFit
        || right.historyRatio - left.historyRatio
        || right.reliability - left.reliability
        || right.performance - left.performance
        || right.stability - left.stability
        || right.leagueRank - left.leagueRank
        || left.key.localeCompare(right.key);
}

function* combinations(items, count, start = 0, selected = []) {
    if (selected.length === count) {
        yield [...selected];
        return;
    }
    const remaining = count - selected.length;
    for (let index = start; index <= items.length - remaining; index += 1) {
        selected.push(items[index]);
        yield* combinations(items, count, index + 1, selected);
        selected.pop();
    }
}

function clanForEntry(clans, buckets, entry) {
    return clans.find(clan => buckets.get(clan.id).includes(entry));
}

function sum(items, getter) {
    return items.reduce((total, item) => total + getter(item), 0);
}

function isEligible(player) {
    return player.availability?.state !== 'no';
}

function byTag(left, right) {
    return String(left.tag).localeCompare(String(right.tag));
}
