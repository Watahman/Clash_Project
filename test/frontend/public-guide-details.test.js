import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const details = [
    ['fair-cwl-roster', 'article1', 'fair-roster'],
    ['cwl-rotation', 'article2', 'rotation'],
    ['cwl-availability', 'article3', 'availability'],
    ['cwl-attack-defense', 'article4', 'two-sided'],
    ['missed-attacks', 'article5', 'missed-guide'],
    ['cwl-bonus-medals', 'article6', 'bonus-guide'],
    ['cwl-season-history', 'article7', 'seasons'],
    ['spreadsheet-vs-cwl-planner', 'article8', 'spreadsheet']
];

function documentFor(slug) {
    return new JSDOM(readFileSync(`src/guides/${slug}.html`, 'utf8')).window.document;
}

describe('crawlable CWL guide details', () => {
    it.each(details)('%s has complete static article metadata and content', (slug, article, anchor) => {
        const document = documentFor(slug);
        const canonical = `https://clashpanel.com/guides/${slug}`;
        const schema = JSON.parse(document.querySelector('[data-guide-structured-data]').textContent);
        const types = schema['@graph'].map(node => node['@type']);

        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.querySelector('link[rel="canonical"]').href).toBe(canonical);
        expect(document.querySelector('meta[name="description"]').content.length).toBeGreaterThan(80);
        expect(document.querySelector('meta[property="og:type"]').content).toBe('article');
        expect(document.querySelector('meta[property="og:url"]').content).toBe(canonical);
        expect(document.querySelector('meta[name="twitter:title"]').content).toContain('ClashPanel');
        expect(types).toEqual(expect.arrayContaining(['Article', 'BreadcrumbList']));
        expect(document.querySelector(`article#${anchor}`)?.textContent.trim().split(/\s+/).length).toBeGreaterThan(110);
        expect(document.querySelector('article[data-guide-article]')).not.toBeNull();
        expect(readFileSync(`src/guides/${slug}.html`, 'utf8')).toContain(`data-guide-detail="${article}"`);

        const links = [...document.querySelectorAll('a')].map(link => link.getAttribute('href'));
        expect(links).toContain('/guides');
        expect(links.some(href => /cwl-planner|cwl-tracker|clan-management/.test(href || ''))).toBe(true);
        expect(links.some(href => href?.startsWith('/guides/'))).toBe(true);
    });

    it('points the guide hub cards and table of contents at detail routes', () => {
        const source = readFileSync('src/guides.html', 'utf8');
        details.forEach(([slug]) => expect(source).toContain(`/guides/${slug}`));
        details.forEach(([, , anchor]) => expect(source).toContain(`id="${anchor}"`));
    });

    it('keeps every localized article key and detail metadata key available', () => {
        const languages = ['en', 'nl', 'fr', 'de', 'es'];
        languages.forEach(language => {
            const source = readFileSync(`src/assets/js/i18n/public-guides/${language}.js`, 'utf8');
            details.forEach(([, article]) => expect(source).toContain(`guides.${article}Html`));
            expect(source).toContain('guides.detailFairTitle');
            expect(source).toContain('guides.detailSpreadsheetDescription');
        });
    });
});
