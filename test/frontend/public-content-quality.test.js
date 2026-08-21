import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const policyFiles = ['privacy', 'cookies', 'terms', 'contact'].map(name => `src/subpages/${name}.html`);
const demoFiles = ['src/cwl-planner.html', 'src/cwl-tracker.html', 'src/clan-management.html'];
const progressFiles = ['src/advanced-stats.html', 'src/achievements.html'];

describe('Public content quality', () => {
    it.each([...policyFiles, ...demoFiles, ...progressFiles, 'src/index.html', 'src/about.html', 'src/guides.html', 'src/methodology.html', 'src/changelog.html'])('%s stays visible when JavaScript fails', file => {
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

    it.each(demoFiles)('%s labels controlled sample data and explains a decision', file => {
        const document = new JSDOM(readFileSync(file, 'utf8')).window.document;
        expect(document.querySelector('.sample-label')?.textContent).toMatch(/sample data/i);
        expect(document.querySelector('.sample-panel figcaption')?.textContent.length).toBeGreaterThan(60);
        expect(document.body.textContent).not.toMatch(/#[0289PYLQGRJCUV]{6,}/);
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
