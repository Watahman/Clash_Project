import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(path, 'utf8');
const dom = path => new JSDOM(read(path)).window.document;
const aboutMarkers = ['aboutPage.independent.f1.title', 'resource-page'];
const capturePages = [
    ['src/cwl-planner.html', '/assets/previews/home/cwl-auto-plan.jpg?v=20260830-authentic'],
    ['src/clan-management.html', '/assets/previews/home/clan-family.webp?v=20260821-authentic']
];
const textOnlyPages = ['src/cwl-tracker.html', 'src/bracket-generator.html'];
const captureSelector = 'img[src*="/assets/previews/home/"]';

describe('public resources redesign surfaces', () => {
    it.each([...capturePages, ...textOnlyPages.map(path => [path])])('%s keeps the public feature structure', (path, capture) => {
        const document = dom(path);

        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.querySelector('.cp-feature-hero.cp-hero-background')).not.toBeNull();
        expect(document.querySelector('link[href*="public-feature-hero-backgrounds.css"]')).not.toBeNull();
        if (capture) expect(document.querySelector(`.cp-detail-section ${captureSelector}`)?.getAttribute('src')).toBe(capture);
    });

    it.each(capturePages)('%s uses exactly one lower actual capture', (path, capture) => {
        const document = dom(path);

        expect(document.querySelectorAll(`main ${captureSelector}`)).toHaveLength(1);
        expect(document.querySelector(`.cp-detail-section ${captureSelector}`)?.getAttribute('src')).toBe(capture);
        expect(document.querySelector(`.cp-feature-hero ${captureSelector}`)).toBeNull();
        expect(document.querySelector(`.home-v2-products ${captureSelector}`)).toBeNull();
        expect(document.querySelector('.cp-detail-section figcaption')?.textContent)
            .toMatch(/controlled (?:fixture|sample) data.*not live/i);
    });

    it.each(textOnlyPages)('%s has no fake product preview or sample table', path => {
        const source = read(path);
        const document = dom(path);

        expect(document.querySelectorAll(`${captureSelector}, .cp-product-preview, .cp-screenshot-sample, .sample-panel, table`)).toHaveLength(0);
        expect(document.querySelector('.cp-feature-hero.cp-hero-background')).not.toBeNull();
        expect(source).not.toMatch(/public-feature-previews\.js|data-preview-copy|sample(?: data| table)/i);
    });

    it('keeps the Planner capture current and clearly labelled', async () => {
        const planner = dom('src/cwl-planner.html');
        const capturePath = 'src/assets/previews/home/cwl-auto-plan.jpg';
        const metadata = await sharp(capturePath).metadata();

        expect(planner.querySelector('.cp-detail-section img[src="/assets/previews/home/cwl-auto-plan.jpg?v=20260830-authentic"][width="1162"][height="711"]')).not.toBeNull();
        expect(readFileSync(capturePath).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
        expect(metadata).toMatchObject({ format: 'jpeg', width: 1162, height: 711 });
    });

    it('keeps About identity artwork while retaining its product/document preview', () => {
        const source = read('src/about.html');
        aboutMarkers.forEach(marker => expect(source).toContain(marker));
        expect(source).toMatch(/pictures\/public-pages\//);
        expect(dom('src/about.html').querySelectorAll('.home-v2-artwork img').length).toBeGreaterThan(0);
        expect(dom('src/about.html').querySelectorAll('h1')).toHaveLength(1);
    });

    it('keeps the released games and bracket actions discoverable', () => {
        const games = dom('src/minigames.html');
        expect(games.querySelectorAll('[data-minigame-select]')).toHaveLength(2);
        expect(games.querySelectorAll('[data-hub-i18n="playNow"]')).toHaveLength(2);
        expect(read('src/minigames.html')).toContain('"@type":"Game"');

        const bracket = dom('src/bracket-generator.html');
        expect(bracket.querySelector('meta[name="robots"]')?.content).toMatch(/\bindex\b/);
        expect(bracket.querySelector('.bracket-public-preview')).toBeNull();
        expect(bracket.querySelector('.home-v2-workflow')).not.toBeNull();
        expect(bracket.querySelector('.home-v2-products')).not.toBeNull();
        expect(bracket.querySelector('.home-v2-bottom-cta')).not.toBeNull();
        expect(bracket.querySelector('.cp-feature-hero.cp-hero-background--bracket')).not.toBeNull();
        expect(bracket.querySelectorAll('.cp-product-preview, .sample-panel, table')).toHaveLength(0);
        expect(read('src/sitemap.xml')).toContain('/minigames');
        expect(read('src/sitemap.xml')).toContain('https://clashpanel.com/bracket-generator');
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
