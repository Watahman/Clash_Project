import { builderBaseAchievementLocales } from './builder-base.js';
import { clanAchievementLocales } from './clan-achievements.js';
import { capitalRaidAchievementLocales } from './capital-raids.js';
import { profileOffenseSeasonLocales } from './profile-offense-seasons.js';
import { trophiesLegendLocales } from './trophies-legend.js';
import { warsCwlLocales } from './wars-cwl.js';
import { socialFamilyLocales } from './social-family.js';
import { workflowSecretLocales } from './workflow-secret.js';
import { importedHomeLocales } from './imported-home.js';
import { builderHelpersCosmeticsLocales } from './builder-helpers-cosmetics.js';

const LANGUAGES = Object.freeze(['en', 'nl', 'fr', 'de', 'es']);

export const achievementFamilyLocales = Object.freeze(Object.fromEntries(
    LANGUAGES.map(language => [language, Object.freeze({
        ...builderBaseAchievementLocales[language],
        ...clanAchievementLocales[language],
        ...capitalRaidAchievementLocales[language],
        ...profileOffenseSeasonLocales[language],
        ...trophiesLegendLocales[language],
        ...warsCwlLocales[language],
        ...socialFamilyLocales[language],
        ...workflowSecretLocales[language],
        ...importedHomeLocales[language],
        ...builderHelpersCosmeticsLocales[language]
    })])
));
