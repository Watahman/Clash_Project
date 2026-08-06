import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { achievementLocales } from '../../src/assets/js/i18n/achievement-locales.js';

const languages = ['nl', 'en', 'fr', 'de', 'es'];

const historicalFamilies = [
    'snapshot_historian', 'long_term_tracker', 'building_momentum',
    'wall_marathon', 'hero_training_arc', 'equipment_evolution',
    'army_evolution', 'builder_momentum', 'collection_growth',
    'active_project_log', 'productive_checkins', 'progress_burst'
];

describe('Achievement history and locale integration', () => {
    it('keeps achievement translation keys aligned in all languages', () => {
        const englishKeys = Object.keys(achievementLocales.en).sort();
        expect(englishKeys).toHaveLength(198);
        for (const language of languages) {
            expect(Object.keys(achievementLocales[language]).sort()).toEqual(englishKeys);
            expect(achievementLocales[language]['nav.achievements']).toBeTruthy();
            expect(achievementLocales[language]['achievements.category.history']).toBeTruthy();
        }
    });

    it('contains every historical achievement family in each language', () => {
        for (const language of languages) {
            for (const family of historicalFamilies) {
                expect(achievementLocales[language][`achievements.family.${family}.title`]).toBeTruthy();
                expect(achievementLocales[language][`achievements.family.${family}.description`]).toBeTruthy();
            }
        }
    });

    it('loads a permanent achievements link through the shared i18n runtime', () => {
        const navigation = readFileSync('src/assets/js/shell/achievements-navigation.js', 'utf8');
        const runtimeTranslations = readFileSync('src/assets/js/i18n/runtime-translations.js', 'utf8');
        expect(navigation).toContain("data-workspace-nav = 'achievements'");
        expect(navigation).toContain("const ACHIEVEMENTS_PATH = '/app/achievements'");
        expect(navigation).toContain('prefetchAchievements');
        expect(runtimeTranslations).toContain("import '../shell/achievements-navigation.js'");
    });

    it('marks the workspace page for translated achievement rendering', () => {
        const html = readFileSync('src/subpages/achievements.html', 'utf8');
        const page = readFileSync('src/assets/js/pages/achievements.js', 'utf8');
        expect(html).toContain('data-workspace-page="achievements"');
        expect(html).toContain('data-i18n="achievements.title"');
        expect(page).toContain("window.addEventListener('clashtools:language-changed'");
        expect(page).toContain('achievements.family.${family.familyKey}.title');
    });
});
