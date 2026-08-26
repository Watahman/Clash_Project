import {
    getClanCurrentWarLeagueGroupRequest,
    getClanInfoRequest,
    getClanMembersRequest,
    getClanWarLeagueWarRequest
} from '../API/API-Clan.js?v=20260826-live-refresh';
import { getPlayerInfoRequest } from '../API/API-Player.js';
import {
    getAllPlansFromDatabase,
    getPlanFromDatabase
} from '../Supabase/Supabase-Plan.js';
import {
    normalizePlan
} from './operation-board-plan-model.js';
import {
    cleanDisplayName,
    getWarSide,
    mergePlayerData,
    normalizeLeaguePhase,
    normalizeTag
} from './operation-board-utils.js';
import { competeT as t } from './compete-locales.js';
import { loadCwlFixture } from './operation-board-fixtures.js';

export class NoActiveCwlError extends Error {
    constructor() {
        super(t('cwl.noActive'));
        this.name = 'NoActiveCwlError';
        this.code = 'NO_ACTIVE_CWL';
    }
}

export async function fetchPlans(userId) {
    const plans = await getAllPlansFromDatabase(userId);
    return Array.isArray(plans)
        ? plans.map(normalizePlan).filter(Boolean)
        : [];
}

export async function fetchPlan(plan) {
    if (!plan) return null;
    if (plan.info) return plan;
    const full = normalizePlan(await getPlanFromDatabase(plan.id)) || plan;
    return { ...plan, ...full };
}

export async function fetchClanName(clanTag) {
    const clan = await getClanInfoRequest(clanTag);
    return cleanDisplayName(clan?.name) || normalizeTag(clanTag);
}

export async function loadOperationSource({
    clan,
    plan = null,
    signal,
    forceRefresh = false
}) {
    const fixture = await loadCwlFixture({ signal });
    if (fixture) return loadFixtureSource(fixture, clan, plan);
    const requestOptions = { signal, forceRefresh };
    const [clanInfoResult, membersResult, leagueGroupResult] = await Promise.allSettled([
        getClanInfoRequest(clan.tag, requestOptions),
        getClanMembersRequest(clan.tag, requestOptions),
        getClanCurrentWarLeagueGroupRequest(clan.tag, requestOptions)
    ]);

    if (isNoActiveCwlResult(leagueGroupResult)) throw new NoActiveCwlError();
    if (leagueGroupResult.status !== 'fulfilled'
        || !isActiveLeagueGroup(leagueGroupResult.value)) {
        throw leagueGroupResult.reason || new Error('Unable to load CWL league group');
    }

    const hasCoreData = [clanInfoResult, membersResult].some(result =>
        result.status === 'fulfilled' && result.value && !result.value.error
    );
    if (!hasCoreData) throw new Error('No live clan data available');

    const members = membersResult.status === 'fulfilled'
        && Array.isArray(membersResult.value?.items)
        ? membersResult.value.items
        : [];
    const clanInfo = clanInfoResult.status === 'fulfilled'
        && !clanInfoResult.value?.error
        ? clanInfoResult.value
        : null;
    const clanBase = {
        ...clan,
        tag: normalizeTag(clanInfo?.tag || clan.tag),
        name: cleanDisplayName(clanInfo?.name || clan.name) || clan.tag,
        players: Array.isArray(clan.players) ? clan.players : []
    };
    const enrichedClan = await enrichPlannedPlayers(clanBase, members, signal);
    const leagueGroup = leagueGroupResult.value;
    const leagueWars = await fetchLeagueWars(leagueGroup, signal, forceRefresh);
    return {
        plan,
        clan: enrichedClan,
        clanInfo,
        members,
        leagueGroup,
        leagueWars,
        wars: leagueWars.filter(war => getWarSide(war, enrichedClan.tag)),
        phase: normalizeLeaguePhase(leagueGroup.state)
    };
}

function loadFixtureSource(fixture, requestedClan, requestedPlan) {
    const source = fixture.data?.source;
    if (!source) throw new Error(t('cwl.sourceUnavailable'));
    if (source.noActive) throw new NoActiveCwlError();
    const fixtureClan = source.clan || requestedClan;
    const clan = {
        ...requestedClan,
        ...fixtureClan,
        tag: normalizeTag(fixtureClan?.tag || requestedClan?.tag),
        name: cleanDisplayName(fixtureClan?.name || requestedClan?.name)
            || normalizeTag(fixtureClan?.tag || requestedClan?.tag),
        players: Array.isArray(fixtureClan?.players) ? fixtureClan.players : []
    };
    return {
        ...source,
        fixture: true,
        plan: source.plan || requestedPlan || null,
        clan,
        members: Array.isArray(source.members) ? source.members : [],
        leagueGroup: source.leagueGroup || null,
        leagueWars: Array.isArray(source.leagueWars) ? source.leagueWars : [],
        wars: Array.isArray(source.wars) && source.wars.length
            ? source.wars
            : (source.leagueWars || []).filter(war =>
                getWarSide(war, clan.tag)
            ),
        phase: source.phase || normalizeLeaguePhase(source.leagueGroup?.state),
        predictionState: source.predictionState || 'unavailable'
    };
}

function isActiveLeagueGroup(group) {
    if (!group || group.error || !Array.isArray(group.rounds) || !group.rounds.length) {
        return false;
    }
    return normalizeLeaguePhase(group.state) !== 'completed';
}

function isNoActiveCwlResult(result) {
    if (result?.status === 'fulfilled') return !isActiveLeagueGroup(result.value);
    return Number(result?.reason?.status) === 404;
}

async function enrichPlannedPlayers(clan, members = [], signal) {
    const memberIndex = new Map(
        members.map(member => [normalizeTag(member.tag), member]).filter(([tag]) => tag)
    );
    const plannedPlayers = Array.isArray(clan.players) ? clan.players : [];
    const enriched = plannedPlayers.map(player =>
        mergePlayerData(player, memberIndex.get(normalizeTag(player.tag)) || {})
    );
    const missing = enriched.filter(player =>
        player.tag && (!player.name || player.name === player.tag || !player.townHall)
    );
    const results = await Promise.allSettled(
        missing.map(player => getPlayerInfoRequest(player.tag, { signal }))
    );
    results.forEach((result, index) => {
        if (result.status !== 'fulfilled' || !result.value || result.value.error) return;
        const fetched = mergePlayerData(missing[index], result.value);
        const target = enriched.find(player => player.tag === fetched.tag);
        if (target) Object.assign(target, fetched);
    });
    return { ...clan, players: enriched };
}

async function fetchLeagueWars(leagueGroup, signal, forceRefresh = false) {
    const warTags = (leagueGroup.rounds || [])
        .flatMap((round, roundIndex) =>
            (round.warTags || []).map(warTag => ({
                warTag,
                round: roundIndex + 1
            }))
        )
        .filter(item => normalizeTag(item.warTag));
    const results = await Promise.allSettled(
        warTags.map(item =>
            getClanWarLeagueWarRequest(item.warTag, {
                signal,
                forceRefresh
            }).then(war => ({
                ...war,
                _round: item.round,
                _warTag: item.warTag
            }))
        )
    );
    return results
        .filter(result =>
            result.status === 'fulfilled' && result.value && !result.value.error
        )
        .map(result => result.value);
}
