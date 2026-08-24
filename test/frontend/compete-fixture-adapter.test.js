import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const catalog = JSON.parse(readFileSync(
    'src/fixtures/redesign/scenarios.json',
    'utf8'
));
const cwlPayload = JSON.parse(readFileSync(
    'src/fixtures/redesign/compete-cwl.json',
    'utf8'
));
const warPayload = JSON.parse(readFileSync(
    'src/fixtures/redesign/compete-war.json',
    'utf8'
));

describe('Compete fixture adapter', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
        vi.resetModules();
        globalThis.fetch = vi.fn(url => {
            const path = String(url);
            if (path.endsWith('/fixtures/redesign/scenarios.json')) {
                return Promise.resolve(jsonResponse(catalog));
            }
            if (path.endsWith('/fixtures/redesign/compete-cwl.json')) {
                return Promise.resolve(jsonResponse(cwlPayload));
            }
            if (path.endsWith('/fixtures/redesign/compete-war.json')) {
                return Promise.resolve(jsonResponse(warPayload));
            }
            throw new Error(`Unexpected fixture request: ${path}`);
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('loads CWL payloads only for a localhost route request', async () => {
        const { loadCwlFixture } = await import(
            '../../src/assets/js/operation-board/operation-board-fixtures.js'
        );
        const fixture = await loadCwlFixture({
            location: new URL('http://localhost/app/cwl-tracker?cpFixture=cwl-active')
        });
        expect(fixture.id).toBe('cwl-active');
        expect(fixture.data.source.plan.id).toBe('fixture-plan');
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('does not request payloads from a non-local fixture URL', async () => {
        const { loadCompeteFixture } = await import(
            '../../src/assets/js/operation-board/operation-board-fixtures.js'
        );
        const fixture = await loadCompeteFixture({
            location: new URL('https://example.test/app/war-board?cpFixture=war-live')
        });
        expect(fixture).toBeNull();
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });
});

function jsonResponse(value) {
    return { ok: true, status: 200, json: async () => value };
}
