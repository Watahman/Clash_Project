import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const ADVANCED_STATS_CACHE_VERSION = '20260913-advanced-dashboard-v2';
const ADVANCED_STATS_CSS_CACHE_VERSION = '20260913-advanced-dashboard-v3';

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Advanced Stats workspace page', () => {
    it('uses its own workspace page identity for contextual help', () => {
        const document = documentFor('src/subpages/advanced-stats.html');
        expect(document.body.dataset.workspacePage).toBe('advancedStats');
    });
    it('contains the private tracking and analysis workflow', () => {
        const document = documentFor('src/subpages/advanced-stats.html');

        expect(document.title).toContain('Advanced Stats');
        expect(document.querySelector('meta[name="robots"]')?.content).toContain('noindex');
        expect(document.body.dataset.workspacePage).toBe('advancedStats');
        expect(document.body.dataset.advancedStatsPage).toBe('true');
        expect(document.querySelector('#advanced-stats-account')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-start')?.getAttribute('type')).toBe('button');
        expect(document.querySelector('#advanced-stats-periods [data-period="7d"]')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-periods [data-period="30d"]')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-periods [data-period="90d"]')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-periods [data-period="all"]')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-categories')).not.toBeNull();
        expect(document.querySelectorAll('#advanced-stats-categories [data-attack-category]')).toHaveLength(3);
        expect(document.querySelector('#advanced-stats-categories [data-attack-category="competitive"]')?.getAttribute('aria-pressed')).toBe('false');
        expect(document.querySelector('#advanced-stats-units')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-armies')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-trend-chart')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-trend-metrics')).not.toBeNull();
        expect(document.querySelectorAll('#advanced-stats-trend-metrics [data-trend-metric]')).toHaveLength(4);
        expect(document.querySelector('#advanced-stats-lifetime-section')).not.toBeNull();
        for (const id of [
            'advanced-stats-lifetime-total-stars',
            'advanced-stats-lifetime-total-destruction',
            'advanced-stats-lifetime-perfect-attacks',
            'advanced-stats-lifetime-best-streak',
            'advanced-stats-lifetime-triple-count',
            'advanced-stats-lifetime-tracked-days',
            'advanced-stats-lifetime-current-streak',
            'advanced-stats-lifetime-most-active-month',
            'advanced-stats-lifetime-best-performance-month',
            'advanced-stats-lifetime-star-zero',
            'advanced-stats-lifetime-star-one',
            'advanced-stats-lifetime-star-two',
            'advanced-stats-lifetime-star-three',
            'advanced-stats-lifetime-star-unknown'
        ]) expect(document.querySelector(`#${id}`), id).not.toBeNull();
        expect(document.querySelector('#advanced-stats-battles')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-loot-cards [data-loot-resource="gold"] img')?.getAttribute('src')).toContain('/assets/game/buildings/gold-storage.webp');
        expect(document.querySelector('#advanced-stats-loot-cards [data-loot-resource="elixir"] img')?.getAttribute('src')).toContain('/assets/game/buildings/elixir-storage.webp');
        expect(document.querySelector('#advanced-stats-loot-cards [data-loot-resource="darkElixir"] img')?.getAttribute('src')).toContain('/assets/game/buildings/dark-elixir-storage.webp');
        expect(document.querySelector('#advanced-stats-profile-error')?.hidden).toBe(true);
        expect(document.querySelector('#advanced-stats-profile-retry')?.getAttribute('type')).toBe('button');
        expect([...document.querySelectorAll('button:not([type])')]).toHaveLength(0);
    });

    it('keeps the unreleased workspace behind the central route guard', () => {
        const source = readFileSync('src/subpages/advanced-stats.html', 'utf8');
        const document = documentFor('src/subpages/advanced-stats.html');

        expect(source).not.toContain("window.location.replace('/dashboard')");
        expect(document.title).toContain('Coming soon');
        expect(document.querySelector('.workspace-coming-soon-badge')).not.toBeNull();
    });

    it('keeps profile errors separate and preserves last-good partial data', () => {
        const source = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        const loader = readFileSync('src/assets/js/pages/advanced-stats-data-loader.js', 'utf8');
        const renderer = readFileSync('src/assets/js/pages/advanced-stats-renderer.js', 'utf8');
        expect(source).toContain('state.profileError = true');
        expect(renderer).toContain('setVisibility(elements.profileError, state.profileError === true)');
        expect(source).toContain('elements.profileRetry?.addEventListener');
        expect(loader).toContain("applySectionResult(state, overview, 'overview'");
        expect(loader).toContain("const SECTION_NAMES = ['overview'");
        expect(loader).toContain("applySectionResult(state, units, 'units'");
        expect(loader).toContain('state.unitCatalog = arrayValue(value?.items)');
        expect(source).not.toContain("state.overview = overview.status === 'fulfilled' ? overview.value : null");
        expect(source).not.toContain("setDataStatus('advancedStats.loadingData');\n    state.nextCursor = null;");
        expect(loader).toContain("data-load-error");
        expect(loader).toContain("advancedStats.partialLoadFailed");
        expect(source).toContain('resetBattleHistoryState(state)');
    });

    it('uses translatable and semantic accessibility labels', () => {
        const document = documentFor('src/subpages/advanced-stats.html');
        const trend = document.querySelector('#advanced-stats-trend-chart');
        const unitFilter = document.querySelector('#advanced-stats-unit-category');

        expect(trend?.getAttribute('role')).toBe('group');
        expect(trend?.getAttribute('data-i18n-aria-label')).toBe('advancedStats.trendsTitle');
        expect(unitFilter?.getAttribute('aria-labelledby')).toBe('advanced-stats-units-title');
        expect(document.querySelector('#advanced-stats-page-status')?.getAttribute('aria-live')).toBe('polite');
        expect(document.querySelector('#advanced-stats-data-status')?.getAttribute('aria-live')).toBe('polite');
        expect(document.querySelectorAll('#advanced-stats-analysis-scopes [data-scope-progress][data-i18n-aria-label]')).toHaveLength(4);
        expect(document.querySelector('[data-i18n="advancedStats.unitScopeNote"]')).not.toBeNull();
    });

    it('shows meaningful army names without developer metadata', () => {
        const source = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        const renderer = readFileSync('src/assets/js/pages/advanced-stats-renderer.js', 'utf8');
        const specializedRenderers = [
            readFileSync('src/assets/js/pages/advanced-stats-armies-renderer.js', 'utf8'),
            readFileSync('src/assets/js/pages/advanced-stats-battles-renderer.js', 'utf8')
        ].join('\n');
        const armyView = readFileSync('src/assets/js/pages/advanced-stats-army-view.js', 'utf8');
        expect(source).toContain("getUnits: (tag, period) => getAdvancedStatsUnits(tag, period, 'ALL')");
        expect(renderer).toContain("formatDate(tracking.lastSuccessfulPollAt");
        expect(specializedRenderers).toContain('.filter(item => item.presentation.units.length)');
        expect(specializedRenderers).toContain('isPlayerFacingUnitName(unit?.name || unit?.unitName)');
        expect(armyView).toContain('export function displayArmyUnits');
        expect(renderer).not.toContain('pieces.push(battle.battleType)');
        expect(renderer).not.toContain("pieces.push(t('advancedStats.bootstrap'))");
        expect(renderer).not.toContain("t('advancedStats.unitsCount'");
    });

    it('versions the complete Advanced Stats translation graph', () => {
        const html = readFileSync('src/subpages/advanced-stats.html', 'utf8');
        const bootstrap = readFileSync('src/assets/js/pages/advanced-stats-bootstrap.js', 'utf8');
        const page = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        const renderer = readFileSync('src/assets/js/pages/advanced-stats-renderer.js', 'utf8');
        const loader = readFileSync('src/assets/js/pages/advanced-stats-data-loader.js', 'utf8');
        const trendRenderer = readFileSync('src/assets/js/pages/advanced-stats-trends-renderer.js', 'utf8');
        const unitRenderer = readFileSync('src/assets/js/pages/advanced-stats-units-renderer.js', 'utf8');
        const lootRenderer = readFileSync('src/assets/js/pages/advanced-stats-loot.js', 'utf8');
        const i18n = readFileSync('src/assets/js/i18n/i18n.js', 'utf8');
        const runtime = readFileSync('src/assets/js/i18n/runtime-translations.js', 'utf8');

        expect(html).toContain(`advanced-stats-bootstrap.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(html).toContain(`advanced-stats.css?v=${ADVANCED_STATS_CSS_CACHE_VERSION}`);
        expect(html).toContain(`advanced-stats-dashboard.css?v=${ADVANCED_STATS_CSS_CACHE_VERSION}`);
        expect(html).toContain(`advanced-stats-lifetime.css?v=${ADVANCED_STATS_CSS_CACHE_VERSION}`);
        expect(html).toContain('workspace-shell.js?v=20260915-auth-policy-v1');
        expect(bootstrap).toContain(`advanced-stats.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(page).toContain(`advanced-stats-renderer.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(page).toContain(`advanced-stats-data-loader.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(page).toContain(`advanced-stats-fixtures.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(renderer).toContain(`advanced-stats-trends-renderer.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(renderer).toContain(`advanced-stats-units-renderer.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(renderer).toContain(`advanced-stats-loot.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(loader).toContain(`i18n/i18n.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(trendRenderer).toContain(`i18n/i18n.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(unitRenderer).toContain(`i18n/i18n.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(lootRenderer).toContain(`i18n/i18n.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(trendRenderer).toContain("advanced-stats-trends.js?v=20260913-advanced-dashboard-v2");
        expect(page).toContain(`i18n/i18n.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(renderer).toContain(`i18n/i18n.js?v=${ADVANCED_STATS_CACHE_VERSION}`);
        expect(page).toContain("advanced-stats-army-view.js?v=20260809-4");
        expect(page).toContain('applyI18n(document)');
        expect(i18n).toContain("runtime-translations.js?v=20260909-battledata-v1");
        expect(runtime).toContain("runtime-locales/workspace-en.js?v=20260831-master-live-v1");
        expect(runtime).toContain("runtime-locales/workspace-nl.js?v=20260831-master-live-v1");
        expect(runtime).toContain("advanced-stats-locales.js?v=20260830-monthly-trends-v1");
        expect(runtime).toContain("advanced-stats-extra-locales.js?v=20260830-monthly-trends-v1");
        expect(runtime).toContain("advanced-stats-ui-locales.js?v=20260909-battledata-v1");
    });

    it('removes setup and sorting notes from the player-facing page', () => {
        const html = readFileSync('src/subpages/advanced-stats.html', 'utf8');
        expect(html).not.toContain('Imported during setup');
        expect(html).not.toContain('newest first');
        expect(html).not.toContain('battle-log snapshot');
        expect(html).toContain('Last refreshed');
    });

    it('keeps destructive deletion visually separate from stopping future tracking', () => {
        const document = documentFor('src/subpages/advanced-stats.html');
        expect(document.querySelector('#advanced-stats-stop')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-delete')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-delete')?.classList.contains('advanced-stats__danger')).toBe(true);
    });

    it('does not apply stale tracking or statistics responses to newer state', () => {
        const source = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        const loader = readFileSync('src/assets/js/pages/advanced-stats-data-loader.js', 'utf8');
        const trackingRequest = source.indexOf('const tracking = await state.api.getTracking');
        const trackingAssignment = source.indexOf('state.tracking = tracking');

        expect(trackingRequest).toBeGreaterThanOrEqual(0);
        expect(source).toContain('if (version !== state.requestVersion) return;');
        expect(trackingAssignment).toBeGreaterThan(trackingRequest);
        expect(loader).toContain('if (requestVersion !== state.requestVersion) return;');
    });

    it('is discoverable through the central workspace module registry', () => {
        const source = readFileSync('src/assets/js/shell/module-registry.js', 'utf8');
        expect(source).toContain("['advancedStats', 'nav.advancedStats'");
        expect(source).toContain("'/app/advanced-stats'");
        expect(source).toContain("'progress'");
    });

    it('serves the clean private route through the worker', async () => {
        const bindings = {
            CLOUD_RUN_ORIGIN: 'https://backend.example',
            ASSETS: {
                fetch: vi.fn(async request => new Response(
                    `asset:${new URL(request.url).pathname}`,
                    { headers: { 'Content-Type': 'text/html' } }
                ))
            }
        };

        const response = await worker.fetch(
            new Request('https://clashpanel.com/app/advanced-stats'),
            bindings
        );

        expect(await response.text()).toBe('asset:/subpages/advanced-stats');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });
});
