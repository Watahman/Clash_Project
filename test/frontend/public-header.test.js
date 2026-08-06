import { beforeEach, describe, expect, it } from 'vitest';
import { normalizePublicHeader } from '../../src/assets/js/shell/public-header.js';

function mountHeader(pathname) {
    window.history.replaceState({}, '', pathname);
    document.body.className = 'public-site';
    document.body.innerHTML = '<header class="public-header"><span>outdated header</span></header>';
    normalizePublicHeader(document);
    return document.querySelector('.public-header');
}

describe('public header normalization', () => {
    beforeEach(() => {
        document.documentElement.lang = 'en';
    });

    it('uses the complete index navigation and action set on resource pages', () => {
        const header = mountHeader('/methodology');
        const navLabels = Array.from(header.querySelectorAll('.public-nav a'))
            .map(link => link.textContent.trim());

        expect(navLabels).toEqual(['Tools', 'Guides', 'Methodology', 'About', 'Changelog']);
        expect(header.querySelector('[href="/subpages/login.html"]')?.textContent.trim()).toBe('Log in');
        expect(header.querySelector('[href="/subpages/register.html"]')?.textContent.trim()).toBe('Start for free');
        expect(header.querySelector('[href="/methodology"]')?.getAttribute('aria-current')).toBe('page');
    });

    it('marks Tools on public product pages and no item on legal pages', () => {
        let header = mountHeader('/cwl-planner');
        expect(header.querySelector('[href="/#features"]')?.getAttribute('aria-current')).toBe('page');

        header = mountHeader('/subpages/privacy');
        expect(header.querySelector('[aria-current="page"]')).toBeNull();
    });

    it('is idempotent', () => {
        const header = mountHeader('/guides');
        const firstMarkup = header.innerHTML;
        normalizePublicHeader(document);
        expect(header.innerHTML).toBe(firstMarkup);
    });
});
