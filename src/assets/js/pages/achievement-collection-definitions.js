const RAW_COLLECTION_DEFINITIONS = [
    {
        key: 'village',
        title: 'Village',
        description: 'Build, improve and preserve your Home Village.',
        icon: '/assets/icons/achievements/village.svg',
        iconFamily: 'village',
        sourceCategories: ['imported_home_village_base', 'imported_upgrade_activity', 'helpers'],
        badge: {
            id: 'village-master',
            name: 'Village Master',
            lockedCopy: 'Complete every Village achievement to unlock this badge.'
        }
    },
    {
        key: 'combat',
        title: 'Combat',
        description: 'Grow your offensive strength and battle activity.',
        icon: '/assets/icons/war/swords.svg',
        iconFamily: 'swords',
        sourceCategories: ['offensive_progression', 'season_economy_and_activity'],
        badge: {
            id: 'combat-master',
            name: 'Combat Master',
            lockedCopy: 'Complete every Combat achievement to unlock this badge.'
        }
    },
    {
        key: 'war-cwl',
        title: 'War & CWL',
        description: 'Prove your impact in regular wars and Clan War League.',
        icon: '/assets/icons/achievements/cwl.svg',
        iconFamily: 'cwl',
        sourceCategories: ['regular_war_offense', 'regular_war_defense', 'clan_war_league'],
        badge: {
            id: 'war-cwl-master',
            name: 'War & CWL Master',
            lockedCopy: 'Complete every War & CWL achievement to unlock this badge.'
        }
    },
    {
        key: 'clan',
        title: 'Clan',
        description: 'Celebrate loyalty, teamwork and your wider clan family.',
        icon: '/assets/icons/achievements/clan-family.svg',
        iconFamily: 'clan',
        sourceCategories: ['clan_loyalty_and_social', 'clan_achievements', 'clan_family_achievements'],
        badge: {
            id: 'clan-master',
            name: 'Clan Master',
            lockedCopy: 'Complete every Clan achievement to unlock this badge.'
        }
    },
    {
        key: 'builder-base',
        title: 'Builder Base',
        description: 'Develop your Builder Base and its battle-ready army.',
        icon: '/assets/icons/achievements/village.svg',
        iconFamily: 'village',
        sourceCategories: ['builder_base', 'imported_builder_base'],
        badge: {
            id: 'builder-base-master',
            name: 'Builder Base Master',
            lockedCopy: 'Complete every Builder Base achievement to unlock this badge.'
        }
    },
    {
        key: 'clan-capital',
        title: 'Clan Capital',
        description: 'Build the Capital and lead successful raid weekends.',
        icon: '/assets/icons/achievements/war.svg',
        iconFamily: 'war',
        sourceCategories: ['clan_capital_and_raids'],
        badge: {
            id: 'clan-capital-master',
            name: 'Clan Capital Master',
            lockedCopy: 'Complete every Clan Capital achievement to unlock this badge.'
        }
    },
    {
        key: 'progression-stats',
        title: 'Progression & Stats',
        description: 'Track profile milestones, rankings and official achievement progress.',
        icon: '/assets/icons/achievements/stats.svg',
        iconFamily: 'stats',
        sourceCategories: ['profile_and_milestones', 'trophies_and_rankings', 'legend_and_ranked_performance', 'dynamic_official_achievements'],
        badge: {
            id: 'progression-stats-master',
            name: 'Progression & Stats Master',
            lockedCopy: 'Complete every Progression & Stats achievement to unlock this badge.'
        }
    },
    {
        key: 'clashpanel',
        title: 'ClashPanel',
        description: 'Make every import and planning workflow count.',
        icon: '/assets/icons/pillars/plan.svg',
        iconFamily: 'plan',
        sourceCategories: ['clashpanel_workflow'],
        badge: {
            id: 'clashpanel-master',
            name: 'ClashPanel Master',
            lockedCopy: 'Complete every ClashPanel achievement to unlock this badge.'
        }
    },
    {
        key: 'special',
        title: 'Special',
        description: 'Discover rare collections and hidden combinations.',
        icon: '/assets/icons/achievements/special.svg',
        iconFamily: 'special',
        sourceCategories: ['cosmetics_and_village_collections', 'secret_and_combination_achievements'],
        badge: {
            id: 'special-master',
            name: 'Special Master',
            lockedCopy: 'Complete every Special achievement to unlock this badge.'
        }
    }
];

function freezeDefinition(definition) {
    Object.freeze(definition.sourceCategories);
    Object.freeze(definition.badge);
    return Object.freeze(definition);
}

export const ACHIEVEMENT_COLLECTION_DEFINITIONS = Object.freeze(
    RAW_COLLECTION_DEFINITIONS.map(freezeDefinition)
);

export const COLLECTION_DEFINITIONS = ACHIEVEMENT_COLLECTION_DEFINITIONS;
export const achievementCollectionDefinitions = ACHIEVEMENT_COLLECTION_DEFINITIONS;
export const COLLECTION_KEYS = Object.freeze(
    ACHIEVEMENT_COLLECTION_DEFINITIONS.map(definition => definition.key)
);

const LEGACY_COLLECTION_KEYS = Object.freeze({
    base: 'village',
    village: 'village',
    attack: 'combat',
    battle: 'combat',
    defense: 'combat',
    war: 'war-cwl',
    wars: 'war-cwl',
    cwl: 'war-cwl',
    clan: 'clan',
    clan_family: 'clan',
    stats: 'progression-stats',
    progression: 'progression-stats',
    native: 'progression-stats',
    official: 'progression-stats',
    planning: 'clashpanel',
    clashpanel: 'clashpanel',
    collection: 'special',
    secrets: 'special',
    rare_fun: 'special',
    other: 'special'
});

export function collectionDefinition(key) {
    return ACHIEVEMENT_COLLECTION_DEFINITIONS.find(definition => definition.key === key);
}

export function collectionKeyForSourceCategory(category) {
    const sourceCategory = String(category || '').trim().toLowerCase();
    const exact = ACHIEVEMENT_COLLECTION_DEFINITIONS.find(definition => (
        definition.sourceCategories.includes(sourceCategory)
    ));
    return exact?.key || LEGACY_COLLECTION_KEYS[sourceCategory] || 'special';
}
