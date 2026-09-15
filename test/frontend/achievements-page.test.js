import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Achievements workspace page', () => {
    it('contains an accessible optional import and secondary detail filter workflow', () => {
        const document = documentFor('src/subpages/achievements.html');

        expect(document.title).toContain('Achievements');
        expect(document.querySelector('meta[name="robots"]')?.content).toContain('noindex');
        expect(document.querySelector('#achievement-account')).not.toBeNull();
        expect(document.querySelector('#achievement-json')).not.toBeNull();
        expect(document.querySelector('#achievement-import-submit')?.getAttribute('type')).toBe('submit');
        expect(document.querySelector('#achievement-search')?.getAttribute('type')).toBe('search');
        expect(document.querySelector('#achievement-source')).toBeNull();
        expect(document.querySelector('#achievement-category')).toBeNull();
        expect(document.querySelector('#achievement-source-list')).not.toBeNull();
        expect(document.querySelector('#achievement-load-more')).toBeNull();
        expect(document.querySelector('#achievement-grid.achievement-hub-grid')).not.toBeNull();
        expect(document.querySelector('#achievement-filter-dialog')?.hasAttribute('hidden')).toBe(true);
        expect(document.querySelector('#achievement-filter-dialog')?.tagName).toBe('DETAILS');
        expect(document.querySelector('#achievement-filter-dialog')?.hasAttribute('open')).toBe(false);
        expect(document.querySelector('#achievement-sources-panel')?.hasAttribute('open')).toBe(false);
        expect(document.querySelector('#achievement-results-count')?.hasAttribute('hidden')).toBe(true);
        expect(document.querySelector('#achievement-import-panel')?.hasAttribute('hidden')).toBe(true);
        expect(document.querySelector('#achievement-import-toggle')?.getAttribute('aria-expanded')).toBe('false');
        expect(document.querySelector('.achievement-import-heading p:last-child')?.textContent)
            .toContain('rest of the achievement library works without this import');
        expect(document.querySelector('#achievement-rarity option[value="uncommon"]')).not.toBeNull();
        expect(document.querySelector('#achievement-rarity option[value="mythic"]')).not.toBeNull();
        expect(document.querySelector('#achievement-status option[value="unknown"]')).not.toBeNull();
        expect([...document.querySelectorAll('button:not([type])')]).toHaveLength(0);
    });

    it('keeps the unreleased workspace behind the Coming Soon route guard', () => {
        const source = readFileSync('src/subpages/achievements.html', 'utf8');
        const document = documentFor('src/subpages/achievements.html');

        expect(source).toContain("window.location.replace('/dashboard')");
        expect(document.title).toContain('Coming soon');
        expect(document.querySelector('.workspace-coming-soon-badge')).not.toBeNull();
    });

    it('keeps unavailable sources separate from zero progress', () => {
        const source = `${readFileSync('src/assets/js/pages/achievements-renderer.js', 'utf8')}\n${readFileSync('src/assets/js/pages/achievement-chronicle-renderer.js', 'utf8')}`;
        expect(source).toContain("'live_profile'");
        expect(source).toContain("'cwl_history'");
        expect(source).toContain("'raid_history'");
        expect(source).toContain("'legend_history'");
        expect(source).toContain("'clashking_history'");
        expect(source).toContain("'clan_profile'");
        expect(source).toContain('!family?.sourceAvailable');
        expect(source).toContain('Waiting for this data source');
    });

    it('presents a trophy wall and keeps connectors inside real progression families', () => {
        const document = documentFor('src/subpages/achievements.html');
        const hubRenderer = readFileSync('src/assets/js/pages/achievement-hub-renderer.js', 'utf8');
        const detailRenderer = readFileSync('src/assets/js/pages/achievement-category-renderer.js', 'utf8');

        expect(document.querySelector('#achievement-grid.achievement-hub-grid')).not.toBeNull();
        expect(document.querySelector('#achievement-hub-summary')).not.toBeNull();
        expect(hubRenderer).toContain('dataset.achievementCategory');
        expect(hubRenderer).toContain('achievement-trophy-panel');
        expect(detailRenderer).toContain('achievement-medal-rail');
        expect(detailRenderer).toContain('tiers.forEach');
        expect(detailRenderer).not.toContain('achievement-map-track');
        expect(detailRenderer).not.toContain('buildChronicleBranches');
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

    it('connects the summary renderer refs to the page controls', () => {
        const source = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(source).toContain("summaryLevel: '#achievement-level'");
        expect(source).toContain("summaryLevelProgress: '#achievement-level-progress'");
        expect(source).toContain("summaryXp: '#achievement-total-xp'");
        expect(source).toContain("summaryImported: '#achievement-last-import'");
    });

    it('opens category details through URL state instead of loading more in place', () => {
        const source = `${readFileSync('src/assets/js/pages/achievements.js', 'utf8')}\n${readFileSync('src/assets/js/pages/achievements-renderer.js', 'utf8')}`;
        expect(source).toContain("url.searchParams.set('category', category)");
        expect(source).toContain("closest('[data-achievement-category]')");
        expect(source).toContain("closest('[data-achievement-back]')");
        expect(source).toContain("window.addEventListener('popstate', handlePopState)");
        expect(source).not.toContain('visibleLimit');
    });

    it('collapses the large import panel after a successful snapshot save', () => {
        const source = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(source).toContain('setImportPanelOpen(false);');
        expect(source).toContain("setStatus(successMessage, 'success');");
    });

    it('is discoverable from the central Progress navigation and Explore', () => {
        const registry = readFileSync('src/assets/js/shell/module-registry.js', 'utf8');
        const explore = readFileSync('src/assets/js/pages/explore.js', 'utf8');
        expect(registry).toContain("['achievements', 'nav.achievements', 'Achievements', 'progress'");
        expect(explore).toContain('WORKSPACE_MODULES.filter');
        expect(explore).toContain("!['dashboard', 'explore'].includes(module.id)");
    });

    it('blocks the clean private route through the worker', async () => {
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

        expect(response.status).toBe(301);
        expect(response.headers.get('Location')).toBe('https://clashpanel.com/dashboard');
        expect(bindings.ASSETS.fetch).not.toHaveBeenCalled();
    });
});
