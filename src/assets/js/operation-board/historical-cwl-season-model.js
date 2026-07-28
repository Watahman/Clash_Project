import { calculateHistoricalSeason } from './historical-cwl-calculations.js';
import { normalizeTag, number } from './operation-board-utils.js';

export function buildHistoricalSeasonModel(data) {
    const summary = calculateHistoricalSeason(data);
    const rounds = summary.wars.map(war => ({
        day: war.day,
        state: 'completed',
        opponent: war.opponent?.name || '-',
        opponentTag: war.opponent?.tag || '',
        stars: number(war.clan?.stars, 0),
        destruction: number(war.clan?.destruction, 0),
        attacksUsed: number(war.clan?.attacks, 0),
        availableAttacks: war.detailsComplete
            ? number(war.teamSize, 0) * number(war.attacksPerMember, 1)
            : null,
        missed: war.detailsComplete
            ? Math.max(
                0,
                number(war.teamSize, 0) * number(war.attacksPerMember, 1)
                - number(war.clan?.attacks, 0)
            )
            : null,
        starsConceded: number(war.opponent?.stars, 0),
        destructionConceded: number(war.opponent?.destruction, 0),
        attacksConceded: number(war.opponent?.attacks, 0),
        result: war.result,
        historical: true
    }));
    const standings = data?.standings || [];
    const selectedTag = normalizeTag(data?.clan?.tag);
    return {
        mode: 'historical',
        phase: 'completed',
        predictionState: 'historical',
        season: data?.season || '',
        clan: data?.clan || { tag: selectedTag, name: selectedTag },
        leagueGroup: { season: data?.season || '', state: 'ended' },
        league: data?.league || null,
        position: data?.position ?? null,
        record: summary.record,
        wars: data?.wars || [],
        rounds,
        roster: summary.roster,
        standings: {
            completedWars: rounds.length,
            selectedIndex: standings.findIndex(row =>
                normalizeTag(row.tag) === selectedTag
            ),
            rows: standings
        },
        rankingHistory: [],
        summary,
        dataQuality: data?.dataQuality || 'Insufficient data'
    };
}

export function getHistoricalCwlPlayerContext(report, playerTag) {
    const tag = normalizeTag(playerTag);
    const player = (report?.roster || []).find(item =>
        normalizeTag(item.tag) === tag
    );
    if (!player) return null;
    return {
        label: formatSeason(report.season),
        attacksUsed: player.attacksUsed,
        availableAttacks: player.availableAttacks,
        stars: player.stars,
        avgStars: player.avgStars,
        avgDestruction: player.destruction,
        tripleRate: player.tripleRate,
        missed: player.missed,
        roundsPlayed: player.roundsPlayed,
        netStarsContributed: player.netStarsContributed,
        offensiveRank: player.offensiveRank
    };
}

export function formatSeason(season, locale = document.documentElement.lang) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(season));
    if (!match) return String(season || '');
    return new Intl.DateTimeFormat(locale || 'en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}
