import { entityImage } from './progress-asset-view.js?v=20260814-achievement-icons-1';

const ICON_PATHS = Object.freeze({
    trophy: '/assets/icons/war/trophy.svg', medal: '/assets/icons/war/medal.svg', target: '/assets/icons/war/target.svg',
    swords: '/assets/icons/war/swords.svg', shield: '/assets/icons/war/shield.svg', win: '/assets/icons/war/win.svg',
    promotion: '/assets/icons/war/promotion.svg', attack: '/assets/icons/war/attack-used.svg', missed: '/assets/icons/war/missed-attack.svg',
    cwl: '/assets/icons/achievements/cwl.svg', war: '/assets/icons/achievements/war.svg', defense: '/assets/icons/achievements/defense.svg',
    collection: '/assets/icons/achievements/collection.svg', social: '/assets/icons/achievements/social.svg', clan: '/assets/icons/achievements/clan-family.svg',
    village: '/assets/icons/achievements/village.svg', progression: '/assets/icons/achievements/progression.svg', special: '/assets/icons/achievements/special.svg',
    stats: '/assets/icons/achievements/stats.svg', star: '/assets/icons/stats/star.svg', army: '/assets/icons/stats/army.svg', tracking: '/assets/icons/stats/tracking.svg',
    trend: '/assets/icons/stats/trend-up.svg', history: '/assets/icons/stats/history.svg', destruction: '/assets/icons/stats/destruction.svg',
    plan: '/assets/icons/pillars/plan.svg', calendar: '/assets/icons/ui/calendar.svg', clock: '/assets/icons/ui/clock.svg', users: '/assets/icons/ui/users.svg',
    user: '/assets/icons/ui/user.svg', link: '/assets/icons/ui/link.svg', check: '/assets/icons/ui/check.svg', export: '/assets/icons/ui/export.svg'
});

const ENTITY_RULES = Object.freeze([
    [/PLY_TH|TOWN[_ ]HALL|TH[_ ]?\d/, ['town-hall-17', 'town-hall-14', 'town-hall-10']],
    [/HERO|CROWN|HALL[_ ]OF[_ ]FAME|WARDROBE/, ['barbarian-king', 'archer-queen', 'grand-warden', 'royal-champion']],
    [/PET|MENAGERIE/, ['unicorn', 'diggy', 'phoenix', 'spirit-fox']],
    [/SPELL|ARCANE|MAGIC/, ['rage-spell', 'freeze-spell', 'lightning-spell', 'invisibility-spell']],
    [/SIEGE|ENGINEER|WORKSHOP/, ['wall-wrecker', 'battle-blimp', 'log-launcher', 'siege-barracks']],
    [/EQUIP|FORGE|BLACKSMITH|WEAPON/, ['heroic-torch', 'giant-gauntlet', 'eternal-tome', 'magic-mirror']],
    [/GOLD|ECONOM/, ['gold-mine', 'gold-storage']],
    [/ELIXIR/, ['elixir-collector', 'elixir-storage']],
    [/DARK|HARVEST/, ['dark-elixir-drill', 'dark-elixir-storage']],
    [/TRAP/, ['giant-bomb', 'bomb', 'seeking-air-mine', 'skeleton-trap']],
    [/WALL/, ['wall-breaker', 'super-wall-breaker']],
    [/LABORATORY/, ['laboratory']],
    [/PET[_ ]HOUSE/, ['pet-house']],
    [/DEFENSE|FORTRESS|STONEWALL|UNDER[_ ]FIRE|BASE[_ ]DEF/, ['air-defense', 'inferno-tower', 'cannon', 'hidden-tesla']],
    // Word-boundaried so generic words that merely *contain* these roots (e.g. "Raider", "Commander")
    // don't hijack the match — see resolveAchievementAsset() for why scope also matters here.
    [/\bCAPITAL\b|\bRAID\b|\bDISTRICT\b/, ['clan-castle', 'army-camp', 'workshop']],
    [/TROOP|ARMY|BARRACK|OFFENSIVE|\bCOMMAND\b|TRAINER/, ['root-rider', 'barbarian', 'dragon', 'pekka', 'golem']],
    [/DECOR|SCENERY|OBSTACLE|COLLECTION|MUSEUM/, ['magic-mirror', 'stick-horse', 'action-figure', 'fire-heart']]
]);

const GLYPH_RULES = Object.freeze([
    [/PLY_ACH_COMPLETE/, 'crown'],
    [/PLY_ACH_PROGRESS/, 'steps'],
    [/SEC_MASTER_OF_THREE/, 'map'],
    [/APP_BASE_ARCHIV/, 'chest'],
    [/DYN/, 'spark']
]);

// Rules that only fire within a whitelisted set of families' own categories (matched against
// the achievement's clean, curated `category` field, not free text). Used for keywords that are
// unambiguous in some categories ("Rank"/"Record" for trophies) but get borrowed in a different
// sense elsewhere ("Trusted Rank" clan role tenure, "Internal Mobility" — "Record players moving…").
const TROPHY_RANK_CATEGORIES = Object.freeze([
    'Trophies & rankings', 'Legend & ranked performance', 'Builder Base', 'Clan achievements'
]);

const ICON_RULES = Object.freeze([
    // "LEAGUE" dropped as a bare trigger — it shows up in non-CWL prose too (e.g. "profile … league
    // … visible" for the Trophy League). CWL/PROMOTION/PODIUM are unambiguous enough on their own.
    [/CWL|PROMOTION|PODIUM/, ['cwl', 'promotion', 'trophy', 'medal']],
    [/(?:^|[^A-Z])WAR(?:_|\s|$)|TRIPLE|STREAK|FINISH|CLEANUP|RAIDER|OPENING|CLUTCH|CAMPAIGN/, ['war', 'swords', 'attack', 'win', 'target', 'medal']],
    [/DEF|SHIELD|SURVIV|BOUNCE|ONE[_ ]STAR|STONEWALL/, ['shield', 'defense', 'missed', 'destruction']],
    [/RAID|CAPITAL/, ['attack', 'army', 'trophy', 'target']],
    [/TR_|TROPHY|RANK|PEAK|PUSH|CLIMB|RECORD|WORLD[_ ]RANKED/, ['trophy', 'target', 'medal', 'trend'], TROPHY_RANK_CATEGORIES],
    [/STAR|CONSTELLATION|ACH[_ ]STARS/, ['star', 'medal', 'special']],
    [/SOC|CLAN|FAM|FAMILY|DONAT|MEMBER|LOYAL|SERVICE|ROSTER|POPULATION|BACKBONE/, ['users', 'clan', 'social', 'link']],
    [/APP|PLAN|DATA|SNAPSHOT|ARCHIV|CONNECTED|STEWARD|PLANNER/, ['plan', 'tracking', 'history', 'export', 'link']],
    [/COL|COLLECT|DECOR|SCENERY|OBSTACLE|MUSEUM/, ['collection', 'special', 'history', 'star']],
    [/SEA|GIVE|SEASON|RESOURCE|DAILY|PRESENCE|LOOT|RUSH|HARVEST/, ['collection', 'calendar', 'stats', 'trend', 'clock']],
    [/PLY|PROFILE|IDENTIF|ROLE|NAME|TRACK|VETERAN|MILESTONE|XP/, ['progression', 'tracking', 'user', 'history', 'calendar']],
    [/BASE|VILLAGE|BUILDING|STRUCTURE|TIMER|UPGRAD|MOMENTUM|WORK|HELPER/, ['village', 'clock', 'calendar', 'progression', 'stats']],
    [/SEC|LUCKY|REDEMPTION|DOUBLE[_ ]DUTY|IRON|UPHILL|LAST[_ ]WORD|QUIET|MASTER/, ['special', 'target', 'trend', 'check']],
    [/DYN|OFFICIAL/, ['special', 'star', 'medal']]
]);

// "Secret & combination achievements" are deliberately meant to read as hidden/mystery badges
// regardless of which game mode they happen to reference (CWL, raids, wars, …), so they skip the
// free-text rules above entirely rather than borrowing an icon from whichever mode they mention.
const SECRET_CATEGORY = 'Secret & combination achievements';
const SECRET_ICONS = Object.freeze(['special', 'check', 'target', 'trend']);

// Used only when nothing else matched at all — replaces the old fully-random glyph fallback with
// something at least thematically related to the achievement's own category.
const CATEGORY_FALLBACK_ICONS = Object.freeze({
    'Profile & milestones': ['progression', 'user', 'tracking', 'calendar'],
    'Offensive progression': ['army', 'progression', 'stats'],
    'Season economy & activity': ['collection', 'calendar', 'stats', 'trend'],
    'Trophies & rankings': ['trophy', 'target', 'medal', 'trend'],
    'Legend & ranked performance': ['trophy', 'trend', 'target', 'medal'],
    'Builder Base': ['village', 'trophy', 'progression', 'stats'],
    'Regular war offense': ['war', 'swords', 'attack', 'win'],
    'Regular war defense': ['shield', 'defense', 'missed', 'destruction'],
    'Clan War League': ['cwl', 'promotion', 'trophy', 'medal'],
    'Clan Capital & raids': ['attack', 'army', 'target', 'trophy'],
    'Clan loyalty & social': ['users', 'clan', 'social', 'link'],
    'Clan achievements': ['clan', 'trophy', 'medal', 'users'],
    'Clan family achievements': ['clan', 'link', 'social', 'users'],
    'ClashPanel workflow': ['plan', 'tracking', 'export', 'link'],
    [SECRET_CATEGORY]: SECRET_ICONS,
    'Imported Home Village base': ['village', 'stats', 'progression'],
    'Imported upgrade activity': ['clock', 'calendar', 'progression', 'stats'],
    'Imported Builder Base': ['village', 'clock', 'stats'],
    Helpers: ['check', 'export', 'link', 'plan'],
    'Cosmetics & village collections': ['collection', 'special', 'history', 'star'],
    'Dynamic official achievements': ['special', 'star', 'medal']
});

// A few families contain words that describe their context rather than their subject. Keep these
// explicit so a generic entity keyword cannot turn a wall, army or base milestone into a troop icon.
const FAMILY_ICON_RULES = Object.freeze([
    [/^PLY_WAR_STARS$/, ['star', 'medal']],
    [/^PLY_CAP_CONTRIB$/, ['clan', 'users']],
    [/^SEA_ATTACK_WINS$/, ['attack', 'swords', 'win']],
    [/^OFF_(?:BALANCED_ARMY|SUPER_ACTIVE_COUNT)$/, ['army', 'stats']],
    [/^BASE_HOME_(?:ALL_OFFENSE_INFRA|OFFENSE_INFRA)/, ['village', 'progression']],
    [/^BASE_HOME_TH_WEAPON/, ['village', 'progression']],
    [/^BASE_(?:HOME|BB)_.*(?:DEFENSE|TRAP|WALL)/, ['defense', 'village', 'progression']]
]);

const GLYPHS = Object.freeze([
    ['crown', 'M4 9h16l-1 10H5L4 9Zm3 0L5 4l4 3 3-5 3 5 4-3-2 5M7 22h10'],
    ['compass', 'm12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Zm0 6 3 3-3 3-3-3 3-3Z'],
    ['chest', 'M4 8h16v11H4zM4 8l2-4h12l2 4M9 8v4h6V8M12 12v3'],
    ['spark', 'm12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 14 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z'],
    ['medal', 'M8 3h8l-1 5a6 6 0 1 1-6 0L8 3Zm4 8v7M9 21h6'],
    ['map', 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16'],
    ['flame', 'M12 22a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-3-2-5-3 3-4 6-4 9a6 6 0 0 0 6 6Z'],
    ['shield', 'M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6l8-3Zm-3 9 2 2 4-5'],
    ['steps', 'M4 19h5v-5h5V9h6M4 5h5v5H4z'],
    ['flag', 'M5 21V4m0 1h12l-2.5 4L17 13H5']
]);

// Entity/glyph matching is scoped to familyKey + title only (no description, no category).
// Descriptions are free prose written for readability, not for keyword-matching, and commonly
// mention *context* ("...for the current Town Hall", "...in the same clan") that isn't the actual
// subject of the achievement. Matching against that prose was the single biggest source of
// mismatched icons — e.g. any hero/troop/spell/pet achievement whose description happened to
// mention "current Town Hall" got a Town Hall building icon instead of the actual subject.
function entityText(family) {
    return `${family?.familyKey || ''} ${family?.title || ''}`.toUpperCase();
}

// Full free text is still used for the ICON_RULES fallback pass, where broader context is more
// often helpful than harmful (e.g. "Loot Gold in one season" needs the description to route
// correctly), except for the category-gated / category-overridden cases handled before it.
function familyText(family) {
    return `${family?.familyKey || ''} ${family?.title || ''} ${family?.category || ''} ${family?.description || ''}`.toUpperCase();
}

function hash(value) {
    return [...String(value)].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function pick(values, seed) { return values[hash(seed) % values.length]; }

function familyIconOverride(family) {
    const familyKey = String(family?.familyKey || '').toUpperCase();
    const rule = FAMILY_ICON_RULES.find(([pattern]) => pattern.test(familyKey));
    return rule ? { type: 'image', value: ICON_PATHS[pick(rule[1], familyKey)] } : null;
}

export function resolveAchievementAsset(family) {
    if (family?.entity) return { type: 'entity', value: family.entity };

    const familyOverride = familyIconOverride(family);
    if (familyOverride) return familyOverride;

    const glyphRule = GLYPH_RULES.find(([pattern]) => pattern.test((family?.familyKey || '').toUpperCase()));
    if (glyphRule) return { type: 'glyph', value: glyphRule[1] };

    const entityRule = ENTITY_RULES.find(([pattern]) => pattern.test(entityText(family)));
    if (entityRule) return { type: 'entity', value: pick(entityRule[1], family.familyKey) };

    const category = family?.category || '';
    if (category === SECRET_CATEGORY) {
        return { type: 'image', value: ICON_PATHS[pick(SECRET_ICONS, family.familyKey)] };
    }

    const text = familyText(family);
    const iconRule = ICON_RULES.find(([pattern, , categoryAllowList]) => {
        if (categoryAllowList && !categoryAllowList.includes(category)) return false;
        return pattern.test(text);
    });
    if (iconRule) return { type: 'image', value: ICON_PATHS[pick(iconRule[1], family.familyKey)] };

    const fallbackIcons = CATEGORY_FALLBACK_ICONS[category];
    if (fallbackIcons) return { type: 'image', value: ICON_PATHS[pick(fallbackIcons, family.familyKey)] };
    return { type: 'glyph', value: pick(GLYPHS, family?.familyKey)[0] };
}

function staticImage(src, label, className = 'achievement-family-image') {
    const image = document.createElement('img');
    image.className = className;
    image.src = src;
    image.alt = '';
    image.title = label;
    image.width = 32;
    image.height = 32;
    image.loading = 'lazy';
    image.decoding = 'async';
    return image;
}

function glyphImage(name, label) {
    const glyph = GLYPHS.find(([key]) => key === name) || GLYPHS[0];
    const wrapper = document.createElement('span');
    wrapper.className = 'achievement-family-icon';
    wrapper.title = label;
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.dataset.glyph = glyph[0];
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', glyph[1]);
    svg.append(path);
    wrapper.append(svg);
    return wrapper;
}

export function achievementFamilyImage(family, label = '') {
    const asset = resolveAchievementAsset(family);
    if (asset.type === 'entity') return entityImage(asset.value, { alt: '', className: 'achievement-family-image achievement-entity-image' });
    if (asset.type === 'glyph') return glyphImage(asset.value, label);
    return staticImage(asset.value, label);
}
