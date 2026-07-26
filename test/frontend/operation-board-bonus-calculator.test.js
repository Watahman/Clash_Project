import { describe, expect, it } from 'vitest';
import {
    buildBonusCalculator
} from '../../src/assets/js/operation-board/operation-board-bonus-calculator.js';

function member(tag, stars, order, defenderTag) {
    return {
        tag,
        name: tag === '#T' ? 'Thomas' : 'Alex',
        townhallLevel: 17,
        attacks: stars == null ? [] : [{
            order,
            defenderTag,
            stars,
            destructionPercentage: stars === 3 ? 100 : 82
        }]
    };
}

function report() {
    return {
        phase: 'live',
        clan: { tag: '#SELF' },
        rounds: [
            { day: 1, state: 'completed' },
            { day: 2, state: 'live' }
        ],
        roster: [
            {
                tag: '#T',
                name: 'Thomas',
                townHall: 17,
                warParticipant: true,
                attacksUsed: 2,
                availableAttacks: 2,
                stars: 6,
                destruction: 100
            },
            {
                tag: '#A',
                name: 'Alex',
                townHall: 17,
                warParticipant: true,
                attacksUsed: 1,
                availableAttacks: 2,
                stars: 2,
                destruction: 82
            }
        ],
        historicalPerformance: {
            '#T': { status: 'ready', performance: 70 },
            '#A': { status: 'ready', performance: 140 }
        },
        wars: [
            {
                state: 'warEnded',
                attacksPerMember: 1,
                clan: {
                    tag: '#SELF',
                    members: [
                        member('#T', 3, 1, '#D1'),
                        member('#A', 2, 2, '#D2')
                    ]
                },
                opponent: {
                    tag: '#ENEMY',
                    members: [
                        {
                            ...member('#D1', 3, 3, '#T'),
                            mapPosition: 1
                        },
                        { ...member('#D2', null, 4, '#A'), mapPosition: 2 }
                    ]
                }
            },
            {
                state: 'inWar',
                attacksPerMember: 1,
                clan: {
                    tag: '#SELF',
                    members: [
                        member('#T', 3, 1, '#D3'),
                        member('#A', null, 2, '#D4')
                    ]
                },
                opponent: {
                    tag: '#ENEMY2',
                    members: [
                        { ...member('#D3', null, 3, '#T'), mapPosition: 1 },
                        { ...member('#D4', null, 4, '#A'), mapPosition: 2 }
                    ]
                }
            }
        ]
    };
}

describe('Operation Board bonus calculator', () => {
    it('keeps live-round misses out of reliability and ranks current CWL performance first', () => {
        const result = buildBonusCalculator(report(), {
            strategy: 'fair',
            recipientCount: 1
        });
        const thomas = result.players.find(player => player.tag === '#T');
        const alex = result.players.find(player => player.tag === '#A');

        expect(result.provisional).toBe(true);
        expect(result.players[0].tag).toBe('#T');
        expect(result.players.filter(player => player.recommended)).toHaveLength(1);
        expect(thomas.reliability).toEqual({
            used: 1,
            available: 1,
            missed: 0
        });
        expect(alex.reliability).toEqual({
            used: 1,
            available: 1,
            missed: 0
        });
        expect(alex.defense.score).toBe(50);
        expect(thomas.defense.score).toBeGreaterThan(0);
    });

    it('uses configured recipients and rejects custom weights that do not total 100', () => {
        const configured = {
            ...report(),
            bonusConfig: { recipients: 2 }
        };
        const result = buildBonusCalculator(configured, {
            strategy: 'custom',
            customWeights: {
                performance: 50,
                contribution: 20,
                reliability: 20,
                defense: 20
            },
            recipientCount: 1
        });

        expect(result.recipients).toEqual({
            count: 2,
            source: 'config',
            editable: false
        });
        expect(result.weightsValid).toBe(false);
        expect(result.weightTotal).toBe(110);
        expect(result.players.every(player => player.score == null)).toBe(true);
    });
});
