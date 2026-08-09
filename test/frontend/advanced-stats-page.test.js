import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

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
        expect(document.querySelector('#advanced-stats-units')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-armies')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-trend-chart')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-battles')).not.toBeNull();
        expect(document.querySelector('#advanced-stats-profile-error')?.hidden).toBe(true);
        expect(document.querySelector('#advanced-stats-profile-retry')?.getAttribute('type')).toBe('button');
        expect([...document.querySelectorAll('button:not([type])')]).toHaveLength(0);
    });

    it('keeps profile errors separate and preserves last-good partial data', () => {
        const source = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        expect(source).toContain("show(elements['advanced-stats-profile-error'], true)");
        expect(source).toContain("show(elements['advanced-stats-no-accounts'], false)");
        expect(source).toContain("addEventListener('click', retryProfileLoad)");
        expect(source).toContain("if (overview.status === 'fulfilled') state.overview = overview.value");
        expect(source).toContain("if (units.status === 'fulfilled') {");
        expect(source).toContain('state.unitCatalog = arrayValue(units.value?.items)');
        expect(source).not.toContain("state.overview = overview.status === 'fulfilled' ? overview.value : null");
        expect(source).not.toContain("setDataStatus('advancedStats.loadingData');\n    state.nextCursor = null;");
        expect(source).toContain("data-load-error");
        expect(source).toContain("advancedStats.partialLoadFailed");
    });

    it('uses translatable and semantic accessibility labels', () => {
        const document = documentFor('src/subpages/advanced-stats.html');
        const trend = document.querySelector('#advanced-stats-trend-chart');
        const unitFilter = document.querySelector('#advanced-stats-unit-category');

        expect(trend?.getAttribute('role')).toBe('img');
        expect(trend?.getAttribute('data-i18n-aria-label')).toBe('advancedStats.trendsTitle');
        expect(unitFilter?.getAttribute('aria-labelledby')).toBe('advanced-stats-units-title');
        expect(document.querySelector('#advanced-stats-page-status')?.getAttribute('aria-live')).toBe('polite');
        expect(document.querySelector('#advanced-stats-data-status')?.getAttribute('aria-live')).toBe('polite');
    });

    it('shows meaningful army names without developer metadata', () => {
        const source = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        expect(source).toContain("import { isPlayerFacingUnitName, presentArmy } from './advanced-stats-army-view.js?v=20260809-4'");
        expect(source).toContain("getAdvancedStatsUnits(state.playerTag, state.period, 'ALL')");
        expect(source).toContain("formatDate(tracking.lastSuccessfulPollAt");
        expect(source).toContain('.filter(item => item.presentation.units.length > 0)');
        expect(source).toContain('isPlayerFacingUnitName(unit?.name || unit?.unitName)');
        expect(source).not.toContain('pieces.push(battle.battleType)');
        expect(source).not.toContain("pieces.push(t('advancedStats.bootstrap'))");
        expect(source).not.toContain("t('advancedStats.unitsCount'");
    });

    it('versions the complete Advanced Stats translation graph', () => {
        const html = readFileSync('src/subpages/advanced-stats.html', 'utf8');
        const bootstrap = readFileSync('src/assets/js/pages/advanced-stats-bootstrap.js', 'utf8');
        const page = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        const i18n = readFileSync('src/assets/js/i18n/i18n.js', 'utf8');
        const runtime = readFileSync('src/assets/js/i18n/runtime-translations.js', 'utf8');

        expect(html).toContain('advanced-stats-bootstrap.js?v=20260809-4');
        expect(html).toContain('workspace-shell.js?v=20260809-4');
        expect(bootstrap).toContain("advanced-stats.js?v=20260809-4");
        expect(page).toContain("i18n/i18n.js?v=20260809-4");
        expect(page).toContain("advanced-stats-army-view.js?v=20260809-4");
        expect(page).toContain('applyI18n(document)');
        expect(i18n).toContain("runtime-translations.js?v=20260809-4");
        expect(runtime).toContain("runtime-locales/workspace-en.js?v=20260809-4");
        expect(runtime).toContain("runtime-locales/workspace-nl.js?v=20260809-4");
        expect(runtime).toContain("advanced-stats-locales.js?v=20260809-4");
        expect(runtime).toContain("advanced-stats-extra-locales.js?v=20260809-4");
        expect(runtime).toContain("advanced-stats-ui-locales.js?v=20260809-4");
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

    it('is discoverable through the workspace navigation installer', () => {
        const source = readFileSync('src/assets/js/shell/advanced-stats-navigation.js', 'utf8');
        expect(source).toContain("const ADVANCED_STATS_PATH = '/app/advanced-stats'");
        expect(source).toContain('data-workspace-nav');
        expect(source).toContain('nav.advancedStats');
        expect(source).toContain('removeAttribute(\'aria-current\')');
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
