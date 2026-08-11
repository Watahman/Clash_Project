import { describe, expect, it } from 'vitest';
import { createBracket, importBracket } from '../../src/assets/js/bracket/bracket-engine.js';
import {
    BRACKET_STORAGE_KEY,
    createBracketStorage
} from '../../src/assets/js/bracket/bracket-page-storage.js';

function memoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

describe('bracket local persistence boundary', () => {
    it('restores a saved bracket and reset removes the saved copy', () => {
        const backend = memoryStorage();
        const storage = createBracketStorage({ storage: backend });
        const bracket = createBracket(['A', 'B', 'C', 'D']);

        expect(storage.save(bracket)).toBe(true);
        expect(storage.restore(importBracket)).toEqual(bracket);
        expect(backend.getItem(BRACKET_STORAGE_KEY)).toContain('"schemaVersion":1');

        expect(storage.remove()).toBe(true);
        expect(storage.restore(importBracket)).toBeNull();
    });

    it('clears an invalid saved copy after restore validation fails', () => {
        const backend = memoryStorage();
        const storage = createBracketStorage({ storage: backend });
        backend.setItem(BRACKET_STORAGE_KEY, '{"schemaVersion":1,"rounds":[]}');

        expect(() => storage.restore(importBracket)).toThrow();
        expect(backend.getItem(BRACKET_STORAGE_KEY)).toBeNull();
    });

    it('does not read, write, or reset browser state while fixture mode is enabled', () => {
        const backend = memoryStorage();
        let fixtureMode = true;
        const storage = createBracketStorage({
            storage: backend,
            enabled: () => !fixtureMode
        });
        const bracket = createBracket(['A', 'B', 'C', 'D']);

        expect(storage.save(bracket)).toBe(false);
        expect(storage.restore(importBracket)).toBeNull();
        expect(storage.remove()).toBe(false);
        expect(backend.getItem(BRACKET_STORAGE_KEY)).toBeNull();

        fixtureMode = false;
        expect(storage.save(bracket)).toBe(true);
        expect(storage.restore(importBracket)).toEqual(bracket);
    });
});
