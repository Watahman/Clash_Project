import nl from './achievement-locales/nl.js';
import en from './achievement-locales/en.js';
import fr from './achievement-locales/fr.js';
import de from './achievement-locales/de.js';
import es from './achievement-locales/es.js';
import { achievementBattleLocales } from './achievement-battle-locales.js';
import { achievementExpandedLocales } from './achievement-expanded-locales.js';

function withExpandedCopy(language, base) {
    return Object.freeze({
        ...base,
        ...(achievementBattleLocales[language] || achievementBattleLocales.en),
        ...(achievementExpandedLocales[language] || achievementExpandedLocales.en)
    });
}

export const achievementLocales = Object.freeze({
    nl: withExpandedCopy('nl', nl),
    en: withExpandedCopy('en', en),
    fr: withExpandedCopy('fr', fr),
    de: withExpandedCopy('de', de),
    es: withExpandedCopy('es', es)
});
