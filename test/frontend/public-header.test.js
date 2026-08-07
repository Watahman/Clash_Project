import { beforeEach, describe, expect, it } from 'vitest';
import {
    normalizePublicFooter,
    normalizePublicHeader,
    normalizePublicShell
} from '../../src/assets/js/shell/public-header.js';

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
        expect(header.querySelectorAll('.public-nav [data-i18n]').length).toBe(6);
        expect(header.querySelector('[href="/subpages/login.html"]')?.textContent.trim()).toBe('Log in');
        expect(header.querySelector('[href="/subpages/register.html"]')?.textContent.trim()).toBe('Start for free');
        expect(header.querySelector('[href="/methodology"]')?.getAttribute('aria-current')).toBe('page');
    });

    it('uses one translated footer structure on every public page', () => {
        const { footer } = mountShell('/guides');
        expect(footer.querySelector('[href="/guides"]')?.dataset.i18n).toBe('public.footer.guides');
        expect(footer.querySelector('[href="/methodology"]')?.dataset.i18n).toBe('public.footer.methodology');
        expect(footer.querySelector('[href="/subpages/privacy"]')?.dataset.i18n).toBe('public.privacy');
        expect(footer.querySelector('[data-cookie-preferences]')?.dataset.i18n).toBe('public.cookiePreferences');
        expect(footer.querySelector('.public-disclaimer')?.dataset.i18n).toBe('public.disclaimer');
    });

    it('marks Tools on public product pages and no item on legal pages', () => {
        let { header } = mountShell('/cwl-planner');
        expect(header.querySelector('[href="/#features"]')?.getAttribute('aria-current')).toBe('page');

        ({ header } = mountShell('/subpages/privacy'));
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