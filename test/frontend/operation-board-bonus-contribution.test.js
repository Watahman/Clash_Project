import { describe, expect, it } from 'vitest';
import {
    calculateCwlContributions
} from '../../src/assets/js/operation-board/operation-board-bonus-contribution.js';

describe('Operation Board bonus contribution', () => {
    it('uses attack order and only credits improvements over the previous best hit', () => {
        const report = {
            clan: { tag: '#SELF' },
            wars: [{
                clan: {
                    tag: '#SELF',
                    members: [
                        {
                            tag: '#A',
                            name: 'First',
                            townhallLevel: 17,
                            attacks: [{
                                order: 1,
                                defenderTag: '#D1',
                                stars: 1,
                                destructionPercentage: 60
                            }]
                        },
                        {
                            tag: '#B',
                            name: 'Second',
                            townhallLevel: 17,
                            attacks: [{
                                order: 2,
                                defenderTag: '#D1',
                                stars: 3,
                                destructionPercentage: 100
                            }]
                        },
                        {
                            tag: '#C',
                            name: 'Third',
                            townhallLevel: 17,
                            attacks: [{
                                order: 3,
                                defenderTag: '#D1',
                                stars: 3,
                                destructionPercentage: 100
                            }]
                        }
                    ]
                },
                opponent: {
                    tag: '#ENEMY',
                    members: [{
                        tag: '#D1',
                        townhallLevel: 17,
                        mapPosition: 1
                    }]
                }
            }]
        };

        const result = calculateCwlContributions(report);

        expect(result.get('#A')).toMatchObject({
            netStars: 1,
            destructionImprovement: 0
        });
        expect(result.get('#B')).toMatchObject({
            netStars: 2,
            destructionImprovement: 0
        });
        expect(result.get('#C')).toMatchObject({
            netStars: 0,
            destructionImprovement: 0
        });
    });
});
