import { describe, expect, it } from 'vitest';
import {
    CWL_PLAN_SCHEMA_VERSION,
    normalizePlanDocument,
    validatePlanDocument
} from '../../src/assets/js/cwl/cwl-plan-schema.js';

describe('CWL plan schema', () => {
    it('migrates the legacy synthetic free-player row without losing poll metadata', () => {
        const document = normalizePlanDocument([
            { clanTag: 'none', players: ['#AAA'], groupId: 'group-1', pollId: 'poll-1' },
            { clanTag: '#CLAN', clanName: 'Clan', amountOfPlayers: '30', players: ['#BBB'] }
        ]);

        expect(document.schemaVersion).toBe(CWL_PLAN_SCHEMA_VERSION);
        expect(document.freePlayers.map(player => player.tag)).toEqual(['#AAA']);
        expect(document.clans[0]).toMatchObject({
            tag: '#CLAN',
            name: 'Clan',
            capacity: 30
        });
        expect(document.clans[0].players.map(player => player.tag)).toEqual(['#BBB']);
        expect(document.pollMeta).toEqual({ groupId: 'group-1', pollId: 'poll-1' });
    });

    it('rejects duplicate players across the free list and clans', () => {
        expect(() => validatePlanDocument({
            schemaVersion: 2,
            freePlayers: [{ tag: '#AAA' }],
            clans: [{ tag: '#CLAN', players: [{ tag: '#AAA' }] }]
        })).toThrow(/maar één keer/i);
    });

    it('accepts extra clan players and preserves their roster roles', () => {
        const players = Array.from({ length: 16 }, (_, index) => ({
            tag: `#P${index}Y`,
            rosterStatus: index === 15 ? 'reserve' : 'core'
        }));
        const document = validatePlanDocument({
            schemaVersion: 3,
            freePlayers: [],
            clans: [{ tag: '#CLAN', capacity: 15, players }]
        });

        expect(document.clans[0].players).toHaveLength(16);
        expect(document.clans[0].players[15].rosterStatus).toBe('reserve');
    });

    it('normalizes invalid roster roles without rejecting the plan', () => {
        const document = normalizePlanDocument({
            clans: [{
                tag: '#CLAN',
                capacity: 15,
                players: [
                    { tag: '#AAA', rosterStatus: 'rotation' },
                    { tag: '#BBB', rosterStatus: 'unknown' }
                ]
            }]
        });

        expect(document.clans[0].players.map(player => player.rosterStatus)).toEqual(['rotation', '']);
    });
});
