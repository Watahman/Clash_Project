import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const documentFor = path => new JSDOM(readFileSync(path, 'utf8')).window.document;

describe('Achievements workspace page', () => {
    it('contains an accessible import and filter workflow', () => {
        const document = documentFor('src/subpages/achievements.html');

        expect(document.title).toContain('Achievements');
        expect(document.querySelector('meta[name="robots"]')?.content).toContain('noindex');
        expect(document.querySelector('#achievement-account')).not.toBeNull();
        expect(document.querySelector('#achievement-json')).not.toBeNull();
        expect(document.querySelector('#achievement-import-submit')?.getAttribute('type')).toBe('submit');
        expect(document.querySelector('#achievement-search')?.getAttribute('type')).toBe('search');
        expect(document.querySelector('#achievement-import-panel')?.hasAttribute('hidden')).toBe(true);
        expect(document.querySelector('#achievement-import-toggle')?.getAttribute('aria-expanded')).toBe('false');
        expect([...document.querySelectorAll('button:not([type])')]).toHaveLength(0);
    });

    it('collapses the large import panel after a successful snapshot save', () => {
        const source = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(source).toContain('setImportPanelOpen(false);');
        expect(source).toContain("setStatus(successMessage, 'success');");
    });

    it('is discoverable from the dashboard', () => {
        const document = documentFor('src/subpages/dashboard.html');
        expect(document.querySelector('a[href="/app/achievements"]')).not.toBeNull();
    });

    it('serves the clean private route through the worker', async () => {
        const bindings = {
            CLOUD_RUN_ORIGIN: 'https://backend.example',
            ASSETS: {
                fetch: vi.fn(async request => new Response(
                    `asset:${new URL(request.url).pathname}`,
                    { headers: { 'Content-Type': 'text/html' } }
                ))
            }
        };

        const response = await worker.fetch(
            new Request('https://clashpanel.com/app/achievements'),
            bindings
        );

        expect(await response.text()).toBe('asset:/subpages/achievements');
        expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });
});
