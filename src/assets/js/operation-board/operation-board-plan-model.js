import { normalizePlanDocument } from '../cwl/cwl-plan-schema.js';
import * as authClient from '../auth/auth-client.js?v=20260829-public-auth-v1';
import {
    cleanDisplayName,
    looksLikeClashTag,
    mergePlayerData,
    normalizeTag,
    number
} from './operation-board-utils.js';

function readPlannerPlayerCache() {
    const key = getPlannerPlayerCacheKey();
    if (!key) return new Map();
    try {
        const raw = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(raw)) return new Map();
        return new Map(
            raw.map(player => [normalizeTag(player?.tag), player]).filter(([tag]) => tag)
        );
    } catch {
        return new Map();
    }
}

function getPlannerPlayerCacheKey() {
    const state = getAuthStateSafely();
    if (state === undefined) return 'clashtools_last_planner_players';
    if (state?.status !== 'authenticated' || !state.session?.user?.id) return null;
    return `clashpanel:planner:${encodeURIComponent(state.session.user.id)}:players`;
}

function getAuthStateSafely() {
    try {
        return typeof authClient.getAuthState === 'function'
            ? authClient.getAuthState()
            : undefined;
    } catch {
        return undefined;
    }
}

export function normalizePlayerRef(reference, fallbackClanName = '') {
    if (typeof reference === 'string') {
        const tag = normalizeTag(reference);
        return tag ? { tag, name: '', townHall: 0, clanName: fallbackClanName } : null;
    }
    if (!reference || typeof reference !== 'object') return null;
    const rawTag = reference.tag
        || reference.playerTag
        || reference.player_tag
        || reference.hashtag
        || (looksLikeClashTag(reference.id) ? reference.id : '');
    const tag = normalizeTag(rawTag);
    if (!tag) return null;
    return {
        tag,
        name: cleanDisplayName(
            reference.name || reference.playerName || reference.player_name || ''
        ),
        townHall: number(
            reference.townHallLevel
                || reference.townHall
                || reference.th
                || reference.townhall,
            0
        ),
        clanName: reference.clanName
            || reference.clan_name
            || fallbackClanName
            || '',
        clanTag: normalizeTag(
            reference.clanTag || reference.clantag || reference.clan_id || ''
        )
    };
}

export function normalizePlan(plan) {
    if (!plan) return null;
    if (typeof plan === 'string') return { id: plan, name: plan, info: null };
    const id = plan.id || plan.uuid || plan.planId;
    if (!id) return null;
    return {
        ...plan,
        id,
        name: plan.name || plan.plan_name || 'Untitled plan',
        info: plan.info != null
            ? normalizePlanDocument(plan.info)
            : plan.planInfo != null
                ? normalizePlanDocument(plan.planInfo)
                : null
    };
}

export function getPlanClans(plan) {
    const info = normalizePlanDocument(plan?.info);
    const playerCache = readPlannerPlayerCache();
    return info.clans.map((clan, index) => {
        const tag = normalizeTag(clan.tag);
        const fallbackName = clan.name || clan.clanName || '';
        const players = (Array.isArray(clan.players) ? clan.players : [])
            .map(player => normalizePlayerRef(player, fallbackName))
            .filter(Boolean)
            .map(player => mergePlayerData(player, playerCache.get(player.tag) || {}));
        return {
            index,
            uuid: clan.uuid || clan.id || '',
            name: fallbackName || tag || `Clan ${index + 1}`,
            tag,
            players,
            amountOfPlayers: number(
                clan.capacity || clan.amountOfPlayers || clan.maxPlayers,
                15
            )
        };
    }).filter(clan => clan.tag);
}

export function hasUsefulClanName(clan) {
    const name = String(clan?.name || '').trim();
    if (!name || name === clan.tag || normalizeTag(name) === clan.tag) return false;
    return !name.toLowerCase().includes('clanid');
}
