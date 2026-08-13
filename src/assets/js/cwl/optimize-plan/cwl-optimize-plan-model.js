import {
    assignPlayersGlobally,
    classifyClanRoles
} from '../auto-plan/cwl-auto-plan-assignment.js';
import { calculateClanReadiness } from '../auto-plan/cwl-auto-plan-readiness.js';
import { scorePlayerForClan } from '../auto-plan/cwl-auto-plan-scoring.js';
import { normalizeRosterStatus } from '../cwl-plan-schema.js';
import { normalizeTag } from '../cwl-utils.js';
import { preservesRequiredClanCoverage } from './cwl-optimize-plan-coverage.js';

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
            currentRole: normalizeRosterStatus(player.currentRole)
        });
    });
    return {
        players: [...playersByTag.values()].sort(byTag),
        clans: normalizeClans(input?.clans),
        locks: normalizeLocks(input?.locks)
    };
}

export function buildPlanState(input) {
    const normalized = normalizeOptimizationInput(input);
    const clans = normalized.clans.map(clan => buildClanState(
        clan,
        normalized.players.filter(player => player.currentClanId === clan.id),
        normalized.locks.roles
    ));
    return {
        ...normalized,
        clans,
        freePlayers: normalized.players.filter(player => !player.currentClanId).sort(byTag),
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
    const roles = new Map(classified.players.map(entry => [entry.player.tag, entry.role]));
    assignment.free.forEach(entry => roles.set(entry.player.tag, 'free'));
    return roles;
}

export function applySuggestionActions(input, suggestions, selectedIds) {
    const normalized = normalizeOptimizationInput(input);
    const selected = new Set(selectedIds);
    let players = normalized.players.map(player => ({ ...player }));
    suggestions.filter(suggestion => selected.has(suggestion.id)).forEach(suggestion => {
        const candidate = players.map(player => applyPlayerActions(player, suggestion.actions));
        if (preservesRequiredClanCoverage(normalized, players, candidate)) players = candidate;
    });
    return buildPlanState({ ...normalized, players });
}

export function toApplicablePlan(state) {
    return {
        mode: 'optimize',
        clans: state.clans.map(clan => ({ ...clan, status: 'active' })),
        freePlayers: state.freePlayers
    };
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
        reasons: { ...(locks?.reasons || {}) },
        startedClanIds: [...new Set(locks?.startedClanIds || [])].sort()
    };
}

function buildClanState(clan, assignedPlayers, roleLocks) {
    const recommendations = recommendClanRoles(clan, assignedPlayers, roleLocks);
    const classified = assignedPlayers.map(player => ({
        player: withRecommendedRole(player, recommendations),
        role: withRecommendedRole(player, recommendations).currentRole,
        hardLocked: false,
        score: scorePlayerForClan(player, clan)
    }));
    const readiness = calculateClanReadiness(clan, classified);
    const activeCount = classified.filter(entry => entry.role !== 'reserve').length;
    const warnings = activeCount < clan.capacity ? [{
        code: 'incomplete_roster', active: activeCount, required: clan.capacity
    }] : [];
    return {
        ...clan,
        players: classified.map(entry => ({
            ...entry.player,
            role: entry.role,
            score: entry.score
        })).sort(comparePlayers),
        readiness,
        warnings,
        metrics: {
            expectedPerformance: readiness.expectedPerRound,
            reliability: readiness.reliability,
            assigned: classified.length,
            active: activeCount,
            readiness: readiness.status
        }
    };
}

function withRecommendedRole(player, recommendations) {
    return {
        ...player,
        currentRole: normalizeRosterStatus(
            player.currentRole,
            recommendations.get(player.tag) === 'free'
                ? 'reserve'
                : recommendations.get(player.tag) || 'core'
        )
    };
}

function aggregateMetrics(clans) {
    const expected = clans.map(clan => clan.metrics.expectedPerformance).filter(Number.isFinite);
    const reliability = clans.map(clan => clan.metrics.reliability).filter(Number.isFinite);
    const readinessOrder = { good: 0, 'low-confidence': 1, risk: 2 };
    const readiness = [...clans].sort((left, right) => (
        (readinessOrder[right.readiness.status] || 0)
        - (readinessOrder[left.readiness.status] || 0)
    ))[0]?.readiness.status || 'low-confidence';
    return {
        expectedPerformance: expected.length ? round(sum(expected), 1) : null,
        reliability: reliability.length ? round(sum(reliability) / reliability.length, 0) : null,
        assigned: sum(clans.map(clan => clan.metrics.assigned)),
        active: sum(clans.map(clan => clan.metrics.active)),
        readiness
    };
}

function applyPlayerActions(player, actions) {
    const next = { ...player };
    actions.filter(action => action.playerTag === player.tag).forEach(action => {
        if (action.type === 'move') next.currentClanId = action.toClanId;
        if (action.type === 'role') next.currentRole = action.role;
        if (action.type === 'free') {
            next.currentClanId = null;
            next.currentRole = '';
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

function sum(values) {
    return values.reduce((total, value) => total + Number(value), 0);
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}

function byTag(left, right) {
    return left.tag.localeCompare(right.tag);
}
