import { describe, expect, it } from 'vitest';
import { translations } from '../../src/assets/js/i18n/translations.js';
import { de } from '../../src/assets/js/i18n/locales/de.js';
import { en } from '../../src/assets/js/i18n/locales/en.js';
import { es } from '../../src/assets/js/i18n/locales/es.js';
import { fr } from '../../src/assets/js/i18n/locales/fr.js';

describe('translation dictionaries', () => {
    it('have identical keys for every supported locale', () => {
        const baseline = Object.keys(translations.nl).sort();
        for (const [locale, dictionary] of Object.entries(translations)) {
            expect(Object.keys(dictionary).sort(), locale).toEqual(baseline);
        }
    });

    it('provides native Auto Plan and Optimize Plan copy in every locale', () => {
        const plannerKeys = Object.keys(en)
            .filter(key => key.startsWith('autoPlan.') || key.startsWith('optimizePlan.'))
            .sort();

        for (const [locale, dictionary] of Object.entries({ fr, de, es })) {
            const localizedKeys = Object.keys(dictionary)
                .filter(key => key.startsWith('autoPlan.') || key.startsWith('optimizePlan.'))
                .sort();
            expect(localizedKeys, locale).toEqual(plannerKeys);
        }
    });

    it('preserves feature placeholders in every language', () => {
        const featureKeys = Object.keys(translations.en).filter(key =>
            key.startsWith('autoPlan.')
            || key.startsWith('optimizePlan.')
            || key.startsWith('cwl.sheet')
        );
        const placeholders = value =>
            [...String(value).matchAll(/\{([^}]+)}/g)].map(match => match[1]).sort();

        for (const key of featureKeys) {
            const expected = placeholders(translations.en[key]);
            for (const [locale, dictionary] of Object.entries(translations)) {
                expect(placeholders(dictionary[key]), `${locale}:${key}`).toEqual(expected);
            }
        }
    });

    it('localizes the planner tool buttons outside English and Dutch', () => {
        const buttonKeys = [
            'cwl.sheetImport',
            'autoPlan.open',
            'optimizePlan.open'
        ];

        for (const locale of ['fr', 'de', 'es']) {
            for (const key of buttonKeys) {
                expect(translations[locale][key], `${locale}:${key}`)
                    .not.toBe(translations.en[key]);
            }
        }
    });
});
