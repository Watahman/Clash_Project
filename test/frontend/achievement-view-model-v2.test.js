import { describe, expect, it } from 'vitest';
import {
    achievementLevelFromXp,
    buildAchievementSummary,
    groupAchievementFamilies
} from '../../src/assets/js/achievements/achievement-view-model.js';

describe('Achievement v2 view model', () => {
    it('marks the current tier unknown even when earlier tiers are unlocked', () => {
        const tiers = [
            { tier: 1, tier_label: '1', rarity: 'uncommon', progress: 3, target: 1, unlocked: true, progress_known: true, source_available: true },
            { tier: 2, tier_label: '2', rarity: 'rare', progress: 3, target: 2, unlocked: true, progress_known: true, source_available: true },
            { tier: 3, tier_label: '3', rarity: 'epic', progress: 3, target: 3, unlocked: true, progress_known: true, source_available: true },
            { tier: 4, tier_label: 'All', rarity: 'legendary', progress: 0, target: 1, unlocked: false, progress_known: false, source_available: false, threshold_text: '{"all_available":true}' }
        ].map((tier, index) => ({
            achievement_key: `BASE_HOME_GEARUPS_${index + 1}`,
            family_key: 'BASE_HOME_GEARUPS',
            title: 'Master Mechanic',
            description: 'Complete Home Village gear-ups.',
            category: 'imported_home_village_base',
            category_label: 'Imported Home Village base',
            source: 'base_data',
            source_codes: ['IG-B', 'CP-BS', 'CK-G', 'CP-D'],
            evaluation_mode: 'IMPORT_CURRENT',
            priority: 'P1',
            xp: [100, 200, 400, 800][index],
            ...tier
        }));

        const [family] = groupAchievementFamilies(tiers);
        expect(family.unlockedTiers).toHaveLength(3);
        expect(family.currentTier.tierLabel).toBe('All');
        expect(family.complete).toBe(false);
        expect(family.sourceAvailable).toBe(false);
        expect(family.state).toBe('unknown');
        expect(family.progressRatio).toBe(0);
    });

    it('uses the v2 XP level formula', () => {
        expect(achievementLevelFromXp(0).level).toBe(1);
        expect(achievementLevelFromXp(99).level).toBe(1);
        expect(achievementLevelFromXp(100).level).toBe(2);
        expect(achievementLevelFromXp(400).level).toBe(3);
    });

    it('normalizes invalid unlock flags before family state and summary consumers see them', () => {
        const families = groupAchievementFamilies([
            {
                achievement_key: 'BAD_1', family_key: 'BAD', title: 'Bad', description: 'Bad',
                category: 'offensive_progression', tier: 1, progress: 4, target: 5,
                comparison: 'GTE', unlocked: true, progress_known: true, source_available: true
            },
            {
                achievement_key: 'DUP_1', family_key: 'DUP', title: 'Duplicate', description: 'Duplicate',
                category: 'offensive_progression', tier: 1, progress: 5, target: 5,
                comparison: 'GTE', unlocked: true, progress_known: true, source_available: true
            },
            {
                achievement_key: 'DUP_1', family_key: 'DUP', title: 'Duplicate', description: 'Duplicate',
                category: 'offensive_progression', tier: 1, progress: 0, target: 5,
                comparison: 'GTE', unlocked: false, progress_known: true, source_available: true
            }
        ]);
        const bad = families.find(family => family.familyKey === 'BAD');
        const duplicate = families.find(family => family.familyKey === 'DUP');

        expect(bad.tiers[0].unlocked).toBe(false);
        expect(bad.complete).toBe(false);
        expect(bad.state).toBe('in_progress');
        expect(duplicate.tiers).toHaveLength(1);
        expect(duplicate.tiers[0].unlocked).toBe(true);
    });

    it('does not trust stored unlocks when measurable progress is below target', () => {
        const [family] = groupAchievementFamilies([{
            achievement_key: 'UNAVAILABLE_1', family_key: 'UNAVAILABLE',
            title: 'Unavailable metric', description: 'Unavailable metric',
            category: 'offensive_progression', tier: 1, progress: 4, target: 5,
            comparison: 'GTE', unlocked: true, progress_known: true, source_available: false
        }]);

        expect(family.tiers[0].unlocked).toBe(false);
        expect(family.state).toBe('unknown');
        expect(buildAchievementSummary([family])).toMatchObject({
            unlockedTierCount: 0,
            totalXp: 0,
            completion: null
        });
    });

    it('does not treat a missing GTE target as zero-progress completion', () => {
        const [family] = groupAchievementFamilies([{
            achievement_key: 'MISSING_TARGET_1', family_key: 'MISSING_TARGET',
            title: 'Missing target', description: 'Missing target',
            category: 'profile_and_milestones', tier: 1, progress: 0,
            comparison: 'GTE', unlocked: true, progress_known: true, source_available: true
        }]);

        expect(family.complete).toBe(false);
        expect(family.state).toBe('unknown');
        expect(family.tiers[0].unlocked).toBe(false);
    });

    it('keeps unknown progress from inflating summary XP through stored flags', () => {
        const [family] = groupAchievementFamilies([{
            achievement_key: 'UNKNOWN_STORED_1', family_key: 'UNKNOWN_STORED',
            title: 'Unknown metric', description: 'Unknown metric',
            category: 'profile_and_milestones', tier: 1, progress: 0, target: 5,
            comparison: 'UNSUPPORTED', unlocked: true, xp: 500,
            progress_known: false, source_available: false
        }]);

        const summary = buildAchievementSummary([family]);
        expect(family.state).toBe('unknown');
        expect(summary.unlockedTierCount).toBe(0);
        expect(summary.totalXp).toBe(0);
    });

    it('keeps LTE, BOOLEAN and unsupported progress semantics explicit', () => {
        const families = groupAchievementFamilies([
            {
                achievement_key: 'RANK_1', family_key: 'RANK', title: 'Rank', description: 'Rank',
                category: 'trophies_and_rankings', tier: 1, progress: 100, target: 100,
                comparison: 'LTE', unlocked: true, progress_known: true, source_available: true
            },
            {
                achievement_key: 'RANK_BAD_1', family_key: 'RANK_BAD', title: 'Rank', description: 'Rank',
                category: 'trophies_and_rankings', tier: 1, progress: 101, target: 100,
                comparison: 'LTE', unlocked: true, progress_known: true, source_available: true
            },
            {
                achievement_key: 'RANK_ZERO_1', family_key: 'RANK_ZERO', title: 'Rank', description: 'Rank',
                category: 'trophies_and_rankings', tier: 1, progress: 0, target: 100,
                comparison: 'LTE', unlocked: true, progress_known: true, source_available: true
            },
            {
                achievement_key: 'BOOL_1', family_key: 'BOOL', title: 'Boolean', description: 'Boolean',
                category: 'profile_and_milestones', tier: 1, progress: 0, target: 1,
                comparison: 'BOOLEAN', unlocked: true, progress_known: true, source_available: true
            },
            {
                achievement_key: 'UNKNOWN_1', family_key: 'UNKNOWN', title: 'Unknown', description: 'Unknown',
                category: 'profile_and_milestones', tier: 1, progress: 999, target: 1,
                comparison: 'UNSUPPORTED', unlocked: true, progress_known: false, source_available: false
            },
            {
                achievement_key: 'UNSUPPORTED_1', family_key: 'UNSUPPORTED', title: 'Unsupported', description: 'Unsupported',
                category: 'profile_and_milestones', tier: 1, progress: 999, target: 1,
                comparison: 'UNSUPPORTED', unlocked: false, progress_known: true, source_available: true
            }
        ]);

        expect(families.find(family => family.familyKey === 'RANK').tiers[0].unlocked).toBe(true);
        expect(families.find(family => family.familyKey === 'RANK_BAD').tiers[0].unlocked).toBe(false);
        expect(families.find(family => family.familyKey === 'RANK_ZERO').progressRatio).toBe(0);
        expect(families.find(family => family.familyKey === 'BOOL').tiers[0].unlocked).toBe(false);
        expect(families.find(family => family.familyKey === 'UNKNOWN').state).toBe('unknown');
        expect(families.find(family => family.familyKey === 'UNSUPPORTED').state).toBe('unknown');
    });
});
