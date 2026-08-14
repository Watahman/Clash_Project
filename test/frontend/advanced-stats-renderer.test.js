import { beforeEach, describe, expect, it } from 'vitest';
import { renderArmies } from '../../src/assets/js/pages/advanced-stats-armies-renderer.js';
import { renderBattles } from '../../src/assets/js/pages/advanced-stats-battles-renderer.js';
import { renderOverview } from '../../src/assets/js/pages/advanced-stats-renderer.js';
import { createTrendValue, renderTrends } from '../../src/assets/js/pages/advanced-stats-trends-renderer.js';
import { renderUnits } from '../../src/assets/js/pages/advanced-stats-units-renderer.js';

beforeEach(() => {
    document.body.replaceChildren();
});

function element(tag = 'div') {
    return document.createElement(tag);
}

function overviewElements() {
    return {
        kpiAttacks: element(),
        kpiStars: element(),
        kpiThreeStar: element(),
        kpiDestruction: element(),
        favoriteTroop: element(),
        favoriteTroopMeta: element(),
        favoriteTroopImage: element(),
        favoriteSpell: element(),
        favoriteSpellMeta: element(),
        favoriteSpellImage: element(),
        favoriteSiege: element(),
        favoriteSiegeMeta: element(),
        favoriteSiegeImage: element(),
        favoriteArmy: element(),
        favoriteArmyMeta: element(),
        favoriteArmyImage: element()
    };
}

describe('Advanced Stats extracted renderers', () => {
    it('keeps missing overview metrics unknown instead of turning them into zeroes', () => {
        const refs = overviewElements();

        renderOverview(refs, {
            overview: { data: { summary: {}, favorites: {} } },
            unitCatalog: []
        });

        expect(refs.kpiAttacks.textContent).toBe('—');
        expect(refs.kpiStars.textContent).toBe('—');
        expect(refs.kpiThreeStar.textContent).toBe('—');
        expect(refs.kpiDestruction.textContent).toBe('—');
    });

    it('renders a partial unit source as an explicit error state', () => {
        const refs = {
            units: element('tbody'),
            unitsMobile: element(),
            unitsTableWrap: element(),
            unitsEmpty: element()
        };

        renderUnits(refs, { units: [], sectionStates: { units: 'error' } });

        expect(refs.units.children).toHaveLength(0);
        expect(refs.unitsTableWrap.hidden).toBe(true);
        expect(refs.unitsEmpty.hidden).toBe(false);
        expect(refs.unitsEmpty.textContent).toContain('could not be loaded');
    });

    it('omits unresolved army compositions while preserving the empty state', () => {
        const refs = { armies: element(), armiesEmpty: element() };

        renderArmies(refs, {
            armies: [{ army: { units: [{ category: 'TROOP', key: 'troop:unknown', quantity: 12 }] } }],
            unitCatalog: [],
            sectionStates: { armies: 'ready' }
        });

        expect(refs.armies.children).toHaveLength(0);
        expect(refs.armiesEmpty.hidden).toBe(false);
        expect(refs.armiesEmpty.textContent).toContain('complete army compositions');
    });

    it('limits favorite armies to a focused top three', () => {
        const refs = { armies: element(), armiesEmpty: element() };
        const armies = Array.from({ length: 5 }, (_, index) => ({
            army: { units: [{ category: 'TROOP', key: `troop-${index}`, name: `Troop ${index}`, quantity: 1 }] },
            battleCount: 5 - index,
            averageStars: 2,
            averageDestruction: 80
        }));

        renderArmies(refs, { armies, unitCatalog: [], sectionStates: { armies: 'ready' } });

        expect(refs.armies.children).toHaveLength(3);
        expect(refs.armies.firstElementChild.textContent).toContain('Troop 0');
        expect(refs.armies.lastElementChild.textContent).toContain('Troop 2');
    });

    it('exposes known and unknown trend values with range semantics', () => {
        const known = createTrendValue({ date: '2026-08-10', attacks: 2, averageStars: 2.5, averageDestruction: 88 }, 0);
        const unknown = createTrendValue({ date: '2026-08-11', attacks: 1, averageStars: null, averageDestruction: null }, 1);

        expect(known.getAttribute('role')).toBe('meter');
        expect(known.getAttribute('aria-valuenow')).toBe('88');
        expect(known.getAttribute('aria-valuetext')).toContain('88%');
        expect(unknown.getAttribute('aria-valuenow')).toBeNull();
        expect(unknown.getAttribute('aria-valuetext')).toContain('1 attack');
        expect(unknown.getAttribute('aria-valuetext')).toContain('—');
        expect(unknown.dataset.known).toBe('false');
    });

    it('preserves trend gaps and battle army filtering', () => {
        const trendRefs = { trendChart: element(), trendEmpty: element() };
        renderTrends(trendRefs, {
            trends: [
                { date: '2026-08-01', attacks: 1, averageStars: 2, averageDestruction: 80 },
                { date: '2026-08-03', attacks: 1, averageStars: 3, averageDestruction: 90 }
            ]
        });
        expect(trendRefs.trendChart.querySelector('.advanced-stats__trend-svg')).not.toBeNull();
        expect(trendRefs.trendChart.querySelector('.advanced-stats__trend-line')).not.toBeNull();
        expect(trendRefs.trendChart.querySelectorAll('.advanced-stats__trend-point')).toHaveLength(2);
        expect(trendRefs.trendChart.querySelector('.advanced-stats__trend-gap')).not.toBeNull();
        expect(trendRefs.trendChart.querySelectorAll('[role="meter"]')).toHaveLength(2);

        const battleRefs = { battles: element(), battlesEmpty: element(), loadMore: element() };
        renderBattles(battleRefs, {
            battles: [{
                opponentName: 'Opponent',
                battleAt: '2026-08-03T18:00:00Z',
                stars: 3,
                destructionPercentage: 91,
                units: [
                    { name: 'Unknown troop (4000185)', quantity: 20 },
                    { name: 'Healer', quantity: 5 }
                ]
            }],
            hasMore: false
        });
        expect(battleRefs.battles.textContent).toContain('Opponent');
        expect(battleRefs.battles.textContent).toContain('Healer');
        expect(battleRefs.battles.textContent).not.toContain('Unknown troop');
    });
});
