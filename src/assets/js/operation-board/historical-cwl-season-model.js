import {
    calculateHistoricalSeason,
    historicalStarsPerWar
} from './historical-cwl-calculations.js?v=20260910-cwl-history-progressive';
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

export function buildHistoricalSeasonPreview(data, fallbackClan = null) {
    const season = data?.season || '';
    const clan = data?.clan || fallbackClan || { tag: '', name: '' };
    const record = normalizeRecord(data?.record, data);
    const summary = {
        season,
        league: data?.league || { id: null, name: '' },
        position: positiveNumber(data?.position),
        record,
        offense: {
            ...emptyAttackMetrics(),
            starsPerWar: historicalStarsPerWar(data, record)
        },
        defense: null,
        starDifferential: null,
        destructionDifferential: null,
        missedAttacks: null,
        attackUsage: null,
        closeWars: null,
        roster: [],
        wars: [],
        dataQuality: data?.dataQuality || 'Partial history',
        warDetailsComplete: false
    };
    return {
        mode: 'historical',
        phase: 'completed',
        predictionState: 'historical',
        season,
        clan,
        leagueGroup: { season, state: 'ended' },
        league: summary.league,
        position: summary.position,
        record,
        wars: [],
        rounds: [],
        roster: [],
        standings: { completedWars: 0, selectedIndex: -1, rows: [] },
        rankingHistory: [],
        summary,
        dataQuality: summary.dataQuality,
        historyPreview: true
    };
}

export function getHistoricalCwlPlayerContext(report, playerTag) {
    const tag = normalizeTag(playerTag);
    const player = (report?.roster || []).find(item =>
        normalizeTag(item.tag) === tag
    );
    if (!player) return null;
    return {
        mode: 'historical',
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

function normalizeRecord(record, data) {
    return {
        wins: nonNegative(record?.wins ?? data?.wins),
        losses: nonNegative(record?.losses ?? data?.losses),
        draws: nonNegative(record?.draws ?? data?.draws)
    };
}

function nonNegative(input) {
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function positiveNumber(input) {
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function emptyAttackMetrics() {
    return {
        attacks: null,
        avgStars: null,
        avgDestruction: null,
        tripleRate: null,
        lowStarRate: null,
        starsPerWar: null
    };
}
