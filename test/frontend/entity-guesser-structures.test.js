import { describe, expect, it } from 'vitest';
import {
    ENTITY_CATEGORIES,
    ENTITY_GUESSER_DATA_VERSION,
    ENTITIES,
    getCategory,
    getEntities
} from '../../src/assets/js/minigames/entity-guesser-catalog.js';
import {
    buildHint,
    compareEntity,
    findEntity,
    getDailyCategory,
    getDailyEntity,
    validateCatalog
} from '../../src/assets/js/minigames/entity-guesser-engine-v2.js';

describe('Entity Guesser phase 2B structures catalog', () => {
    it('combines all ten categories without incomplete entities', () => {
        expect(ENTITY_GUESSER_DATA_VERSION).toContain('phase-2b');
        expect(ENTITY_CATEGORIES.map(category => category.id)).toEqual([
            'troops',
            'spells',
            'heroes',
            'pets',
            'equipment',
            'defenses',
            'resourceBuildings',
            'armyBuildings',
            'utilityBuildings',
            'traps'
        ]);
        expect(ENTITIES).toHaveLength(163);
        expect(validateCatalog()).toEqual([]);
    });

    it('contains the expected permanent structure catalogs', () => {
        expect(getEntities('defenses')).toHaveLength(21);
        expect(getEntities('resourceBuildings')).toHaveLength(6);
        expect(getEntities('armyBuildings')).toHaveLength(12);
        expect(getEntities('utilityBuildings')).toHaveLength(7);
        expect(getEntities('traps')).toHaveLength(8);

        expect(findEntity('MGT', getEntities('defenses'))?.name).toBe('Multi-Gear Tower');
        expect(findEntity('SAM', getEntities('traps'))?.name).toBe('Seeking Air Mine');
        expect(findEntity('CC', getEntities('armyBuildings'))?.name).toBe('Clan Castle');
    });

    it('rotates every phase 2B category through Daily Mode', () => {
        const categories = new Set();
        const start = new Date('2026-08-01T00:00:00.000Z');

        for (let offset = 0; offset < 32; offset += 1) {
            const date = new Date(start);
            date.setUTCDate(date.getUTCDate() + offset);
            const dateKey = date.toISOString().slice(0, 10);
            const category = getDailyCategory(dateKey);
            const answer = getDailyEntity(dateKey, category);
            categories.add(category.id);
            expect(answer.categoryId).toBe(category.id);
        }

        expect(categories).toEqual(new Set(ENTITY_CATEGORIES.map(category => category.id)));
    });

    it('compares defense range, targets and merge status correctly', () => {
        const category = getCategory('defenses');
        const cannon = getEntities('defenses').find(entity => entity.id === 'cannon');
        const multiArcher = getEntities('defenses').find(entity => entity.id === 'multi-archer-tower');
        const comparison = compareEntity(cannon, multiArcher, category);

        expect(comparison.find(cell => cell.key === 'targets').state).toBe('partial');
        expect(comparison.find(cell => cell.key === 'rangeClass'))
            .toMatchObject({ state: 'close', direction: 'higher' });
        expect(comparison.find(cell => cell.key === 'merged').state).toBe('wrong');
    });

    it('compares trap visibility, effect and Town Hall context', () => {
        const category = getCategory('traps');
        const bomb = getEntities('traps').find(entity => entity.id === 'bomb');
        const gigaBomb = getEntities('traps').find(entity => entity.id === 'giga-bomb');
        const comparison = compareEntity(bomb, gigaBomb, category);

        expect(comparison.find(cell => cell.key === 'visibility').state).toBe('wrong');
        expect(comparison.find(cell => cell.key === 'unlockTh').direction).toBe('higher');
        expect(comparison.find(cell => cell.key === 'directDamage').state).toBe('correct');
    });

    it('builds structure-specific hints without naming the answer', () => {
        const defense = getEntities('defenses').find(entity => entity.id === 'revenge-tower');
        const defenseHints = [
            buildHint(defense, getCategory('defenses'), 1),
            buildHint(defense, getCategory('defenses'), 2)
        ].join(' ');
        expect(defenseHints).toContain('Town Hall 18');
        expect(defenseHints).not.toContain('Revenge Tower');

        const trapEntity = getEntities('traps').find(entity => entity.id === 'giga-bomb');
        const trapHints = [
            buildHint(trapEntity, getCategory('traps'), 1),
            buildHint(trapEntity, getCategory('traps'), 2)
        ].join(' ');
        expect(trapHints).toContain('visible');
        expect(trapHints).not.toContain('Giga Bomb');
    });
});
