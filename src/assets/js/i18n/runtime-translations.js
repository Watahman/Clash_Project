import { en } from './locales/en.js';
import { nl } from './locales/nl.js';
import { fr } from './locales/fr.js';
import { de } from './locales/de.js';
import { es } from './locales/es.js';
import workspaceEn from './runtime-locales/workspace-en.js?v=20260809-4';
import workspaceNl from './runtime-locales/workspace-nl.js?v=20260809-4';
import workspaceFr from './runtime-locales/workspace-fr.js?v=20260809-4';
import workspaceDe from './runtime-locales/workspace-de.js?v=20260809-4';
import workspaceEs from './runtime-locales/workspace-es.js?v=20260809-4';
import publicEn from './runtime-locales/public-en.js';
import publicNl from './runtime-locales/public-nl.js';
import publicFr from './runtime-locales/public-fr.js';
import publicDe from './runtime-locales/public-de.js';
import publicEs from './runtime-locales/public-es.js';
import nlCompletion from './locale-completions/nl.js';
import frCompletion from './locale-completions/fr.js';
import deCompletion from './locale-completions/de.js';
import esCompletion from './locale-completions/es.js';
import { publicStaticLocales } from './public-static-locales.js?v=20260812-redesign';
import { publicResourceLocales } from './public-resource-locales.js';
import { achievementLocales } from './achievement-locales.js';
import { advancedStatsLocales } from './advanced-stats-locales.js?v=20260809-4';
import { advancedStatsExtraLocales } from './advanced-stats-extra-locales.js?v=20260809-4';
import { advancedStatsUiLocales } from './advanced-stats-ui-locales.js?v=20260809-4';
import { profilePageLocales } from './profile-page-locales.js';
import { navigationV2Locales } from './navigation-v2-locales.js';

export const supportedLanguages = Object.freeze(['nl', 'en', 'fr', 'de', 'es']);

const plannerToolFallback = Object.fromEntries(
    Object.entries(en).filter(([key]) => key.startsWith('autoPlan.') || key.startsWith('optimizePlan.'))
);

function buildDictionary(language, base, workspace, publicCopy, completion = {}) {
    const fallback = language === 'en' || language === 'nl' ? {} : plannerToolFallback;
    const advancedStats = {
        ...(advancedStatsLocales[language] || {}),
        ...(advancedStatsExtraLocales[language] || {}),
        ...(advancedStatsUiLocales[language] || {})
    };
    return Object.freeze({
        ...fallback,
        ...base,
        ...workspace,
        ...publicCopy,
        ...completion,
        ...advancedStats,
        ...(publicStaticLocales[language] || {}),
        ...(publicResourceLocales[language] || {}),
        ...(achievementLocales[language] || {}),
        ...(profilePageLocales[language] || {}),
        ...(navigationV2Locales[language] || {})
    });
}

export const translations = Object.freeze({
    en: buildDictionary('en', en, workspaceEn, publicEn),
    nl: buildDictionary('nl', nl, workspaceNl, publicNl, nlCompletion),
    fr: buildDictionary('fr', fr, workspaceFr, publicFr, frCompletion),
    de: buildDictionary('de', de, workspaceDe, publicDe, deCompletion),
    es: buildDictionary('es', es, workspaceEs, publicEs, esCompletion)
});

export function isSupportedLanguage(language) {
    return supportedLanguages.includes(language);
}

export function isLanguageLoaded(language) {
    return isSupportedLanguage(language);
}

export function getTranslationValue(language, key) {
    return translations[language]?.[key] ?? translations.en[key];
}

export async function ensureLanguage(language) {
    return translations[isSupportedLanguage(language) ? language : 'en'];
}
