import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { getActiveCwlPollMeta } from './cwl-availability.js?v=20260829-public-auth-v1';
import {
    CWL_PLAN_SCHEMA_VERSION,
    normalizeClanPriority,
    normalizePlanDocument,
    normalizePlayerPriority,
    normalizeRosterStatus,
    validatePlanDocument
} from './cwl-plan-schema.js';
import { getCardTag, normalizeTag } from './cwl-utils.js';

export function cleanPlanId(value) {
    const id = String(value || '').trim();
    return id && id !== 'undefined' && id !== 'null' ? id : null;
}

export function normalizePlan(plan) {
    if (!plan) return null;
    if (typeof plan === 'string') return { id: plan, uuid: plan, name: plan, info: null, revision: null };
    const id = cleanPlanId(plan.id || plan.uuid || plan.planId);
    if (!id) return null;
    const rawInfo = plan.info ?? plan.planInfo ?? null;
    return {
        ...plan,
        id,
        uuid: plan.uuid || id,
        name: String(plan.name || plan.plan_name || t('cwl.unnamedPlan')).trim(),
        info: rawInfo == null ? null : normalizePlanDocument(rawInfo),
        revision: Number.isFinite(Number(plan.revision)) ? Number(plan.revision) : null
    };
}

function readPlayerCard(player) {
    const snapshot = {
        name: player.querySelector('.cwl-player-name')?.textContent || '',
        clanName: player.querySelector('.cwl-player-clan')?.textContent || '',
        tag: getCardTag(player),
        townHallLevel: Number(player.dataset.townHall || 1),
        playerPriority: normalizePlayerPriority(player.dataset.playerPriority)
    };
    const rosterStatus = normalizeRosterStatus(player.dataset.rosterStatus);
    if (rosterStatus) snapshot.rosterStatus = rosterStatus;
    const legacySchedule = String(player.dataset.legacySchedule || '')
        .split(',')
        .map(Number)
        .filter(day => Number.isInteger(day) && day >= 1 && day <= 7);
    if (legacySchedule.length) snapshot.plannedDays = legacySchedule;
    return snapshot;
}

export function serializePlanDocument({ availablePlayers, allClans, persistCache = true,
    persistCacheIfAllowed } = {}) {
    const pollMeta = getActiveCwlPollMeta();
    const document = {
        schemaVersion: CWL_PLAN_SCHEMA_VERSION,
        freePlayers: Array.from(
            availablePlayers.querySelectorAll('.cwl-player-article[data-planner-card="true"]'),
            readPlayerCard
        ).filter(player => player.tag),
        clans: Array.from(allClans.querySelectorAll('.cwl-clan-article')).map(clan => ({
            id: clan.id.split('_').at(-1),
            tag: normalizeTag(clan.dataset.clanTag),
            name: clan.dataset.clanName || clan.querySelector('.cwl-clan-name')?.textContent || '',
            capacity: Number(clan.querySelector('.cwl-clan-capacity')?.value || clan.dataset.clanCapacity || 15),
            badgeUrl: clan.querySelector('.cwl-clan-logo')?.src || '',
            clanPriority: normalizeClanPriority(clan.dataset.clanPriority),
            players: Array.from(
                clan.querySelectorAll('.cwl-player-article[data-planner-card="true"]'),
                readPlayerCard
            ).filter(player => player.tag)
        })),
        pollMeta: {
            groupId: pollMeta.groupId || '',
            pollId: pollMeta.pollId || ''
        }
    };
    const validated = validatePlanDocument(document);
    persistCacheIfAllowed?.(persistCache, validated);
    return validated;
}

function freezeDeep(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    Object.values(value).forEach(child => freezeDeep(child, seen));
    return Object.freeze(value);
}

function exportTimestamp(now) {
    const date = now instanceof Date ? new Date(now.getTime()) : new Date(now ?? Date.now());
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function createCurrentPlanSnapshot({ availablePlayers, allClans, planName, now,
    persistCacheIfAllowed } = {}) {
    const info = serializePlanDocument({ availablePlayers, allClans, persistCache: false,
        persistCacheIfAllowed });
    const name = String(planName?.value || '').trim() || t('cwl.defaultPlanName');
    return freezeDeep({
        name,
        exportedAt: exportTimestamp(now),
        ...info
    });
}
