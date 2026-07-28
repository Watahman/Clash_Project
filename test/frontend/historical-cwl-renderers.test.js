import { describe, expect, it, vi } from 'vitest';

import {
    renderHistoricalOverview
} from '../../src/assets/js/operation-board/historical-cwl-overview-renderer.js';
import {
    renderHistoricalSummary
} from '../../src/assets/js/operation-board/historical-cwl-summary-renderer.js';
import {
    renderRoster,
    syncRosterMode
} from '../../src/assets/js/operation-board/operation-board-roster-renderer.js';

describe('Historical CWL renderers', () => {
    it('shows a stable empty state when ClashKing has no CWL history', () => {
        const container = document.createElement('section');

        renderHistoricalOverview(container, {
            seasons: [],
            chronological: [],
            insights: [],
            count: 0
        });

        expect(container.querySelector('h2').textContent)
            .toBe('No CWL history available');
        expect(container.textContent).toContain(
            'ClashKing has no completed CWL seasons for this clan.'
        );
    });

    it('keeps unavailable summary metrics visibly unknown', () => {
        const container = document.createElement('div');

        renderHistoricalSummary(container, {
            summary: {
                season: '2026-06',
                league: { name: 'Master League II' },
                leagueChange: { state: 'unknown', nextLeague: null },
                position: null,
                record: { wins: 0, losses: 0, draws: 0 },
                offense: {
                    avgStars: null,
                    avgDestruction: null,
                    tripleRate: null,
                    starsPerWar: null
                },
                defense: null,
                starDifferential: null,
                destructionDifferential: null,
                attackUsage: null,
                missedAttacks: null,
                dataQuality: 'Partial history'
            }
        });

        const keyMetrics = Array.from(
            container.querySelectorAll('.op-history-key-stats dd')
        ).map(node => node.textContent);
        expect(keyMetrics).toEqual(['—', '—', '—', '—']);
        expect(container.textContent).toContain(
            'Defense details are unavailable for this season.'
        );
    });

    it('renders the overview chart, comparisons and season actions', () => {
        const container = document.createElement('section');
        const selectSeason = vi.fn();
        const chronological = [
            overviewSeason('2026-05', 'Master League II', 2.15, 2.05),
            overviewSeason('2026-06', 'Master League I', 2.42, 1.98)
        ];
        chronological[1].change = 'promoted';

        renderHistoricalOverview(container, {
            chronological,
            seasons: [...chronological].reverse(),
            count: 2,
            promotions: 1,
            relegations: 0,
            averageFinish: 1.5,
            insights: [{
                title: 'Best offensive season',
                season: 'June 2026',
                value: '2.42★/attack'
            }]
        }, { selectSeason });

        expect(container.querySelector('.op-history-trend-svg')).not.toBeNull();
        expect(container.querySelectorAll('[data-history-season]')).toHaveLength(4);
        expect(container.querySelectorAll('.op-history-comparison-row').length)
            .toBeGreaterThan(1);

        const juneButtons = Array.from(
            container.querySelectorAll('[data-history-season="2026-06"]')
        );
        juneButtons[0].click();
        expect(selectSeason).toHaveBeenCalledWith('2026-06');
    });

    it('shows historical participation instead of planning state', () => {
        document.body.innerHTML = `
            <table><thead><tr><th id="planning">Planning</th></tr></thead>
            <tbody id="roster"></tbody></table>
            <input id="filter">
            <select id="view"><option value="all">All</option></select>
            <span id="count"></span>`;
        const refs = {
            rosterPlanningHeader: document.querySelector('#planning'),
            rosterBody: document.querySelector('#roster'),
            rosterFilter: document.querySelector('#filter'),
            rosterView: document.querySelector('#view'),
            rosterCount: document.querySelector('#count')
        };
        const report = {
            mode: 'historical',
            rounds: [{ day: 1 }, { day: 2 }],
            roster: [{
                tag: '#P0L',
                name: 'Orion',
                townHall: 17,
                roundsPlayed: 1,
                attacksUsed: 1,
                availableAttacks: 1,
                stars: 3,
                destruction: 100,
                missed: 0,
                status: 'ok'
            }]
        };

        syncRosterMode(refs, report);
        renderRoster(refs, report);

        expect(refs.rosterPlanningHeader.hidden).toBe(false);
        expect(refs.rosterPlanningHeader.textContent).toBe('Participation');
        expect(refs.rosterBody.textContent).toContain('1/2');
        expect(refs.rosterBody.textContent).toContain('Complete');
        expect(refs.rosterBody.querySelectorAll('td')).toHaveLength(7);
    });
});

function overviewSeason(season, league, offense, defense) {
    return {
        data: { season },
        label: season === '2026-05' ? 'May 2026' : 'June 2026',
        change: 'unknown',
        summary: {
            season,
            league: { name: league },
            position: season === '2026-05' ? 2 : 1,
            record: { wins: 6, losses: 1, draws: 0 },
            offense: {
                avgStars: offense,
                avgDestruction: 91.4,
                tripleRate: 0.58,
                starsPerWar: 36.8
            },
            defense: {
                avgStars: defense,
                avgDestruction: 87.1,
                tripleRate: 0.41,
                starsPerWar: 33.2
            },
            attackUsage: 0.98,
            missedAttacks: 2,
            starDifferential: 3.6,
            destructionDifferential: 4.3,
            dataQuality: 'Complete'
        }
    };
}
