import { publicHomeLocales } from './public-home-locales.js';
import { publicGuidesLocales } from './public-guides-locales.js';
import { publicChangelogLocales } from './public-changelog-locales.js';

const languages = ['en', 'nl', 'fr', 'de', 'es'];

export const publicResourceLocales = Object.freeze(Object.fromEntries(
    languages.map(language => [language, Object.freeze({
        ...publicHomeLocales[language],
        ...publicGuidesLocales[language],
        ...publicChangelogLocales[language]
    })])
));
