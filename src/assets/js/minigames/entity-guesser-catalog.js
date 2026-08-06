import {
    ENTITIES as CORE_ENTITIES,
    ENTITY_CATEGORIES as CORE_CATEGORIES
} from './entity-guesser-data.js';
import {
    STRUCTURE_CATEGORIES,
    STRUCTURE_ENTITIES
} from './entity-guesser-structures-data.js';

export const ENTITY_GUESSER_DATA_VERSION = '2026-08-phase-2b';

export const DAILY_CATEGORY_SEQUENCE = Object.freeze([
    'troops',
    'equipment',
    'defenses',
    'spells',
    'resourceBuildings',
    'pets',
    'traps',
    'equipment',
    'armyBuildings',
    'heroes',
    'defenses',
    'troops',
    'utilityBuildings',
    'spells',
    'equipment',
    'traps'
]);

export const ENTITY_CATEGORIES = Object.freeze([
    ...CORE_CATEGORIES,
    ...STRUCTURE_CATEGORIES
]);

export const ENTITIES = Object.freeze([
    ...CORE_ENTITIES,
    ...STRUCTURE_ENTITIES
]);

export const CATEGORY_BY_ID = Object.freeze(
    Object.fromEntries(ENTITY_CATEGORIES.map(category => [category.id, category]))
);

export const ENTITIES_BY_CATEGORY = Object.freeze(
    Object.fromEntries(
        ENTITY_CATEGORIES.map(category => [
            category.id,
            Object.freeze(ENTITIES.filter(entity => entity.categoryId === category.id))
        ])
    )
);

export function getCategory(categoryId) {
    return CATEGORY_BY_ID[categoryId] || CATEGORY_BY_ID.troops;
}

export function getEntities(categoryId, { dailyOnly = false } = {}) {
    const entities = ENTITIES_BY_CATEGORY[categoryId] || [];
    return dailyOnly
        ? entities.filter(entity => entity.dailyEligible !== false)
        : entities;
}
