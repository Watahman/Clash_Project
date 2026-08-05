import { normalizeTag } from './cwl-utils.js';
import { t } from '../i18n/i18n.js';

export const CWL_PLAN_SCHEMA_VERSION = 4;

export const CWL_ROSTER_STATUSES = Object.freeze(['core', 'rotation', 'reserve']);

export function normalizeRosterStatus(value, fallback = '') {
    const status = String(value || '').trim().toLowerCase();
    return CWL_ROSTER_STATUSES.includes(status) ? status : fallback;
}

export function normalizePlannedDays(value) {
    const days = Array.isArray(value)
        ? value
        : String(value || '').split(',');
    return [...new Set(days
        .map(Number)
        .filter(day => Number.isInteger(day) && day >= 1 && day <= 7)
    )].sort((left, right) => left - right);
}

export function normalizePlayerSnapshot(player, fallbackClanName = '', fallbackRosterStatus = '') {
    if (typeof player === 'string') {
        const tag = normalizeTag(player);
        return tag ? {
            tag,
            name: tag,
            townHallLevel: 1,
            clanName: fallbackClanName,
            rosterStatus: normalizeRosterStatus('', fallbackRosterStatus),
            plannedDays: []
        } : null;
    }
    if (!player || typeof player !== 'object') return null;
    const tag = normalizeTag(player.tag || player.playerTag || player.accountTag || player.clashTag);
    if (!tag) return null;
    return {
        tag,
        name: String(player.name || player.playerName || tag).trim(),
        townHallLevel: Math.max(1, Number(player.townHallLevel || player.townHall || player.th || 1)),
        clanName: String(player.clanName || player.clan?.name || fallbackClanName || '').trim(),
        clanTag: normalizeTag(player.clanTag || player.clantag || player.clan?.tag || ''),
        rosterStatus: normalizeRosterStatus(
            player.rosterStatus || player.roster_status || player.status,
            fallbackRosterStatus
        ),
        plannedDays: normalizePlannedDays(
            player.plannedDays || player.planned_days || player.days
        )
    };
}

function uniquePlayerSnapshots(players, fallbackClanName = '', fallbackRosterStatus = '') {
    const byTag = new Map();
    (Array.isArray(players) ? players : []).forEach(player => {
        const normalized = normalizePlayerSnapshot(player, fallbackClanName, fallbackRosterStatus);
        if (normalized && !byTag.has(normalized.tag)) byTag.set(normalized.tag, normalized);
    });
    return [...byTag.values()];
}

function normalizeClan(clan, index) {
    const tag = normalizeTag(clan?.tag || clan?.clanTag || clan?.clantag);
    if (!tag) return null;
    const name = String(clan?.name || clan?.clanName || tag).trim();
    return {
        id: String(clan?.id || clan?.uuid || `legacy-${index}`),
        tag,
        name,
        capacity: [15, 30].includes(Number(clan?.capacity || clan?.amountOfPlayers || clan?.maxPlayers))
            ? Number(clan?.capacity || clan?.amountOfPlayers || clan?.maxPlayers)
            : 15,
        badgeUrl: String(clan?.badgeUrl || clan?.badge_url || '').trim(),
        players: uniquePlayerSnapshots(clan?.players, name)
    };
}

export function normalizePlanDocument(input) {
    if (input && !Array.isArray(input) && typeof input === 'object') {
        const clans = (Array.isArray(input.clans) ? input.clans : [])
            .map(normalizeClan)
            .filter(Boolean);
        return {
            schemaVersion: CWL_PLAN_SCHEMA_VERSION,
            freePlayers: uniquePlayerSnapshots(input.freePlayers),
            clans,
            pollMeta: {
                groupId: String(input.pollMeta?.groupId || '').trim(),
                pollId: String(input.pollMeta?.pollId || '').trim()
            }
        };
    }

    const legacy = Array.isArray(input) ? input : [];
    const first = legacy[0];
    const hasSyntheticFreePlayers = String(first?.clanTag || first?.clantag || '').toLowerCase() === 'none';
    const clanRows = hasSyntheticFreePlayers ? legacy.slice(1) : legacy;
    return {
        schemaVersion: CWL_PLAN_SCHEMA_VERSION,
        freePlayers: uniquePlayerSnapshots(hasSyntheticFreePlayers ? first?.players : []),
        clans: clanRows.map(normalizeClan).filter(Boolean),
        pollMeta: {
            groupId: String(hasSyntheticFreePlayers ? first?.groupId || '' : '').trim(),
            pollId: String(hasSyntheticFreePlayers ? first?.pollId || '' : '').trim()
        }
    };
}

export function validatePlanDocument(input) {
    const document = normalizePlanDocument(input);
    const allTags = [
        ...document.freePlayers.map(player => player.tag),
        ...document.clans.flatMap(clan => clan.players.map(player => player.tag))
    ];
    if (new Set(allTags).size !== allTags.length) {
        throw new Error(t('cwl.accountAlreadyInPlanner'));
    }
    return document;
}
