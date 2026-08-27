const EXPANSION_SEASON = '2026-05';

const ORIGINAL_LEAGUES = [
    'Bronze League III', 'Bronze League II', 'Bronze League I',
    'Silver League III', 'Silver League II', 'Silver League I',
    'Gold League III', 'Gold League II', 'Gold League I',
    'Crystal League III', 'Crystal League II', 'Crystal League I',
    'Master League III', 'Master League II', 'Master League I',
    'Champion League III', 'Champion League II', 'Champion League I'
];

const EXPANDED_LEAGUES = [
    ...ORIGINAL_LEAGUES,
    'Titan League III', 'Titan League II', 'Titan League I',
    'Legend League'
];

export function reconstructHistoricalLeagues(
    seasons = [],
    currentLeague = null
) {
    let followingLeague = leagueName(currentLeague);
    const reconstructed = [...seasons]
        .filter(season => season?.season)
        .sort((left, right) => right.season.localeCompare(left.season))
        .map(season => {
            const exact = knownLeague(season.league, season.season);
            const name = exact || inferStartingLeague(
                followingLeague,
                season.season,
                season.position,
                groupSize(season)
            );
            const enriched = name && !exact
                ? {
                    ...season,
                    league: { id: null, name, inferred: true }
                }
                : season;
            if (name) followingLeague = name;
            return enriched;
        });
    const bySeason = new Map(reconstructed.map(item => [item.season, item]));
    return seasons.map(item => bySeason.get(item?.season) || item);
}

function inferStartingLeague(following, season, position, size) {
    if (!following || !positiveInteger(position) || !positiveInteger(size)) {
        return '';
    }
    const matches = leaguesFor(season).filter(candidate =>
        leagueAfter(candidate, season, position, size) === following
    );
    if (matches.includes(following)) return following;
    return matches.length === 1 ? matches[0] : '';
}

function leagueAfter(league, season, position, groupSize) {
    const leagues = leaguesFor(season);
    const index = leagues.indexOf(league);
    if (index < 0) return '';
    const promoted = Math.min(promotionSlots(league, season), groupSize);
    if (position <= promoted && index + 1 < leagues.length) {
        return leagues[index + 1];
    }
    const baseDemoted = demotionSlots(league);
    const demoted = Math.min(
        baseDemoted,
        Math.max(0, groupSize - (8 - baseDemoted))
    );
    if (demoted > 0 && position > groupSize - demoted && index > 0) {
        return leagues[index - 1];
    }
    return league;
}

function promotionSlots(league, season) {
    if (season >= EXPANSION_SEASON) {
        if ([
            'Champion League I',
            'Titan League III',
            'Titan League II',
            'Titan League I'
        ].includes(league)) return 4;
        if ([
            'Master League I',
            'Champion League III',
            'Champion League II'
        ].includes(league)) return 2;
        if (league === 'Legend League') return 0;
    }
    if (league.startsWith('Bronze League')) return 3;
    if ([
        'Master League I',
        'Champion League III',
        'Champion League II'
    ].includes(league)) return 1;
    return league === 'Champion League I' ? 0 : 2;
}

function demotionSlots(league) {
    if (league === 'Bronze League III') return 0;
    return [
        'Bronze League II',
        'Bronze League I',
        'Silver League III'
    ].includes(league) ? 1 : 2;
}

function knownLeague(league, season) {
    const name = leagueName(league);
    return leaguesFor(season).includes(name) ? name : '';
}

function leaguesFor(season) {
    return season >= EXPANSION_SEASON ? EXPANDED_LEAGUES : ORIGINAL_LEAGUES;
}

function leagueName(league) {
    return String(league?.name || '').trim();
}

function groupSize(season) {
    const standings = Array.isArray(season?.standings)
        ? season.standings.length : 0;
    return standings > 1 ? standings : 8;
}

function positiveInteger(value) {
    return Number.isInteger(Number(value)) && Number(value) > 0;
}
