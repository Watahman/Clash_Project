import { en } from './locales/en.js';
import workspaceEn from './runtime-locales/workspace-en.js';
import publicEn from './runtime-locales/public-en.js';
import { guidanceLocales } from './guidance-locales.js';
import { runtimeCompletionLocales } from './runtime-completion-locales.js';

export const supportedLanguages = Object.freeze(['nl', 'en', 'fr', 'de', 'es']);

const plannerToolFallback = Object.fromEntries(
    Object.entries(en).filter(([key]) => key.startsWith('autoPlan.') || key.startsWith('optimizePlan.'))
);

/* Only unambiguous Dutch words are checked. Shared words such as "plan",
   "automatisch" or "laden" are deliberately excluded. */
const DUTCH_LEAK_PATTERN = /\b(?:geen|opslaan|verwijderen|toevoegen|sluiten|annuleren|speler|spelers|aanval|aanvallen|instellingen|vrienden|beschikbaar|wachtwoord|gebruikersnaam|meldingen|volgende|vorige|vandaag|gisteren|kies|zoeken|overzicht|bewerken|wordt|worden)\b|\bnog geen\b|\bprobeer opnieuw\b/iu;

function completeDictionary(language, dictionary) {
    const completed = { ...translations.en, ...dictionary };
    Object.entries(completed).forEach(([key, value]) => {
        const missing = typeof value !== 'string' || value.trim() === '';
        const dutchLeak = language !== 'nl' && language !== 'en' && DUTCH_LEAK_PATTERN.test(String(value));
        if (missing || dutchLeak) completed[key] = translations.en[key] || key;
    });
    return Object.freeze(completed);
}

export const translations = {
    en: Object.freeze({ ...en, ...workspaceEn, ...publicEn })
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
    return Boolean(translations[language]);
}

export async function ensureLanguage(language) {
    if (!isSupportedLanguage(language)) return translations.en;
    if (translations[language]) return translations[language];
    if (loadingLanguages.has(language)) return loadingLanguages.get(language);

    const loading = localeLoaders[language]().then(([baseModule, workspaceModule, publicModule]) => {
        const base = baseModule[language];
        const fallback = language === 'en' || language === 'nl' ? {} : plannerToolFallback;
        const dictionary = completeDictionary(language, {
            ...fallback,
            ...base,
            ...workspaceModule.default,
            ...publicModule.default,
            ...(guidanceLocales[language] || {}),
            ...(runtimeCompletionLocales[language] || {})
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
