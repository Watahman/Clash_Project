import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const publicPages = new Map([
    ['src/index.html', 'https://clashpanel.com/'],
    ['src/subpages/privacy.html', 'https://clashpanel.com/subpages/privacy'],
    ['src/subpages/cookies.html', 'https://clashpanel.com/subpages/cookies'],
    ['src/subpages/terms.html', 'https://clashpanel.com/subpages/terms'],
    ['src/subpages/contact.html', 'https://clashpanel.com/subpages/contact']
]);

const privatePages = [
    'src/404.html',
    'src/subpages/bracket-generator.html',
    'src/subpages/cwl-operation-board.html',
    'src/subpages/cwl-planner-drafts.html',
    'src/subpages/cwl-planner.html',
    'src/subpages/dashboard.html',
    'src/subpages/groups.html',
    'src/subpages/login.html',
    'src/subpages/register.html'
];

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Pre-launch static contract', () => {
    it.each([...publicPages])('%s is independently indexable', (path, canonical) => {
        const document = documentFor(path);
        expect(document.title.trim()).not.toBe('');
        expect(document.querySelector('meta[name="description"]')?.content.trim()).not.toBe('');
        expect(document.querySelector('meta[name="robots"]')?.content).toMatch(/\bindex\b/i);
        expect(document.querySelector('link[rel="canonical"]')?.href).toBe(canonical);
        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.querySelector('meta[property="og:title"]')?.content.trim()).not.toBe('');
        expect(document.querySelector('meta[property="og:url"]')?.content).toBe(canonical);
        expect(document.querySelector('meta[name="twitter:card"]')?.content).toBe('summary');
    });

    it.each(privatePages)('%s explicitly opts out of indexing', path => {
        const robots = documentFor(path).querySelector('meta[name="robots"]')?.content || '';
        expect(robots).toMatch(/\bnoindex\b/i);
    });

    it('keeps crawler and sitemap rules aligned with the build-time domain', () => {
        const robots = readFileSync('src/robots.txt', 'utf8');
        const sitemap = readFileSync('src/sitemap.xml', 'utf8');

        expect(robots).toContain('Disallow: /api/');
        expect(robots).toContain('Disallow: /subpages/popup_htmls/');
        expect(robots).toContain('https://replace-with-production-domain.invalid/sitemap.xml');
        expect(sitemap).not.toContain('https://clashpanel.com');
        expect(sitemap.match(/https:\/\/replace-with-production-domain\.invalid/g)).toHaveLength(5);
    });

    it('defines baseline static security and preview noindex headers', () => {
        const headers = readFileSync('src/_headers', 'utf8');

        expect(headers).toContain('X-Content-Type-Options: nosniff');
        expect(headers).toContain('X-Frame-Options: DENY');
        expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin');
        expect(headers).toContain('Permissions-Policy:');
        expect(headers).toContain('workers.dev/*');
        expect(headers).toContain('X-Robots-Tag: noindex');
    });

    it('uses explicit button types in every HTML source', () => {
        const pages = [...publicPages.keys(), ...privatePages, 'src/subpages/popup_htmls/profile_popup.html'];
        for (const path of new Set(pages)) {
            const buttonsWithoutType = [...documentFor(path).querySelectorAll('button:not([type])')];
            expect(buttonsWithoutType, path).toHaveLength(0);
        }
    });
});
