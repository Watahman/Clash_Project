import { describe, expect, it } from 'vitest';
import {
    buildLeagueRoundPredictions
} from '../../src/assets/js/cwl/cwl-round-prediction.js';

function member(tag, townHall = 17) {
    return { tag, townhallLevel: townHall, mapPosition: 1, attacks: [] };
}

describe('CWL round prediction baseline', () => {
    it('keeps historical performance dominant after one poor current attack', () => {
        const report = {
            clan: { tag: '#SELF' },
            leagueWars: [{
                _round: 2,
                _warTag: '#WAR2',
                state: 'preparation',
                clan: {
                    tag: '#SELF',
                    name: 'Self',
                    members: [member('#PLAYER')]
                },
                opponent: {
                    tag: '#ENEMY',
                    name: 'Enemy',
                    members: [member('#TARGET')]
                }
            }]
        };
        const roster = [{
            tag: '#PLAYER',
            attacksUsed: 1,
            availableAttacks: 1,
            stars: 0,
            destruction: 20
        }];
        const insights = new Map([
            ['#PLAYER', {
                townHall: 17,
                historical: {
                    status: 'ready',
                    avgStars: 2.8,
                    avgDestruction: 95,
                    performance: 110,
                    reliability: 100,
                    attackCount: 80
                }
            }],
            ['#TARGET', {
                townHall: 17,
                historical: {
                    status: 'ready',
                    avgStars: 2.4,
                    avgDestruction: 88,
                    performance: 100,
                    reliability: 98,
                    attackCount: 70
                }
            }]
        ]);

        const result = buildLeagueRoundPredictions(report, roster, insights);
        expect(result.roundPredictions.get(2).stars).toBeGreaterThan(2.5);
        expect(result.roundPredictions.get(2).confidence).toBe('High');
    });
});
