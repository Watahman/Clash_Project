import { decideWarResult } from '../cwl/cwl-war-state.js';
import { normalizeTag, number } from './operation-board-utils.js';

const SIMULATION_COUNT = 800;

export function buildLeagueModel(report) {
    const rounds = report?.rounds || [];
    const completed = rounds.filter(round => round.state === 'completed');
    const selected = selectedStanding(report?.standings);
    const forecast = buildPositionForecast(report, selected);
    return {
        currentPosition: selected?.rank ?? null,
        completedRounds: completed.length,
        totalRounds: rounds.length || 7,
        record: completed.reduce((value, round) => {
            if (round.result === 'win') value.wins += 1;
            else if (round.result === 'loss') value.losses += 1;
            else if (round.result === 'draw') value.draws += 1;
            return value;
        }, { wins: 0, losses: 0, draws: 0 }),
        forecast
    };
}

function buildPositionForecast(report, selected) {
    const standings = report?.standings;
    const predictions = report?.leaguePredictions || [];
    const clanCount = standings?.rows?.length || 0;
    const rounds = report?.leagueGroup?.rounds?.length || report?.rounds?.length || 7;
    const expectedWars = clanCount && rounds ? clanCount * rounds / 2 : 0;
    const remainingWars = Math.max(
        0,
        expectedWars - number(standings?.completedWars, 0)
    );
    if (
        !selected
        || clanCount < 2
        || remainingWars < 1
        || predictions.length !== remainingWars
    ) return unavailableForecast('coverage');
    const coverage = average(predictions.flatMap(war => [
        number(war.clan.coverage, 0),
        number(war.opponent.coverage, 0)
    ]));
    const historicalAttacks = predictions.reduce(
        (sum, war) =>
            sum
            + number(war.clan.historicalAttacks, 0)
            + number(war.opponent.historicalAttacks, 0),
        0
    );
    const hasLowConfidence = predictions.some(war =>
        war.clan.confidence === 'Low' || war.opponent.confidence === 'Low'
    );
    if (
        coverage < 0.5
        || historicalAttacks < predictions.length * 40
        || hasLowConfidence
    ) {
        return unavailableForecast('lowData');
    }

    const base = standingsMap(standings.rows);
    const finalRows = rankRows(applyPredictions(base, predictions));
    const selectedTag = normalizeTag(selected.tag);
    const deterministicRank = finalRows.find(row => row.tag === selectedTag)?.rank;
    const simulatedRanks = simulateRanks(base, predictions, selectedTag);
    const probabilities = rankProbabilities(simulatedRanks, clanCount);
    const meaningfulRanks = probabilities
        .filter(item => item.probability >= 0.1)
        .map(item => item.rank);
    const minimum = Math.min(...meaningfulRanks, deterministicRank);
    const maximum = Math.max(...meaningfulRanks, deterministicRank);
    const strongConfidence = coverage >= 0.75
        && historicalAttacks >= predictions.length * 100
        && predictions.every(war =>
            war.clan.confidence !== 'Low'
            && war.opponent.confidence !== 'Low'
        );
    return {
        available: true,
        minimum,
        maximum,
        deterministicRank,
        confidence: strongConfidence ? 'High' : 'Medium',
        probabilities: strongConfidence ? probabilities : [],
        history: buildForecastHistory(
            base,
            predictions,
            selectedTag,
            clanCount
        )
    };
}

function buildForecastHistory(base, predictions, selectedTag, clanCount) {
    const expectedPerDay = clanCount / 2;
    const byDay = new Map();
    predictions.forEach(war => {
        const day = number(war.day, 0);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(war);
    });
    let current = cloneStandings(base);
    const history = [];
    Array.from(byDay.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([day, wars]) => {
            if (wars.length !== expectedPerDay) return;
            current = applyPredictions(current, wars);
            const rows = rankRows(current);
            const selected = rows.find(row => row.tag === selectedTag);
            if (selected) {
                history.push({
                    day,
                    rank: selected.rank,
                    clanCount,
                    stars: selected.stars,
                    destruction: selected.destruction,
                    predicted: true
                });
            }
        });
    return history;
}

function simulateRanks(base, predictions, selectedTag) {
    const random = seededRandom(20260726);
    return Array.from({ length: SIMULATION_COUNT }, () => {
        const sampled = predictions.map(war => ({
            ...war,
            clan: sampleSide(war.clan, random),
            opponent: sampleSide(war.opponent, random)
        }));
        const rows = rankRows(applyPredictions(base, sampled));
        return rows.find(row => row.tag === selectedTag)?.rank;
    }).filter(Number.isFinite);
}

function sampleSide(side, random) {
    const spread = side.confidence === 'High'
        ? 1.8
        : side.confidence === 'Medium' ? 2.7 : 4;
    return {
        ...side,
        stars: clamp(
            side.stars + normal(random) * spread,
            0,
            number(side.availableAttacks, 15) * 3
        ),
        destruction: clamp(
            side.destruction + normal(random) * spread * 1.4,
            0,
            100
        )
    };
}

function applyPredictions(source, predictions) {
    const standings = cloneStandings(source);
    predictions.forEach(war => {
        const result = decideWarResult(
            war.clan.stars,
            war.clan.destruction,
            war.opponent.stars,
            war.opponent.destruction,
            'completed'
        );
        addResult(standings, war.clan, result);
        addResult(
            standings,
            war.opponent,
            result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'draw'
        );
    });
    return standings;
}

function addResult(standings, side, result) {
    const tag = normalizeTag(side.tag);
    const row = standings.get(tag);
    if (!row) return;
    row.wars += 1;
    row.stars += number(side.stars, 0);
    row.destructionTotal += number(side.destruction, 0);
    if (result === 'win') row.wins += 1;
    else if (result === 'loss') row.losses += 1;
    else row.draws += 1;
}

function standingsMap(rows) {
    return new Map(rows.map(row => [
        normalizeTag(row.tag),
        {
            ...row,
            tag: normalizeTag(row.tag),
            wars: number(row.wars, 0),
            wins: number(row.wins, 0),
            losses: number(row.losses, 0),
            draws: number(row.draws, 0),
            stars: number(row.stars, 0),
            destructionTotal: Number.isFinite(Number(row.destructionTotal))
                ? Number(row.destructionTotal)
                : number(row.destruction, 0) * number(row.wars, 0)
        }
    ]));
}

function cloneStandings(source) {
    return new Map(
        Array.from(source.entries()).map(([tag, row]) => [tag, { ...row }])
    );
}

function rankRows(standings) {
    return Array.from(standings.values())
        .map(row => ({
            ...row,
            destruction: row.wars ? row.destructionTotal / row.wars : 0
        }))
        .sort((a, b) =>
            b.stars - a.stars
            || b.destruction - a.destruction
            || b.wins - a.wins
        )
        .map((row, index) => ({ ...row, rank: index + 1 }));
}

function rankProbabilities(ranks, clanCount) {
    return Array.from({ length: clanCount }, (_, index) => ({
        rank: index + 1,
        probability: ranks.filter(rank => rank === index + 1).length / ranks.length
    }));
}

function selectedStanding(standings) {
    return standings?.selectedIndex >= 0
        ? standings.rows[standings.selectedIndex]
        : null;
}

function unavailableForecast(reason) {
    return {
        available: false,
        reason,
        minimum: null,
        maximum: null,
        probabilities: [],
        history: []
    };
}

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function normal(random) {
    const first = Math.max(random(), Number.EPSILON);
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
}

function average(values) {
    return values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
