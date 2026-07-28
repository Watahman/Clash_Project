import { describe, expect, it } from 'vitest';

import {
    calculateHistoricalSeason
} from '../../src/assets/js/operation-board/historical-cwl-calculations.js';

describe('Historical CWL season calculations', () => {
    it('separates earned and conceded attacks and only counts reliable misses', () => {
        const result = calculateHistoricalSeason(seasonFixture());

        expect(result.offense.avgStars).toBeCloseTo(2.5);
        expect(result.offense.avgDestruction).toBeCloseTo(92.5);
        expect(result.offense.tripleRate).toBeCloseTo(0.5);
        expect(result.defense.avgStars).toBeCloseTo(1.5);
        expect(result.defense.avgDestruction).toBeCloseTo(80);
        expect(result.starDifferential).toBeCloseTo(2);
        expect(result.attackUsage).toBeCloseTo(0.5);
        expect(result.missedAttacks).toBe(2);
        expect(result.roster[0]).toMatchObject({
            tag: '#P0L',
            attacksUsed: 2,
            availableAttacks: 2,
            missed: 0,
            stars: 5,
            avgDefense: 90,
            netStarsContributed: 5,
            offensiveRank: 1
        });
        expect(result.roster.find(player => player.tag === '#P2Y')).toMatchObject({
            availableAttacks: 2,
            missed: 2,
            avgDefense: 70
        });
    });

    it('does not turn incomplete history into missed attacks or defense metrics', () => {
        const fixture = seasonFixture();
        fixture.wars[0].detailsComplete = false;

        const result = calculateHistoricalSeason(fixture);

        expect(result.attackUsage).toBeNull();
        expect(result.missedAttacks).toBeNull();
        expect(result.defense).toBeNull();
        expect(result.roster.find(player => player.tag === '#P0L').missed).toBeNull();
        expect(result.roster.find(player => player.tag === '#P0L').avgDefense)
            .toBeNull();
    });
});

function seasonFixture() {
    const attack = (attackerTag, defenderTag, stars, destruction, order) => ({
        attackerTag,
        defenderTag,
        stars,
        destruction,
        order
    });
    return {
        season: '2026-06',
        clan: { tag: '#CLAN', name: 'ClashPanel' },
        league: { name: 'Master League II' },
        position: 1,
        record: { wins: 1, losses: 0, draws: 0 },
        dataQuality: 'Complete',
        roster: [
            { tag: '#P0L', name: 'Alex', townHall: 17 },
            { tag: '#P2Y', name: 'Luna', townHall: 17 }
        ],
        wars: [{
            day: 1,
            state: 'completed',
            result: 'win',
            teamSize: 2,
            attacksPerMember: 2,
            detailsComplete: true,
            clan: {
                tag: '#CLAN',
                stars: 5,
                destruction: 92,
                attacks: 2,
                members: [
                    {
                        tag: '#P0L',
                        name: 'Alex',
                        townHall: 17,
                        attacks: [
                            attack('#P0L', '#E1', 3, 100, 1),
                            attack('#P0L', '#E2', 2, 85, 2)
                        ]
                    },
                    { tag: '#P2Y', name: 'Luna', townHall: 17, attacks: [] }
                ]
            },
            opponent: {
                tag: '#ENEMY',
                stars: 3,
                destruction: 80,
                attacks: 2,
                members: [{
                    tag: '#E1',
                    attacks: [
                        attack('#E1', '#P0L', 2, 90, 1),
                        attack('#E1', '#P2Y', 1, 70, 2)
                    ]
                }]
            }
        }]
    };
}
