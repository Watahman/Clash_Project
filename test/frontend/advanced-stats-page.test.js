import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Advanced Stats workspace page', () => {
    it('contains the private tracking and analysis workflow', () => {
        const document = documentFor('src/subpages/advanced-stats.html');

        expect(document.title).toContain('Advanced Stats');
        expect(document.querySelector('meta[name="robots"]')?.content).toContain('noindex');
        expect(document.body.dataset.workspacePage).toBe('advancedStats');
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
        expect([...document.querySelectorAll('button:not([type])')]).toHaveLength(0);
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

    it('keeps dynamic army summaries localized', () => {
        const source = readFileSync('src/assets/js/pages/advanced-stats.js', 'utf8');
        expect(source).toContain("t('advancedStats.unitsCount'");
        expect(source).toContain("CLAN_CASTLE_TROOP: 'advancedStats.categoryClanCastleTroops'");
        expect(source).toContain("CLAN_CASTLE_SPELL: 'advancedStats.categoryClanCastleSpells'");
        expect(source).not.toContain('${formatNumber(units.length)} units');
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
