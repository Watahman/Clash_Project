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
        expect(document.querySelectorAll('.home3-product-shot > img')).toHaveLength(3);
        expect(document.querySelector('a[href="/advanced-stats"]')).toBeNull();
        expect(document.querySelector('a[href="/achievements"]')).toBeNull();
        expect(document.querySelector('.home3-pillar--coming-soon[aria-disabled="true"]')).not.toBeNull();
        expect(document.querySelectorAll('.home3-progress-card--coming-soon')).toHaveLength(2);
        expect(document.querySelectorAll('.home3-progress-card--coming-soon .workspace-coming-soon-badge')).toHaveLength(2);
        expect(document.querySelectorAll('.home3-progress-card--coming-soon img')).toHaveLength(0);
        expect(document.querySelectorAll('.home3-progress-card--coming-soon .home3-progress-art')).toHaveLength(2);
        expect(document.querySelectorAll('.home3-progress-card--coming-soon .home3-progress-title')).toHaveLength(2);
        expect(document.querySelector('.home3-ecosystem')?.textContent).toMatch(/Advanced Stats[\s\S]*Coming soon[\s\S]*Achievements[\s\S]*Coming soon/i);
        expect(document.querySelector('.home3-lead')?.textContent).toMatch(/Advanced Stats and Achievements are coming soon/i);
        expect(read('src/index.html')).not.toMatch(/previews\/home\/(?:advanced-stats|achievements)\.webp/);
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

    it('labels unreleased progress claims throughout the homepage ecosystem', () => {
        const document = documentFor('src/index.html');
        const ecosystem = document.querySelector('.home3-ecosystem')?.textContent || '';
        const progress = document.querySelector('.home3-progress-showcase')?.textContent || '';

        expect(document.querySelector('.home3-lead')?.textContent)
            .toMatch(/Advanced Stats and Achievements are coming soon/i);
        expect(ecosystem).toMatch(/Advanced Stats[\s\S]*Coming soon[\s\S]*Achievements[\s\S]*Coming soon/i);
        expect(progress).toMatch(/Advanced Stats[\s\S]*Coming soon[\s\S]*Achievements[\s\S]*Coming soon/i);
    });

    it('publishes complete initial legal content without requiring JavaScript', () => {
        const privacy = documentFor('src/subpages/privacy.html').body.textContent;
        const cookies = documentFor('src/subpages/cookies.html').body.textContent;
        const terms = documentFor('src/subpages/terms.html').body.textContent;

        expect(privacy).toMatch(/account|authentication/i);
        expect(privacy).toMatch(/analytics|technical/i);
        expect(privacy).toMatch(/retention|rights|delete|erase/i);
        expect(cookies).toMatch(/essential storage/i);
        expect(cookies).toMatch(/functional storage/i);
        expect(cookies).toMatch(/analytics storage/i);
        expect(cookies).toMatch(/advertising storage/i);
        expect(cookies).toMatch(/guest CWL Planner drafts|bracket state|minigame progress/i);
        expect(terms).toMatch(/unofficial.*not endorsed by Supercell/i);
        expect(terms).toMatch(/misuse|account trading|cheating/i);
        expect(terms).toMatch(/availability|liability|Belgian law|contact/i);
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
        const changedGraphVersion = 'v=20260831-master-live-v1';
        const publicVersion = 'v=20260829-public-auth-v1';
        const publicHeaderVersion = 'v=20260829-public-header-cta-v2';
        const entry = read('src/assets/js/pages/public-site.js');

        expect(read('src/index.html')).toContain(`public-site.js?${changedGraphVersion}`);
        ['contact', 'privacy', 'cookies', 'terms'].forEach(name => {
            const policyPage = read(`src/subpages/${name}.html`);
            expect(policyPage).toContain(`public-site.js?${changedGraphVersion}`);
            expect(policyPage).toContain(`public-policy.js?${changedGraphVersion}`);
        });
        expect(entry).toContain(`i18n.js?${changedGraphVersion}`);
        ['theme-manager.js', 'public-header.js']
            .forEach(file => expect(entry).toContain(`${file}?${publicHeaderVersion}`));
        expect(entry).toContain('public-resource-pages.js?v=20260829-public-auth-v1');
        expect(read('src/assets/js/i18n/i18n.js')).toContain(`runtime-translations.js?${changedGraphVersion}`);
        expect(read('src/assets/js/i18n/runtime-translations.js')).toContain(`public-resource-locales.js?${changedGraphVersion}`);
        const resources = read('src/assets/js/i18n/public-resource-locales.js');
        expect(resources).toContain(`public-home-v3-locales.js?${changedGraphVersion}`);
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

    it('uses one current lower capture for Planner and Clan Family', () => {
        const captures = [
            ['src/cwl-planner.html', '/assets/previews/home/cwl-auto-plan.jpg?v=20260830-authentic'],
            ['src/clan-management.html', '/assets/previews/home/clan-family.webp?v=20260821-authentic']
        ];

        captures.forEach(([path, source]) => {
            const document = documentFor(path);
            const capturesOnPage = document.querySelectorAll('main img[src*="/assets/previews/home/"]');

            expect(capturesOnPage).toHaveLength(1);
            expect(document.querySelector(`.cp-detail-section img[src="${source}"]`)).not.toBeNull();
            expect(document.querySelector('.cp-feature-hero img[src*="/assets/previews/home/"]')).toBeNull();
            expect(document.querySelector('.home-v2-products img[src*="/assets/previews/home/"]')).toBeNull();
        });
    });
});
