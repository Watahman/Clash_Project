import { describe, expect, it } from 'vitest';
import { translations } from '../../src/assets/js/i18n/translations.js';

describe('translation dictionaries', () => {
    it('have identical keys for every supported locale', () => {
        const baseline = Object.keys(translations.nl).sort();
        for (const [locale, dictionary] of Object.entries(translations)) {
            expect(Object.keys(dictionary).sort(), locale).toEqual(baseline);
        }
    });
});
