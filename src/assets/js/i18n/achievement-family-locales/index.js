import { builderBaseAchievementLocales } from './builder-base.js';
import { clanAchievementLocales } from './clan-achievements.js';
import { capitalRaidAchievementLocales } from './capital-raids.js';

const LANGUAGES = Object.freeze(['en', 'nl', 'fr', 'de', 'es']);

export const achievementFamilyLocales = Object.freeze(Object.fromEntries(
    LANGUAGES.map(language => [language, Object.freeze({
        ...builderBaseAchievementLocales[language],
        ...clanAchievementLocales[language],
        ...capitalRaidAchievementLocales[language]
    })])
));
