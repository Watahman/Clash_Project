import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(path, 'utf8');

describe('Progress workspace page contracts', () => {
    it('covers every required Advanced Stats lifecycle and source-quality state', () => {
        const renderer = read('src/assets/js/pages/advanced-stats-renderer.js');
        const analysis = read('src/assets/js/pages/advanced-stats.js');
        const analysisModel = read('src/assets/js/pages/advanced-stats-analysis.js');
        const analysisRenderer = read('src/assets/js/pages/advanced-stats-analysis-renderer.js');
        const dataLoader = read('src/assets/js/pages/advanced-stats-data-loader.js');
        const trendRenderer = read('src/assets/js/pages/advanced-stats-trends-renderer.js');

        for (const status of ['INITIALIZING', 'ACTIVE', 'PAUSED', 'DEGRADED', 'STOPPED', 'ERROR']) {
            expect(renderer).toContain(`${status}:`);
        }
        expect(renderer).toContain('trackingExists');
        expect(renderer).toContain('analysisPending');
        expect(renderer).toContain('analysis.active');
        expect(renderer).toContain('(analysis.error && !hasHistory)');
        expect(analysisModel).toContain('ACTIVE_PHASES');
        expect(analysisModel).toContain("['READY', 'PARTIAL', 'UNSUPPORTED']");
        expect(analysisModel).toContain('current.active');
        expect(analysisRenderer).toContain('aria-valuetext');
        expect(trendRenderer).toContain('aria-valuetext');
        expect(dataLoader).toContain('Promise.allSettled');
        expect(dataLoader).toContain('data-load-error');
        expect(analysis).toContain('resetRangeData({ clearTracking: true })');
    });

    it('uses the central entity resolver and gives achievement families semantic assets', () => {
        const helper = read('src/assets/js/pages/progress-asset-view.js');
        const assetView = read('src/assets/js/pages/achievement-asset-view.js');
        const renderer = read('src/assets/js/pages/achievements-renderer.js');

        expect(helper).toContain("from '../assets/entity-assets.js'");
        expect(helper).toContain('ASSET_FALLBACKS.entity');
        expect(helper).toContain('getEntityAsset(entity)');
        expect(helper).toContain('/assets/icons/achievements/');
        expect(assetView).toContain('ENTITY_RULES');
        expect(assetView).toContain('GLYPH_RULES');
        expect(renderer).toContain('achievementFamilyImage(family');
    });

    it('keeps both progress pages usable on narrow screens without hiding their data model', () => {
        const advancedStats = read('src/assets/css/advanced-stats.css');
        const achievements = read('src/assets/css/achievements.css');

        expect(advancedStats).toContain('@media (max-width: 599px)');
        expect(advancedStats).toContain('.advanced-stats__units-mobile { display: grid;');
        expect(advancedStats).toContain('.advanced-stats__two-column { align-items: stretch; display: grid; gap: 24px; grid-template-columns: 1fr; }');
        expect(advancedStats).toContain('.advanced-stats__army-list { display: grid; gap: 12px; grid-template-columns: repeat(3, minmax(0, 1fr)); }');
        expect(advancedStats).toContain('.advanced-stats__trend-tooltip');
        expect(achievements).toContain('.achievement-filter-dialog:modal');
        expect(achievements).toContain('.achievement-grid { grid-template-columns: 1fr;');
        expect(achievements).not.toMatch(/gradient|glow/i);
    });

    it('registers the requested localhost fixture boundaries', () => {
        const catalog = JSON.parse(read('src/fixtures/redesign/scenarios.json')).scenarios;
        const ids = new Set(catalog.map(scenario => scenario.id));
        const stats = ['stats-no-account', 'stats-not-tracking', 'stats-initializing', 'stats-active', 'stats-paused', 'stats-degraded', 'stats-error', 'stats-partial', 'stats-no-attacks', 'stats-rich-90d'];
        const achievements = ['achievements-no-account', 'achievements-new', 'achievements-mid', 'achievements-rich', 'achievements-missing-source', 'achievements-import-valid', 'achievements-import-invalid'];

        [...stats, ...achievements].forEach(id => expect(ids.has(id), id).toBe(true));
        expect(read('src/assets/js/fixtures/redesign-fixture-mode.js')).toContain("new Set(['localhost', '127.0.0.1'");
        expect(read('src/assets/js/pages/advanced-stats-fixtures.js')).toContain('getRedesignFixture');
        expect(read('src/assets/js/pages/achievements-fixtures.js')).toContain('getRedesignFixture');
    });
});
