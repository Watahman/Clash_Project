import { nl } from './locales/nl.js';
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';
import { de } from './locales/de.js';
import { es } from './locales/es.js';
import { workspaceLocales } from './workspace-locales.js';

const autoPlanFallback = Object.fromEntries(
    Object.entries(en).filter(([key]) => key.startsWith('autoPlan.'))
);

export const translations = Object.freeze({
    nl: Object.freeze({ ...nl, ...workspaceLocales.nl }),
    en: Object.freeze({ ...en, ...workspaceLocales.en }),
    fr: Object.freeze({ ...autoPlanFallback, ...fr, ...workspaceLocales.fr }),
    de: Object.freeze({ ...autoPlanFallback, ...de, ...workspaceLocales.de }),
    es: Object.freeze({ ...autoPlanFallback, ...es, ...workspaceLocales.es })
});
