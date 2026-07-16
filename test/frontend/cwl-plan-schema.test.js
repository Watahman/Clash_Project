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

    it('rejects rosters beyond their configured capacity', () => {
        const players = Array.from({ length: 16 }, (_, index) => ({ tag: `#P${index}Y` }));
        expect(() => validatePlanDocument({
            schemaVersion: 2,
            freePlayers: [],
            clans: [{ tag: '#CLAN', capacity: 15, players }]
        })).toThrow(/meer dan 15/i);
    });
});
