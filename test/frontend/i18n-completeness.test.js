import { describe, expect, it } from 'vitest';
import { publicStaticLocales } from '../../src/assets/js/i18n/public-static-locales.js';
import { publicResourceLocales } from '../../src/assets/js/i18n/public-resource-locales.js';
import { publicPolicyExtraLocales } from '../../src/assets/js/i18n/public-policy-extra-locales.js';
import {
    ensureLanguage,
    getTranslationValue,
    isLanguageLoaded
} from '../../src/assets/js/i18n/runtime-translations.js';

const languages = ['nl', 'fr', 'de', 'es'];

describe('translation completeness', () => {
    it('keeps every methodology key available in every supported language', () => {
        const englishKeys = Object.keys(publicStaticLocales.en).sort();
        languages.forEach(language => {
            expect(Object.keys(publicStaticLocales[language]).sort()).toEqual(englishKeys);
        });
    });

    it('keeps every explicit public-resource key available in every supported language', () => {
        const englishKeys = Object.keys(publicResourceLocales.en).sort();
        languages.forEach(language => {
            expect(Object.keys(publicResourceLocales[language]).sort()).toEqual(englishKeys);
        });
    });

    it('loads all supported dictionaries synchronously', async () => {
        languages.forEach(language => expect(isLanguageLoaded(language)).toBe(true));
        await Promise.all(languages.map(language => ensureLanguage(language)));
    });

    it('translates dashboard and page-guide copy without an English loading window', () => {
        languages.forEach(language => {
            expect(getTranslationValue(language, 'guidance.help.pageAction')).not.toBe('What can I do here?');
            expect(getTranslationValue(language, 'guidance.help.kicker')).not.toBe('Page guide');
            expect(getTranslationValue(language, 'guidance.dashboard.title')).not.toBe('Find your next action');
            expect(getTranslationValue(language, 'guidance.dashboard.chooseTitle')).not.toBe('What do you want to do?');
            expect(getTranslationValue(language, 'guidance.dashboard.continueTitle')).not.toBe('Continue where you left off');
        });
    });

    it('contains translated methodology, guides, changelog and homepage copy', () => {
        languages.forEach(language => {
            expect(getTranslationValue(language, 'methodology.title')).not.toBe(publicStaticLocales.en['methodology.title']);
            expect(getTranslationValue(language, 'methodology.autoProblem')).not.toBe(publicStaticLocales.en['methodology.autoProblem']);
            expect(getTranslationValue(language, 'guides.heroTitle')).not.toBe(publicResourceLocales.en['guides.heroTitle']);
            expect(getTranslationValue(language, 'guides.article1Html')).not.toBe(publicResourceLocales.en['guides.article1Html']);
            expect(getTranslationValue(language, 'changelog.heroTitle')).not.toBe(publicResourceLocales.en['changelog.heroTitle']);
            expect(getTranslationValue(language, 'homeV2.heroLead')).not.toBe(publicResourceLocales.en['homeV2.heroLead']);
        });
    });

    it('contains explicit translated metadata and samples for every public feature page', () => {
        languages.forEach(language => {
            expect(getTranslationValue(language, 'feature.about.documentTitle')).not.toBe(publicResourceLocales.en['feature.about.documentTitle']);
            expect(getTranslationValue(language, 'feature.planner.sampleHtml')).not.toBe(publicResourceLocales.en['feature.planner.sampleHtml']);
            expect(getTranslationValue(language, 'feature.tracker.sampleHtml')).not.toBe(publicResourceLocales.en['feature.tracker.sampleHtml']);
            expect(getTranslationValue(language, 'feature.family.sampleHtml')).not.toBe(publicResourceLocales.en['feature.family.sampleHtml']);
            expect(getTranslationValue(language, 'authPage.loginTitle')).not.toBe(publicResourceLocales.en['authPage.loginTitle']);
            expect(getTranslationValue(language, 'authPage.registerTitle')).not.toBe(publicResourceLocales.en['authPage.registerTitle']);
        });
    });

    it('provides complete French German and Spanish legal-page content', () => {
        ['fr', 'de', 'es'].forEach(language => {
            const locale = publicPolicyExtraLocales[language];
            expect(locale.privacy.sections.length).toBeGreaterThanOrEqual(10);
            expect(locale.cookies.sections.length).toBeGreaterThanOrEqual(7);
            expect(locale.terms.sections.length).toBeGreaterThanOrEqual(11);
            expect(locale.contact.sections.length).toBeGreaterThanOrEqual(3);
            expect(locale.contact.feedback.send).toBeTruthy();
        });
    });
});
