const BRANCH_DEFINITIONS = Object.freeze([
    ['cwl', 'cwl', '/assets/icons/achievements/cwl.svg'],
    ['wars', 'wars', '/assets/icons/achievements/war.svg'],
    ['planning', 'planning', '/assets/icons/pillars/plan.svg'],
    ['stats', 'stats', '/assets/icons/achievements/stats.svg'],
    ['progression', 'progression', '/assets/icons/achievements/progression.svg'],
    ['base', 'base', '/assets/icons/achievements/village.svg'],
    ['clan', 'clan', '/assets/icons/achievements/clan-family.svg'],
    ['clan_family', 'clanFamily', '/assets/icons/ui/link.svg'],
    ['collection', 'collection', '/assets/icons/achievements/collection.svg'],
    ['secrets', 'secrets', '/assets/icons/achievements/special.svg'],
    ['official', 'official', '/assets/icons/stats/star.svg'],
    ['other', 'other', '/assets/icons/achievements/progression.svg']
].map(([key, labelKey, icon]) => Object.freeze({ key, labelKey, icon })));

const CATEGORY_BRANCH = Object.freeze({
    clan_war_league: 'cwl',
    cwl: 'cwl',
    regular_war_offense: 'wars',
    regular_war_defense: 'wars',
    war: 'wars',
    clashpanel_workflow: 'planning',
    clashpanel: 'planning',
    trophies_and_rankings: 'stats',
    legend_and_ranked_performance: 'stats',
    season_economy_and_activity: 'stats',
    clan_capital_and_raids: 'stats',
    stats: 'stats',
    battle: 'stats',
    profile_and_milestones: 'progression',
    offensive_progression: 'progression',
    progression: 'progression',
    attack: 'progression',
    defense: 'progression',
    builder_base: 'base',
    imported_home_village_base: 'base',
    imported_upgrade_activity: 'base',
    imported_builder_base: 'base',
    helpers: 'base',
    village: 'base',
    clan_loyalty_and_social: 'clan',
    clan_achievements: 'clan',
    clan: 'clan',
    clan_family_achievements: 'clan_family',
    clan_family: 'clan_family',
    cosmetics_and_village_collections: 'collection',
    collection: 'collection',
    secret_and_combination_achievements: 'secrets',
    rare_fun: 'secrets',
    dynamic_official_achievements: 'official',
    native: 'official'
});

const SOURCE_BRANCH = Object.freeze({
    cwl_history: 'cwl',
    war: 'wars',
    clashpanel: 'planning',
    advanced_stats: 'stats',
    legend_history: 'stats',
    clashking_history: 'stats',
    raid_history: 'stats',
    clan_family: 'clan_family'
});

const PRIORITY_ORDER = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const Y_PATTERN = Object.freeze([72, 126, 92, 146, 62, 112]);

function slug(value) {
    return String(value || '').trim().toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

export function chronicleBranchKey(family) {
    const category = slug(family?.category);
    return CATEGORY_BRANCH[category] || SOURCE_BRANCH[String(family?.source || '').toLowerCase()] || 'other';
}

export function chronicleRarity(family) {
    const tier = family?.complete ? family?.highestUnlocked : family?.currentTier;
    return String(tier?.rarity || 'common').toLowerCase();
}

export function isChronicleMilestone(family) {
    return String(family?.priority || '').toUpperCase() === 'P0';
}

export function isChronicleReached(family) {
    return family?.complete === true || (family?.unlockedTiers?.length || 0) > 0;
}

function familyOrder(left, right) {
    const priority = (PRIORITY_ORDER[String(left?.priority).toUpperCase()] ?? 9)
        - (PRIORITY_ORDER[String(right?.priority).toUpperCase()] ?? 9);
    return priority || String(left?.familyKey || '').localeCompare(String(right?.familyKey || ''));
}

export function buildChronicleBranches(families) {
    const grouped = new Map(BRANCH_DEFINITIONS.map(branch => [branch.key, { ...branch, families: [] }]));
    for (const family of families || []) grouped.get(chronicleBranchKey(family)).families.push(family);
    return [...grouped.values()]
        .filter(branch => branch.families.length)
        .map(branch => ({ ...branch, families: branch.families.sort(familyOrder) }));
}

export function chronicleNodePositions(count) {
    return Array.from({ length: count }, (_, index) => ({
        x: 78 + index * 154,
        y: Y_PATTERN[index % Y_PATTERN.length]
    }));
}

export function chronicleMapSize(positions) {
    return {
        width: Math.max(380, (positions.at(-1)?.x || 0) + 86),
        height: 318
    };
}

export { BRANCH_DEFINITIONS };
