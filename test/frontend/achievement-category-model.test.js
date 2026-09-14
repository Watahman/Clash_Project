import { describe, expect, it } from 'vitest';
import {
    ACHIEVEMENT_COLLECTION_DEFINITIONS,
    COLLECTION_KEYS
} from '../../src/assets/js/pages/achievement-collection-definitions.js';
import {
    achievementStructure,
    buildAchievementCollections,
    buildAchievementCategories,
    categoryByKey
} from '../../src/assets/js/pages/achievement-category-model.js';

function tier(number, overrides = {}) {
    return {
        family_key: overrides.family_key,
        achievement_key: overrides.achievement_key || `FAMILY_${number}`,
        tier: number,
        unlocked: overrides.unlocked ?? false,
        ...overrides
    };
}

function family(category, key, overrides = {}) {
    const tiers = overrides.tiers || [tier(1, { family_key: key })];
    return {
        familyKey: key,
        category,
        state: overrides.state || (overrides.complete ? 'complete' : 'locked'),
        sourceAvailable: overrides.sourceAvailable ?? true,
        hasStoredProgress: overrides.hasStoredProgress ?? true,
        complete: overrides.complete ?? false,
        tiers,
        ...overrides
    };
}

describe('Achievement collection model', () => {
    it('defines the nine user-facing collections in stable order', () => {
        expect(COLLECTION_KEYS).toEqual([
            'village', 'combat', 'war-cwl', 'clan', 'builder-base',
            'clan-capital', 'progression-stats', 'clashpanel', 'special'
        ]);
        expect(ACHIEVEMENT_COLLECTION_DEFINITIONS).toHaveLength(9);
        ACHIEVEMENT_COLLECTION_DEFINITIONS.forEach(definition => {
            expect(definition.title).toBeTruthy();
            expect(definition.description).toBeTruthy();
            expect(definition.icon).toMatch(/^\/assets\//);
            expect(definition.badge).toEqual(expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                lockedCopy: expect.any(String)
            }));
        });
    });

    it('maps every source category to the requested collection without flattening it', () => {
        const input = [
            family('imported_home_village_base', 'HOME'),
            family('imported_upgrade_activity', 'UPGRADE'),
            family('helpers', 'HELP'),
            family('secret_and_combination_achievements', 'SECRET'),
            family('clan_capital_and_raids', 'CAPITAL')
        ];
        const collections = buildAchievementCollections(input);

        expect(categoryByKey(collections, 'village').sourceCategories).toEqual([
            'imported_home_village_base', 'imported_upgrade_activity', 'helpers'
        ]);
        expect(categoryByKey(collections, 'village').sourceFamiliesByCategory.helpers[0].category)
            .toBe('helpers');
        expect(categoryByKey(collections, 'clan-capital').families[0].familyKey).toBe('CAPITAL');
        expect(categoryByKey(collections, 'special').families[0].category)
            .toBe('secret_and_combination_achievements');
    });

    it('unlocks a collection badge only when every known family is complete', () => {
        const complete = family('clan_capital_and_raids', 'CAPITAL', {
            complete: true,
            state: 'complete',
            tiers: [tier(1, { family_key: 'CAPITAL', unlocked: true })]
        });
        const incomplete = family('clan_capital_and_raids', 'OTHER');
        const collection = categoryByKey(buildAchievementCollections([complete]), 'clan-capital');
        const locked = categoryByKey(buildAchievementCollections([incomplete]), 'clan-capital');

        expect(collection.badge.state).toBe('unlocked');
        expect(collection.badge.unlocked).toBe(true);
        expect(locked.badge.state).toBe('locked');
        expect(locked.badge.unlocked).toBe(false);
        expect(JSON.stringify(collection.badge)).not.toMatch(/bronze|silver|gold/i);
    });

    it('preserves unknown progress instead of treating it as zero or complete', () => {
        const waiting = family('clan_capital_and_raids', 'CAPITAL', {
            complete: false,
            state: 'unknown',
            sourceAvailable: false,
            hasStoredProgress: false
        });
        const collection = categoryByKey(buildAchievementCollections([waiting]), 'clan-capital');

        expect(collection.progressKnown).toBe(false);
        expect(collection.state).toBe('unknown');
        expect(collection.completion).toBeNull();
        expect(collection.completionPercent).toBeNull();
        expect(collection.badge.state).toBe('locked');
        expect(collection.badge.status).toBe('unknown');
    });

    it('classifies only proven consecutive tiers as a progression chain', () => {
        const chain = family('offensive_progression', 'CHAIN', {
            tiers: [
                tier(1, { family_key: 'CHAIN' }),
                tier(2, { family_key: 'CHAIN' })
            ]
        });
        const gap = family('offensive_progression', 'GAP', {
            tiers: [tier(1, { family_key: 'GAP' }), tier(3, { family_key: 'GAP' })]
        });
        const guessed = {
            category: 'offensive_progression',
            tiers: [tier(1), tier(2)]
        };

        expect(achievementStructure(chain)).toBe('progression');
        expect(achievementStructure(gap)).toBe('standalone');
        expect(achievementStructure(guessed)).toBe('standalone');
    });

    it('keeps legacy and unknown source categories inside a user-facing collection', () => {
        const legacy = family('progression', 'LEGACY');
        const unknown = family('future_backend_bucket', 'FUTURE');
        const collections = buildAchievementCategories([legacy, unknown]);

        expect(collections.find(collection => collection.key === 'progression-stats').families).toContainEqual(
            expect.objectContaining({ familyKey: 'LEGACY' })
        );
        expect(collections.find(collection => collection.key === 'special').families).toContainEqual(
            expect.objectContaining({ familyKey: 'FUTURE' })
        );
        expect(collections.flatMap(collection => collection.families)).toHaveLength(2);
    });

    it('deduplicates repeated achievement keys and tiers before classifying', () => {
        const input = [
            {
                category: 'offensive_progression',
                family_key: 'OFFENSE',
                achievement_key: 'OFFENSE_1',
                tier: 1,
                unlocked: true
            },
            {
                category: 'offensive_progression',
                family_key: 'OFFENSE',
                achievement_key: 'OFFENSE_1',
                tier: 1,
                unlocked: false
            },
            {
                category: 'offensive_progression',
                family_key: 'OFFENSE',
                achievement_key: 'OFFENSE_2',
                tier: 2,
                unlocked: true
            }
        ];
        const collection = categoryByKey(buildAchievementCollections(input), 'combat');
        expect(collection.families).toHaveLength(1);
        expect(collection.families[0].tiers).toHaveLength(2);
        expect(collection.progressionFamilies).toHaveLength(1);
    });

    it('keeps the legacy category entry point pointed at collection output', () => {
        expect(buildAchievementCategories([]).map(collection => collection.key)).toEqual(COLLECTION_KEYS);
        expect(categoryByKey(buildAchievementCategories([]), 'missing')).toBeUndefined();
    });
});
