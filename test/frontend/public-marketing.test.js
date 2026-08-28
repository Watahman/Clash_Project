import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { publicHomeV3Locales } from '../../src/assets/js/i18n/public-home-v3-locales.js';

const publicPages = [
    'src/index.html',
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    'src/advanced-stats.html',
    'src/achievements.html',
    'src/bracket-generator.html',
    'src/about.html',
    'src/subpages/contact.html',
    'src/subpages/privacy.html',
    'src/subpages/cookies.html',
    'src/subpages/terms.html'
];

const applicationPages = [
    'src/subpages/dashboard.html',
    'src/subpages/cwl-planner.html',
    'src/subpages/cwl-operation-board.html',
    'src/subpages/groups.html',
    'src/subpages/advanced-stats.html',
    'src/subpages/achievements.html'
];

const cinematicPages = [
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    'src/bracket-generator.html',
    'src/about.html'
];

const featurePages = cinematicPages.filter(path => path !== 'src/index.html');

const read = path => readFileSync(path, 'utf8');
const documentFor = path => new JSDOM(read(path)).window.document;

describe('Public marketing shell', () => {
    it.each(publicPages)('%s keeps the shared public shell', path => {
        const document = documentFor(path);

        expect(document.querySelector('body.public-site')).not.toBeNull();
        expect(document.querySelector('.public-header')).not.toBeNull();
        expect(document.querySelector('.public-footer')).not.toBeNull();
        expect(document.querySelector('script[src*="/assets/js/pages/public-site.js?v="]')).not.toBeNull();
    });

    it('keeps the homepage product-led and follows the requested story', () => {
        const document = documentFor('src/index.html');

        expect(document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim())
            .toBe('Clash of Clans tools for CWL planning and clan management');
        expect(document.querySelector('.home3-product-stage')).toBeNull();
        expect(document.querySelectorAll('.home3-pillar-grid > a')).toHaveLength(5);
        expect(document.querySelectorAll('.home3-feature')).toHaveLength(3);
        expect(document.querySelector('.home3-ecosystem')).not.toBeNull();
        expect(document.querySelectorAll('.home3-flow > li')).toHaveLength(6);
        expect(document.querySelector('.home3-progress-showcase')).not.toBeNull();
        expect(document.querySelectorAll('.home3-product-shot > img')).toHaveLength(5);
        expect(document.querySelector('a[href="/advanced-stats"]')).toBeNull();
        expect(document.querySelector('a[href="/achievements"]')).toBeNull();
        expect(document.querySelector('.home3-pillar--coming-soon[aria-disabled="true"]')).not.toBeNull();
        expect(document.querySelectorAll('.home3-progress-card--coming-soon')).toHaveLength(2);
        expect(document.querySelectorAll('.home3-progress-card--coming-soon .workspace-coming-soon-badge')).toHaveLength(2);
        expect(document.querySelector('.home3-feature-photo')).toBeNull();
        expect(document.querySelector('.home3-trust')).not.toBeNull();
        expect(document.querySelector('.home3-final')).not.toBeNull();
        expect(document.querySelector('.home-v2-hero-background')).toBeNull();
    });

    it('links the homepage to the public bracket generator', () => {
        const document = documentFor('src/index.html');

        expect(document.querySelector('a[href="/bracket-generator"]')).not.toBeNull();
        expect(document.querySelector('a[href="/cwl-tracker"]')).not.toBeNull();
    });

    it('keeps public feature CTAs on the permanent application routes', () => {
        const tracker = documentFor('src/cwl-tracker.html');
        const family = documentFor('src/clan-management.html');

        expect(tracker.querySelectorAll('a[href="/app/cwl-tracker"]')).toHaveLength(2);
        expect(tracker.querySelector('a[href="/app/cwl-operation-board"]')).toBeNull();
        expect(family.querySelectorAll('a[href="/app/clan-management"]')).toHaveLength(2);
        expect(family.querySelector('a[href="/app/groups"]')).toBeNull();
    });

    it('keeps the homepage H1 specific across supported languages', () => {
        const titles = {
            en: 'Clash of Clans tools for CWL planning and clan management',
            nl: 'Clash of Clans-tools voor CWL-planning en clanbeheer',
            fr: 'Outils Clash of Clans pour planifier la CWL et gérer votre clan',
            de: 'Clash of Clans-Tools für CWL-Planung und Clanverwaltung',
            es: 'Herramientas de Clash of Clans para planificar CWL y gestionar tu clan'
        };

        Object.entries(titles).forEach(([language, title]) => {
            expect(publicHomeV3Locales[language]['homeV3.title']).toBe(title);
        });
    });

    it('loads the dedicated connected-product homepage theme', () => {
        const document = documentFor('src/index.html');
        const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map(link => link.getAttribute('href'));

        expect(stylesheets).toContain('/assets/css/public-home-v3.css?v=20260821-authentic-home');
        expect(stylesheets).toContain('/assets/css/public-home-previews.css?v=20260821-authentic-home');
        expect(stylesheets).toContain('/assets/css/public-home-showcase.css?v=20260821-product-home');
        expect(document.querySelector('body.public-home-v3')).not.toBeNull();
    });

    it('keeps homepage SVG icons readable in both themes', () => {
        const css = read('src/assets/css/public-home-previews.css');

        expect(css).toContain('.public-home-v3 main img[src*="/assets/icons/"]');
        expect(css).toContain('brightness(0) saturate(100%)');
        expect(css).toContain('invert(1)');
    });

    it('cache-busts the complete changed public module graph', () => {
        const productVersion = 'v=20260821-product-home';
        const translationsVersion = 'v=20260823-achievement-card-assets-1';
        const publicVersion = 'v=20260828-seo-final';
        const entry = read('src/assets/js/pages/public-site.js');

        expect(entry).toContain(`i18n.js?${publicVersion}`);
        ['theme-manager.js', 'public-header.js']
            .forEach(file => expect(entry).toContain(`${file}?${publicVersion}`));
        expect(entry).toContain('public-resource-pages.js?v=20260821-authentic-pages');
        expect(read('src/assets/js/i18n/i18n.js')).toContain(`runtime-translations.js?${translationsVersion}`);
        expect(read('src/assets/js/i18n/runtime-translations.js')).toContain(`public-resource-locales.js?${productVersion}`);
        const resources = read('src/assets/js/i18n/public-resource-locales.js');
        expect(resources).toContain(`public-home-v3-locales.js?${productVersion}`);
        expect(resources).toContain(`public-home-v3-micro-locales.js?${productVersion}`);
        expect(resources).toContain(`public-feature-extra-locales.js?${productVersion}`);
    });

    it('reveals hero previews on load before observing lower-page content', () => {
        const entry = read('src/assets/js/pages/public-site.js');

        expect(entry).toContain("item.closest('.home3-hero')");
        expect(entry).toContain('heroItems.forEach(item => item.classList.add(\'is-visible\'))');
        expect(entry).toContain('scrollItems.forEach(item => observer.observe(item))');
    });

    it.each(cinematicPages)('%s loads the approved cinematic public theme', path => {
        const document = documentFor(path);
        const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map(link => link.getAttribute('href'));

        expect(stylesheets).toContain('/assets/css/public-home-v2.css');
        expect(document.querySelector('body.public-home-v2')).not.toBeNull();
    });

    it.each(featurePages)('%s explains the feature with workflow, detail and a CTA', path => {
        const document = documentFor(path);

        expect(document.querySelector('.feature-v2-workflow')).not.toBeNull();
        expect(document.querySelector('.home-v2-products')).not.toBeNull();
        expect(document.querySelector('.home-v2-bottom-cta')).not.toBeNull();
    });

    it.each(applicationPages)('%s does not load the public redesign', path => {
        const document = documentFor(path);
        const publicStylesheet = document.querySelector(
            'link[href="/assets/css/public-marketing.css"]'
        );
        const cinematicStylesheet = document.querySelector(
            'link[href="/assets/css/public-home-v2.css"]'
        );

        expect(publicStylesheet).toBeNull();
        expect(cinematicStylesheet).toBeNull();
    });

    it('scopes the design system to public pages', () => {
        const css = readFileSync('src/assets/css/public-marketing.css', 'utf8');

        expect(css).toContain('body.public-site');
        expect(css).not.toContain('body.workspace-app');
    });

    it('uses a real Planner capture instead of an invented public roster table', () => {
        const planner = documentFor('src/cwl-planner.html');
        const localized = read('src/assets/js/i18n/public-feature-extra-locales.js');

        expect(planner.querySelector('.cp-screenshot-sample img[src="/assets/previews/home/cwl-planner.webp?v=20260821-authentic"]')).not.toBeNull();
        expect(planner.querySelector('.resource-page .sample-panel table')).toBeNull();
        expect(localized).not.toMatch(/Sample North|Voorbeeld Noord|Exemple Nord|Beispiel Nord|Ejemplo Norte/);
        expect(localized.match(/cp-screenshot-sample/g)).toHaveLength(5);
    });
});
