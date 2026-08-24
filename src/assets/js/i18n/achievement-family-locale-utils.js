const LANGUAGES = Object.freeze(['en', 'nl', 'fr', 'de', 'es']);

export function buildFamilyLocaleMaps(families) {
    const maps = Object.fromEntries(LANGUAGES.map(language => [language, {}]));
    Object.entries(families).forEach(([familyKey, copy]) => {
        LANGUAGES.forEach(language => {
            const prefix = `achievements.family.${familyKey}`;
            if (copy.title[language]) maps[language][`${prefix}.title`] = copy.title[language];
            if (copy.description[language]) maps[language][`${prefix}.description`] = copy.description[language];
        });
    });
    return Object.freeze(Object.fromEntries(
        LANGUAGES.map(language => [language, Object.freeze(maps[language])])
    ));
}
