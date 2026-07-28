import { beforeEach, describe, expect, it } from 'vitest';
import {
    renderLeagueSections
} from '../../src/assets/js/operation-board/operation-board-league-renderer.js';

describe('Operation Board League renderer', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <strong id="current"></strong><strong id="projected"></strong>
            <small id="probabilities"></small><strong id="completed"></strong>
            <strong id="record"></strong>
            <span id="round-state"></span><span id="round-count"></span>
            <div id="rounds"></div>
            <span id="stars-state"></span><div id="stars"></div>
            <span id="position-state"></span><div id="position"></div>
            <span id="standings-state"></span><div id="standings"></div>
            <p id="standings-note"></p>`;
    });

    it('shows compact unfinished predictions and never replaces completed results', () => {
        const refs = {
            currentPosition: document.querySelector('#current'),
            projectedFinish: document.querySelector('#projected'),
            finishProbabilities: document.querySelector('#probabilities'),
            completedRounds: document.querySelector('#completed'),
            record: document.querySelector('#record'),
            roundState: document.querySelector('#round-state'),
            roundCount: document.querySelector('#round-count'),
            roundsList: document.querySelector('#rounds'),
            starsChartState: document.querySelector('#stars-state'),
            starsChart: document.querySelector('#stars'),
            positionChartState: document.querySelector('#position-state'),
            positionChart: document.querySelector('#position'),
            standingsState: document.querySelector('#standings-state'),
            standingsList: document.querySelector('#standings'),
            standingsNote: document.querySelector('#standings-note')
        };
        renderLeagueSections(refs, {
            predictionState: 'ready',
            clan: { tag: '#SELF' },
            rounds: [
                {
                    day: 1,
                    state: 'completed',
                    result: 'win',
                    opponent: 'Alpha',
                    stars: 34,
                    destruction: 94,
                    attacksUsed: 15,
                    availableAttacks: 15,
                    prediction: { stars: 36, confidence: 'High' }
                },
                {
                    day: 2,
                    state: 'preparation',
                    result: 'notStarted',
                    opponent: 'Beta',
                    stars: 0,
                    destruction: 0,
                    attacksUsed: 0,
                    availableAttacks: 15,
                    prediction: {
                        stars: 33.6,
                        destruction: 92.4,
                        attacksUsed: 14.5,
                        availableAttacks: 15,
                        coverage: 0.8,
                        confidence: 'Medium'
                    }
                }
            ],
            leagueGroup: { rounds: [{}, {}] },
            leaguePredictions: [],
            rankingHistory: [],
            standings: {
                selectedIndex: 0,
                completedWars: 1,
                rows: [{
                    tag: '#SELF',
                    name: 'Self',
                    rank: 1,
                    wars: 1,
                    wins: 1,
                    losses: 0,
                    draws: 0,
                    stars: 34,
                    destruction: 94
                }]
            }
        });

        expect(document.querySelectorAll('.op-round-prediction')).toHaveLength(1);
        expect(document.querySelector('.op-round-prediction summary').textContent)
            .toContain('33.6');
        expect(document.querySelector('.op-result-text').textContent).toBeTruthy();
        expect(document.querySelector('.op-standing-header')).not.toBeNull();
        expect(document.querySelector('.op-standing-row.is-selected').textContent)
            .toContain('1W · 0L · 0D');
        expect(refs.record.textContent).toBe('1W · 0L · 0D');
    });
});
