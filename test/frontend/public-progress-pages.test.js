import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const progressPages = new Map([
    ['src/advanced-stats.html', 'https://clashpanel.com/advanced-stats'],
    ['src/achievements.html', 'https://clashpanel.com/achievements']
]);
const featurePages = [
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    ...progressPages.keys()
];

const read = path => readFileSync(path, 'utf8');
const documentFor = path => new JSDOM(read(path)).window.document;
const privateScriptPattern = /(?:supabase|\/api\/|auth-client|\/auth\/)/i;
const playerIdentityPattern = /\b(?:playerTag|clanTag|playerName|clanName)\b|#[0289PYLQGRJCUV]{6,}/i;

describe('Public progress page contracts', () => {
    it.each([...progressPages])('%s is indexable with one canonical H1', (path, canonical) => {
        const document = documentFor(path);

        expect(document.querySelector('meta[name="robots"]')?.content).toMatch(/^index,\s*follow$/i);
        expect(document.querySelector('link[rel="canonical"]')?.href).toBe(canonical);
        expect(document.querySelectorAll('h1')).toHaveLength(1);
    });

    it.each([...progressPages])('%s labels controlled values as non-live public content', path => {
        const document = documentFor(path);
        const labels = [...document.querySelectorAll('.sample-label, .pp-sample-badge, .pp-privacy-note, .pp-callout')]
            .map(element => element.textContent)
            .join(' ');

        expect(labels).toMatch(/(?:controlled sample|illustrative preview|read-only preview)/i);
        expect(labels).toMatch(/(?:not live|not personal progress|private progress)/i);
    });

    it.each([...progressPages])('%s has no private API, Supabase or auth script', path => {
        const document = documentFor(path);
        const scripts = [...document.querySelectorAll('script[src]')]
            .map(script => script.getAttribute('src') || '');

        expect(scripts).not.toEqual(expect.arrayContaining([
            expect.stringMatching(privateScriptPattern)
        ]));
        expect(read(path)).not.toContain('Data/ads.js');
        expect(read(path)).not.toMatch(/pagead2\.googlesyndication\.com|googletagmanager\.com\/gtag/i);
    });

    it.each([...progressPages])('%s does not expose player tags or names in its public fixture', path => {
        const source = read(path);
        const document = documentFor(path);

        expect(source).not.toMatch(playerIdentityPattern);
        expect(document.querySelectorAll('[data-player-tag], [data-clan-tag], [data-player-name], [data-clan-name]'))
            .toHaveLength(0);
    });

    it('keeps Advanced Stats as a product-led read-only preview', () => {
        const document = documentFor('src/advanced-stats.html');
        const source = read('src/advanced-stats.html');

        expect(document.querySelector('.pp-dashboard-preview')).not.toBeNull();
        expect(document.querySelectorAll('.pp-panel')).toHaveLength(4);
        expect(document.querySelectorAll('[data-stat-period]')).toHaveLength(2);
        expect(document.querySelectorAll('form, input, textarea, [contenteditable="true"]')).toHaveLength(0);
        expect(document.body.textContent).toMatch(/opts? in to tracking/i);
        expect(document.body.textContent).toMatch(/incomplete history|missing history/i);
        expect(source).toContain('2.80');
        expect(source).toContain('80%');
        expect(source).toContain('91%');
        expect(source).not.toMatch(/2\.72|72\.2%|88\.4%/);
        expect(source).toContain('canonical 20-battle fixture');
        expect(source).toContain('separate illustrative trend sample');
    });

    it('keeps Achievements browseable with filters and personal progress private', () => {
        const document = documentFor('src/achievements.html');
        const bodyText = document.body.textContent;

        expect(document.querySelector('.pp-dashboard-preview')).not.toBeNull();
        expect(document.querySelectorAll('select[data-achievement-filter]')).toHaveLength(2);
        expect(document.querySelector('[data-achievement-filter="category"]')).not.toBeNull();
        expect(document.querySelector('[data-achievement-filter="rarity"]')).not.toBeNull();
        expect(document.querySelectorAll('.pp-achievement-card')).toHaveLength(8);
        expect(document.querySelector('[data-achievement-empty]')).not.toBeNull();
        expect(document.querySelector('[data-achievement-count]')).not.toBeNull();
        expect(bodyText).toContain('340 catalog families');
        expect(bodyText).toContain('1,331 fixed tiers');
        expect(bodyText).toContain('Town Hall Trailblazer');
        expect(bodyText).toContain('CWL Veteran');
        expect(document.querySelectorAll('form, input, textarea, [contenteditable="true"]')).toHaveLength(0);
        expect(bodyText).toMatch(/read-only catalog/i);
        expect(bodyText).toMatch(/personal progress/i);
        expect(bodyText).toMatch(/signed-in private workspace/i);
    });

    it('keeps the public progress runtime filter and trend hooks present', () => {
        const source = read('src/assets/js/pages/public-progress-pages.js');

        expect(source).toContain("data-achievement-filter");
        expect(source).toContain("card.dataset[key] === value");
        expect(source).toContain("canonicalStars");
        expect(source).toContain("window.dispatchEvent(new CustomEvent('clashtools:public-progress-updated'))");
    });

    it('covers the five-locale public demo module and feature-page navigation state', () => {
        const localeSource = read('src/assets/js/i18n/public-progress-locales.js');

        ['en', 'nl', 'fr', 'de', 'es'].forEach(language => {
            expect(localeSource).toMatch(new RegExp(`\\b${language}\\b`));
        });
        expect(localeSource).toContain('stats.title');
        expect(localeSource).toContain('ach.catalogTitle');
        expect(localeSource).toContain('sample.plannerTitle');
        expect(localeSource).toContain('sample.trackerTitle');
        expect(localeSource).toContain('sample.familyTitle');
        featurePages.forEach(path => {
            const document = documentFor(path);
            expect(document.querySelector('script[src*="public-progress-locales.js"]')).not.toBeNull();
            expect(document.querySelector('nav a[href="/#features"][aria-current="page"]')).toBeNull();
        });
    });

    it('keeps public product previews visible in both themes without glow styling', () => {
        const previewCss = read('src/assets/css/public-feature-previews.css');
        const progressCss = read('src/assets/css/public-progress-pages.css');

        expect(previewCss).toMatch(/\.cp-product-preview\s*\{[\s\S]*?margin:\s*0;/);
        expect(progressCss).toMatch(/:root:not\(\[data-theme="light"\]\)[\s\S]*?\.pp-achievement-icon img/);
        expect(progressCss).not.toMatch(/\.pp-achievement-icon[^}]*box-shadow/);
        expect(progressCss).not.toMatch(/\.pp-achievement-icon img[^}]*drop-shadow/);
    });
});
