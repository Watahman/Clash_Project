import { describe, expect, it } from 'vitest';
import { reconstructHistoricalLeagues } from '../../src/assets/js/operation-board/historical-cwl-league-reconstructor.js';

describe('Historical CWL league reconstruction', () => {
    it('counts backwards from the official current clan league', () => {
        const seasons = reconstructHistoricalLeagues([
            season('2026-06', 6),
            season('2026-05', 2),
            season('2026-04', 8)
        ], { id: 48000012, name: 'Crystal League I' });

        expect(seasons.map(item => item.league.name)).toEqual([
            'Crystal League I',
            'Crystal League II',
            'Crystal League I'
        ]);
        expect(seasons.every(item => item.league.inferred)).toBe(true);
    });

    it('keeps an exact V2 league instead of replacing it', () => {
        const seasons = reconstructHistoricalLeagues([
            {
                ...season('2026-06', 1),
                league: { id: 48000014, name: 'Master League II' }
            }
        ], { id: 48000015, name: 'Master League I' });

        expect(seasons[0].league).toEqual({
            id: 48000014,
            name: 'Master League II'
        });
    });
});

function season(value, position) {
    return {
        season: value,
        position,
        league: { id: null, name: '' },
        standings: Array.from({ length: 8 }, (_, index) => ({
            rank: index + 1
        }))
    };
}
