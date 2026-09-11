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
const removedProgressSelectors = [
    '.pp-dashboard', '.pp-dashboard-preview', '.pp-panel', '.pp-filter', '.pp-filter-bar',
    '.pp-card', '.pp-achievement-card',
    '.pp-signal-strip', '[data-stat-period]', '[data-achievement-filter]'
].join(', ');

describe('Public progress page contracts', () => {
    it.each([...progressPages])('%s is an indexable Coming Soon page with one canonical H1', (path, canonical) => {
        const document = documentFor(path);
        const h1 = document.querySelector('h1');
        const status = document.querySelector('.pp-coming-soon-status');

        expect(document.querySelector('meta[name="robots"]')?.content).toMatch(/^index,\s*follow$/i);
        expect(document.querySelector('link[rel="canonical"]')?.href).toBe(canonical);
        expect(document.querySelectorAll('h1')).toHaveLength(1);
        expect(document.querySelector('.workspace-coming-soon-badge')).not.toBeNull();
        expect(status).not.toBeNull();
        expect(status?.closest('h1')).toBeNull();
        expect(h1?.textContent).not.toMatch(/coming\s+soon/i);
        expect(document.body.textContent).toMatch(/coming\s+soon/i);
        expect(JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent || '{}'))
            .toMatchObject({ '@graph': expect.arrayContaining([
                expect.objectContaining({ description: expect.stringMatching(/coming soon/i) })
            ]) });
    });

    it.each([...progressPages])('%s keeps the public surface text-only and source-aware', path => {
        const document = documentFor(path);
        const source = read(path);

        expect(document.querySelector('.pp-coming-soon-hero')).not.toBeNull();
        expect(document.querySelectorAll(removedProgressSelectors)).toHaveLength(0);
        expect(document.querySelectorAll('main img')).toHaveLength(0);
        expect(document.querySelectorAll('form, input, textarea, [contenteditable="true"]')).toHaveLength(0);
        expect(document.body.textContent).toMatch(/private|coverage|tracked/i);
        expect(source).not.toMatch(/(?:sample|fixture|controlled values|illustrative preview|read-only dashboard)/i);
        expect(source).not.toContain('public-progress-pages.js');
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

    it('does not leave a profile shortcut into unreleased progress workspaces', () => {
        const document = documentFor('src/subpages/profile.html');

        expect(document.querySelector('a[href="/app/advanced-stats"]')).toBeNull();
        expect(document.querySelector('a[href="/app/achievements"]')).toBeNull();
        expect(document.querySelectorAll('.profile-next-link--coming-soon[aria-disabled="true"]')).toHaveLength(2);
    });

    it.each([...progressPages])('%s does not expose player tags or names in its public fixture', path => {
        const source = read(path);
        const document = documentFor(path);

        expect(source).not.toMatch(playerIdentityPattern);
        expect(document.querySelectorAll('[data-player-tag], [data-clan-tag], [data-player-name], [data-clan-name]'))
            .toHaveLength(0);
    });

    it('keeps Advanced Stats as a credible Coming Soon explanation', () => {
        const document = documentFor('src/advanced-stats.html');
        const source = read('src/advanced-stats.html');

        expect(document.querySelector('.pp-detail-list')).not.toBeNull();
        expect(document.querySelectorAll('.pp-detail-list li')).toHaveLength(3);
        expect(document.querySelector('.pp-boundary')).not.toBeNull();
        expect(document.body.textContent).toMatch(/tracked attacks|coverage|private workspace/i);
        expect(source).not.toMatch(/(?:sample|fixture|\b\d+(?:\.\d+)?%|20-battle)/i);
    });

    it('keeps Achievements as a credible Coming Soon explanation', () => {
        const document = documentFor('src/achievements.html');
        const bodyText = document.body.textContent;
        const source = read('src/achievements.html');

        expect(document.querySelector('.pp-detail-list')).not.toBeNull();
        expect(document.querySelectorAll('.pp-detail-list li')).toHaveLength(3);
        expect(document.querySelector('.pp-boundary')).not.toBeNull();
        expect(document.querySelectorAll('form, input, textarea, [contenteditable="true"]')).toHaveLength(0);
        expect(bodyText).toMatch(/milestones|personal progress|private workspace/i);
        expect(source).not.toMatch(/(?:sample|fixture|catalog families|fixed tiers|data-achievement-filter)/i);
    });

    it('covers the five-locale public demo module and feature-page navigation state', () => {
        const localeSource = read('src/assets/js/i18n/public-progress-locales.js');

        ['en', 'nl', 'fr', 'de', 'es'].forEach(language => {
            expect(localeSource).toMatch(new RegExp(`\\b${language}\\b`));
        });
        expect(localeSource).toContain('stats.title');
        expect(localeSource).toContain('ach.title');
        expect(localeSource).toContain('common.comingSoon');
        featurePages.forEach(path => {
            const document = documentFor(path);
            expect(document.querySelector('script[src*="public-progress-locales.js"]')).not.toBeNull();
            expect(document.querySelector('nav a[href="/#features"][aria-current="page"]')).toBeNull();
        });
    });

    it('keeps the Coming Soon surface visible in both themes with restrained motion', () => {
        const progressCss = read('src/assets/css/public-progress-pages.css');

        expect(progressCss).toContain('var(--cp-progress)');
        expect(progressCss).toContain('.pp-coming-soon-hero::after');
        expect(progressCss).toContain('@media (prefers-reduced-motion: reduce)');
        expect(progressCss).not.toMatch(/\.pp-(?:dashboard-preview|preview|panel|filter|achievement|signal|chart)/i);
    });
});
