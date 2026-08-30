import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { publicFeatureExtraLocales } from '../../src/assets/js/i18n/public-feature-extra-locales.js';

const read = path => readFileSync(path, 'utf8');
const dom = path => new JSDOM(read(path)).window.document;
const aboutMarkers = ['aboutPage.independent.f1.title', 'resource-page'];
const familyCaptureLabels = {
    en: 'ClashPanel interface — controlled fixture data — not live',
    nl: 'ClashPanel-interface — gecontroleerde fixturedata — niet live',
    fr: 'Interface ClashPanel — données de fixture contrôlées — non en direct',
    de: 'ClashPanel-Oberfläche — kontrollierte Fixture-Daten — nicht live',
    es: 'Interfaz de ClashPanel — datos de fixture controlados — no en directo'
};

describe('public resources redesign surfaces', () => {
    it.each([
        ['src/cwl-planner.html', ['cp-screenshot-sample']],
        ['src/cwl-tracker.html', ['cp-preview-score', 'tracker.liveStep', 'tracker.standings']],
        ['src/clan-management.html', ['sample-panel']]
    ])('%s keeps an approved product/document preview', (path, markers) => {
        const source = read(path);
        markers.forEach(marker => expect(source).toContain(marker));
        expect(source).not.toMatch(/pictures\/(?:public-pages|home)\//);
        expect(dom(path).querySelectorAll('h1')).toHaveLength(1);
    });

    it.each(['src/cwl-planner.html', 'src/clan-management.html'])('%s omits removed fake feature previews', path => {
        const source = read(path);
        const document = dom(path);

        expect(document.querySelector('.cp-product-preview')).toBeNull();
        expect(document.querySelector('.cp-review')).toBeNull();
        expect(source).not.toMatch(/data-preview-copy="(?:planner|family)\./);
    });

    it('uses the authentic Clan Family capture in every localized sample', () => {
        const family = dom('src/clan-management.html');
        const capture = family.querySelector('.cp-screenshot-sample img[src="/assets/previews/home/clan-family.webp?v=20260821-authentic"]');
        const caption = capture?.closest('.sample-panel')?.querySelector('.sample-label')?.textContent || '';
        const bindings = read('src/assets/js/pages/public-page-bindings.js');

        expect(capture).not.toBeNull();
        expect(caption).toMatch(/controlled (?:fixture|sample) data.*not live/i);
        expect(family.querySelector('.sample-panel table')).toBeNull();
        expect(bindings).toContain('family-capture-title');
        expect(bindings).not.toContain('family-sample-title');

        Object.entries(familyCaptureLabels).forEach(([language, label]) => {
            const sample = publicFeatureExtraLocales[language]['feature.family.sampleHtml'];

            expect(sample).toContain('/assets/previews/home/clan-family.webp?v=20260821-authentic');
            expect(sample).toContain('class="sample-panel cp-screenshot-sample"');
            expect(sample).toContain(`class="sample-label">${label}</span>`);
            expect(sample).not.toContain('<table');
            expect(sample).not.toMatch(/Planner handoff|Overdracht naar Planner|Transfert vers le Planner|Planner-Übergabe|Transferencia al Planner/i);
        });
    });

    it('describes the localized Planner sample as a capture, not an interactive interface', async () => {
        const planner = dom('src/cwl-planner.html');
        const capturePath = 'src/assets/previews/home/cwl-auto-plan.jpg';
        const metadata = await sharp(capturePath).metadata();

        expect(planner.querySelector('.cp-detail-section img[src="/assets/previews/home/cwl-auto-plan.jpg?v=20260830-authentic"][width="1162"][height="711"]')).not.toBeNull();
        expect(readFileSync(capturePath).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
        expect(metadata).toMatchObject({ format: 'jpeg', width: 1162, height: 711 });
        Object.values(publicFeatureExtraLocales).forEach(copy => {
            const sample = copy['feature.planner.sampleHtml'];

            expect(sample).toContain('/assets/previews/home/cwl-planner.webp?v=20260821-authentic');
            expect(sample).not.toMatch(/interact/i);
        });
    });

    it('keeps Tracker preview copy active after removing Planner and Family copy', () => {
        const tracker = dom('src/cwl-tracker.html');
        const copy = read('src/assets/js/pages/public-feature-previews.js');

        expect(tracker.querySelectorAll('.cp-product-preview')).toHaveLength(2);
        expect(tracker.querySelector('[data-preview-copy="tracker.chrome"]')).not.toBeNull();
        expect(copy).toContain("'tracker.chrome'");
        expect(copy).not.toContain("'planner.chrome'");
        expect(copy).not.toContain("'family.chrome'");
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
        expect(bracket.querySelector('.bracket-public-preview')).not.toBeNull();
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
