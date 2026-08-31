import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    normalizePublicFooter,
    normalizePublicHeader,
    normalizePublicShell,
    updatePublicHeaderAuth
} from '../../src/assets/js/shell/public-header.js?v=20260829-public-header-cta-v2';

const PUBLIC_NAV = [
    ['Tools', '/#features'],
    ['Games', '/minigames'],
    ['Guides', '/guides'],
    ['Methodology', '/methodology'],
    ['About', '/about'],
    ['Changelog', '/changelog']
];

const PUBLIC_STATIC_PAGES = [
    ['src/index.html', 'tools'], ['src/about.html', 'about'],
    ['src/achievements.html', null], ['src/advanced-stats.html', null],
    ['src/bracket-generator.html', null], ['src/changelog.html', 'changelog'],
    ['src/clan-management.html', null], ['src/cwl-planner.html', null],
    ['src/cwl-tracker.html', null], ['src/guides.html', 'guides'],
    ['src/methodology.html', 'methodology'], ['src/minigames.html', 'games'],
    ['src/subpages/contact.html', null], ['src/subpages/cookies.html', null],
    ['src/subpages/privacy.html', null], ['src/subpages/terms.html', null],
    ['src/guides/cwl-attack-defense.html', 'guides'],
    ['src/guides/cwl-availability.html', 'guides'],
    ['src/guides/cwl-bonus-medals.html', 'guides'],
    ['src/guides/cwl-rotation.html', 'guides'],
    ['src/guides/cwl-season-history.html', 'guides'],
    ['src/guides/fair-cwl-roster.html', 'guides'],
    ['src/guides/missed-attacks.html', 'guides'],
    ['src/guides/spreadsheet-vs-cwl-planner.html', 'guides']
];

const STATIC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readStaticPage(relativePath) {
    return new DOMParser().parseFromString(
        readFileSync(resolve(STATIC_ROOT, relativePath), 'utf8'),
        'text/html'
    );
}

function mountShell(pathname) {
    window.history.replaceState({}, '', pathname);
    document.body.className = 'public-site';
    document.body.innerHTML = '<header class="public-header"><span>outdated header</span></header><footer class="public-footer"><span>outdated footer</span></footer>';
    normalizePublicShell(document);
    return {
        header: document.querySelector('.public-header'),
        footer: document.querySelector('.public-footer')
    };
}

describe('public shell normalization', () => {
    beforeEach(() => {
        document.documentElement.lang = 'en';
    });

    it('uses the complete index navigation and action set on resource pages', () => {
        const { header } = mountShell('/methodology');
        const navLabels = Array.from(header.querySelectorAll('.public-nav a'))
            .map(link => link.textContent.trim());

        expect(navLabels).toEqual(['Tools', 'Games', 'Guides', 'Methodology', 'About', 'Changelog']);
        expect(header.querySelectorAll('.public-nav [data-i18n]').length).toBe(5);
        expect(header.querySelector('[data-public-auth-guest][href*="/subpages/login.html"]')?.textContent.trim()).toBe('Log in');
        const startButton = header.querySelector('[data-public-start]');
        expect(startButton?.textContent.trim()).toBe('Start for free');
        expect(startButton?.getAttribute('href')).toBe('/dashboard');
        expect(header.querySelector('[data-public-authenticated]')).toBeNull();
        expect(header.querySelector('[href="/methodology"]')?.getAttribute('aria-current')).toBe('page');
    });

    it('always routes the start button to Dashboard', () => {
        const { header } = mountShell('/cwl-tracker');
        const languageControl = header.querySelector('[data-language-control]');
        const startButton = header.querySelector('[data-public-start]');

        updatePublicHeaderAuth({ status: 'authenticated' });
        expect(header.dataset.authState).toBe('authenticated');
        expect(header.querySelectorAll('[data-public-auth-guest]:not([hidden])')).toHaveLength(0);
        expect(startButton).toHaveProperty('hidden', false);
        expect(startButton?.textContent.trim()).toBe('Start for free');
        expect(startButton?.getAttribute('href')).toBe('/dashboard');
        expect(header.querySelector('[data-language-control]')).toBe(languageControl);

        updatePublicHeaderAuth({ status: 'auth-unavailable' });
        expect(header.dataset.authState).toBe('auth-unavailable');
        expect(header.querySelectorAll('[data-public-auth-guest]:not([hidden])')).toHaveLength(1);
        expect(startButton?.getAttribute('href')).toBe('/dashboard');
        expect(header.textContent).not.toContain('Log out');
    });

    it('uses one translated footer structure on every public page', () => {
        const { footer } = mountShell('/guides');
        expect(footer.querySelector('[href="/guides"]')?.dataset.i18n).toBe('public.footer.guides');
        expect(footer.querySelector('[href="/methodology"]')?.dataset.i18n).toBe('public.footer.methodology');
        expect(footer.querySelector('[href="/privacy"]')?.dataset.i18n).toBe('public.privacy');
        expect(footer.querySelector('[data-cookie-preferences]')?.dataset.i18n).toBe('public.cookiePreferences');
        expect(footer.querySelector('.public-disclaimer')?.dataset.i18n).toBe('public.disclaimer');
    });

    it('keeps Guides active on a guide detail route', () => {
        const { header } = mountShell('/guides/fair-cwl-roster');

        expect(header.querySelector('[href="/guides"]')?.getAttribute('aria-current'))
            .toBe('page');
    });

    it('does not mark a section link as the current page on product or legal pages', () => {
        let { header } = mountShell('/cwl-planner');
        expect(header.querySelector('[aria-current="page"]')).toBeNull();

        ({ header } = mountShell('/privacy'));
        expect(header.querySelector('[aria-current="page"]')).toBeNull();
    });

    it('is idempotent', () => {
        const { header, footer } = mountShell('/guides');
        const firstHeader = header.innerHTML;
        const firstFooter = footer.innerHTML;
        normalizePublicHeader(document);
        normalizePublicFooter(document);
        expect(header.innerHTML).toBe(firstHeader);
        expect(footer.innerHTML).toBe(firstFooter);
    });
});

describe('public shell static fallbacks', () => {
    it('keeps every public fallback aligned with the shared nav and CTA contract', () => {
        PUBLIC_STATIC_PAGES.forEach(([relativePath, activeSection]) => {
            const page = readStaticPage(relativePath);
            const links = Array.from(page.querySelectorAll('header.public-header nav.public-nav > a'));
            expect(links.map(link => [link.textContent.trim(), link.getAttribute('href')]), relativePath)
                .toEqual(PUBLIC_NAV);

            const current = links.filter(link => link.getAttribute('aria-current') === 'page');
            expect(current, relativePath).toHaveLength(activeSection ? 1 : 0);
            if (activeSection) expect(current[0].getAttribute('href'), relativePath)
                .toBe(PUBLIC_NAV.find(([, href]) => href.includes(activeSection === 'tools' ? '#features' : activeSection))[1]);

            const legalHrefs = Array.from(page.querySelectorAll('footer.public-footer nav a'))
                .map(link => link.getAttribute('href'));
            expect(legalHrefs, relativePath).toEqual(expect.arrayContaining(['/privacy', '/cookies', '/terms', '/contact']));

            const startLinks = Array.from(page.querySelectorAll('a')).filter(link => /Start(?: for)? free/i.test(link.textContent));
            expect(startLinks.every(link => link.getAttribute('href') === '/dashboard'), relativePath).toBe(true);
        });
    });
});
