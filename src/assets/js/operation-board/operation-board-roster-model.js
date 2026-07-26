import {
    decideWarResult,
    isAttackCountingState,
    isMissedCountingState,
    normalizeWarState
} from '../cwl/cwl-war-state.js';
import {
    cleanDisplayName,
    getWarSide,
    mergePlayerData,
    normalizeTag,
    number
} from './operation-board-utils.js';

export function createEmptyRound(day) {
    return {
        day,
        state: 'notStarted',
        opponent: '-',
        stars: 0,
        destruction: 0,
        attacksUsed: 0,
        availableAttacks: 0,
        missed: 0,
        result: 'notStarted'
    };
}

export function getPlayerStatus(player) {
    if (player.warParticipant && !player.planned) return 'unplanned';
    if (player.planned && !player.warParticipant) return 'plannedOnly';
    if (!player.planned && player.apiMember) return 'apiOnly';
    return 'ok';
}

export function buildRosterModel(raw) {
    const plannedRecords = Array.isArray(raw.clan?.players) ? raw.clan.players : [];
    const plannedTags = new Set(
        plannedRecords.map(player => normalizeTag(player.tag || player)).filter(Boolean)
    );
    const players = new Map();

    const ensure = (tag, data = {}) => {
        const normalized = normalizeTag(tag || data.tag);
        if (!normalized) return null;
        if (!players.has(normalized)) {
            players.set(normalized, {
                tag: normalized,
                name: data.name || '',
                townHall: number(data.townHallLevel || data.townHall || data.th, 0),
                clanName: data.clanName || data.clan?.name || '',
                planned: plannedTags.has(normalized),
                apiMember: false,
                warParticipant: false,
                attacksUsed: 0,
                availableAttacks: 0,
                stars: 0,
                destructionTotal: 0,
                destructionHits: 0,
                missed: 0,
                dayStats: {}
            });
        }
        const player = players.get(normalized);
        Object.assign(player, mergePlayerData(player, data));
        if (plannedTags.has(normalized)) player.planned = true;
        return player;
    };

    plannedRecords.forEach(player => ensure(player.tag || player, player));
    (raw.members || []).forEach(member => {
        const player = ensure(member.tag, member);
        if (player) player.apiMember = true;
    });

    const maxRound = Math.max(
        7,
        ...(raw.wars || []).map(war => number(war._round, 1))
    );
    const rounds = Array.from({ length: maxRound }, (_, index) =>
        createEmptyRound(index + 1)
    );
    (raw.wars || []).forEach(war =>
        addWarToRoster(war, raw.clan?.tag, rounds, ensure)
    );

    const roster = Array.from(players.values()).map(player => ({
        ...player,
        name: cleanDisplayName(player.name) || player.tag,
        destruction: player.destructionHits
            ? player.destructionTotal / player.destructionHits
            : 0,
        status: getPlayerStatus(player)
    })).sort((a, b) =>
        Number(b.townHall) - Number(a.townHall)
        || a.name.localeCompare(b.name)
    );
    return { roster, rounds };
}

function addWarToRoster(war, clanTag, rounds, ensure) {
    const side = getWarSide(war, clanTag);
    if (!side) return;
    const day = Math.max(1, number(war._round, 1));
    const round = rounds[day - 1] || createEmptyRound(day);
    rounds[day - 1] = round;
    const state = normalizeWarState(war);
    const counting = isAttackCountingState(state);
    const missedCounting = isMissedCountingState(state);
    const members = Array.isArray(side.self?.members) ? side.self.members : [];
    const attacksPerMember = Math.max(1, number(war.attacksPerMember, 1));
    const attacksUsed = counting ? number(side.self?.attacks, 0) : 0;
    const availableAttacks = counting ? members.length * attacksPerMember : 0;

    Object.assign(round, {
        state,
        opponent: side.opponent?.name || '-',
        stars: counting ? number(side.self?.stars, 0) : 0,
        destruction: counting ? number(side.self?.destructionPercentage, 0) : 0,
        attacksUsed,
        availableAttacks,
        missed: missedCounting ? Math.max(0, availableAttacks - attacksUsed) : 0
    });
    round.result = decideWarResult(
        round.stars,
        round.destruction,
        number(side.opponent?.stars, 0),
        number(side.opponent?.destructionPercentage, 0),
        state
    );
    members.forEach(member =>
        addMemberWarStats(member, round, attacksPerMember, counting, missedCounting, ensure)
    );
}

function addMemberWarStats(member, round, attacksPerMember, counting, missedCounting, ensure) {
    const player = ensure(member.tag, member);
    if (!player) return;
    player.warParticipant = true;
    const attacks = Array.isArray(member.attacks) ? member.attacks : [];
    const dayStat = {
        day: round.day,
        opponent: round.opponent,
        state: round.state,
        warParticipant: true,
        attacksUsed: counting ? attacks.length : 0,
        availableAttacks: counting ? attacksPerMember : 0,
        stars: 0,
        destructionTotal: 0,
        destructionHits: 0,
        missed: missedCounting ? Math.max(0, attacksPerMember - attacks.length) : 0,
        result: round.result
    };
    if (counting) {
        player.availableAttacks += attacksPerMember;
        if (missedCounting) player.missed += dayStat.missed;
        attacks.forEach(attack => {
            const stars = number(attack.stars, 0);
            const destruction = number(attack.destructionPercentage, 0);
            player.attacksUsed += 1;
            player.stars += stars;
            player.destructionTotal += destruction;
            player.destructionHits += 1;
            dayStat.stars += stars;
            dayStat.destructionTotal += destruction;
            dayStat.destructionHits += 1;
        });
    }
    dayStat.destruction = dayStat.destructionHits
        ? dayStat.destructionTotal / dayStat.destructionHits
        : 0;
    player.dayStats[round.day] = dayStat;
}
