import { beforeEach, describe, expect, it } from 'vitest';
import {
    normalizePublicFooter,
    normalizePublicHeader,
    normalizePublicShell,
    updatePublicHeaderAuth
} from '../../src/assets/js/shell/public-header.js?v=20260829-public-auth-v1';

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
        expect(header.querySelector('[data-public-auth-guest][href*="/subpages/register.html"]')?.textContent.trim()).toBe('Start for free');
        expect(header.querySelector('[data-public-authenticated]')).toHaveProperty('hidden', true);
        expect(header.querySelector('[href="/methodology"]')?.getAttribute('aria-current')).toBe('page');
    });

    it('switches between guest and authenticated actions without replacing controls', () => {
        const { header } = mountShell('/cwl-tracker');
        const languageControl = header.querySelector('[data-language-control]');

        updatePublicHeaderAuth({ status: 'authenticated' });
        expect(header.dataset.authState).toBe('authenticated');
        expect(header.querySelectorAll('[data-public-auth-guest]:not([hidden])')).toHaveLength(0);
        expect(header.querySelector('[data-public-authenticated]')).toHaveProperty('hidden', false);
        expect(header.querySelector('[data-language-control]')).toBe(languageControl);

        updatePublicHeaderAuth({ status: 'auth-unavailable' });
        expect(header.dataset.authState).toBe('auth-unavailable');
        expect(header.querySelectorAll('[data-public-auth-guest]:not([hidden])')).toHaveLength(2);
        expect(header.querySelector('[data-public-authenticated]')).toHaveProperty('hidden', true);
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
