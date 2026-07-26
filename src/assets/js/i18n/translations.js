import { nl } from './locales/nl.js';
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';
import { de } from './locales/de.js';
import { es } from './locales/es.js';
import { workspaceLocales } from './workspace-locales.js';

const plannerToolFallback = Object.fromEntries(
    Object.entries(en).filter(([key]) =>
        key.startsWith('autoPlan.') || key.startsWith('optimizePlan.')
    )
);

export const translations = Object.freeze({
    nl: Object.freeze({ ...nl, ...workspaceLocales.nl }),
    en: Object.freeze({ ...en, ...workspaceLocales.en }),
    fr: Object.freeze({ ...plannerToolFallback, ...fr, ...workspaceLocales.fr }),
    de: Object.freeze({ ...plannerToolFallback, ...de, ...workspaceLocales.de }),
    es: Object.freeze({ ...plannerToolFallback, ...es, ...workspaceLocales.es })
});
