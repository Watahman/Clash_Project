import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const publicPages = new Map([
    ['src/index.html', 'https://clashpanel.com/'],
    ['src/cwl-planner.html', 'https://clashpanel.com/cwl-planner'],
    ['src/cwl-tracker.html', 'https://clashpanel.com/cwl-tracker'],
    ['src/clan-management.html', 'https://clashpanel.com/clan-management'],
    ['src/advanced-stats.html', 'https://clashpanel.com/advanced-stats'],
    ['src/achievements.html', 'https://clashpanel.com/achievements'],
    ['src/minigames.html', 'https://clashpanel.com/minigames'],
    ['src/about.html', 'https://clashpanel.com/about'],
    ['src/subpages/privacy.html', 'https://clashpanel.com/privacy'],
    ['src/subpages/cookies.html', 'https://clashpanel.com/cookies'],
    ['src/subpages/terms.html', 'https://clashpanel.com/terms'],
    ['src/subpages/contact.html', 'https://clashpanel.com/contact'],
    ['src/bracket-generator.html', 'https://clashpanel.com/bracket-generator']
]);

const privatePages = [
    'src/404.html',
    'src/subpages/bracket-generator.html',
    'src/subpages/cwl-operation-board.html',
    'src/subpages/cwl-planner-drafts.html',
    'src/subpages/cwl-planner.html',
    'src/subpages/dashboard.html',
    'src/subpages/groups.html',
    'src/subpages/minigames.html',
    'src/subpages/advanced-stats.html',
    'src/subpages/achievements.html',
    'src/subpages/login.html',
    'src/subpages/register.html'
];

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Pre-launch static contract', () => {
    it.each([...publicPages])('%s is independently indexable', (path, canonical) => {
        const document = documentFor(path);
        expect(document.title.trim()).not.toBe('');
        expect(document.querySelector('meta[name="description"]')?.content.trim()).not.toBe('');
        const robots = document.querySelector('meta[name="robots"]')?.content || '';
        if (['src/advanced-stats.html', 'src/achievements.html'].includes(path)) {
            expect(robots).toMatch(/\bnoindex\b/i);
            expect(robots).toMatch(/\bfollow\b/i);
        } else {
            expect(robots).toMatch(/\bindex\b/i);
        }
        expect(document.querySelector('link[rel="canonical"]')?.href).toBe(canonical);
        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.querySelector('meta[property="og:title"]')?.content.trim()).not.toBe('');
        expect(document.querySelector('meta[property="og:url"]')?.content).toBe(canonical);
        expect(document.querySelector('meta[name="twitter:card"]')?.content).toMatch(/^summary/);
    });

    it.each(privatePages)('%s explicitly opts out of indexing', path => {
        const robots = documentFor(path).querySelector('meta[name="robots"]')?.content || '';
        expect(robots).toMatch(/\bnoindex\b/i);
    });

    it('keeps crawler and sitemap rules aligned with the build-time domain', () => {
        const robots = readFileSync('src/robots.txt', 'utf8');
        const sitemap = readFileSync('src/sitemap.xml', 'utf8');

        expect(robots).toContain('Disallow: /api/');
        expect(robots).not.toContain('Disallow: /app/');
        expect(robots).toContain('Disallow: /subpages/popup_htmls/');
        expect(robots).toContain('https://clashpanel.com/sitemap.xml');
        expect(sitemap).not.toContain('replace-with-production-domain.invalid');
        expect(sitemap).not.toContain('/advanced-stats');
        expect(sitemap).not.toContain('/achievements');
        expect(sitemap).toContain('/minigames');
        for (const name of ['privacy', 'cookies', 'terms', 'contact']) {
            expect(sitemap).toContain(`https://clashpanel.com/${name}`);
            expect(sitemap).not.toContain(`https://clashpanel.com/subpages/${name}`);
        }
        expect(sitemap).toContain(
            '<loc>https://clashpanel.com/changelog</loc><lastmod>2026-08-14</lastmod>'
        );
        expect(sitemap).toContain('https://clashpanel.com/bracket-generator');
        expect(sitemap.match(/https:\/\/clashpanel\.com/g)).toHaveLength(22);
        expect(sitemap.match(/<url>/g)).toHaveLength(22);
    });

    it('defines permanent static fallbacks for legacy legal URLs', () => {
        const redirects = readFileSync('src/_redirects', 'utf8');

        for (const name of ['privacy', 'cookies', 'terms', 'contact']) {
            expect(redirects).toContain(
                `/subpages/${name} /${name} 301`
            );
            expect(redirects).toContain(
                `/subpages/${name}.html /${name} 301`
            );
        }
        expect(redirects).toContain('/about.html /about 301');
    });

    it.each([
        ['privacy', 'https://clashpanel.com/privacy'],
        ['cookies', 'https://clashpanel.com/cookies'],
        ['terms', 'https://clashpanel.com/terms'],
        ['contact', 'https://clashpanel.com/contact']
    ])('%s exposes canonical social metadata for the preferred route', (name, canonical) => {
        const document = documentFor(`src/subpages/${name}.html`);

        expect(document.querySelector('meta[name="twitter:url"]')?.content).toBe(canonical);
        expect(JSON.parse(
            document.querySelector('script[type="application/ld+json"]')?.textContent || '{}'
        ).url).toBe(canonical);
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
        const pages = [
            ...publicPages.keys(),
            ...privatePages
        ];
        for (const path of new Set(pages)) {
            const buttonsWithoutType = [...documentFor(path).querySelectorAll('button:not([type])')];
            expect(buttonsWithoutType, path).toHaveLength(0);
        }
    });
});
