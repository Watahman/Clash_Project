import { decideWarResult, normalizeWarState } from '../cwl/cwl-war-state.js';
import {
    cleanDisplayName,
    normalizeTag,
    number
} from './operation-board-utils.js';

function addStandingWar(stats, clan, opponent, result) {
    const tag = normalizeTag(clan?.tag);
    if (!tag) return;
    if (!stats.has(tag)) {
        stats.set(tag, {
            tag,
            name: cleanDisplayName(clan?.name) || tag,
            wars: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            stars: 0,
            destructionTotal: 0
        });
    }
    const row = stats.get(tag);
    row.wars += 1;
    row.stars += number(clan?.stars, 0);
    row.destructionTotal += number(clan?.destructionPercentage, 0);
    if (result === 'win') row.wins += 1;
    else if (result === 'loss') row.losses += 1;
    else row.draws += 1;
    row.lastOpponent = cleanDisplayName(opponent?.name)
        || normalizeTag(opponent?.tag)
        || '-';
}

export function buildStandings(wars = [], selectedClanTag = '') {
    const completedWars = wars.filter(war =>
        normalizeWarState(war) === 'completed' && war?.clan && war?.opponent
    );
    const stats = new Map();
    completedWars.forEach(war => {
        const clanStars = number(war.clan?.stars, 0);
        const opponentStars = number(war.opponent?.stars, 0);
        const clanDestruction = number(war.clan?.destructionPercentage, 0);
        const opponentDestruction = number(war.opponent?.destructionPercentage, 0);
        const clanResult = decideWarResult(
            clanStars,
            clanDestruction,
            opponentStars,
            opponentDestruction,
            'completed'
        );
        const opponentResult = clanResult === 'win'
            ? 'loss'
            : clanResult === 'loss'
                ? 'win'
                : 'draw';
        addStandingWar(stats, war.clan, war.opponent, clanResult);
        addStandingWar(stats, war.opponent, war.clan, opponentResult);
    });
    const rows = Array.from(stats.values())
        .map(row => ({
            ...row,
            destruction: row.wars ? row.destructionTotal / row.wars : 0
        }))
        .sort((a, b) =>
            b.stars - a.stars
            || b.destruction - a.destruction
            || b.wins - a.wins
            || a.name.localeCompare(b.name)
        )
        .map((row, index) => ({ ...row, rank: index + 1 }));
    const selectedTag = normalizeTag(selectedClanTag);
    return {
        rows,
        selectedIndex: rows.findIndex(row => row.tag === selectedTag),
        completedWars: completedWars.length
    };
}
