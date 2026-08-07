import { describe, expect, it } from 'vitest';
import { advancedStatsLocales } from '../../src/assets/js/i18n/advanced-stats-locales.js';

describe('Advanced Stats locales', () => {
    it('keeps complete English and Dutch key parity', () => {
        const english = Object.keys(advancedStatsLocales.en).sort();
        const dutch = Object.keys(advancedStatsLocales.nl).sort();
        expect(dutch).toEqual(english);
        expect(english.length).toBeGreaterThan(50);
    });

    it('uses tracked-history wording instead of claiming a reconstructed lifetime', () => {
        expect(advancedStatsLocales.en['advancedStats.startNote']).toContain('cannot reconstruct');
        expect(advancedStatsLocales.nl['advancedStats.startNote']).toContain('niet reconstrueren');
        expect(advancedStatsLocales.en['advancedStats.armyCompositionNote']).toContain('cannot prove');
        expect(advancedStatsLocales.nl['advancedStats.armyCompositionNote']).toContain('niet bewijzen');
    });
});
