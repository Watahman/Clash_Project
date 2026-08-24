import { nl } from './locales/nl.js';
import { en } from './locales/en.js';
import { fr } from './locales/fr.js';
import { de } from './locales/de.js';
import { es } from './locales/es.js';
import { workspaceLocales } from './workspace-locales.js';
import { publicPageLocales } from './public-pages-locales.js';
import { achievementLocales } from './achievement-locales.js?v=20260823-achievement-card-assets-1';

const plannerToolFallback = Object.fromEntries(
    Object.entries(en).filter(([key]) =>
        key.startsWith('autoPlan.') || key.startsWith('optimizePlan.')
    )
);

export const translations = Object.freeze({
    nl: Object.freeze({ ...nl, ...workspaceLocales.nl, ...publicPageLocales.nl, ...achievementLocales.nl }),
    en: Object.freeze({ ...en, ...workspaceLocales.en, ...publicPageLocales.en, ...achievementLocales.en }),
    fr: Object.freeze({ ...plannerToolFallback, ...fr, ...workspaceLocales.fr, ...publicPageLocales.fr, ...achievementLocales.fr }),
    de: Object.freeze({ ...plannerToolFallback, ...de, ...workspaceLocales.de, ...publicPageLocales.de, ...achievementLocales.de }),
    es: Object.freeze({ ...plannerToolFallback, ...es, ...workspaceLocales.es, ...publicPageLocales.es, ...achievementLocales.es })
});
