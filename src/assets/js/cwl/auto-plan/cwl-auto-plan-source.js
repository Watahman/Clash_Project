import { getClanCurrentWarLeagueGroupRequest } from '../../API/API-Clan.js';
import {
    getPlayerPerformance,
    loadPlayerPerformanceBatch
} from '../player-performance-client.js';
import { getPlayerAvailability } from '../cwl-availability.js';
import { savePlan } from '../cwl-plan-io.js';
import { normalizePlannedDays } from '../cwl-plan-schema.js';
import {
    rememberPlannerPlayers,
    updateAllPlayerCounters
} from '../cwl-planner-card-state.js';
import {
    syncPlayerPlannedDays,
    syncPlayerRosterStatus
} from '../cwl-player-controls.js';
import { getCardTag, normalizeTag } from '../cwl-utils.js';

export async function collectAutoPlanInput(root = document) {
    const clanCards = Array.from(root.querySelectorAll('.cwl-clan-article'));
    const clans = clanCards.map(readClan).filter(clan => clan.tag);
    const playerCards = Array.from(root.querySelectorAll(
        '.cwl-player-article[data-planner-card="true"]'
    ));
    const tags = playerCards.map(getCardTag).filter(Boolean);
    const [, lockData] = await Promise.all([
        loadPlayerPerformanceBatch(tags),
        loadCwlRegistrationLocks(clans)
    ]);
    const players = playerCards.map(card => readPlayer(card, getPlayerPerformance(getCardTag(card))));
    const rounds = Math.max(
        1,
        ...players.map(player => Number(player.availability?.rounds) || 7)
    );
    return {
        players,
        clans,
        rounds: Math.min(7, rounds),
        locks: lockData
    };
}

export async function loadCwlRegistrationLocks(clans) {
    const ordered = [...clans].sort((left, right) => left.tag.localeCompare(right.tag));
    const clanIdByTag = new Map(ordered.map(clan => [normalizeTag(clan.tag), clan.id]));
    const results = await Promise.allSettled(
        ordered.map(clan => getClanCurrentWarLeagueGroupRequest(clan.tag))
    );
    const assignments = {};
    const reasons = {};
    const startedClanIds = [];

    results.forEach((result, index) => {
        if (result.status !== 'fulfilled' || !isStartedGroup(result.value)) return;
        startedClanIds.push(ordered[index].id);
        const groupClans = Array.isArray(result.value?.clans) ? result.value.clans : [];
        [...groupClans].sort((left, right) =>
            normalizeTag(left?.tag).localeCompare(normalizeTag(right?.tag))
        ).forEach(groupClan => {
            const clanId = clanIdByTag.get(normalizeTag(groupClan?.tag));
            if (!clanId) return;
            const members = Array.isArray(groupClan?.members) ? groupClan.members : [];
            members.forEach(member => {
                const tag = normalizeTag(member?.tag);
                if (!tag || Object.hasOwn(assignments, tag)) return;
                assignments[tag] = clanId;
                reasons[tag] = 'registered-cwl-roster';
            });
        });
    });
    return {
        assignments,
        roles: {},
        reasons,
        startedClanIds: [...new Set(startedClanIds)].sort()
    };
}

export function applyAutoPlanResult(result, root = document) {
    const cardByTag = new Map(
        Array.from(root.querySelectorAll(
            '.cwl-player-article[data-planner-card="true"]'
        )).map(card => [getCardTag(card), card])
    );
    const clanById = new Map(
        Array.from(root.querySelectorAll('.cwl-clan-article'))
            .map(card => [clanId(card), card])
    );
    const freeRoster = root.querySelector('#cwl-available-players');

    result.freePlayers.forEach(player => {
        const card = cardByTag.get(player.tag);
        if (!card || !freeRoster) return;
        freeRoster.appendChild(card);
        syncPlayerRosterStatus(card);
        syncPlayerPlannedDays(card, []);
    });
    result.clans.forEach(clan => {
        const target = clanById.get(clan.id)?.querySelector('.cwl-clan-player-list');
        if (!target) return;
        clan.players.forEach(player => {
            const card = cardByTag.get(player.tag);
            if (!card) return;
            target.appendChild(card);
            syncPlayerRosterStatus(card, { preferredStatus: player.role });
            syncPlayerPlannedDays(card, player.plannedDays);
        });
    });

    updateAllPlayerCounters();
    rememberPlannerPlayers();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-auto-plan-applied', {
        detail: { mode: result.mode }
    }));
    window.dispatchEvent(new CustomEvent('clashtools:cwl-player-added'));
    return savePlan();
}

function readClan(card) {
    return {
        id: clanId(card),
        tag: normalizeTag(card.dataset.clanTag),
        name: card.dataset.clanName
            || card.querySelector('.cwl-clan-name')?.textContent?.trim()
            || card.dataset.clanTag,
        league: card.dataset.clanLeague
            || card.querySelector('.cwl-clan-league')?.textContent?.replace(/^.*?·\s*/, '').trim()
            || '',
        capacity: Number(card.querySelector('.cwl-clan-capacity')?.value) === 30 ? 30 : 15
    };
}

function readPlayer(card, performance) {
    const tag = getCardTag(card);
    const currentClan = card.closest('.cwl-clan-article');
    return {
        ...(card._cwlPlayer || {}),
        tag,
        name: card.querySelector('.cwl-player-name')?.textContent?.trim() || tag,
        townHallLevel: Number(card.dataset.townHall) || 1,
        currentClanId: currentClan ? clanId(currentClan) : null,
        currentRole: card.dataset.rosterStatus || '',
        plannedDays: normalizePlannedDays(card.dataset.plannedDays),
        hasPlannedDays: Object.hasOwn(card.dataset, 'plannedDays'),
        availability: getPlayerAvailability(tag),
        performance: performance || { status: 'unavailable' }
    };
}

function clanId(card) {
    return String(card?.id || '').replace(/^cwl-clan-template_/, '');
}

function isStartedGroup(group) {
    if (!group || group.error || !Array.isArray(group.clans)) return false;
    return !['ended', 'completed'].includes(String(group.state || '').toLowerCase());
}
