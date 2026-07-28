import { describe, expect, it } from 'vitest';

import {
    compareHistoricalSeasons
} from '../../src/assets/js/operation-board/historical-cwl-comparison.js';
import {
    buildHistoricalCwlOverview,
    getLeagueChangeForSeason
} from '../../src/assets/js/operation-board/historical-cwl-overview-model.js';

describe('Historical CWL overview', () => {
    it('derives league progression from consecutive real seasons', () => {
        const overview = buildHistoricalCwlOverview([
            season('2026-05', 'Master League II', 2.2, 2.1, 0.95, 3),
            season('2026-06', 'Master League I', 2.5, 2.0, 0.99, 1),
            season('2026-07', 'Master League I', 2.4, 2.2, 0.97, 4)
        ]);

        expect(overview.promotions).toBe(1);
        expect(overview.relegations).toBe(0);
        expect(overview.averageFinish).toBeCloseTo(8 / 3);
        expect(overview.chronological.map(item => item.change)).toEqual([
            'promoted',
            'same',
            'unknown'
        ]);
        expect(overview.insights.some(item =>
            item.title === 'Best offensive season'
            && item.season.includes('June')
        )).toBe(true);
    });

    it('keeps league change unknown when the next real month is unavailable', () => {
        expect(getLeagueChangeForSeason(
            '2026-05',
            { name: 'Master League II' },
            [
                { season: '2026-05', league: { name: 'Master League II' } },
                { season: '2026-07', league: { name: 'Master League I' } }
            ]
        )).toEqual({ state: 'unknown', nextLeague: null });
    });

    it('derives promotion from the final group position without a next season', () => {
        const latest = season(
            '2026-06',
            'Master League I',
            2.5,
            2.0,
            0.99,
            2
        );
        latest.standings = Array.from({ length: 8 }, (_, index) => ({
            rank: index + 1,
            tag: `#CLAN${index + 1}`
        }));

        const overview = buildHistoricalCwlOverview([latest]);

        expect(overview.promotions).toBe(1);
        expect(overview.chronological[0].change).toBe('promoted');
        expect(getLeagueChangeForSeason(
            latest.season,
            latest.league,
            [],
            { position: latest.position, groupSize: latest.standings.length }
        )).toEqual({
            state: 'promoted',
            nextLeague: { name: 'Champion League III' }
        });
    });

    it('treats higher conceded values as a negative comparison', () => {
        const [row] = compareHistoricalSeasons(
            { defense: { avgStars: 2.1 } },
            { defense: { avgStars: 2.3 } }
        ).filter(item => item.label === 'Stars conceded');

        expect(row.direction).toBe('bad');
        expect(row.change).toBe('↑0.20★');
    });
});

function season(seasonValue, league, offense, defense, usage, position) {
    const attack = (tag, stars) => ({
        attackerTag: tag,
        defenderTag: '#TARGET',
        stars,
        destruction: 90,
        order: 1
    });
    return {
        season: seasonValue,
        clan: { tag: '#CLAN', name: 'ClashPanel' },
        league: { name: league },
        position,
        record: { wins: 1, losses: 0, draws: 0 },
        dataQuality: 'Complete',
        roster: [{ tag: '#P0L', name: 'Alex', townHall: 17 }],
        wars: [{
            day: 1,
            state: 'completed',
            result: 'win',
            teamSize: 1,
            attacksPerMember: 1 / usage,
            detailsComplete: true,
            clan: {
                stars: offense,
                destruction: 90,
                attacks: 1,
                members: [{
                    tag: '#P0L',
                    attacks: [attack('#P0L', offense)]
                }]
            },
            opponent: {
                stars: defense,
                destruction: 85,
                attacks: 1,
                members: [{
                    tag: '#E1',
                    attacks: [attack('#E1', defense)]
                }]
            }
        }]
    };
}
