import { describe, expect, it } from 'vitest';
import {
    ENTITY_CATEGORIES,
    ENTITY_GUESSER_DATA_VERSION,
    ENTITIES,
    getCategory,
    getEntities,
    getEntitiesBySourceCategory
} from '../../src/assets/js/minigames/entity-guesser-catalog.js';
import {
    buildHint,
    compareEntity,
    findEntity,
    getDailyCategory,
    getDailyEntity,
    validateCatalog
} from '../../src/assets/js/minigames/entity-guesser-engine-v2.js';

describe('Entity Guesser phase 2D broad categories', () => {
    it('combines the complete catalog into four broad, valid categories', () => {
        expect(ENTITY_GUESSER_DATA_VERSION).toContain('phase-2d');
        expect(ENTITY_CATEGORIES.map(category => category.id)).toEqual([
            'defenses',
            'otherBuildings',
            'troopsHeroes',
            'spellsEquipment'
        ]);
        expect(ENTITIES).toHaveLength(163);
        expect(getEntities('defenses')).toHaveLength(29);
        expect(getEntities('otherBuildings')).toHaveLength(25);
        expect(getEntities('troopsHeroes')).toHaveLength(50);
        expect(getEntities('spellsEquipment')).toHaveLength(59);
        expect(validateCatalog()).toEqual([]);
        ENTITY_CATEGORIES.forEach(category => {
            expect(category.columns.some(column => column.key === 'unlockTh')).toBe(false);
        });
    });

    it('keeps every original answer in the expected broad category', () => {
        expect(getEntitiesBySourceCategory('defenses')).toHaveLength(21);
        expect(getEntitiesBySourceCategory('traps')).toHaveLength(8);
        expect(getEntitiesBySourceCategory('resourceBuildings')).toHaveLength(6);
        expect(getEntitiesBySourceCategory('armyBuildings')).toHaveLength(12);
        expect(getEntitiesBySourceCategory('utilityBuildings')).toHaveLength(7);

        expect(findEntity('MGT', getEntities('defenses'))?.name).toBe('Multi-Gear Tower');
        expect(findEntity('SAM', getEntities('defenses'))?.name).toBe('Seeking Air Mine');
        expect(findEntity('CC', getEntities('otherBuildings'))?.name).toBe('Clan Castle');
        expect(findEntity('fireball', getEntities('spellsEquipment'))?.name).toBe('Fireball');
    });

    it('rotates every broad category through Daily Mode', () => {
        const categories = new Set();
        const start = new Date('2026-08-01T00:00:00.000Z');

        for (let offset = 0; offset < 16; offset += 1) {
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

    it('compares defenses and traps using the same meaningful fields', () => {
        const category = getCategory('defenses');
        const cannon = getEntities('defenses').find(entity => entity.id === 'cannon');
        const gigaBomb = getEntities('defenses').find(entity => entity.id === 'giga-bomb');
        const comparison = compareEntity(cannon, gigaBomb, category);

        expect(comparison.find(cell => cell.key === 'kind').state).toBe('wrong');
        expect(comparison.find(cell => cell.key === 'targets').state).toBe('partial');
        expect(comparison.find(cell => cell.key === 'visibility').state).toBe('wrong');
        expect(comparison.some(cell => cell.key === 'unlockTh')).toBe(false);
    });

    it('compares mixed troops, Heroes and Pets without missing fields', () => {
        const category = getCategory('troopsHeroes');
        const barbarian = getEntities('troopsHeroes').find(entity => entity.id === 'barbarian');
        const king = getEntities('troopsHeroes').find(entity => entity.id === 'barbarian-king');
        const comparison = compareEntity(barbarian, king, category);

        expect(comparison).toHaveLength(category.columns.length);
        expect(comparison.find(cell => cell.key === 'kind').state).toBe('wrong');
        expect(comparison.find(cell => cell.key === 'movement').state).toBe('correct');
    });

    it('builds broad-category hints without naming the answer', () => {
        const defense = getEntities('defenses').find(entity => entity.id === 'revenge-tower');
        const defenseHints = [
            buildHint(defense, getCategory('defenses'), 1),
            buildHint(defense, getCategory('defenses'), 2)
        ].join(' ');
        expect(defenseHints).toContain('long coverage');
        expect(defenseHints).not.toContain('Town Hall');
        expect(defenseHints).not.toContain('Revenge Tower');

        const equipment = getEntities('spellsEquipment').find(entity => entity.id === 'magic-mirror');
        const equipmentHints = [
            buildHint(equipment, getCategory('spellsEquipment'), 1),
            buildHint(equipment, getCategory('spellsEquipment'), 2)
        ].join(' ');
        expect(equipmentHints).toContain('Equipment');
        expect(equipmentHints).not.toContain('Magic Mirror');
    });
});
