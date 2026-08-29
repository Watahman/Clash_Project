import { beforeEach, describe, expect, it } from 'vitest';
import { renderArmies } from '../../src/assets/js/pages/advanced-stats-armies-renderer.js?v=20260829-public-auth-v1';
import { renderBattles } from '../../src/assets/js/pages/advanced-stats-battles-renderer.js?v=20260829-public-auth-v1';
import { renderOverview } from '../../src/assets/js/pages/advanced-stats-renderer.js?v=20260829-public-auth-v1';
import { renderCoverageStatus, renderHistoryAnalysis } from '../../src/assets/js/pages/advanced-stats-analysis-renderer.js?v=20260829-public-auth-v1';
import { normalizeAnalysis } from '../../src/assets/js/pages/advanced-stats-analysis.js';
import { createTrendValue, renderTrends } from '../../src/assets/js/pages/advanced-stats-trends-renderer.js?v=20260829-public-auth-v1';
import { renderUnits } from '../../src/assets/js/pages/advanced-stats-units-renderer.js?v=20260829-public-auth-v1';

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

    it('shows honest coverage source labels without exposing source identifiers', () => {
        const refs = {
            analysisCoverageNormal: element('dd'), analysisCoverageNormalMeta: element('small'),
            analysisCoverageWar: element('dd'), analysisCoverageWarMeta: element('small'),
            analysisCoverageRanked: element('dd'), analysisCoverageRankedMeta: element('small')
        };

        renderCoverageStatus(refs, {
            normal: { status: 'PARTIAL', sourceLabel: 'clashking-v2', sourceId: 'internal-42' },
            war: { status: 'UNAVAILABLE', reasonLabel: 'Not supplied' }
        }, 'analysis');

        expect(refs.analysisCoverageNormal.dataset.state).toBe('partial');
        expect(refs.analysisCoverageNormalMeta.textContent).toContain('ClashKing');
        expect(refs.analysisCoverageNormalMeta.textContent).not.toContain('clashking-v2');
        expect(refs.analysisCoverageNormalMeta.textContent).not.toContain('internal-42');
        expect(refs.analysisCoverageWar.dataset.state).toBe('unavailable');
        expect(refs.analysisCoverageWarMeta.textContent).toContain('Not supplied');
        expect(refs.analysisCoverageRanked.dataset.state).toBe('unknown');
    });

    it('renders compact backend scope phases and hides terminal unknown progress', () => {
        const root = document.createElement('section');
        root.innerHTML = `
            <h2></h2><p></p><strong></strong><progress></progress>
            <span data-processed></span><span data-available></span>
            <ol data-analysis-scopes>
                <li data-analysis-scope="normal"><em data-scope-status></em><progress data-scope-progress></progress><small data-scope-count></small></li>
                <li data-analysis-scope="war"><em data-scope-status></em><progress data-scope-progress></progress><small data-scope-count></small></li>
                <li data-analysis-scope="ranked"><em data-scope-status></em><progress data-scope-progress></progress><small data-scope-count></small></li>
                <li data-analysis-scope="aggregate"><em data-scope-status></em><progress data-scope-progress></progress><small data-scope-count></small></li>
            </ol><ol class="advanced-stats__analysis-steps"></ol>
        `;
        const refs = {
            analysisLoading: root,
            analysisTitle: root.querySelector('h2'),
            analysisText: root.querySelector('p'),
            analysisStatus: root.querySelector('strong'),
            analysisProgress: root.querySelector(':scope > progress'),
            analysisProcessed: root.querySelector('[data-processed]'),
            analysisAvailable: root.querySelector('[data-available]')
        };
        const analysis = normalizeAnalysis({
            trackingExists: true,
            analysisPhase: 'BOOTSTRAPPING',
            analysisProgress: 36,
            analysisProcessed: 18,
            analysisTotal: 50,
            analysisScopes: [
                { scope: 'normal', bootstrapStatus: 'RUNNING', progress: 36 },
                { scope: 'war', bootstrapStatus: 'PARTIAL', coverage: 'PARTIAL', progress: 100 },
                { scope: 'ranked', bootstrapStatus: 'PENDING', capabilityStatus: 'UNSUPPORTED', coverage: 'UNSUPPORTED', progress: 0 }
            ]
        });

        renderHistoryAnalysis({ ...refs, analysisError: null, analysisRetry: null }, { analysis, analysisRequested: true });

        expect(root.hidden).toBe(false);
        expect(root.querySelector('[data-analysis-scope="normal"]').dataset.phase).toBe('PROCESSING');
        expect(root.querySelector('[data-analysis-scope="war"]').dataset.phase).toBe('PARTIAL');
        expect(root.querySelector('[data-analysis-scope="war"] progress').hidden).toBe(true);
        expect(root.querySelector('[data-analysis-scope="ranked"] em').textContent).toContain('Not available');
        expect(refs.analysisProgress.value).toBe(36);
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

    it('merges duplicate unit names before rendering usage rows', () => {
        const refs = {
            units: element('tbody'),
            unitsMobile: element(),
            unitsTableWrap: element(),
            unitsEmpty: element()
        };

        renderUnits(refs, {
            units: [
                { key: 'troop_4000177', name: 'Meteor Golem', totalQuantity: 44, battlesPresent: 10, usageRate: 50 },
                { key: 'troop_177', name: 'Meteor Golem', totalQuantity: 1, battlesPresent: 1, usageRate: 5 }
            ],
            overview: { data: { summary: { attacks: 20 } } },
            sectionStates: { units: 'ready' }
        });

        expect(refs.units.children).toHaveLength(1);
        expect(refs.units.textContent).toContain('45');
        expect(refs.units.textContent).toContain('11');
        expect(refs.units.textContent).not.toMatch(/Meteor Golem[\s\S]*Meteor Golem/);
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
        const unknown = createTrendValue({ date: '2026-08-11', attacks: null, averageStars: null, averageDestruction: null }, 1);

        expect(known.getAttribute('role')).toBe('meter');
        expect(known.getAttribute('aria-valuenow')).toBe('2');
        expect(known.getAttribute('aria-valuemax')).toBe('2');
        expect(known.getAttribute('aria-valuetext')).toContain('88%');
        expect(unknown.getAttribute('aria-valuenow')).toBeNull();
        expect(unknown.getAttribute('aria-valuetext')).toContain('— attacks');
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
        expect(trendRefs.trendChart.querySelectorAll('.advanced-stats__trend-grid-label')).toHaveLength(3);
        expect([...trendRefs.trendChart.querySelectorAll('.advanced-stats__trend-grid-label')].map(label => label.textContent).join(' ')).not.toContain('%');
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
