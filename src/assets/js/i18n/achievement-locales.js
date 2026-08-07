import nl from './achievement-locales/nl.js';
import en from './achievement-locales/en.js';
import fr from './achievement-locales/fr.js';
import de from './achievement-locales/de.js';
import es from './achievement-locales/es.js';
import { achievementBattleLocales } from './achievement-battle-locales.js';

function withBattleCopy(language, base) {
    return Object.freeze({
        ...base,
        ...(achievementBattleLocales[language] || achievementBattleLocales.en)
    });
}

export const achievementLocales = Object.freeze({
    nl: withBattleCopy('nl', nl),
    en: withBattleCopy('en', en),
    fr: withBattleCopy('fr', fr),
    de: withBattleCopy('de', de),
    es: withBattleCopy('es', es)
});