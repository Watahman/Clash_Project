import {
    ENTITIES as CORE_ENTITIES,
    ENTITY_CATEGORIES as CORE_CATEGORIES
} from './entity-guesser-data.js';
import {
    STRUCTURE_CATEGORIES,
    STRUCTURE_ENTITIES
} from './entity-guesser-structures-data.js';

export const ENTITY_GUESSER_DATA_VERSION = '2026-09-01-equipment-fix-1';

const SOURCE_CATEGORIES = Object.freeze([
    ...CORE_CATEGORIES,
    ...STRUCTURE_CATEGORIES
]);

const SOURCE_ENTITIES = Object.freeze([
    ...CORE_ENTITIES,
    ...STRUCTURE_ENTITIES
]);

const GROUP_BY_SOURCE_CATEGORY = Object.freeze({
    defenses: 'defenses',
    traps: 'defenses',
    resourceBuildings: 'otherBuildings',
    armyBuildings: 'otherBuildings',
    utilityBuildings: 'otherBuildings',
    troops: 'troopsHeroes',
    heroes: 'troopsHeroes',
    pets: 'troopsHeroes',
    spells: 'spellsEquipment',
    equipment: 'spellsEquipment'
});

export const DAILY_CATEGORY_SEQUENCE = Object.freeze([
    'troopsHeroes',
    'spellsEquipment',
    'defenses',
    'otherBuildings',
    'defenses',
    'troopsHeroes',
    'spellsEquipment',
    'otherBuildings'
]);

export const ENTITY_CATEGORIES = Object.freeze([
    {
        id: 'defenses',
        label: 'Defenses',
        shortLabel: 'Defenses',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'kind', label: 'Type', labelKey: 'type', kind: 'exact' },
            { key: 'targets', label: 'Targets', labelKey: 'targets', kind: 'set' },
            { key: 'impact', label: 'Effect', labelKey: 'effect', kind: 'exact' },
            { key: 'coverage', label: 'Range', labelKey: 'range', kind: 'exact' },
            { key: 'behavior', label: 'Attack', labelKey: 'attack', kind: 'exact' },
            { key: 'feature', label: 'Special', labelKey: 'special', kind: 'exact' },
            { key: 'visibility', label: 'State', labelKey: 'state', kind: 'exact' },
            { key: 'merged', label: 'Merged', labelKey: 'merged', kind: 'boolean' }
        ])
    },
    {
        id: 'otherBuildings',
        label: 'Other Buildings',
        shortLabel: 'Other Buildings',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'kind', label: 'Type', labelKey: 'type', kind: 'exact' },
            { key: 'system', label: 'System', labelKey: 'system', kind: 'exact' },
            { key: 'function', label: 'Function', labelKey: 'function', kind: 'exact' },
            { key: 'footprint', label: 'Size', labelKey: 'size', kind: 'ordered', order: ['1x1', '2x2', '3x3', '4x4'] },
            { key: 'countClass', label: 'Count', labelKey: 'count', kind: 'exact' },
            { key: 'capacityBased', label: 'Capacity', labelKey: 'capacity', kind: 'boolean' }
        ])
    },
    {
        id: 'troopsHeroes',
        label: 'Troops & Heroes',
        shortLabel: 'Troops & Heroes',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'kind', label: 'Type', labelKey: 'type', kind: 'exact' },
            { key: 'movement', label: 'Move', labelKey: 'move', kind: 'exact' },
            { key: 'targets', label: 'Targets', labelKey: 'targets', kind: 'set' },
            { key: 'favorite', label: 'Favorite', labelKey: 'favorite', kind: 'exact' },
            { key: 'attackStyle', label: 'Attack', labelKey: 'attack', kind: 'exact' },
            { key: 'role', label: 'Role', labelKey: 'role', kind: 'exact' }
        ])
    },
    {
        id: 'spellsEquipment',
        label: 'Spells & Equipment',
        shortLabel: 'Spells & Equipment',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'kind', label: 'Type', labelKey: 'type', kind: 'exact' },
            { key: 'activation', label: 'Timing', labelKey: 'timing', kind: 'exact' },
            { key: 'effect', label: 'Effect', labelKey: 'effect', kind: 'exact' },
            { key: 'affects', label: 'Affects', labelKey: 'affects', kind: 'set' },
            { key: 'role', label: 'Role', labelKey: 'role', kind: 'exact' },
            { key: 'origin', label: 'Source', labelKey: 'source', kind: 'exact' },
            { key: 'tier', label: 'Tier', labelKey: 'rarity', kind: 'exact' }
        ])
    }
].map(category => Object.freeze(category)));

function normalizeEntity(entity) {
    const sourceCategoryId = entity.categoryId;
    const categoryId = GROUP_BY_SOURCE_CATEGORY[sourceCategoryId];
    const shared = { ...entity, sourceCategoryId, categoryId };

    if (categoryId === 'defenses') {
        return Object.freeze({
            ...shared,
            kind: sourceCategoryId === 'traps' ? 'Trap' : 'Defense',
            impact: entity.damageType || entity.effect,
            coverage: entity.rangeClass || entity.area,
            behavior: entity.attackStyle || entity.mode,
            feature: entity.special || entity.role,
            merged: Boolean(entity.merged)
        });
    }

    if (categoryId === 'otherBuildings') {
        const kind = sourceCategoryId === 'resourceBuildings'
            ? 'Resource'
            : sourceCategoryId === 'armyBuildings' ? 'Army' : 'Utility';
        return Object.freeze({
            ...shared,
            kind,
            system: entity.system || entity.resource,
            capacityBased: Boolean(entity.stores || entity.capacityBased)
        });
    }

    if (categoryId === 'troopsHeroes') {
        const kind = sourceCategoryId === 'troops'
            ? 'Troop'
            : sourceCategoryId === 'heroes' ? 'Hero' : 'Pet';
        return Object.freeze({ ...shared, kind });
    }

    return Object.freeze({
        ...shared,
        kind: sourceCategoryId === 'spells' ? 'Spell' : 'Equipment',
        activation: entity.duration || entity.activation,
        origin: entity.resource || entity.source,
        tier: entity.unlockTier || entity.rarity
    });
}

export const ENTITIES = Object.freeze(SOURCE_ENTITIES.map(normalizeEntity));

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
    return CATEGORY_BY_ID[categoryId] || CATEGORY_BY_ID.troopsHeroes;
}

export function getEntities(categoryId, { dailyOnly = false } = {}) {
    const entities = ENTITIES_BY_CATEGORY[categoryId] || [];
    return dailyOnly
        ? entities.filter(entity => entity.dailyEligible !== false)
        : entities;
}

export function getEntitiesBySourceCategory(sourceCategoryId) {
    return ENTITIES.filter(entity => entity.sourceCategoryId === sourceCategoryId);
}

export function getSourceCategories() {
    return SOURCE_CATEGORIES;
}
