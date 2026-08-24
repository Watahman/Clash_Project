import {
    assignPlayersGlobally,
    classifyClanRoles
} from './cwl-auto-plan-assignment.js';
import { calculateClanReadiness } from './cwl-auto-plan-readiness.js';
import { selectActiveClans } from './cwl-auto-plan-selection.js';

export function buildAutoPlan(input) {
    const players = normalizePlayers(input?.players);
    const clans = normalizeClans(input?.clans);
    const locks = normalizeLocks(input?.locks);
    const selection = selectActiveClans({
        players,
        clans,
        assignmentLocks: locks.assignments,
        roleLocks: locks.roles
    });
    const activeClanIds = new Set(selection.activeClans.map(clan => clan.id));
    const assignment = assignPlayersGlobally({
        players,
        clans: selection.activeClans,
        assignmentLocks: locks.assignments,
        roleLocks: locks.roles
    });
    const results = clans.map(clan => {
        if (!activeClanIds.has(clan.id)) {
            return unusedClanResult(clan, selection.activeClans.length);
        }
        const classified = classifyClanRoles(
            clan,
            assignment.buckets.get(clan.id) || [],
            locks.roles
        );
        const readiness = calculateClanReadiness(clan, classified.players);
        const warnings = [
            ...(classified.players.filter(entry => entry.role !== 'reserve').length < clan.capacity
                ? [{
                    code: 'incomplete_roster',
                    active: classified.players.filter(entry => entry.role !== 'reserve').length,
                    required: clan.capacity,
                    message: `Only ${classified.players.filter(entry => entry.role !== 'reserve').length} of ${clan.capacity} required active players are available.`
                }] : [])
        ];
        return {
            ...clan,
            status: 'active',
            rotationPositions: classified.rotationPositions,
            players: classified.players.map(entry => ({
                ...entry.player,
                role: entry.role,
                hardLocked: entry.hardLocked,
                score: entry.score
            })).sort(compareResultPlayers),
            readiness,
            warnings
        };
    });
    const freePlayers = assignment.free.map(entry => entry.player).sort(byTag);
    const activeCount = selection.activeClans.length;
    return {
        mode: input?.mode === 'guided' ? 'guided' : 'automatic',
        clans: results,
        activeCount,
        totalClanCount: clans.length,
        freePlayers,
        changes: buildChanges(players, results, freePlayers),
        warnings: results.flatMap(clan =>
            clan.warnings.map(warning => ({ ...warning, clanId: clan.id, clanName: clan.name }))
        ),
        locks
    };
}

function unusedClanResult(clan, activeCount) {
    return {
        ...clan,
        status: 'not-used',
        reasonCode: activeCount
            ? 'not_enough_remaining_players'
            : 'not_enough_complete_roster',
        rotationPositions: 0,
        players: [],
        readiness: null,
        warnings: []
    };
}

function normalizePlayers(players) {
    const byPlayerTag = new Map();
    (Array.isArray(players) ? players : []).forEach(player => {
        const tag = normalizeTag(player?.tag);
        if (!tag || byPlayerTag.has(tag)) return;
        byPlayerTag.set(tag, {
            ...player,
            tag,
            name: String(player.name || tag),
            townHallLevel: Math.max(1, Number(player.townHallLevel) || 1),
            currentClanId: player.currentClanId || null
        });
    });
    return [...byPlayerTag.values()].sort(byTag);
}

function normalizeClans(clans) {
    return (Array.isArray(clans) ? clans : [])
        .filter(clan => clan?.id && normalizeTag(clan?.tag))
        .map(clan => ({
            ...clan,
            id: String(clan.id),
            tag: normalizeTag(clan.tag),
            name: String(clan.name || clan.tag),
            league: String(clan.league || ''),
            capacity: Number(clan.capacity) === 30 ? 30 : 15
        }))
        .sort((left, right) => left.tag.localeCompare(right.tag));
}

function normalizeLocks(locks) {
    return {
        assignments: { ...(locks?.assignments || {}) },
        roles: { ...(locks?.roles || {}) },
        reasons: { ...(locks?.reasons || {}) }
    };
}

function buildChanges(players, clans, freePlayers) {
    const destination = new Map(freePlayers.map(player => [player.tag, null]));
    const roles = new Map();
    clans.forEach(clan => clan.players.forEach(player => {
        destination.set(player.tag, clan.id);
        roles.set(player.tag, player.role);
    }));
    return players.flatMap(player => {
        const nextClanId = destination.get(player.tag) ?? null;
        const clanChanged = (player.currentClanId || null) !== nextClanId;
        const roleChanged = nextClanId
            && String(player.currentRole || '') !== String(roles.get(player.tag) || '');
        if (!clanChanged && !roleChanged) return [];
        const clan = clans.find(item => item.id === nextClanId);
        return [{
            playerTag: player.tag,
            playerName: player.name,
            fromClanId: player.currentClanId || null,
            toClanId: nextClanId,
            toClanName: clan?.name || '',
            role: roles.get(player.tag) || ''
        }];
    }).sort((left, right) => left.playerTag.localeCompare(right.playerTag));
}

function compareResultPlayers(left, right) {
    const roleOrder = { core: 0, rotation: 1, reserve: 2 };
    return roleOrder[left.role] - roleOrder[right.role]
        || right.score.fit - left.score.fit
        || left.tag.localeCompare(right.tag);
}

function normalizeTag(tag) {
    const value = String(tag || '').trim().toUpperCase();
    if (!value) return '';
    return value.startsWith('#') ? value : `#${value}`;
}

function clampRounds(value) {
    return Math.max(1, Math.min(7, Math.round(Number(value) || 7)));
}

function byTag(left, right) {
    return left.tag.localeCompare(right.tag);
}
