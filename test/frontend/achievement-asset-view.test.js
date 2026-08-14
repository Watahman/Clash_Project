import { describe, expect, it } from 'vitest';
import { resolveAchievementAsset } from '../../src/assets/js/pages/achievement-asset-view.js';

const family = (familyKey, title = familyKey, category = 'Achievements') => ({ familyKey, title, category, description: '' });

describe('Achievement family assets', () => {
    it('uses different semantic assets for unrelated achievement families', () => {
        const assets = [
            resolveAchievementAsset(family('WAR_TRIPLE_MACHINE', 'Triple Machine')),
            resolveAchievementAsset(family('BASE_ECONOMY_COMPLETION', 'Economy Completion')),
            resolveAchievementAsset(family('COL_HERO_WARDROBE', 'Hero Wardrobe')),
            resolveAchievementAsset(family('APP_DATA_STEWARD', 'Data Steward'))
        ];

        expect(new Set(assets.map(asset => `${asset.type}:${asset.value}`)).size).toBe(4);
    });

    it('prefers a real game entity when the family describes a game object', () => {
        expect(resolveAchievementAsset(family('BASE_DEFENSE_COMPLETION', 'Defense Completion'))).toMatchObject({ type: 'entity' });
        expect(resolveAchievementAsset(family('OFF_SPELL_SCHOLAR', 'Spell Scholar'))).toMatchObject({ type: 'entity' });
        expect(resolveAchievementAsset(family('PLY_TH', 'Town Hall Trailblazer'))).toMatchObject({ type: 'entity' });
    });

    it('keeps explicitly supplied entity assets intact', () => {
        expect(resolveAchievementAsset({ ...family('CUSTOM'), entity: 'root-rider' }))
            .toEqual({ type: 'entity', value: 'root-rider' });
    });

    it('falls back to a custom SVG glyph instead of the generic category icon', () => {
        expect(resolveAchievementAsset(family('DYN_OFFICIAL_ACHIEVEMENT', 'Official Achievement Mastery')))
            .toMatchObject({ type: 'glyph', value: 'spark' });
    });
});
