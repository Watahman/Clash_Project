import { normalizeTag, number } from '../operation-board/operation-board-utils.js';

const CWL_TYPE_FIELDS = ['type', 'warType', 'war_type', 'mode', 'format'];
const CWL_ID_FIELDS = ['tag', 'warTag', '_warTag'];

export function buildWarHistory(raw, clanTag, limit = 20) {
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    const wars = items.slice(0, limit).map(war => normalizeHistoryWar(war, clanTag));
    const completed = wars.filter(war => war.isRegular && war.result !== 'unknown');
    const wins = completed.filter(war => war.result === 'win').length;
    const avgStars = completed.length
        ? completed.reduce((sum, war) => sum + war.own.stars, 0) / completed.length
        : null;
    const avgUsage = completed.length
        ? completed.reduce((sum, war) => sum + war.attackUsage, 0) / completed.length
        : null;
    return {
        wars,
        summary: {
            wins,
            losses: completed.filter(war => war.result === 'loss').length,
            draws: completed.filter(war => war.result === 'draw').length,
            winRate: completed.length ? wins / completed.length * 100 : null,
            avgStars,
            avgUsage,
            regularWars: completed.length,
            excludedWars: wars.filter(war => !war.isRegular).length
        }
    };
}

export function isCwlHistoryWar(war = {}) {
    return historySources(war).some(source => {
        if (isTruthyFlag(source?.isLeagueWar)
            || isTruthyFlag(source?.leagueWar)
            || isTruthyFlag(source?.isCwl)
            || isTruthyFlag(source?.isCWL)
            || isTruthyFlag(source?.cwl)) return true;
        if (CWL_TYPE_FIELDS.some(field => isCwlType(source?.[field]))) return true;
        if (isCwlWarLogShape(source)) return true;
        return CWL_ID_FIELDS.some(field => Boolean(source?.[field]));
    });
}

function normalizeHistoryWar(war, clanTag) {
    const selected = normalizeTag(clanTag);
    const own = normalizeTag(war?.clan?.tag) === selected ? war.clan : war.opponent;
    const opponent = own === war.clan ? war.opponent : war.clan;
    const ownScore = score(own);
    const opponentScore = score(opponent);
    const cwl = isCwlHistoryWar(war);
    const grouped = !cwl && isGroupedHistoryWar(war, ownScore, opponentScore);
    const excluded = cwl || grouped;
    const comparison = ownScore.stars - opponentScore.stars
        || ownScore.destruction - opponentScore.destruction;
    const capacity = Math.max(
        1,
        number(war?.teamSize) * Math.max(1, number(war?.attacksPerMember, 2))
    );
    return {
        endTime: war?.endTime || '',
        teamSize: number(war?.teamSize),
        result: comparison > 0 ? 'win' : comparison < 0 ? 'loss' : 'draw',
        isCwl: cwl,
        isGrouped: grouped,
        isRegular: !excluded,
        historyType: cwl ? 'cwl' : grouped ? 'grouped' : 'regular',
        own: { name: own?.name || selected, ...ownScore },
        opponent: { name: opponent?.name || normalizeTag(opponent?.tag), ...opponentScore },
        attackUsage: excluded ? null : number(own?.attacks) / capacity * 100
    };
}

function historySources(war) {
    return [war, war?.war, war?.war_data, war?.warData].filter(
        source => source && typeof source === 'object'
    );
}

function isCwlType(value) {
    const normalized = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
    const compact = normalized.replace(/\s+/g, '');
    return normalized === 'cwl'
        || normalized === 'clanwarleague'
        || normalized === 'clan war league'
        || normalized === 'league'
        || normalized === 'league war'
        || compact === 'leaguewar'
        || compact.includes('cwl');
}

function isTruthyFlag(value) {
    return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function isCwlWarLogShape(source) {
    return Boolean(source?.clan && source?.opponent)
        && source.opponent.tag == null;
}

function isGroupedHistoryWar(war, own, opponent) {
    const teamSize = number(war?.teamSize);
    if (teamSize <= 0) return false;
    const attacksPerMember = Math.max(1, number(war?.attacksPerMember, 2));
    const capacity = teamSize * attacksPerMember;
    const maxStars = teamSize * 3;
    return own.attacks > capacity
        || opponent.attacks > capacity
        || own.destruction > 100
        || opponent.destruction > 100
        || own.stars > maxStars
        || opponent.stars > maxStars;
}

function score(side = {}) {
    return {
        stars: number(side.stars),
        destruction: number(side.destructionPercentage),
        attacks: number(side.attacks)
    };
}
