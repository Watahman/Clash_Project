import { en } from './locales/en.js';
import workspaceEn from './runtime-locales/workspace-en.js';
import publicEn from './runtime-locales/public-en.js';
import nlCompletion from './locale-completions/nl.js';
import frCompletion from './locale-completions/fr.js';
import deCompletion from './locale-completions/de.js';
import esCompletion from './locale-completions/es.js';
import { publicStaticLocales } from './public-static-locales.js';

export const supportedLanguages = Object.freeze(['nl', 'en', 'fr', 'de', 'es']);

const plannerToolFallback = Object.fromEntries(
    Object.entries(en).filter(([key]) => key.startsWith('autoPlan.') || key.startsWith('optimizePlan.'))
);

const eagerTranslations = Object.freeze({
    en: publicStaticLocales.en,
    nl: Object.freeze({ ...nlCompletion, ...publicStaticLocales.nl }),
    fr: Object.freeze({ ...frCompletion, ...publicStaticLocales.fr }),
    de: Object.freeze({ ...deCompletion, ...publicStaticLocales.de }),
    es: Object.freeze({ ...esCompletion, ...publicStaticLocales.es })
});

export const translations = {
    en: Object.freeze({ ...en, ...workspaceEn, ...publicEn, ...eagerTranslations.en })
};

const localeLoaders = {
    nl: () => Promise.all([
        import('./locales/nl.js'),
        import('./runtime-locales/workspace-nl.js'),
        import('./runtime-locales/public-nl.js')
    ]),
    fr: () => Promise.all([
        import('./locales/fr.js'),
        import('./runtime-locales/workspace-fr.js'),
        import('./runtime-locales/public-fr.js')
    ]),
    de: () => Promise.all([
        import('./locales/de.js'),
        import('./runtime-locales/workspace-de.js'),
        import('./runtime-locales/public-de.js')
    ]),
    es: () => Promise.all([
        import('./locales/es.js'),
        import('./runtime-locales/workspace-es.js'),
        import('./runtime-locales/public-es.js')
    ])
};

const loadingLanguages = new Map();

export function isSupportedLanguage(language) {
    return supportedLanguages.includes(language);
}

export function isLanguageLoaded(language) {
    return language === 'en' || Boolean(translations[language]);
}

export function getTranslationValue(language, key) {
    return translations[language]?.[key]
        ?? eagerTranslations[language]?.[key]
        ?? translations.en[key];
}

export async function ensureLanguage(language) {
    if (!isSupportedLanguage(language)) return translations.en;
    if (language === 'en') return translations.en;
    if (translations[language]) return translations[language];
    if (loadingLanguages.has(language)) return loadingLanguages.get(language);

    const loading = localeLoaders[language]().then(([baseModule, workspaceModule, publicModule]) => {
        const base = baseModule[language];
        const fallback = language === 'nl' ? {} : plannerToolFallback;
        const dictionary = Object.freeze({
            ...fallback,
            ...base,
            ...workspaceModule.default,
            ...publicModule.default,
            ...eagerTranslations[language]
        });
        translations[language] = dictionary;
        loadingLanguages.delete(language);
        return dictionary;
    }).catch(error => {
        loadingLanguages.delete(language);
        throw error;
    });

    loadingLanguages.set(language, loading);
    return loading;
}
