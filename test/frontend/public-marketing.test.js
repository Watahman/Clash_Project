import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const publicPages = [
    'src/index.html',
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
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
    'src/subpages/groups.html'
];

const cinematicPages = [
    'src/cwl-planner.html',
    'src/cwl-tracker.html',
    'src/clan-management.html',
    'src/bracket-generator.html',
    'src/about.html'
];

const featurePages = cinematicPages.filter(path => path !== 'src/index.html');

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Public marketing shell', () => {
    it.each(publicPages)('%s keeps the shared public shell', path => {
        const document = documentFor(path);

        expect(document.querySelector('body.public-site')).not.toBeNull();
        expect(document.querySelector('.public-header')).not.toBeNull();
        expect(document.querySelector('.public-footer')).not.toBeNull();
        expect(document.querySelector('script[src*="/assets/js/pages/public-site.js?v=20260812-redesign"]')).not.toBeNull();
    });

    it('keeps the homepage product-led and follows the requested story', () => {
        const document = documentFor('src/index.html');

        expect(document.querySelector('h1')?.textContent.replace(/\s+/g, ' ').trim())
            .toBe('Everything your Clash life needs. One place.');
        expect(document.querySelector('.home3-product-stage')).not.toBeNull();
        expect(document.querySelectorAll('.home3-pillar-grid > a')).toHaveLength(5);
        expect(document.querySelectorAll('.home3-feature')).toHaveLength(3);
        expect(document.querySelector('.home3-ecosystem')).not.toBeNull();
        expect(document.querySelector('.home3-play-progress')).not.toBeNull();
        expect(document.querySelector('.home3-trust')).not.toBeNull();
        expect(document.querySelector('.home3-final')).not.toBeNull();
        expect(document.querySelector('.home-v2-hero-background')).toBeNull();
    });

    it('loads the dedicated connected-product homepage theme', () => {
        const document = documentFor('src/index.html');
        const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map(link => link.getAttribute('href'));

        expect(stylesheets).toContain('/assets/css/public-home-v3.css');
        expect(stylesheets).toContain('/assets/css/public-home-previews.css');
        expect(document.querySelector('body.public-home-v3')).not.toBeNull();
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
});
