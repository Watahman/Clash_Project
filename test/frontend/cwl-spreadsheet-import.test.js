import { describe, expect, it } from 'vitest';
import {
    collectWorkbookCandidates,
    extractTagsFromCell,
    inferTagContext
} from '../../src/assets/js/cwl/cwl-spreadsheet-import.js';

describe('CWL spreadsheet import', () => {
    it('extracts hash tags and URL encoded tags without duplicates', () => {
        expect(extractTagsFromCell('Player #2PYLQG9 and https://example.test/?tag=%23JCUV89')).toEqual([
            '#2PYLQG9',
            '#JCUV89'
        ]);
    });

    it('accepts a bare tag when the entire cell is a tag', () => {
        expect(extractTagsFromCell('  2PYLQG9  ')).toEqual(['#2PYLQG9']);
        expect(extractTagsFromCell('player 2PYLQG9')).toEqual([]);
    });

    it('infers player and clan context', () => {
        expect(inferTagContext('Player Tag Roster')).toBe('player');
        expect(inferTagContext('Clan Tag')).toBe('clan');
        expect(inferTagContext('Tag')).toBe('unknown');
    });

    it('collects unique tags and keeps source occurrences', () => {
        const rows = [
            ['Player Tag', 'Clan'],
            ['#2PYLQG9', '#JCUV89'],
            ['#2PYLQG9', '']
        ];
        const XLSX = {
            utils: {
                sheet_to_json: () => rows,
                encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`
            }
        };
        const workbook = { SheetNames: ['Roster'], Sheets: { Roster: {} } };
        const result = collectWorkbookCandidates(workbook, XLSX);

        expect(result).toHaveLength(2);
        expect(result.find(item => item.tag === '#2PYLQG9')?.occurrences).toHaveLength(2);
        expect(result.find(item => item.tag === '#JCUV89')?.inferredType).toBe('clan');
    });

    it('collects more than 500 unique tags without truncating the import', () => {
        const tagChars = '0289PYLQGRJCUV';
        const encodeTag = value => {
            let remaining = value;
            let encoded = '';
            do {
                encoded = tagChars[remaining % tagChars.length] + encoded;
                remaining = Math.floor(remaining / tagChars.length);
            } while (remaining > 0);
            return `#P${encoded.padStart(2, '0')}`;
        };
        const rows = [
            ['Player Tag'],
            ...Array.from({ length: 501 }, (_, index) => [encodeTag(index)])
        ];
        const XLSX = {
            utils: {
                sheet_to_json: () => rows,
                encode_cell: ({ r }) => `A${r + 1}`
            }
        };
        const workbook = { SheetNames: ['Roster'], Sheets: { Roster: {} } };

        const result = collectWorkbookCandidates(workbook, XLSX);

        expect(result).toHaveLength(501);
        expect(result.at(-1)?.tag).toBe(encodeTag(500));
    });
});
