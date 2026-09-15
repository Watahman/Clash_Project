import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    normalizePublicFooter,
    normalizePublicHeader,
    normalizePublicShell,
    updatePublicHeaderAuth
} from '../../src/assets/js/shell/public-header.js?v=20260915-auth-policy-v1';

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
        expect(header.dataset.authState).toBe('loading');
        expect(header.querySelector('[data-public-auth-guest]')?.textContent.trim()).toBe('Log in');
        expect(header.querySelector('[data-public-auth-guest]')).toHaveProperty('hidden', true);
        const startButton = header.querySelector('[data-public-start]');
        expect(startButton?.textContent.trim()).toBe('Start for free');
        expect(startButton).toHaveProperty('hidden', true);
        expect(header.querySelector('[data-public-authenticated]')).toHaveProperty('hidden', true);
        expect(header.querySelector('[href="/methodology"]')?.getAttribute('aria-current')).toBe('page');
    });

    it('switches between guest and authenticated actions without replacing shared controls', () => {
        const { header } = mountShell('/cwl-tracker');
        const languageControl = header.querySelector('[data-language-control]');
        const themeToggle = header.querySelector('[data-theme-toggle]');
        const login = header.querySelector('[data-public-auth-guest][data-i18n="auth.login"]');
        const startButton = header.querySelector('[data-public-start]');
        const accountButton = header.querySelector('[data-public-authenticated]');

        updatePublicHeaderAuth({ status: 'authenticated' });
        expect(header.dataset.authState).toBe('authenticated');
        expect(header.querySelectorAll('[data-public-auth-guest]:not([hidden])')).toHaveLength(0);
        expect(startButton).toHaveProperty('hidden', true);
        expect(accountButton).toHaveProperty('hidden', false);
        expect(accountButton?.textContent.trim()).toBe('Dashboard');
        expect(accountButton?.getAttribute('href')).toBe('/dashboard');
        expect(header.querySelector('[data-language-control]')).toBe(languageControl);
        expect(header.querySelector('[data-theme-toggle]')).toBe(themeToggle);

        updatePublicHeaderAuth({ status: 'guest' });
        expect(header.dataset.authState).toBe('guest');
        expect(login).toHaveProperty('hidden', false);
        expect(login?.getAttribute('href')).toBe('/subpages/login.html');
        expect(login?.getAttribute('href')).not.toContain('next');
        expect(login?.hasAttribute('inert')).toBe(false);
        expect(startButton).toHaveProperty('hidden', false);
        expect(accountButton).toHaveProperty('hidden', true);
    });

    it('keeps auth controls hidden and inert while session restore is loading', () => {
        const { header } = mountShell('/');
        const login = header.querySelector('[data-public-auth-guest][data-i18n="auth.login"]');
        const authZone = header.querySelector('[data-public-auth-zone]');

        expect(header.dataset.authState).toBe('loading');
        expect(authZone).toHaveProperty('hidden', true);
        expect(authZone?.hasAttribute('inert')).toBe(true);
        expect(login).toHaveProperty('hidden', true);
        expect(login?.getAttribute('href')).toBeNull();
        expect(login?.getAttribute('tabindex')).toBe('-1');
    });

    it('keeps hidden auth controls visually absent despite public action display rules', () => {
        const { header } = mountShell('/');
        const style = document.createElement('style');
        style.textContent = readFileSync(resolve(STATIC_ROOT, 'src/assets/css/public-marketing.css'), 'utf8');
        document.head.append(style);

        expect(getComputedStyle(header.querySelector('[data-public-auth-zone]')).display).toBe('none');
    });

    it('does not expose any auth action when auth resolution is unavailable', () => {
        const { header } = mountShell('/about');
        const login = header.querySelector('[data-public-auth-guest][data-i18n="auth.login"]');
        const accountButton = header.querySelector('[data-public-authenticated]');
        const authZone = header.querySelector('[data-public-auth-zone]');

        updatePublicHeaderAuth({ status: 'auth-unavailable' });

        expect(header.dataset.authState).toBe('auth-unavailable');
        expect(authZone).toHaveProperty('hidden', true);
        expect(authZone?.hasAttribute('inert')).toBe(true);
        expect(login).toHaveProperty('hidden', true);
        expect(login?.getAttribute('href')).toBeNull();
        expect(accountButton).toHaveProperty('hidden', true);
        expect(accountButton?.getAttribute('href')).toBeNull();
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

            const headerLogin = page.querySelector('header.public-header [data-public-auth-guest].link-button');
            const headerStart = page.querySelector('header.public-header [data-public-auth-href="/dashboard"]');
            [headerLogin, headerStart].forEach(control => {
                expect(control?.hidden, relativePath).toBe(true);
                expect(control?.hasAttribute('inert'), relativePath).toBe(true);
                expect(control?.getAttribute('href'), relativePath).toBeNull();
            });
            expect(headerLogin?.dataset.publicAuthHref, relativePath).toBe('/subpages/login');
            expect(headerStart?.dataset.publicAuthHref, relativePath).toBe('/dashboard');

            const contentStartLinks = Array.from(page.querySelectorAll('main a'))
                .filter(link => /Start(?: for)? free/i.test(link.textContent));
            expect(contentStartLinks.every(link => link.getAttribute('href') === '/dashboard'), relativePath).toBe(true);
        });
    });
});
