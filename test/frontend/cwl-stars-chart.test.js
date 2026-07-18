import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, values = {}) => ({
        'op.starsChartLabel': 'Grafiek met sterren per CWL-dag',
        'op.chartDaysAvailable': `${values.count}/${values.total} dagen`,
        'op.starsChartPoint': `Dag ${values.day}: ${values.stars} sterren, ${values.destruction}% destruction, tegen ${values.opponent}`,
        'op.day': 'Dag',
        'op.destruction': 'destruction',
        'op.chartOpponent': `Tegen ${values.opponent}`,
        'op.starsChartEmpty': 'Nog geen live of afgeronde war days beschikbaar.',
        'op.chartDayEmpty': `Dag ${values.day}: nog geen data`,
        'op.chartDayValue': `Dag ${values.day}: ${values.stars} sterren`,
        'op.dayShort': 'D'
    })[key] || key
}));

describe('stars per war day chart', () => {
    beforeEach(() => {
        document.body.innerHTML = '<span id="status"></span><div id="chart"></div>';
    });

    it('keeps future days empty instead of turning them into zero-star points', async () => {
        const { buildStarsPerDaySeries } = await import('../../src/assets/js/cwl/cwl-stars-chart.js');
        const series = buildStarsPerDaySeries([
            { day: 1, state: 'completed', stars: 31, destruction: 90.4, opponent: 'North' },
            { day: 2, state: 'live', stars: 0, destruction: 0, opponent: 'South' },
            { day: 3, state: 'preparation', stars: 44, destruction: 100, opponent: 'Future' }
        ]);

        expect(series).toHaveLength(7);
        expect(series[0]).toMatchObject({ stars: 31, destruction: 90.4, opponent: 'North' });
        expect(series[1].stars).toBe(0);
        expect(series[2].stars).toBeNull();
        expect(series[6].stars).toBeNull();
    });

    it('renders accessible real-data points and seven explicit day labels', async () => {
        const { renderStarsPerDayChart } = await import('../../src/assets/js/cwl/cwl-stars-chart.js');
        const container = document.querySelector('#chart');
        const status = document.querySelector('#status');
        renderStarsPerDayChart(container, [
            { day: 1, state: 'completed', stars: 31, destruction: 90.4, opponent: 'North' },
            { day: 2, state: 'live', stars: 18, destruction: 82.1, opponent: 'South' }
        ], status);

        expect(container.querySelectorAll('.op-stars-point')).toHaveLength(2);
        expect(container.querySelectorAll('.op-stars-x-axis > span')).toHaveLength(7);
        expect(container.querySelector('.op-stars-point').getAttribute('aria-label')).toContain('tegen North');
        expect(container.querySelectorAll('.op-stars-x-axis strong')[2].textContent).toBe('—');
        expect(status.textContent).toBe('2/7 dagen');
    });

    it('does not connect a line across a missing day', async () => {
        const { buildStarsPerDaySeries, getLineSegments } = await import('../../src/assets/js/cwl/cwl-stars-chart.js');
        const series = buildStarsPerDaySeries([
            { day: 1, state: 'completed', stars: 31 },
            { day: 3, state: 'completed', stars: 29 }
        ]);

        expect(getLineSegments(series)).toHaveLength(2);
        expect(getLineSegments(series).map(segment => segment.map(point => point.day))).toEqual([[1], [3]]);
    });
});
