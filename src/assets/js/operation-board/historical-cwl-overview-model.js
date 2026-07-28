import { calculateHistoricalSeason } from './historical-cwl-calculations.js';
import { formatSeason } from './historical-cwl-season-model.js';

const LEAGUE_ORDER = [
    'Unranked',
    'Bronze League III', 'Bronze League II', 'Bronze League I',
    'Silver League III', 'Silver League II', 'Silver League I',
    'Gold League III', 'Gold League II', 'Gold League I',
    'Crystal League III', 'Crystal League II', 'Crystal League I',
    'Master League III', 'Master League II', 'Master League I',
    'Champion League III', 'Champion League II', 'Champion League I'
];

export function buildHistoricalCwlOverview(seasons = []) {
    const chronological = seasons
        .filter(item => item?.season)
        .map(data => ({
            data,
            summary: calculateHistoricalSeason(data),
            label: formatSeason(data.season)
        }))
        .sort((a, b) => a.data.season.localeCompare(b.data.season));
    chronological.forEach((item, index) => {
        const previous = chronological[index - 1];
        item.change = previous && consecutive(previous.data.season, item.data.season)
            ? leagueChange(previous.summary.league, item.summary.league)
            : 'unknown';
    });
    const rich = chronological.filter(item => item.summary.offense.avgStars != null);
    const positions = chronological
        .map(item => item.summary.position)
        .filter(Number.isFinite);
    return {
        chronological,
        seasons: [...chronological].reverse(),
        count: chronological.length,
        promotions: chronological.filter(item => item.change === 'promoted').length,
        relegations: chronological.filter(item => item.change === 'relegated').length,
        averageFinish: positions.length
            ? positions.reduce((sum, value) => sum + value, 0) / positions.length
            : null,
        insights: buildInsights(rich)
    };
}

export function getLeagueChangeForSeason(
    season,
    league,
    seasonIndex = []
) {
    const ordered = seasonIndex
        .filter(item => item?.season)
        .sort((a, b) => a.season.localeCompare(b.season));
    const index = ordered.findIndex(item => item.season === season);
    const next = ordered[index + 1];
    if (!next || !consecutive(season, next.season)) {
        return { state: 'unknown', nextLeague: null };
    }
    return {
        state: leagueChange(league, next.league),
        nextLeague: next.league || null
    };
}

function buildInsights(items) {
    const insights = [];
    const offensive = best(items, item => item.summary.offense.avgStars, true);
    if (offensive) {
        insights.push({
            type: 'offense',
            title: 'Best offensive season',
            season: offensive.label,
            value: `${offensive.summary.offense.avgStars.toFixed(2)}★/attack`
        });
    }
    const defensive = best(
        items.filter(item => item.summary.defense?.avgStars != null),
        item => item.summary.defense.avgStars,
        false
    );
    if (defensive) {
        insights.push({
            type: 'defense',
            title: 'Best defensive season',
            season: defensive.label,
            value: `${defensive.summary.defense.avgStars.toFixed(2)}★ conceded/attack`
        });
    }
    const reliable = best(
        items.filter(item => item.summary.attackUsage != null),
        item => item.summary.attackUsage,
        true
    );
    if (reliable) {
        insights.push({
            type: 'reliability',
            title: 'Most reliable season',
            season: reliable.label,
            value: `${(reliable.summary.attackUsage * 100).toFixed(1)}% attacks used`
        });
    }
    const improvement = biggestImprovement(items);
    if (improvement) insights.push(improvement);
    const closest = best(items, item => item.summary.closeWars, true);
    if (closest?.summary.closeWars > 0) {
        insights.push({
            type: 'close',
            title: 'Closest season',
            season: closest.label,
            value: `${closest.summary.closeWars} wars decided by ≤1 star`
        });
    }
    return insights.slice(0, 5);
}

function biggestImprovement(items) {
    let result = null;
    for (let index = 1; index < items.length; index++) {
        const previous = items[index - 1];
        const current = items[index];
        if (!consecutive(previous.data.season, current.data.season)) continue;
        const change = current.summary.offense.avgStars
            - previous.summary.offense.avgStars;
        if (change <= 0 || result && result.change >= change) continue;
        result = {
            type: 'improvement',
            title: 'Biggest improvement',
            season: `${previous.label} → ${current.label}`,
            value: `+${change.toFixed(2)}★/attack`,
            change
        };
    }
    return result;
}

function best(items, selector, highest) {
    return items.reduce((winner, item) => {
        const value = selector(item);
        if (!Number.isFinite(value)) return winner;
        if (!winner) return item;
        const winnerValue = selector(winner);
        return highest ? value > winnerValue ? item : winner
            : value < winnerValue ? item : winner;
    }, null);
}

function leagueChange(previous, current) {
    const previousRank = leagueRank(previous);
    const currentRank = leagueRank(current);
    if (previousRank == null || currentRank == null) return 'unknown';
    if (currentRank > previousRank) return 'promoted';
    if (currentRank < previousRank) return 'relegated';
    return 'same';
}

function leagueRank(league) {
    const name = String(league?.name || '').trim();
    const index = LEAGUE_ORDER.indexOf(name);
    return index < 0 ? null : index;
}

function consecutive(first, second) {
    const [firstYear, firstMonth] = first.split('-').map(Number);
    const [secondYear, secondMonth] = second.split('-').map(Number);
    return secondYear * 12 + secondMonth - (firstYear * 12 + firstMonth) === 1;
}
