import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const policyFiles = ['privacy', 'cookies', 'terms', 'contact'].map(name => `src/subpages/${name}.html`);
const captureFiles = ['src/cwl-planner.html', 'src/clan-management.html'];
const textOnlyFeatureFiles = ['src/cwl-tracker.html', 'src/bracket-generator.html'];
const featureFiles = [...captureFiles, ...textOnlyFeatureFiles];
const progressFiles = ['src/advanced-stats.html', 'src/achievements.html'];

describe('Public content quality', () => {
    it.each([...policyFiles, ...featureFiles, ...progressFiles, 'src/index.html', 'src/about.html', 'src/guides.html', 'src/methodology.html', 'src/changelog.html'])('%s stays visible when JavaScript fails', file => {
        const document = new JSDOM(readFileSync(file, 'utf8')).window.document;
        expect(document.documentElement.classList.contains('workspace-page-loading')).toBe(false);
    });

    it.each(policyFiles)('%s contains its meaningful body before JavaScript', file => {
        const document = new JSDOM(readFileSync(file, 'utf8')).window.document;
        const body = document.querySelector('[data-policy-document]');
        expect(body?.dataset.staticEnglish).toBe('true');
        expect(body?.textContent.trim().split(/\s+/).length).toBeGreaterThanOrEqual(150);
        expect(body?.querySelectorAll('section').length).toBeGreaterThanOrEqual(3);
    });

    it.each(captureFiles)('%s labels its actual capture and explains a decision', file => {
        const document = new JSDOM(readFileSync(file, 'utf8')).window.document;
        expect(document.querySelector('.cp-detail-section img[src*="/assets/previews/home/"]')).not.toBeNull();
        expect(document.querySelector('.cp-detail-section figcaption')?.textContent).toMatch(/controlled (?:fixture|sample) data.*not live/i);
        expect(document.querySelector('.cp-detail-section figcaption')?.textContent.length).toBeGreaterThan(40);
        expect(document.querySelector('.cp-feature-hero img[src*="/assets/previews/home/"]')).toBeNull();
        expect(document.querySelector('.home-v2-products img[src*="/assets/previews/home/"]')).toBeNull();
        expect(document.body.textContent).not.toMatch(/#[0289PYLQGRJCUV]{6,}/);
    });

    it.each(textOnlyFeatureFiles)('%s has no fake preview or sample table', file => {
        const source = readFileSync(file, 'utf8');
        const document = new JSDOM(source).window.document;

        expect(document.querySelector('.cp-feature-hero.cp-hero-background')).not.toBeNull();
        expect(document.querySelectorAll('.cp-product-preview, .cp-screenshot-sample, .sample-panel, table')).toHaveLength(0);
        expect(document.querySelectorAll('main img[src*="/assets/previews/home/"]')).toHaveLength(0);
        expect(source).not.toMatch(/public-feature-previews\.js|data-preview-copy|sample(?: data| table)/i);
    });

    it.each(progressFiles)('%s is a text-only Coming Soon page', file => {
        const source = readFileSync(file, 'utf8');
        const document = new JSDOM(source).window.document;
        const status = document.querySelector('.pp-coming-soon-status');

        expect(document.body.textContent).toMatch(/coming\s+soon/i);
        expect(status).not.toBeNull();
        expect(status?.closest('h1')).toBeNull();
        expect(document.querySelectorAll('main img')).toHaveLength(0);
        expect(document.querySelectorAll('.pp-dashboard, .pp-dashboard-preview, .pp-panel, .pp-filter, .pp-filter-bar, .pp-card, .pp-achievement-card')).toHaveLength(0);
        expect(source).not.toMatch(/public-progress-pages\.js|(?:sample|fixture|controlled values)/i);
    });

    it('publishes substantial methodology and eight original guide sections', () => {
        const methodology = new JSDOM(readFileSync('src/methodology.html', 'utf8')).window.document;
        const guides = new JSDOM(readFileSync('src/guides.html', 'utf8')).window.document;
        expect(methodology.querySelectorAll('.resource-article')).toHaveLength(8);
        expect(guides.querySelectorAll('.resource-article')).toHaveLength(8);
        expect(guides.body.textContent).toContain('Written by ClashPanel');
    });

    it('keeps Guides and Methodology free of invented sample panels', () => {
        const methodology = new JSDOM(readFileSync('src/methodology.html', 'utf8')).window.document;
        const guides = new JSDOM(readFileSync('src/guides.html', 'utf8')).window.document;

        expect(guides.querySelector('.guide-featured-preview')).toBeNull();
        expect(guides.querySelector('.sample-panel')).toBeNull();
        expect(guides.querySelector('.resource-article .resource-note')).toBeNull();
        expect(methodology.querySelector('.sample-panel')).toBeNull();
        expect(methodology.querySelector('.resource-article .resource-note')).toBeNull();
    });
});
