import { describe, expect, it } from 'vitest';
import {
    DEFAULT_EXPORT_OPTIONS,
    createCwlExportViewModel,
    safeExportFilename
} from '../../src/assets/js/cwl/export/cwl-export-model.js';

const snapshot = {
    name: 'August CWL',
    exportedAt: '2026-08-21T10:00:00.000Z',
    schemaVersion: 4,
    freePlayers: [{ tag: '#FREE', name: 'Free Player', townHallLevel: 16 }],
    clans: [
        {
            id: 'clan-1',
            tag: '#AAA',
            name: 'Alpha',
            capacity: 15,
            badgeUrl: 'https://example.test/alpha.png',
            players: [
                { tag: '#P2', name: 'Rotation', townHallLevel: 17, rosterStatus: 'rotation' },
                { tag: '#P1', name: 'Core', townHallLevel: 18, rosterStatus: 'core' }
            ]
        },
        {
            id: 'clan-2',
            tag: '#BBB',
            name: 'Bravo',
            capacity: 30,
            players: [{ tag: '#P3', name: 'Reserve', townHallLevel: 15, rosterStatus: 'reserve' }]
        }
    ],
    pollMeta: { groupId: '', pollId: '' }
};

describe('CWL export model', () => {
    it('exposes stable defaults and builds a complete immutable view model', () => {
        expect(DEFAULT_EXPORT_OPTIONS).toMatchObject({
            scope: 'complete',
            showPlayerNames: true,
            showTownHallLevels: true,
            showPlayerTags: false,
            showRosterRoles: true
        });

        const model = createCwlExportViewModel(snapshot);

        expect(model).toMatchObject({
            name: 'August CWL',
            exportedAt: snapshot.exportedAt,
            scope: 'complete',
            selectedClanId: null,
            visibility: {
                playerNames: true,
                townHallLevels: true,
                playerTags: false,
                rosterRoles: true
            },
            totals: { clans: 2, assignedPlayers: 3, unassignedPlayers: 1 }
        });
        expect(model.clans[0].players.map(player => player.name)).toEqual(['Core', 'Rotation']);
        expect(model.clans[0].roleCounts).toEqual({ core: 1, rotation: 1, reserve: 0 });
        expect(Object.isFrozen(model)).toBe(true);
        expect(Object.isFrozen(model.clans[0].players[0])).toBe(true);
    });

    it('limits a single-clan view and accepts visibility aliases', () => {
        const model = createCwlExportViewModel(snapshot, {
            scope: 'single-clan',
            selectedClanId: 'clan-2',
            playerNames: false,
            townHallLevels: false,
            playerTags: true,
            rosterRoles: false
        });

        expect(model.scope).toBe('single');
        expect(model.mode).toBe('single-clan');
        expect(model.selectedClanId).toBe('clan-2');
        expect(model.clans.map(clan => clan.name)).toEqual(['Bravo']);
        expect(model.freePlayers).toEqual([]);
        expect(model.visibility).toEqual({
            playerNames: false,
            townHallLevels: false,
            playerTags: true,
            rosterRoles: false
        });
    });

    it('creates safe, deterministic filenames', () => {
        expect(safeExportFilename('August / CWL', 'xlsx')).toBe('ClashPanel-August-CWL.xlsx');
        expect(safeExportFilename('My Plan', '.PNG', 'single clan')).toBe(
            'ClashPanel-My-Plan-single-clan.png'
        );
        expect(safeExportFilename('***', 'xlsx')).toBe('ClashPanel-Plan.xlsx');
        expect(safeExportFilename('ClashPanel-August CWL')).toBe('ClashPanel-August-CWL');
    });
});
