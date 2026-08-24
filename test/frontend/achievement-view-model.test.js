import { describe, expect, it } from 'vitest';
import {
    achievementLevelFromXp,
    buildAchievementSummary,
    collectLinkedAccounts,
    filterAchievementFamilies,
    groupAchievementFamilies,
    parseBaseDataText
} from '../../src/assets/js/achievements/achievement-view-model.js';

describe('achievement base-data view model', () => {
    it('validates and unwraps copied base data', () => {
        const result = parseBaseDataText(JSON.stringify({
            baseData: {
                tag: '#LQURPQJ0Y',
                timestamp: 1786035596,
                buildings: [{ data: 1000000, lvl: 13, cnt: 4 }],
                traps: [{ data: 12000000, lvl: 10, cnt: 4 }],
                heroes: [{ data: 28000000, lvl: 100 }],
                units: [{ data: 4000000, lvl: 12 }]
            }
        }));

        expect(result.valid).toBe(true);
        expect(result.tag).toBe('#LQURPQJ0Y');
        expect(result.recognizedSections).toEqual(['buildings', 'traps', 'units', 'heroes']);
        expect(result.itemCount).toBe(4);
    });

    it('rejects incomplete or invalid exports before sending them', () => {
        expect(parseBaseDataText('{broken').valid).toBe(false);
        expect(parseBaseDataText(JSON.stringify({ tag: '#ABC', timestamp: 123 })).valid).toBe(false);
    });

    it('extracts and deduplicates linked player accounts', () => {
        const accounts = collectLinkedAccounts([{
            name: 'Profile owner',
            accounts: [
                { tag: '#ABC123', name: 'Main', townHallLevel: 17 },
                { playerTag: '#ABC123', name: 'Duplicate' },
                { clashTag: 'DEF456', playerName: 'Mini', townhall: 13 }
            ]
        }]);

        expect(accounts).toEqual([
            { tag: '#ABC123', name: 'Main', townHallLevel: 17 },
            { tag: '#DEF456', name: 'Mini', townHallLevel: 13 }
        ]);
    });
});

describe('achievement family presentation', () => {
    const rows = [
        {
            achievement_key: 'hero_power_1', family_key: 'hero_power', title: 'Hero Power I',
            description: 'Combined hero levels: 100', category: 'army', rarity: 'common',
            tier: 1, xp: 50, progress: 180, target: 100, unlocked: true,
            progress_known: true, source_available: true
        },
        {
            achievement_key: 'hero_power_2', family_key: 'hero_power', title: 'Hero Power II',
            description: 'Combined hero levels: 250', category: 'army', rarity: 'rare',
            tier: 2, xp: 100, progress: 180, target: 250, unlocked: false,
            progress_known: true, source_available: true
        },
        {
            achievement_key: 'wall_grinder_1', family_key: 'wall_grinder', title: 'Wall Grinder I',
            description: 'Combined wall levels: 500', category: 'base', rarity: 'common',
            tier: 1, xp: 50, progress: 0, target: 500, unlocked: false,
            progress_known: true, source_available: true
        }
    ];

    it('groups tiers into one useful card per family', () => {
        const families = groupAchievementFamilies(rows);
        const hero = families.find(family => family.familyKey === 'hero_power');

        expect(hero.title).toBe('Hero Power');
        expect(hero.description).toBe('Combined hero levels');
        expect(hero.state).toBe('unlocked');
        expect(hero.currentTier.tier).toBe(2);
        expect(hero.progressRatio).toBeCloseTo(0.72);
    });

    it('builds XP and completion summaries from permanent unlocks', () => {
        const summary = buildAchievementSummary(groupAchievementFamilies(rows));

        expect(summary.familyCount).toBe(2);
        expect(summary.unlockedTierCount).toBe(1);
        expect(summary.totalTierCount).toBe(3);
        expect(summary.totalXp).toBe(50);
        expect(summary.level).toEqual(achievementLevelFromXp(50));
    });

    it('shows shared clan unlocks without adding them to personal XP', () => {
        const clanRow = {
            achievement_key: 'cl_level_1', family_key: 'cl_level', title: 'Clan Level I',
            description: 'Reach clan level 2', category: 'clan', rarity: 'common', scope: 'clan',
            tier: 1, xp: 500, progress: 2, target: 2, unlocked: true,
            progress_known: true, source_available: true
        };
        const summary = buildAchievementSummary(groupAchievementFamilies([...rows, clanRow]));

        expect(summary.unlockedTierCount).toBe(2);
        expect(summary.totalXp).toBe(50);
        expect(summary.level).toEqual(achievementLevelFromXp(50));
    });

    it('filters by category, state, rarity and text', () => {
        const families = groupAchievementFamilies(rows);
        expect(filterAchievementFamilies(families, { category: 'army' })).toHaveLength(1);
        expect(filterAchievementFamilies(families, { status: 'locked' })[0].familyKey).toBe('wall_grinder');
        expect(filterAchievementFamilies(families, { rarity: 'rare' })[0].familyKey).toBe('hero_power');
        expect(filterAchievementFamilies(families, { search: 'wall' })[0].familyKey).toBe('wall_grinder');
    });
});
