import { describe, expect, it } from 'vitest';
import { publicStaticLocales } from '../../src/assets/js/i18n/public-static-locales.js';
import {
    ensureLanguage,
    getTranslationValue
} from '../../src/assets/js/i18n/runtime-translations.js';

const languages = ['nl', 'fr', 'de', 'es'];

describe('translation completeness', () => {
    it('keeps every methodology key available in every supported language', () => {
        const englishKeys = Object.keys(publicStaticLocales.en).sort();
        languages.forEach(language => {
            expect(Object.keys(publicStaticLocales[language]).sort()).toEqual(englishKeys);
        });
    });

    it('loads dashboard and help translations in every supported language', async () => {
        await Promise.all(languages.map(language => ensureLanguage(language)));
        languages.forEach(language => {
            expect(getTranslationValue(language, 'guidance.help.pageAction')).not.toBe('What can I do here?');
            expect(getTranslationValue(language, 'guidance.dashboard.title')).not.toBe('Find your next action');
            expect(getTranslationValue(language, 'guidance.dashboard.chooseTitle')).not.toBe('What do you want to do?');
        });
    });

    it('keeps completion translations available before the async locale finishes', () => {
        ['fr', 'de', 'es'].forEach(language => {
            expect(getTranslationValue(language, 'guidance.help.pageAction')).not.toBe('What can I do here?');
            expect(getTranslationValue(language, 'guidance.dashboard.title')).not.toBe('Find your next action');
        });
    });

    it('contains translated methodology copy instead of English fallbacks', () => {
        languages.forEach(language => {
            expect(getTranslationValue(language, 'methodology.title')).not.toBe(publicStaticLocales.en['methodology.title']);
            expect(getTranslationValue(language, 'methodology.autoProblem')).not.toBe(publicStaticLocales.en['methodology.autoProblem']);
            expect(getTranslationValue(language, 'methodology.limitTitle')).not.toBe(publicStaticLocales.en['methodology.limitTitle']);
        });
    });
});
