import { describe, expect, it } from 'vitest';
import {
    achievementLevelFromXp,
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
});
