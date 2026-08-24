import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getRedesignFixture,
    isLocalFixtureHost,
    isRedesignFixtureRequested
} from '../../src/assets/js/fixtures/redesign-fixture-mode.js';
import { createEntityAnswerPicker } from '../../src/assets/js/minigames/entity-guesser-picker.js';
import { createEntityGuesserStateManager } from '../../src/assets/js/minigames/entity-guesser-state.js';
import {
    readJson,
    readString,
    shouldPersistDailyState,
    writeJson,
    writeString
} from '../../src/assets/js/minigames/minigames-storage.js';

function createMemoryStorage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

function createStateManager(storage, isFixtureActive = () => false) {
    const category = { id: 'troopsHeroes', maxAttempts: 6 };
    const entities = [
        { id: 'barbarian', name: 'Barbarian' },
        { id: 'archer', name: 'Archer' }
    ];
    return createEntityGuesserStateManager({
        entityCategories: [category],
        dataVersion: 7,
        dailyStorageKey: 'entity-daily',
        practiceCategoryKey: 'entity-practice-category',
        getCategory: () => category,
        getEntities: () => entities,
        getDailyCategory: () => category,
        getDailyEntity: () => entities[0],
        getPracticeEntity: () => entities[1],
        readJson: (key, fallback) => readJson(key, fallback, storage),
        readString: (key, fallback) => readString(key, fallback, storage),
        writeString: (key, value) => writeString(key, value, storage),
        isFixtureActive
    });
}

describe('extracted minigame helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('reconstructs valid Entity Guesser state and avoids fixture practice writes', () => {
        const storage = createMemoryStorage();
        const manager = createStateManager(storage);
        const daily = manager.create('daily', null, '2026-08-11');

        expect(daily).toMatchObject({
            mode: 'daily',
            answerId: 'barbarian',
            categoryId: 'troopsHeroes',
            dataVersion: 7
        });
        writeJson('entity-daily', daily, storage);
        expect(manager.create('daily', null, '2026-08-11')).toEqual(daily);

        const recovered = manager.hydrate({ ...daily, answerId: 'removed-entity' });
        expect(recovered.answer.id).toBe('barbarian');
        expect(recovered.state.answerId).toBe('barbarian');

        const fixtureManager = createStateManager(storage, () => true);
        fixtureManager.create('practice', 'troopsHeroes', '2026-08-11');
        expect(readString('entity-practice-category', '', storage)).toBe('');
    });

    it('keeps the answer picker keyboard and pointer paths in one helper', () => {
        document.body.innerHTML = `
            <div data-answer-picker>
                <input data-guess-input />
                <div data-guess-suggestions hidden></div>
                <span data-picker-help></span>
            </div>`;
        const elements = {
            picker: document.querySelector('[data-answer-picker]'),
            input: document.querySelector('[data-guess-input]'),
            suggestions: document.querySelector('[data-guess-suggestions]'),
            pickerHelp: document.querySelector('[data-picker-help]')
        };
        const entities = [
            { id: 'barbarian', name: 'Barbarian' },
            { id: 'archer', name: 'Archer' }
        ];
        const messages = vi.fn();
        const picker = createEntityAnswerPicker({
            elements,
            getEntities: () => entities,
            searchEntities: (query, values) => values.filter(entity => (
                entity.name.toLowerCase().includes(query.toLowerCase())
            )),
            appendImage: vi.fn(),
            text: key => ({ availableAnswers: 'available answers', noMatches: 'No matches' }[key] || key),
            setMessage: messages,
            isComplete: () => false
        });

        picker.bind();
        elements.input.click();
        expect(elements.suggestions.hidden).toBe(false);
        expect(elements.suggestions.querySelectorAll('.entity-suggestion')).toHaveLength(2);

        elements.input.value = 'arc';
        elements.input.dispatchEvent(new Event('input'));
        expect(elements.suggestions.querySelector('.entity-suggestion').textContent).toBe('Archer');

        elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(elements.input.value).toBe('Archer');
        expect(elements.suggestions.hidden).toBe(true);
        expect(messages).toHaveBeenCalledWith('');
    });

    it('limits fixture activation to localhost and blocks fixture persistence', async () => {
        const localLocation = { hostname: 'localhost', search: '?cpFixture=entity-won' };
        const productionLocation = { hostname: 'clashpanel.com', search: '?cpFixture=entity-won' };

        expect(isLocalFixtureHost(localLocation)).toBe(true);
        expect(isRedesignFixtureRequested(localLocation)).toBe(true);
        expect(isRedesignFixtureRequested(productionLocation)).toBe(false);
        await expect(getRedesignFixture(productionLocation)).rejects.toThrow('localhost');

        expect(shouldPersistDailyState('daily', true)).toBe(false);
        expect(shouldPersistDailyState('daily', false)).toBe(true);
        expect(shouldPersistDailyState('practice', true)).toBe(false);

        const fixtureMode = readFileSync('src/assets/js/fixtures/redesign-fixture-mode.js', 'utf8');
        const entityController = readFileSync('src/assets/js/pages/minigames-phase2b.js', 'utf8');
        const higherLowerController = readFileSync('src/assets/js/pages/higher-lower.js', 'utf8');
        expect(fixtureMode).toContain("const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])");
        expect(fixtureMode).not.toContain('localStorage');
        expect(entityController).toContain('shouldPersistDailyState(state.mode, fixtureActive)');
        expect(higherLowerController).toContain('shouldPersistDailyState(run.mode, fixtureActive)');
    });
});
