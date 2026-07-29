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

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Public marketing shell', () => {
    it.each(publicPages)('%s uses the isolated public design system', path => {
        const document = documentFor(path);
        const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map(link => link.getAttribute('href'));

        expect(stylesheets).toContain('/assets/css/public-marketing.css');
        expect(stylesheets).not.toContain('/assets/css/public-home-v2.css');
        expect(stylesheets).not.toContain('/assets/css/public-tool-page.css');
        expect(document.querySelector('body.public-site')).not.toBeNull();
        expect(document.querySelector('.public-header')).not.toBeNull();
        expect(document.querySelector('.public-footer')).not.toBeNull();
        expect(document.querySelector('script[src="/assets/js/pages/public-site.js"]')).not.toBeNull();
    });

    it('keeps the homepage product-led and follows the requested story', () => {
        const document = documentFor('src/index.html');

        expect(document.querySelector('h1')?.textContent.trim())
            .toBe('Plan CWL without the spreadsheet chaos.');
        expect(document.querySelector('#product-preview')).not.toBeNull();
        expect(document.querySelector('[data-section="problem-solution"]')).not.toBeNull();
        expect(document.querySelectorAll('[data-workflow]')).toHaveLength(3);
        expect(document.querySelector('[data-section="how-it-works"]')).not.toBeNull();
        expect(document.querySelector('[data-section="other-tools"]')).not.toBeNull();
        expect(document.querySelector('[data-section="final-cta"]')).not.toBeNull();
    });

    it.each([
        'src/cwl-planner.html',
        'src/cwl-tracker.html',
        'src/clan-management.html'
    ])('%s explains the feature with a preview, capabilities and a CTA', path => {
        const document = documentFor(path);

        expect(document.querySelector('.marketing-feature-preview')).not.toBeNull();
        expect(document.querySelector('.marketing-capabilities')).not.toBeNull();
        expect(document.querySelector('.marketing-final-cta')).not.toBeNull();
    });

    it.each(applicationPages)('%s does not load the public redesign', path => {
        const document = documentFor(path);
        const publicStylesheet = document.querySelector(
            'link[href="/assets/css/public-marketing.css"]'
        );

        expect(publicStylesheet).toBeNull();
    });

    it('scopes the design system to public pages', () => {
        const css = readFileSync('src/assets/css/public-marketing.css', 'utf8');

        expect(css).toContain('body.public-site');
        expect(css).not.toContain('body.workspace-app');
    });
});
