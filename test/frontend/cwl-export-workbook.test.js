import { describe, expect, it, vi } from 'vitest';
import {
    createCwlExportWorkbook,
    downloadCwlExportWorkbook
} from '../../src/assets/js/cwl/export/cwl-export-xlsx.js';

const snapshot = {
    name: 'August CWL',
    schemaVersion: 4,
    freePlayers: [{ tag: '#FREE', name: 'Free Player', townHallLevel: 16 }],
    clans: [
        {
            id: 'one',
            tag: '#AAA',
            name: 'War / Alpha',
            capacity: 15,
            players: [
                { tag: '#P1', name: 'Core', townHallLevel: 18, rosterStatus: 'core' },
                { tag: '#P2', name: 'Reserve', townHallLevel: 16, rosterStatus: 'reserve' }
            ]
        },
        {
            id: 'two',
            tag: '#BBB',
            name: 'War / Alpha',
            capacity: 30,
            players: [{ tag: '#P3', name: 'Rotation', townHallLevel: 17, rosterStatus: 'rotation' }]
        },
        {
            id: 'three',
            tag: '#CCC',
            name: 'Overview',
            capacity: 15,
            players: []
        }
    ]
};

function fakeXlsx() {
    return {
        utils: {
            book_new: () => ({ SheetNames: [], Sheets: {} }),
            json_to_sheet: (rows, options) => ({ rows, headers: options.header }),
            book_append_sheet: (workbook, sheet, name) => {
                workbook.SheetNames.push(name);
                workbook.Sheets[name] = sheet;
            }
        },
        writeFile: vi.fn()
    };
}

describe('CWL export workbook', () => {
    it('creates overview, unique safe clan sheets, and unassigned rows', () => {
        const XLSX = fakeXlsx();
        const workbook = createCwlExportWorkbook(snapshot, XLSX);

        expect(workbook.SheetNames).toEqual([
            'Overview',
            'War Alpha',
            'War Alpha (2)',
            'Overview (2)',
            'Unassigned'
        ]);
        expect(workbook.Sheets.Overview.rows[0]).toMatchObject({
            'Plan name': 'August CWL',
            'Clan name': 'War / Alpha',
            'Clan tag': '#AAA',
            Capacity: 15,
            'Assigned players': 2,
            'Core count': 1,
            'Rotation count': 0,
            'Reserve count': 1
        });
        expect(workbook.Sheets['War Alpha'].rows[0]).toMatchObject({
            'Player Name': 'Core',
            'Player Tag': '#P1',
            'Town Hall': 18,
            Role: 'Core',
            'Original Clan': 'War / Alpha'
        });
        expect(workbook.Sheets.Unassigned.rows[0]).toMatchObject({
            'Player Name': 'Free Player',
            'Original Clan': ''
        });
        expect(workbook.Sheets.Overview['!cols']).toHaveLength(OVERVIEW_COLUMNS);
        expect(workbook.Sheets.Unassigned['!cols']).toHaveLength(PLAYER_COLUMNS);
    });

    it('writes the workbook using a safe plan filename', () => {
        const XLSX = fakeXlsx();
        const result = downloadCwlExportWorkbook(snapshot, {
            XLSX,
            suffix: 'backup'
        });

        expect(XLSX.writeFile).toHaveBeenCalledWith(
            result.workbook,
            'ClashPanel-August-CWL-backup.xlsx'
        );
        expect(result.filename).toBe('ClashPanel-August-CWL-backup.xlsx');
    });
});

const OVERVIEW_COLUMNS = 8;
const PLAYER_COLUMNS = 5;
