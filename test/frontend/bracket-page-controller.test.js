import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { createBracketFixture } from '../../src/assets/js/bracket/bracket-fixtures.js';
import { createBracketController } from '../../src/assets/js/bracket/bracket-page-controller.js';
import { collectBracketRefs } from '../../src/assets/js/bracket/bracket-page-view.js';

const privateHtml = readFileSync('src/subpages/bracket-generator.html', 'utf8');

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

function controllerHarness(storageBackend, fixture = undefined) {
    const dom = new JSDOM(privateHtml, { url: 'http://localhost/app/brackets' });
    const refs = collectBracketRefs(dom.window.document);
    const controller = createBracketController({
        refs,
        documentRef: dom.window.document,
        windowRef: dom.window,
        storageBackend,
        fixture,
        boardRenderer: () => {},
        connectorRenderer: () => {}
    });
    return { dom, refs, controller };
}

describe('bracket page controller boundary', () => {
    it('restores and resets through the controller without leaking browser globals', () => {
        const backend = memoryStorage();
        const first = controllerHarness(backend);
        first.refs.name.value = 'Local cup';
        first.refs.participants.value = 'A\nB\nC\nD';
        first.controller.generate(false);

        const second = controllerHarness(backend);
        second.controller.restore();
        expect(second.controller.getState().bracket.name).toBe('Local cup');
        expect(second.refs.participants.value).toBe('A\nB\nC\nD');

        second.controller.clearBracket();
        expect(backend.getItem('clashtools.bracket.current')).toBeNull();
        expect(second.controller.getState().bracket).toBeNull();
    });

    it('keeps fixture mode out of local persistence', async () => {
        const backend = memoryStorage();
        const fixture = {
            isRequested: () => true,
            get: async () => ({ id: 'bracket-4' })
        };
        const harness = controllerHarness(backend, fixture);

        expect(await harness.controller.loadFixture()).toBe(true);
        expect(harness.controller.getState().bracket).toEqual(createBracketFixture('bracket-4'));
        harness.controller.clearBracket();
        expect(backend.getItem('clashtools.bracket.current')).toBeNull();
    });
});
