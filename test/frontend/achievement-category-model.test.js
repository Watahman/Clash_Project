import { describe, expect, it } from 'vitest';
import {
    achievementStructure,
    buildAchievementCategories,
    categoryByKey
} from '../../src/assets/js/pages/achievement-category-model.js';

function family(category, key, overrides = {}) {
    const tiers = overrides.tiers || [{ tier: 1, unlocked: overrides.complete === true }];
    return {
        familyKey: key,
        category,
        categoryLabel: overrides.categoryLabel || category,
        complete: overrides.complete ?? false,
        state: overrides.state || (overrides.complete ? 'complete' : 'locked'),
        sourceAvailable: overrides.sourceAvailable ?? true,
        hasStoredProgress: overrides.hasStoredProgress ?? true,
        tiers,
        ...overrides
    };
}

describe('Achievement category model', () => {
    it('classifies only a family with multiple existing tiers as progression', () => {
        const one = family('planning', 'ONE');
        const chain = family('planning', 'CHAIN', {
            tiers: [
                { tier: 1, unlocked: true },
                { tier: 2, unlocked: false }
            ]
        });

        expect(achievementStructure(one)).toBe('standalone');
        expect(achievementStructure(chain)).toBe('progression');
    });

    it('keeps families independent and preserves their source tier order', () => {
        const first = family('war', 'FIRST', { complete: true, tiers: [{ tier: 2 }, { tier: 1 }] });
        const second = family('war', 'SECOND', { tiers: [{ tier: 1 }, { tier: 2 }, { tier: 3 }] });
        const category = buildAchievementCategories([first, second])[0];

        expect(category.progressionFamilies).toEqual([first, second]);
        expect(category.standaloneFamilies).toEqual([]);
        expect(category.families[0].tiers.map(tier => tier.tier)).toEqual([2, 1]);
        expect(category.families[1].tiers.map(tier => tier.tier)).toEqual([1, 2, 3]);
        expect(category.families[0]).not.toHaveProperty('nextFamily');
        expect(category.families[1]).not.toHaveProperty('previousFamily');
    });

    it('uses real category identity and separates progression from standalone families', () => {
        const planning = family('planning', 'PLAN', { categoryLabel: 'Planning', tiers: [{ tier: 1 }, { tier: 2 }] });
        const war = family('war', 'WAR', { categoryLabel: 'War', tiers: [{ tier: 1 }] });
        const categories = buildAchievementCategories([planning, war]);

        expect(categories.map(category => category.key)).toEqual(['planning', 'war']);
        expect(categories[0].categoryLabel).toBe('Planning');
        expect(categories[0].progressionFamilies).toEqual([planning]);
        expect(categories[0].standaloneFamilies).toEqual([]);
        expect(categories[1].progressionFamilies).toEqual([]);
        expect(categories[1].standaloneFamilies).toEqual([war]);
        expect(categoryByKey(categories, 'war')).toBe(categories[1]);
        expect(categoryByKey(categories, 'missing')).toBeUndefined();
    });

    it('calculates family completion independently from tier completion', () => {
        const complete = family('stats', 'COMPLETE', {
            complete: true,
            tiers: [{ tier: 1, unlocked: true }, { tier: 2, unlocked: false }]
        });
        const inProgress = family('stats', 'IN_PROGRESS', {
            complete: false,
            tiers: [{ tier: 1, unlocked: true }, { tier: 2, unlocked: true }]
        });
        const category = buildAchievementCategories([complete, inProgress])[0];

        expect(category.completedFamilies).toBe(1);
        expect(category.familyCount).toBe(2);
        expect(category.completion).toBe(0.5);
        expect(category.completionPercent).toBe(50);
        expect(category.tierCount).toBe(4);
        expect(category.unlockedTierCount).toBe(3);
        expect(category.tierCompletionPercent).toBe(75);
    });

    it.each([
        [0, 'none'],
        [24, 'none'],
        [25, 'bronze'],
        [50, 'silver'],
        [75, 'gold'],
        [100, 'master']
    ])('maps %s%% family completion to the %s badge', (completedPercent, expected) => {
        const total = 100;
        const completed = Array.from({ length: total }, (_, index) => family('badges', `F${index}`, {
            complete: index < completedPercent
        }));
        const category = buildAchievementCategories(completed)[0];

        expect(category.badge.state).toBe(expected);
        expect(category.badgeConfirmedUnlocked).toBe(expected === 'master');
    });

    it('marks a category badge unknown when an unmeasured family has no stored progress', () => {
        const category = buildAchievementCategories([
            family('history', 'KNOWN', { complete: true }),
            family('history', 'WAITING', {
                complete: false,
                state: 'unknown',
                sourceAvailable: false,
                hasStoredProgress: false
            })
        ])[0];

        expect(category.completionPercent).toBe(50);
        expect(category.badge.state).toBe('unknown');
        expect(category.badge.unlocked).toBe(false);
        expect(category.badge.confirmedUnlocked).toBe(false);
    });
});
