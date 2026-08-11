import { normalizeWarState } from '../cwl/cwl-war-state.js';
import { competeT as t } from '../operation-board/compete-locales.js';
import { getWarSide, normalizeTag, number } from '../operation-board/operation-board-utils.js';

export class ActiveCwlWarError extends Error {
    constructor() {
        super(t('war.activeCwlStatus'));
        this.code = 'ACTIVE_CWL_WAR';
    }
}

export function buildWarBoardReport(rawWar, clanTag, historicalPerformance = {}) {
    const selectedTag = normalizeTag(clanTag);
    if (!rawWar || normalizeWarState(rawWar) === 'notAvailable') {
        return emptyReport(selectedTag, rawWar);
    }
    if (rawWar.tag || rawWar.warTag || rawWar.isLeagueWar === true) {
        throw new ActiveCwlWarError();
    }
    const side = getWarSide(rawWar, selectedTag);
    if (!side) throw new Error('The selected clan is not part of this war.');
    const normalizedWar = {
        ...rawWar,
        attacksPerMember: Math.max(1, number(rawWar.attacksPerMember, 2)),
        clan: normalizeClan(rawWar.clan),
        opponent: normalizeClan(rawWar.opponent)
    };
    const normalizedSide = getWarSide(normalizedWar, selectedTag);
    return {
        kind: 'regular-war',
        clan: {
        tag: normalizeTag(normalizedSide.self.tag),
        name: normalizedSide.self.name || selectedTag,
            badgeUrl: normalizedSide.self.badgeUrls?.small
                || normalizedSide.self.badgeUrls?.medium
                || normalizedSide.self.badgeUrl
                || ''
        },
        opponent: {
            tag: normalizeTag(normalizedSide.opponent.tag),
            name: normalizedSide.opponent.name || normalizeTag(normalizedSide.opponent.tag),
            badgeUrl: normalizedSide.opponent.badgeUrls?.small
                || normalizedSide.opponent.badgeUrls?.medium
                || normalizedSide.opponent.badgeUrl
                || ''
        },
        state: normalizeWarState(normalizedWar),
        warKey: buildWarKey(normalizedWar, selectedTag),
        roster: (normalizedSide.self.members || []).sort((a, b) => a.mapPosition - b.mapPosition),
        wars: [normalizedWar],
        historicalPerformance
    };
}

export function currentWarPlayerContext(report, playerTag) {
    const war = report?.wars?.[0];
    const side = getWarSide(war, report?.clan?.tag);
    const tag = normalizeTag(playerTag);
    const member = side?.self?.members?.find(player => normalizeTag(player.tag) === tag);
    if (!member) return null;
    const attacks = Array.isArray(member.attacks) ? member.attacks : [];
    const state = normalizeWarState(war);
    const attackLimit = Math.max(1, number(war?.attacksPerMember, 2));
    const totalStars = attacks.reduce((sum, attack) => sum + number(attack.stars), 0);
    return {
        heading: t('war.currentClanWar'),
        stars: totalStars,
        avgStars: attacks.length ? totalStars / attacks.length : null,
        avgDestruction: attacks.length
            ? attacks.reduce((sum, attack) => sum + number(attack.destructionPercentage), 0) / attacks.length
            : 0,
        attacksUsed: attacks.length,
        attackLimit,
        missed: state === 'completed' ? Math.max(0, attackLimit - attacks.length) : null
    };
}

export function buildWarKey(war, clanTag) {
    return [
        normalizeTag(clanTag).replace('#', ''),
        String(war?.startTime || war?.preparationStartTime || 'unknown'),
        normalizeTag(war?.opponent?.tag).replace('#', '')
    ].join(':');
}

function normalizeClan(clan = {}) {
    return {
        ...clan,
        tag: normalizeTag(clan.tag),
        members: (clan.members || []).map(normalizeMember)
    };
}

function normalizeMember(member = {}, index = 0) {
    return {
        ...member,
        tag: normalizeTag(member.tag),
        townhallLevel: number(member.townhallLevel || member.townHallLevel),
        townHall: number(member.townhallLevel || member.townHallLevel),
        mapPosition: number(member.mapPosition, index + 1),
        attacks: Array.isArray(member.attacks) ? member.attacks : []
    };
}

function emptyReport(clanTag, rawWar) {
    return {
        kind: 'regular-war',
        clan: { tag: clanTag, name: clanTag },
        opponent: null,
        state: normalizeWarState(rawWar),
        warKey: '',
        roster: [],
        wars: [],
        historicalPerformance: {}
    };
}
