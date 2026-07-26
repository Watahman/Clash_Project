import { describe, expect, it } from 'vitest';
import {
    buildLeagueModel
} from '../../src/assets/js/operation-board/operation-board-league-model.js';

const rows = [
    { tag: '#AAA', name: 'Alpha', rank: 1, wars: 1, wins: 1, stars: 34, destruction: 94 },
    { tag: '#BBB', name: 'Beta', rank: 2, wars: 1, wins: 1, stars: 33, destruction: 92 },
    { tag: '#SELF', name: 'Self', rank: 3, wars: 1, wins: 1, stars: 32, destruction: 91 },
    { tag: '#CCC', name: 'Gamma', rank: 4, wars: 1, wins: 0, stars: 28, destruction: 87 }
];

function side(tag, stars, confidence = 'High') {
    return {
        tag,
        stars,
        destruction: 92,
        availableAttacks: 15,
        historicalAttacks: 120,
        coverage: 0.9,
        confidence
    };
}

function report(predictions) {
    return {
        clan: { tag: '#SELF' },
        rounds: [
            { day: 1, state: 'completed', result: 'win' },
            { day: 2, state: 'preparation', result: 'notStarted' }
        ],
        leagueGroup: { rounds: [{}, {}] },
        standings: {
            rows,
            selectedIndex: 2,
            completedWars: 2
        },
        leaguePredictions: predictions
    };
}

describe('Operation Board League model', () => {
    it('builds record, projected range and probabilities from complete forecasts', () => {
        const model = buildLeagueModel(report([
            { id: '#W3', day: 2, clan: side('#SELF', 35), opponent: side('#AAA', 32) },
            { id: '#W4', day: 2, clan: side('#BBB', 31), opponent: side('#CCC', 30) }
        ]));

        expect(model.record).toEqual({ wins: 1, losses: 0, draws: 0 });
        expect(model.completedRounds).toBe(1);
        expect(model.forecast.available).toBe(true);
        expect(model.forecast.minimum).toBeLessThanOrEqual(model.forecast.maximum);
        expect(model.forecast.probabilities.length).toBeGreaterThan(0);
        expect(model.forecast.history[0]).toMatchObject({ day: 2, predicted: true });
    });

    it('does not publish a finish when historical coverage is too low', () => {
        const low = side('#SELF', 35, 'Low');
        low.coverage = 0.2;
        low.historicalAttacks = 4;
        const model = buildLeagueModel(report([
            { id: '#W3', day: 2, clan: low, opponent: side('#AAA', 32) },
            { id: '#W4', day: 2, clan: side('#BBB', 31), opponent: side('#CCC', 30) }
        ]));

        expect(model.forecast).toMatchObject({
            available: false,
            reason: 'lowData'
        });
    });
});
