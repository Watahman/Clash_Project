import { normalizeTag, number } from '../operation-board/operation-board-utils.js';

export function buildWarHistory(raw, clanTag, limit = 20) {
    const items = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : [];
    const wars = items.slice(0, limit).map(war => normalizeHistoryWar(war, clanTag));
    const completed = wars.filter(war => war.result !== 'unknown');
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
            avgUsage
        }
    };
}

function normalizeHistoryWar(war, clanTag) {
    const selected = normalizeTag(clanTag);
    const own = normalizeTag(war?.clan?.tag) === selected ? war.clan : war.opponent;
    const opponent = own === war.clan ? war.opponent : war.clan;
    const ownScore = score(own);
    const opponentScore = score(opponent);
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
        own: { name: own?.name || selected, ...ownScore },
        opponent: { name: opponent?.name || normalizeTag(opponent?.tag), ...opponentScore },
        attackUsage: number(own?.attacks) / capacity * 100
    };
}

function score(side = {}) {
    return {
        stars: number(side.stars),
        destruction: number(side.destructionPercentage),
        attacks: number(side.attacks)
    };
}
