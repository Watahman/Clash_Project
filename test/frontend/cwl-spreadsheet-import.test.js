import { describe, expect, it, vi } from 'vitest';
import {
    collectWorkbookCandidates,
    extractTagsFromCell,
    inferTagContext,
    lookupWithRateLimitRetry,
    runWithConcurrency
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
        expect(extractTagsFromCell('299')).toEqual([]);
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

    it('uses explicit tag columns across multiple sheets and distant rows', () => {
        const sheets = {
            Players: [
                ['PlayerTag', 'PlayerName', 'ClanTag'],
                ...Array.from({ length: 8 }, (_, index) => [
                    index === 7 ? '#2PYLQG9' : '',
                    `Player ${index + 1}`,
                    index === 7 ? '#JCUV89' : ''
                ])
            ],
            Clans: [
                ['ClanTag', 'ClanName'],
                ['#JCUV89', 'Example clan']
            ]
        };
        const XLSX = {
            utils: {
                sheet_to_json: sheet => sheet,
                encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`
            }
        };
        const workbook = { SheetNames: Object.keys(sheets), Sheets: sheets };

        const result = collectWorkbookCandidates(workbook, XLSX);

        expect(result.find(item => item.tag === '#2PYLQG9')?.inferredType).toBe('player');
        expect(result.find(item => item.tag === '#JCUV89')?.inferredType).toBe('clan');
        expect(result.find(item => item.tag === '#JCUV89')?.occurrences).toHaveLength(2);
    });

    it('waits and retries a rate-limited lookup instead of dropping the tag', async () => {
        const rateLimitError = Object.assign(new Error('Too many requests'), {
            status: 429,
            code: 'RATE_LIMITED',
            details: { retryAfter: 2 }
        });
        const request = vi.fn()
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValue({ tag: '#2PYLQG9', name: 'Player' });
        const wait = vi.fn().mockResolvedValue();

        const result = await lookupWithRateLimitRetry(request, { wait });

        expect(result).toEqual({ ok: true, data: { tag: '#2PYLQG9', name: 'Player' } });
        expect(request).toHaveBeenCalledTimes(2);
        expect(wait).toHaveBeenCalledWith(2_000);
    });

    it('uses the configured number of workers without losing result order', async () => {
        const items = Array.from({ length: 9 }, (_, index) => index + 1);
        const results = new Array(items.length);
        let active = 0;
        let peakActive = 0;

        await runWithConcurrency(items, 3, async (item, index) => {
            active += 1;
            peakActive = Math.max(peakActive, active);
            await Promise.resolve();
            results[index] = item * 2;
            active -= 1;
        });

        expect(peakActive).toBe(3);
        expect(results).toEqual(items.map(item => item * 2));
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
