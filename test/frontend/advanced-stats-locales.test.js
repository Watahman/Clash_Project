import { describe, expect, it } from 'vitest';
import { advancedStatsLocales } from '../../src/assets/js/i18n/advanced-stats-locales.js';
import { advancedStatsExtraLocales } from '../../src/assets/js/i18n/advanced-stats-extra-locales.js';
import { advancedStatsUiLocales } from '../../src/assets/js/i18n/advanced-stats-ui-locales.js';
import { translations } from '../../src/assets/js/i18n/runtime-translations.js?v=20260829-public-auth-v1';

const featureLocales = Object.fromEntries(
    ['en', 'nl', 'fr', 'de', 'es'].map(language => [
        language,
        {
            ...(advancedStatsLocales[language] || {}),
            ...(advancedStatsExtraLocales[language] || {}),
            ...(advancedStatsUiLocales[language] || {})
        }
    ])
);

describe('Advanced Stats locales', () => {
    it('keeps complete key parity in all supported site languages', () => {
        const english = Object.keys(featureLocales.en).sort();
        expect(english.length).toBeGreaterThan(50);

        for (const language of ['nl', 'fr', 'de', 'es']) {
            expect(Object.keys(featureLocales[language]).sort(), language).toEqual(english);
        }
    });

    it('loads every Advanced Stats key into each runtime dictionary', () => {
        const keys = Object.keys(featureLocales.en);
        for (const language of ['en', 'nl', 'fr', 'de', 'es']) {
            for (const key of keys) {
                expect(translations[language][key], `${language}:${key}`).toBe(featureLocales[language][key]);
                expect(translations[language][key].trim(), `${language}:${key}`).not.toBe('');
            }
        }
    });

    it('preserves interpolation placeholders across languages', () => {
        for (const language of ['en', 'nl', 'fr', 'de', 'es']) {
            expect(featureLocales[language]['advancedStats.armyUses']).toContain('{count}');
            expect(featureLocales[language]['advancedStats.usedInAttacks']).toContain('{count}');
            expect(featureLocales[language]['advancedStats.partialLoadFailed']).toContain('{sections}');
            expect(featureLocales[language]['advancedStats.profileLoadFailedTitle']).toBeTruthy();
            expect(featureLocales[language]['advancedStats.retry']).toBeTruthy();
        }
    });

    it('uses tracked-history wording instead of claiming a reconstructed lifetime', () => {
        expect(featureLocales.en['advancedStats.startNote']).toContain('cannot reconstruct');
        expect(featureLocales.nl['advancedStats.startNote']).toContain('niet reconstrueren');
        expect(featureLocales.fr['advancedStats.startNote']).toContain('ne peut pas reconstruire');
        expect(featureLocales.de['advancedStats.startNote']).toContain('nicht rekonstruieren');
        expect(featureLocales.es['advancedStats.startNote']).toContain('no puede reconstruir');

        expect(featureLocales.en['advancedStats.armyCompositionNote']).toContain('saved army');
        expect(featureLocales.nl['advancedStats.armyCompositionNote']).toContain('opgeslagen army');
        expect(featureLocales.fr['advancedStats.armyCompositionNote']).toContain('armée enregistrée');
        expect(featureLocales.de['advancedStats.armyCompositionNote']).toContain('gespeicherten Armee');
        expect(featureLocales.es['advancedStats.armyCompositionNote']).toContain('ejército guardado');
    });
});
