import { publicHomeLocales } from './public-home-locales.js';
import { publicHomeV3Locales } from './public-home-v3-locales.js';
import { publicHomeV3MicroLocales } from './public-home-v3-micro-locales.js';
import { publicGuidesLocales } from './public-guides-locales.js';
import { publicChangelogLocales } from './public-changelog-locales.js?v=20260821-public-pages';
import { publicFeatureExtraLocales } from './public-feature-extra-locales.js?v=20260821-public-pages';
import { publicMediaLocales } from './public-media-locales.js';
import { publicAccessibilityLocales } from './public-accessibility-locales.js';
import { authPageLocales } from './auth-page-locales.js';

const languages = ['en', 'nl', 'fr', 'de', 'es'];

export const publicResourceLocales = Object.freeze(Object.fromEntries(
    languages.map(language => [language, Object.freeze({
        ...publicHomeLocales[language],
        ...publicHomeV3Locales[language],
        ...publicHomeV3MicroLocales[language],
        ...publicGuidesLocales[language],
        ...publicChangelogLocales[language],
        ...publicFeatureExtraLocales[language],
        ...publicMediaLocales[language],
        ...publicAccessibilityLocales[language],
        ...authPageLocales[language]
    })])
));
