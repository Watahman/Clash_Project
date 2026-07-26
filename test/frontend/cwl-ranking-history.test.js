import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, values = {}) => ({
        'op.positionChartLabel': 'Positie per CWL-dag',
        'op.chartDaysAvailable': `${values.count}/${values.total} dagen`,
        'op.positionChartPoint': `Dag ${values.day}: positie ${values.rank}/${values.total}, ${values.stars} sterren, ${values.destruction}% destruction`,
        'op.day': 'Dag',
        'op.chartCumulativeStars': `${values.stars} sterren cumulatief`,
        'op.destruction': 'destruction',
        'op.positionChartEmpty': 'Geen complete dagstanden beschikbaar.',
        'op.positionDayEmpty': `Dag ${values.day}: geen complete stand`,
        'op.positionDayValue': `Dag ${values.day}: positie ${values.rank}/${values.total}`,
        'op.dayShort': 'D'
    })[key] || key
}));

const clans = ['#PQL', '#AAA', '#BBB', '#CCC'];

function leagueGroup() {
    return {
        clans: clans.map(tag => ({ tag })),
        rounds: [
            { warTags: ['#WAR1', '#WAR2'] },
            { warTags: ['#WAR3', '#WAR4'] },
            ...Array.from({ length: 5 }, () => ({ warTags: ['#0', '#0'] }))
        ]
    };
}

function completedWar(round, warTag, clan, opponent) {
    return { _round: round, _warTag: warTag, state: 'warEnded', clan: { tag: clan }, opponent: { tag: opponent } };
}

function standingsForHistory(wars) {
    const secondDay = wars.length === 4;
    const selected = { tag: '#PQL', rank: secondDay ? 1 : 3, stars: secondDay ? 67 : 31, destruction: secondDay ? 92.6 : 89.4 };
    const rows = [
        { tag: '#AAA', rank: secondDay ? 2 : 1, stars: 65, destruction: 91 },
        { tag: '#BBB', rank: secondDay ? 3 : 2, stars: 61, destruction: 90 },
        selected,
        { tag: '#CCC', rank: 4, stars: 55, destruction: 88 }
    ].sort((a, b) => a.rank - b.rank);
    return { rows, selectedIndex: rows.findIndex(row => row.tag === '#PQL') };
}

describe('CWL ranking history', () => {
    beforeEach(() => {
        document.body.innerHTML = '<span id="status"></span><div id="chart"></div>';
    });

    it('reconstructs cumulative positions only from fully completed rounds', async () => {
        const { buildRankingHistory } = await import('../../src/assets/js/cwl/cwl-ranking-history.js');
        const buildStandings = vi.fn(standingsForHistory);
        const history = buildRankingHistory({
            leagueGroup: leagueGroup(),
            leagueWars: [
                completedWar(1, '#WAR1', '#PQL', '#AAA'),
                completedWar(1, '#WAR2', '#BBB', '#CCC'),
                completedWar(2, '#WAR3', '#PQL', '#BBB'),
                completedWar(2, '#WAR4', '#AAA', '#CCC')
            ],
            selectedClanTag: '#PQL',
            buildStandings
        });

        expect(history[0]).toMatchObject({ day: 1, rank: 3, clanCount: 4, stars: 31 });
        expect(history[1]).toMatchObject({ day: 2, rank: 1, clanCount: 4, stars: 67 });
        expect(history.slice(2).every(point => point.rank === null)).toBe(true);
        expect(buildStandings.mock.calls.map(call => call[0].length)).toEqual([2, 4]);
    });

    it('leaves the day and every later position empty when an expected war is missing', async () => {
        const { buildRankingHistory } = await import('../../src/assets/js/cwl/cwl-ranking-history.js');
        const buildStandings = vi.fn(standingsForHistory);
        const history = buildRankingHistory({
            leagueGroup: leagueGroup(),
            leagueWars: [completedWar(1, '#WAR1', '#PQL', '#AAA')],
            selectedClanTag: '#PQL',
            buildStandings
        });

        expect(history.every(point => point.rank === null)).toBe(true);
        expect(history[0].reason).toBe('unfinishedWars');
        expect(buildStandings).not.toHaveBeenCalled();
    });

    it('does not publish a position for a live or partially completed round', async () => {
        const { buildRankingHistory } = await import('../../src/assets/js/cwl/cwl-ranking-history.js');
        const buildStandings = vi.fn(standingsForHistory);
        const liveWar = { ...completedWar(2, '#WAR3', '#PQL', '#BBB'), state: 'inWar' };
        const history = buildRankingHistory({
            leagueGroup: leagueGroup(),
            leagueWars: [
                completedWar(1, '#WAR1', '#PQL', '#AAA'),
                completedWar(1, '#WAR2', '#BBB', '#CCC'),
                liveWar,
                completedWar(2, '#WAR4', '#AAA', '#CCC')
            ],
            selectedClanTag: '#PQL',
            buildStandings
        });

        expect(history[0].rank).toBe(3);
        expect(history[1]).toMatchObject({ rank: null, reason: 'unfinishedWars' });
        expect(history.slice(1).every(point => point.rank === null)).toBe(true);
    });

    it('renders rank one at the top with accessible cumulative details', async () => {
        const { renderRankingHistoryChart } = await import('../../src/assets/js/cwl/cwl-ranking-history.js');
        const container = document.querySelector('#chart');
        renderRankingHistoryChart(container, [
            { day: 1, rank: 3, clanCount: 4, stars: 31, destruction: 89.4 },
            { day: 2, rank: 1, clanCount: 4, stars: 67, destruction: 92.6 }
        ], document.querySelector('#status'));

        expect(container.querySelectorAll('.op-ranking-point')).toHaveLength(2);
        expect(container.querySelector('.op-ranking-point[data-day="2"]').style.getPropertyValue('--point-y')).toBe('0%');
        expect(container.querySelector('.op-ranking-point[data-day="1"]').getAttribute('aria-label')).toContain('positie 3/4');
        expect(container.querySelectorAll('.op-stars-x-axis strong')[2].textContent).toBe('—');
        expect(document.querySelector('#status').textContent).toBe('2/7 dagen');
    });

    it('renders only supplied League forecast positions as a dashed continuation', async () => {
        const {
            buildRankingPrediction,
            renderRankingHistoryChart
        } = await import('../../src/assets/js/cwl/cwl-ranking-history.js');
        const history = [
            { day: 1, rank: 3, clanCount: 4, stars: 31, destruction: 89.4 },
            ...Array.from({ length: 6 }, (_, index) => ({
                day: index + 2,
                rank: null
            }))
        ];
        const forecast = [
            { day: 2, rank: 2, clanCount: 4 },
            { day: 3, rank: 1, clanCount: 4 }
        ];

        expect(buildRankingPrediction(history, forecast)).toEqual([
            { day: 1, value: 3 },
            { day: 2, value: 2 },
            { day: 3, value: 1 }
        ]);
        renderRankingHistoryChart(
            document.querySelector('#chart'),
            history,
            document.querySelector('#status'),
            forecast
        );
        expect(document.querySelectorAll('.op-ranking-prediction-line')).toHaveLength(1);
        expect(document.querySelectorAll('.op-stars-x-axis strong')[1].textContent).toBe('~#2');
    });
});
