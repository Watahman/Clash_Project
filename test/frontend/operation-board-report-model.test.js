import { describe, expect, it } from 'vitest';

import { buildReport } from '../../src/assets/js/operation-board/operation-board-report-model.js';

describe('Operation Board report model', () => {
    it('builds the same report without mutating its API input', () => {
        const raw = {
            clan: {
                tag: '#PQL',
                name: 'Belgian Warriors',
                players: [{ tag: '#P0L', name: 'Emile', townHall: 17 }]
            },
            plan: {
                id: 'plan-1',
                clans: [{
                    tag: '#PQL',
                    players: [{ tag: '#P0L', name: 'Emile', townHall: 17 }]
                }]
            },
            members: [
                { tag: '#P0L', name: 'Emile', townHallLevel: 17 },
                { tag: '#P2Y', name: 'Luna', townHallLevel: 16 }
            ],
            leagueGroup: {
                state: 'inWar',
                clans: [{ tag: '#PQL' }, { tag: '#AAA' }],
                rounds: [{ warTags: ['#WAR1'] }]
            },
            leagueWars: [{
                _round: 1,
                _warTag: '#WAR1',
                state: 'warEnded',
                clan: {
                    tag: '#PQL',
                    name: 'Belgian Warriors',
                    stars: 30,
                    destructionPercentage: 91,
                    attacks: [{ attackerTag: '#P0L', stars: 3, destructionPercentage: 100 }],
                    members: [{ tag: '#P0L', name: 'Emile', townhallLevel: 17, attacks: [{ stars: 3, destructionPercentage: 100 }] }]
                },
                opponent: {
                    tag: '#AAA',
                    name: 'Northern Kings',
                    stars: 28,
                    destructionPercentage: 88,
                    members: []
                }
            }]
        };
        raw.wars = raw.leagueWars;
        const snapshot = structuredClone(raw);

        const first = buildReport(raw);
        const second = buildReport(raw);

        expect(raw).toEqual(snapshot);
        expect(second).toEqual(first);
        expect(first.rounds[0]).toMatchObject({
            day: 1,
            state: 'completed',
            opponent: 'Northern Kings',
            stars: 30,
            result: 'win'
        });
        expect(first.roster.map(player => player.tag)).toEqual(['#P0L', '#P2Y']);
        expect(first.roster[0]).toMatchObject({
            planned: true,
            warParticipant: true,
            attacksUsed: 1,
            stars: 3
        });
    });
});
