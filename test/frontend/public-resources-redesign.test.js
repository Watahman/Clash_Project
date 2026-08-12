import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(path, 'utf8');
const dom = path => new JSDOM(read(path)).window.document;

describe('public resources redesign surfaces', () => {
    it.each([
        ['src/cwl-planner.html', ['cp-preview-planner', 'planner.playerPool', 'planner.reviewTitle']],
        ['src/cwl-tracker.html', ['cp-preview-score', 'tracker.liveStep', 'tracker.standings']],
        ['src/clan-management.html', ['cp-preview-family', 'family.network', 'family.planner']],
        ['src/about.html', ['aboutPage.independent.f1.title', 'resource-page']]
    ])('%s keeps a genuine product/document preview', (path, markers) => {
        const source = read(path);
        markers.forEach(marker => expect(source).toContain(marker));
        expect(source).not.toMatch(/pictures\/(?:public-pages|home)\//);
        expect(dom(path).querySelectorAll('h1')).toHaveLength(1);
    });

    it('keeps the released games and bracket actions discoverable', () => {
        const games = dom('src/minigames.html');
        expect(games.querySelectorAll('[data-minigame-select]')).toHaveLength(2);
        expect(games.querySelectorAll('[data-hub-i18n="playNow"]')).toHaveLength(2);
        expect(read('src/minigames.html')).toContain('"@type":"Game"');

        const bracket = dom('src/bracket-generator.html');
        expect(bracket.querySelector('meta[name="robots"]')?.content).toMatch(/noindex/);
        expect(bracket.querySelector('.bracket-public-preview')).not.toBeNull();
        expect(read('src/sitemap.xml')).toContain('/minigames');
        expect(read('src/sitemap.xml')).not.toContain('/bracket-generator');
    });

    it('sets readable document measures and maintains localized methodology metadata', () => {
        const resources = read('src/assets/css/public-resources.css');
        const legal = read('src/assets/css/public-info.css');
        expect(resources).toContain('max-width: 45rem');
        expect(resources).toContain('font-size: 1.0625rem');
        expect(resources).toContain('line-height: 1.75');
        expect(legal).toContain('grid-template-columns: minmax(0, 13.75rem) minmax(0, 47.5rem)');
        expect(legal).toContain('font-size: 1.0625rem');
        expect(read('src/assets/js/i18n/public-static-locales.js')).toContain('Maintained 12 August 2026');
        expect(read('src/assets/js/pages/public-resource-pages.js')).toContain('changelog-module-badges');
    });
});
