import { beforeEach, describe, expect, it } from 'vitest';
import {
    normalizeLifetime,
    presentLifetime,
    renderLifetime
} from '../../src/assets/js/pages/advanced-stats-lifetime-renderer.js?v=20260912-advanced-dashboard-v1';
import {
    createTrendValue,
    renderTrends,
    trendLineSegments,
    trendScale
} from '../../src/assets/js/pages/advanced-stats-trends-renderer.js?v=20260912-advanced-dashboard-v1';

beforeEach(() => document.body.replaceChildren());

function lifetimeRefs() {
    const section = document.createElement('section');
    section.innerHTML = `
        <strong id="stars"></strong><strong id="destruction"></strong><strong id="perfect"></strong><strong id="best"></strong>
        <strong id="triple"></strong><strong id="days"></strong><strong id="current"></strong><strong id="active"></strong><strong id="month"></strong>
        <strong id="zero"></strong><strong id="one"></strong><strong id="two"></strong><strong id="three"></strong><strong id="unknown"></strong>
        <div data-category="regular"><strong data-category-value></strong><small data-category-meta></small></div>
        <div data-category="competitive"><strong data-category-value></strong><small data-category-meta></small></div>
        <div data-category="unknown"><strong data-category-value></strong><small data-category-meta></small></div>
        <div data-lifetime-favorites><div data-lifetime-favorites-content></div></div>
        <div data-lifetime-successful-army><div data-lifetime-successful-army-content></div></div>`;
    document.body.append(section);
    const refs = {
        lifetimeSection: section,
        lifetimeAvailability: document.createElement('small'),
        lifetimeCategory: section,
        lifetimeFavorites: section.querySelector('[data-lifetime-favorites]'),
        lifetimeSuccessfulArmy: section.querySelector('[data-lifetime-successful-army]')
    };
    [['TotalStars', 'stars'], ['TotalDestruction', 'destruction'], ['PerfectAttacks', 'perfect'], ['BestStreak', 'best'], ['TripleCount', 'triple'], ['TrackedDays', 'days'], ['CurrentStreak', 'current'], ['MostActiveMonth', 'active'], ['BestPerformanceMonth', 'month'], ['StarZero', 'zero'], ['StarOne', 'one'], ['StarTwo', 'two'], ['StarThree', 'three'], ['StarUnknown', 'unknown']]
        .forEach(([key, id]) => { refs[`lifetime${key}`] = section.querySelector(`#${id}`); });
    return refs;
}

describe('Advanced Stats lifetime and metric renderers', () => {
    it('normalizes the backend lifetime envelope without changing nulls', () => {
        const normalized = normalizeLifetime({ data: { summary: { perfectAttacks: null }, starDistribution: { three: 0 } } });
        expect(normalized.summary.perfectAttacks).toBeNull();
        expect(normalized.starDistribution.three).toBe(0);
    });

    it('presents lifetime primary metrics and keeps unavailable streaks honest', () => {
        const refs = lifetimeRefs();
        renderLifetime(refs, {
            lifetime: { data: {
                summary: { totalStars: 7, totalDestruction: 259, perfectAttacks: null, bestThreeStarStreak: null, threeStarCount: 2, trackedAttackDays: 3, currentThreeStarStreak: null },
                starDistribution: { zero: 0, one: 1, two: 2, three: 2, unknown: 0 }, categories: {}
            } }, lifetimeState: 'ready', unitCatalog: []
        });

        expect(refs.lifetimeTotalStars.textContent).toBe('7');
        expect(refs.lifetimeTotalDestruction.textContent).toBe('259%');
        expect(refs.lifetimePerfectAttacks.textContent).not.toBe('0');
        expect(refs.lifetimeBestStreak.textContent).not.toBe('0');
        expect(refs.lifetimeStarZero.textContent).toBe('0');
        expect(refs.lifetimeCurrentStreak.textContent).not.toBe('0');
    });

    it('renders category metrics and sample size independently', () => {
        const refs = lifetimeRefs();
        renderLifetime(refs, { lifetime: { data: { categories: {
            regular: { attacks: 10, averageStars: 2.4, threeStarRate: 40, sampleSize: 10 },
            competitive: { attacks: 5, averageStars: 2.8, threeStarRate: 60 }
        } } }, lifetimeState: 'ready', unitCatalog: [] });
        expect(refs.lifetimeCategory.querySelector('[data-category="regular"] [data-category-value]').textContent).toContain('2.40');
        expect(refs.lifetimeCategory.querySelector('[data-category="regular"] [data-category-meta]').textContent).toContain('10');
        expect(refs.lifetimeCategory.querySelector('[data-category="regular"] [data-category-meta]').textContent).toContain('Sample size');
        expect(refs.lifetimeCategory.querySelector('[data-category="regular"] [data-category-meta]').textContent).not.toContain('Minimum sample');
        expect(refs.lifetimeCategory.querySelector('[data-category="competitive"] [data-category-value]').textContent).toContain('60%');
    });

    it('renders the reliable all-time favorite army in the lifetime summary', () => {
        const refs = lifetimeRefs();
        renderLifetime(refs, {
            lifetime: { data: {
                favorites: {},
                mostUsedArmy: {
                    army: { units: [{ category: 'TROOP', name: 'Archer', quantity: 12 }] },
                    battleCount: 8
                }
            } }, lifetimeState: 'ready', unitCatalog: []
        });

        const army = refs.lifetimeFavorites.querySelector('[data-favorite-type="army"]');
        expect(army?.textContent).toContain('Archer');
        expect(army?.textContent).toContain('8');
    });

    it('scales metric values and marks unknown selected metrics without zeros', () => {
        expect(trendScale([{ averageStars: 2.5 }], 'averageStars')).toMatchObject({ maximum: 3 });
        expect(trendScale([{ threeStarRate: 80 }], 'threeStarRate')).toMatchObject({ maximum: 100 });
        const value = createTrendValue({ date: '2026-08-01', attacks: 6, averageStars: null }, 0, { metric: 'averageStars' });
        expect(value.dataset.known).toBe('false');
        expect(value.getAttribute('aria-valuenow')).toBeNull();
        expect(value.getAttribute('aria-valuetext')).toContain('6 attacks');
    });

    it('splits trend lines at calendar gaps as well as null metric values', () => {
        expect(trendLineSegments([
            { date: '2026-01-01', attacks: 2 },
            { date: '2026-03-01', attacks: 2 },
            { date: '2026-04-01', attacks: null },
            { date: '2026-05-01', attacks: 3 }
        ])).toHaveLength(3);
        const refs = { trendChart: document.createElement('div'), trendEmpty: document.createElement('p') };
        renderTrends(refs, { trends: [
            { date: '2026-08-01', attacks: 1, averageStars: 2 },
            { date: '2026-10-01', attacks: 2, averageStars: 3 }
        ], trendMetric: 'averageStars' });
        expect(refs.trendChart.querySelectorAll('.advanced-stats__trend-line')).toHaveLength(2);
        expect(refs.trendChart.querySelector('svg').dataset.metric).toBe('averageStars');
    });

    it('renders an empty metric chart without manufacturing points', () => {
        const refs = { trendChart: document.createElement('div'), trendEmpty: document.createElement('p') };
        renderTrends(refs, { trends: [], trendMetric: 'threeStarRate' });
        expect(refs.trendChart.children).toHaveLength(0);
        expect(refs.trendEmpty.hidden).toBe(false);
    });
});
