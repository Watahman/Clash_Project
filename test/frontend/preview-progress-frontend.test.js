import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const helperPath = '../../src/assets/js/shell/preview-progress-access.js';

async function loadHelper() {
    return import(`${helperPath}?case=${Math.random()}`);
}

function response(enabled) {
    return new Response(JSON.stringify({ enabled }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

describe('preview progress frontend access', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllGlobals();
    });

    it('ignores a late response from a previous identity', async () => {
        let resolvePrevious;
        let resolveCurrent;
        vi.stubGlobal('fetch', vi.fn()
            .mockImplementationOnce(() => new Promise(resolve => { resolvePrevious = resolve; }))
            .mockImplementationOnce(() => new Promise(resolve => { resolveCurrent = resolve; })));
        const helper = await loadHelper();

        const previous = helper.resolvePreviewProgressAccess({ identity: 'user-a' });
        const current = helper.resolvePreviewProgressAccess({ identity: '' });
        resolveCurrent(response(false));
        await current;
        resolvePrevious(response(true));
        await previous;

        expect(helper.getPreviewProgressAccess()).toMatchObject({
            identity: '',
            enabled: false,
            status: 'resolved'
        });
    });

    it('clears access immediately on guest state, even with an older allowed request pending', async () => {
        let release;
        vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { release = resolve; })));
        const helper = await loadHelper();
        const pending = helper.resolvePreviewProgressAccess({ identity: 'user-a' });

        await helper.resolvePreviewProgressAccess({ authState: { status: 'guest', session: null } });
        release(response(true));
        await pending;

        expect(helper.getPreviewProgressAccess()).toMatchObject({ enabled: false, identity: '' });
    });

    it('keeps profile progress links fail-closed until capability is enabled', () => {
        const document = new JSDOM(readFileSync('src/subpages/profile.html', 'utf8')).window.document;
        const links = [...document.querySelectorAll('[data-preview-progress-module]')];

        expect(links).toHaveLength(2);
        expect(links.map(link => link.dataset.previewProgressModule)).toEqual([
            'advancedStats',
            'achievements'
        ]);
        links.forEach(link => {
            expect(link.hasAttribute('href')).toBe(false);
            expect(link.getAttribute('aria-disabled')).toBe('true');
            expect(link.querySelector('[data-preview-progress-action]')?.textContent)
                .toContain('Coming soon');
        });
    });
});
