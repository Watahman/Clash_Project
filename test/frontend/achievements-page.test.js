import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Achievements workspace page', () => {
    it('contains an accessible optional import and v2 filter workflow', () => {
        const document = documentFor('src/subpages/achievements.html');

        expect(document.title).toContain('Achievements');
        expect(document.querySelector('meta[name="robots"]')?.content).toContain('noindex');
        expect(document.querySelector('#achievement-account')).not.toBeNull();
        expect(document.querySelector('#achievement-json')).not.toBeNull();
        expect(document.querySelector('#achievement-import-submit')?.getAttribute('type')).toBe('submit');
        expect(document.querySelector('#achievement-search')?.getAttribute('type')).toBe('search');
        expect(document.querySelector('#achievement-source')).not.toBeNull();
        expect(document.querySelector('#achievement-source-list')).not.toBeNull();
        expect(document.querySelector('#achievement-load-more')?.getAttribute('type')).toBe('button');
        expect(document.querySelector('#achievement-import-panel')?.hasAttribute('hidden')).toBe(true);
        expect(document.querySelector('#achievement-import-toggle')?.getAttribute('aria-expanded')).toBe('false');
        expect(document.querySelector('.achievement-import-heading p:last-child')?.textContent)
            .toContain('rest of the achievement library works without this import');
        expect(document.querySelector('#achievement-rarity option[value="uncommon"]')).not.toBeNull();
        expect(document.querySelector('#achievement-rarity option[value="mythic"]')).not.toBeNull();
        expect(document.querySelector('#achievement-status option[value="unknown"]')).not.toBeNull();
        expect([...document.querySelectorAll('button:not([type])')]).toHaveLength(0);
    });

    it('keeps unavailable sources separate from zero progress', () => {
        const source = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(source).toContain("'live_profile'");
        expect(source).toContain("'cwl_history'");
        expect(source).toContain("'raid_history'");
        expect(source).toContain("'legend_history'");
        expect(source).toContain("'clashking_history'");
        expect(source).toContain("'clan_profile'");
        expect(source).toContain("family.state === 'unknown'");
        expect(source).toContain('Waiting for this data source');
    });

    it('uses the v2 XP level formula and hides the dynamic catalog template', () => {
        const source = readFileSync('src/assets/js/achievements/achievement-view-model.js', 'utf8');
        expect(source).toContain('Math.sqrt(xp / 100)');
        expect(source).toContain('100 * (level - 1) ** 2');
        expect(source).toContain("? 'unknown'");
        expect(source).toContain('if (row.catalogTemplate) continue;');
    });

    it('loads expensive CWL history after the fast first render', () => {
        const source = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(source).toContain("getAchievements(tag, { deepHistory: false })");
        expect(source).toContain('void loadDeepHistory(tag, requestId)');
        expect(source).toContain("getAchievements(tag, { deepHistory: true, loading: 'background' })");
    });

    it('paginates the large achievement library instead of mounting every card', () => {
        const source = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(source).toContain('const PAGE_SIZE = 48');
        expect(source).toContain('filtered.slice(0, state.visibleLimit)');
        expect(source).toContain('state.visibleLimit += PAGE_SIZE');
    });

    it('collapses the large import panel after a successful snapshot save', () => {
        const source = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(source).toContain('setImportPanelOpen(false);');
        expect(source).toContain("setStatus(successMessage, 'success');");
    });

    it('is discoverable from the dashboard', () => {
        const document = documentFor('src/subpages/dashboard.html');
        expect(document.querySelector('a[href="/app/achievements"]')).not.toBeNull();
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
            new Request('https://clashpanel.com/app/achievements'),
            bindings
        );

        expect(await response.text()).toBe('asset:/subpages/achievements');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });
});
