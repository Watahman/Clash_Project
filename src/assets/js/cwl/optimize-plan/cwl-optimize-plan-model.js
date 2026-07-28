import {
    assignPlayersGlobally,
    classifyClanRoles
} from '../auto-plan/cwl-auto-plan-assignment.js';
import { calculateClanReadiness } from '../auto-plan/cwl-auto-plan-readiness.js';
import {
    buildDailySchedule,
    evaluatePlannedSchedule
} from '../auto-plan/cwl-auto-plan-schedule.js';
import { scorePlayerForClan } from '../auto-plan/cwl-auto-plan-scoring.js';
import {
    normalizePlannedDays,
    normalizeRosterStatus
} from '../cwl-plan-schema.js';
import { normalizeTag } from '../cwl-utils.js';

export function normalizeOptimizationInput(input) {
    const playersByTag = new Map();
    (Array.isArray(input?.players) ? input.players : []).forEach(player => {
        const tag = normalizeTag(player?.tag);
        if (!tag || playersByTag.has(tag)) return;
        playersByTag.set(tag, {
            ...player,
            tag,
            name: String(player.name || tag),
            townHallLevel: Math.max(1, Number(player.townHallLevel) || 1),
            currentClanId: player.currentClanId ? String(player.currentClanId) : null,
            currentRole: normalizeRosterStatus(player.currentRole),
            plannedDays: normalizePlannedDays(player.plannedDays),
            hasPlannedDays: Boolean(player.hasPlannedDays)
                || normalizePlannedDays(player.plannedDays).length > 0
        });
    });
    const clans = (Array.isArray(input?.clans) ? input.clans : [])
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
    return {
        players: [...playersByTag.values()].sort(byTag),
        clans,
        rounds: Math.max(1, Math.min(7, Math.round(Number(input?.rounds) || 7))),
        locks: {
            assignments: { ...(input?.locks?.assignments || {}) },
            roles: { ...(input?.locks?.roles || {}) },
            reasons: { ...(input?.locks?.reasons || {}) },
            startedClanIds: [...new Set(input?.locks?.startedClanIds || [])].sort()
        }
    };
}

export function buildPlanState(input) {
    const normalized = normalizeOptimizationInput(input);
    const clans = normalized.clans.map(clan => buildClanState(
        clan,
        normalized.players.filter(player => player.currentClanId === clan.id),
        normalized.rounds,
        normalized.locks.roles
    ));
    const freePlayers = normalized.players
        .filter(player => !player.currentClanId)
        .map(player => ({ ...player }))
        .sort(byTag);
    return {
        ...normalized,
        clans,
        freePlayers,
        metrics: aggregateMetrics(clans)
    };
}

export function recommendClanRoles(clan, players, roleLocks = {}) {
    const assignment = assignPlayersGlobally({
        players,
        clans: [clan],
        assignmentLocks: {},
        roleLocks
    });
    const classified = classifyClanRoles(
        clan,
        assignment.buckets.get(clan.id) || [],
        roleLocks
    );
    const roles = new Map(classified.players.map(entry => [
        entry.player.tag,
        entry.role
    ]));
    assignment.free.forEach(entry => roles.set(entry.player.tag, 'free'));
    return roles;
}

export function applySuggestionActions(input, suggestions, selectedIds) {
    const normalized = normalizeOptimizationInput(input);
    const selected = new Set(selectedIds);
    const actions = suggestions
        .filter(suggestion => selected.has(suggestion.id))
        .flatMap(suggestion => suggestion.actions);
    const players = normalized.players.map(player => applyPlayerActions(player, actions));
    return buildPlanState({ ...normalized, players });
}

export function toApplicablePlan(state) {
    return {
        mode: 'optimize',
        rounds: state.rounds,
        clans: state.clans.map(clan => ({
            ...clan,
            status: 'active',
            players: clan.players
        })),
        freePlayers: state.freePlayers
    };
}

function buildClanState(clan, assignedPlayers, rounds, roleLocks) {
    const recommendations = recommendClanRoles(clan, assignedPlayers, roleLocks);
    const players = assignedPlayers.map(player => ({
        ...player,
        currentRole: normalizeRosterStatus(
            player.currentRole,
            recommendations.get(player.tag) === 'free'
                ? 'reserve'
                : recommendations.get(player.tag) || 'core'
        )
    }));
    const classified = players.map(player => ({
        player,
        role: player.currentRole,
        hardLocked: false,
        score: scorePlayerForClan(player, clan)
    }));
    const hasExplicitSchedule = players.some(player => player.hasPlannedDays);
    const schedule = hasExplicitSchedule
        ? evaluatePlannedSchedule(clan, classified, rounds)
        : buildDailySchedule(clan, classified, rounds);
    const plannedPlayers = classified.map(entry => ({
        ...entry,
        player: {
            ...entry.player,
            plannedDays: schedule.plannedDays[entry.player.tag] || []
        }
    }));
    const readiness = calculateClanReadiness(clan, plannedPlayers, schedule);
    const activeCount = plannedPlayers.filter(entry => entry.role !== 'reserve').length;
    const warnings = [
        ...(activeCount < clan.capacity ? [{
            code: 'incomplete_roster',
            active: activeCount,
            required: clan.capacity
        }] : []),
        ...schedule.warnings
    ];
    return {
        ...clan,
        players: plannedPlayers.map(entry => ({
            ...entry.player,
            role: entry.role,
            score: entry.score
        })).sort(comparePlayers),
        lineups: schedule.lineups,
        lineupChanges: schedule.changes,
        readiness,
        warnings,
        metrics: {
            expectedPerformance: readiness.expectedPerRound,
            reliability: readiness.reliability,
            lineupChanges: schedule.changes,
            readiness: readiness.status
        }
    };
}

function aggregateMetrics(clans) {
    const expected = clans.map(clan => clan.metrics.expectedPerformance)
        .filter(Number.isFinite);
    const reliability = clans.map(clan => clan.metrics.reliability)
        .filter(Number.isFinite);
    const readinessOrder = { good: 0, 'low-confidence': 1, risk: 2 };
    const readiness = [...clans].sort((left, right) =>
        (readinessOrder[right.readiness.status] || 0)
        - (readinessOrder[left.readiness.status] || 0)
    )[0]?.readiness.status || 'low-confidence';
    return {
        expectedPerformance: expected.length
            ? round(expected.reduce((sum, value) => sum + value, 0), 1)
            : null,
        reliability: reliability.length
            ? round(reliability.reduce((sum, value) => sum + value, 0) / reliability.length, 0)
            : null,
        lineupChanges: clans.reduce((sum, clan) => sum + clan.lineupChanges, 0),
        readiness
    };
}

function applyPlayerActions(player, actions) {
    const next = { ...player, plannedDays: [...player.plannedDays] };
    actions.filter(action => action.playerTag === player.tag).forEach(action => {
        if (action.type === 'move') next.currentClanId = action.toClanId;
        if (action.type === 'role') next.currentRole = action.role;
        if (action.type === 'days') {
            next.plannedDays = normalizePlannedDays(action.days);
            next.hasPlannedDays = true;
        }
        if (action.type === 'free') {
            next.currentClanId = null;
            next.currentRole = '';
            next.plannedDays = [];
            next.hasPlannedDays = false;
        }
    });
    return next;
}

function comparePlayers(left, right) {
    const roles = { core: 0, rotation: 1, reserve: 2 };
    return (roles[left.role] ?? 3) - (roles[right.role] ?? 3)
        || right.score.fit - left.score.fit
        || left.tag.localeCompare(right.tag);
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}

function byTag(left, right) {
    return left.tag.localeCompare(right.tag);
}
