export const STRUCTURE_CATEGORIES = Object.freeze([
    {
        id: 'defenses',
        label: 'Defenses',
        shortLabel: 'Defenses',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'targets', label: 'Targets', labelKey: 'targets', kind: 'set' },
            { key: 'damageType', label: 'Damage', labelKey: 'damageType', kind: 'exact' },
            { key: 'rangeClass', label: 'Range', labelKey: 'range', kind: 'ordered', order: ['Short', 'Medium', 'Long', 'Very Long'] },
            { key: 'unlockTh', label: 'TH', labelKey: 'th', kind: 'number', closeWithin: 1 },
            { key: 'attackStyle', label: 'Attack', labelKey: 'attack', kind: 'exact' },
            { key: 'special', label: 'Special', labelKey: 'special', kind: 'exact' },
            { key: 'merged', label: 'Merged', labelKey: 'merged', kind: 'boolean' },
            { key: 'visibility', label: 'State', labelKey: 'state', kind: 'exact' }
        ])
    },
    {
        id: 'resourceBuildings',
        label: 'Resource Buildings',
        shortLabel: 'Resources',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'resource', label: 'Resource', labelKey: 'resource', kind: 'exact' },
            { key: 'function', label: 'Function', labelKey: 'function', kind: 'exact' },
            { key: 'unlockTh', label: 'TH', labelKey: 'th', kind: 'number', closeWithin: 1 },
            { key: 'footprint', label: 'Size', labelKey: 'size', kind: 'ordered', order: ['2x2', '3x3', '4x4'] },
            { key: 'produces', label: 'Produces', labelKey: 'produces', kind: 'boolean' },
            { key: 'stores', label: 'Stores', labelKey: 'stores', kind: 'boolean' },
            { key: 'lootRole', label: 'Loot role', labelKey: 'lootRole', kind: 'exact' },
            { key: 'countClass', label: 'Count', labelKey: 'count', kind: 'exact' }
        ])
    },
    {
        id: 'armyBuildings',
        label: 'Army Buildings',
        shortLabel: 'Army Buildings',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'system', label: 'System', labelKey: 'system', kind: 'exact' },
            { key: 'function', label: 'Function', labelKey: 'function', kind: 'exact' },
            { key: 'unlockTh', label: 'TH', labelKey: 'th', kind: 'number', closeWithin: 1 },
            { key: 'footprint', label: 'Size', labelKey: 'size', kind: 'ordered', order: ['2x2', '3x3', '4x4', '5x5'] },
            { key: 'capacityBased', label: 'Capacity', labelKey: 'capacity', kind: 'boolean' },
            { key: 'unlocksContent', label: 'Unlocks', labelKey: 'unlocks', kind: 'boolean' },
            { key: 'upgradeResource', label: 'Upgrade', labelKey: 'upgrade', kind: 'exact' },
            { key: 'countClass', label: 'Count', labelKey: 'count', kind: 'exact' }
        ])
    },
    {
        id: 'utilityBuildings',
        label: 'Utility Buildings',
        shortLabel: 'Utility',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'system', label: 'System', labelKey: 'system', kind: 'exact' },
            { key: 'function', label: 'Function', labelKey: 'function', kind: 'exact' },
            { key: 'unlockTh', label: 'TH', labelKey: 'th', kind: 'number', closeWithin: 1 },
            { key: 'footprint', label: 'Size', labelKey: 'size', kind: 'ordered', order: ['1x1', '2x2', '3x3', '4x4'] },
            { key: 'battleTarget', label: 'Battle target', labelKey: 'battleTarget', kind: 'boolean' },
            { key: 'upgradeable', label: 'Upgradeable', labelKey: 'upgradeable', kind: 'boolean' },
            { key: 'connectsArea', label: 'Connects', labelKey: 'connects', kind: 'exact' },
            { key: 'countClass', label: 'Count', labelKey: 'count', kind: 'exact' }
        ])
    },
    {
        id: 'traps',
        label: 'Traps',
        shortLabel: 'Traps',
        maxAttempts: 6,
        columns: Object.freeze([
            { key: 'targets', label: 'Targets', labelKey: 'targets', kind: 'set' },
            { key: 'effect', label: 'Effect', labelKey: 'effect', kind: 'exact' },
            { key: 'visibility', label: 'Visible', labelKey: 'visibility', kind: 'exact' },
            { key: 'unlockTh', label: 'TH', labelKey: 'th', kind: 'number', closeWithin: 1 },
            { key: 'area', label: 'Area', labelKey: 'area', kind: 'ordered', order: ['Single', 'Small', 'Medium', 'Large'] },
            { key: 'mode', label: 'Mode', labelKey: 'mode', kind: 'exact' },
            { key: 'role', label: 'Role', labelKey: 'role', kind: 'exact' },
            { key: 'directDamage', label: 'Damage', labelKey: 'damage', kind: 'boolean' }
        ])
    }
]);

const defense = (id, name, aliases, targets, damageType, rangeClass, unlockTh, attackStyle, special, merged = false, visibility = 'Always active') => ({
    id, name, aliases, categoryId: 'defenses', targets, damageType, rangeClass, unlockTh, attackStyle, special, merged, visibility, dailyEligible: true
});

const resourceBuilding = (id, name, aliases, resource, fn, unlockTh, footprint, produces, stores, lootRole, countClass) => ({
    id, name, aliases, categoryId: 'resourceBuildings', resource, function: fn, unlockTh, footprint, produces, stores, lootRole, countClass, dailyEligible: true
});

const armyBuilding = (id, name, aliases, system, fn, unlockTh, footprint, capacityBased, unlocksContent, upgradeResource, countClass = 'Single') => ({
    id, name, aliases, categoryId: 'armyBuildings', system, function: fn, unlockTh, footprint, capacityBased, unlocksContent, upgradeResource, countClass, dailyEligible: true
});

const utilityBuilding = (id, name, aliases, system, fn, unlockTh, footprint, battleTarget, upgradeable, connectsArea, countClass = 'Single') => ({
    id, name, aliases, categoryId: 'utilityBuildings', system, function: fn, unlockTh, footprint, battleTarget, upgradeable, connectsArea, countClass, dailyEligible: true
});

const trap = (id, name, aliases, targets, effect, visibility, unlockTh, area, mode, role, directDamage) => ({
    id, name, aliases, categoryId: 'traps', targets, effect, visibility, unlockTh, area, mode, role, directDamage, dailyEligible: true
});

export const STRUCTURE_ENTITIES = Object.freeze([
    defense('cannon', 'Cannon', [], ['Ground'], 'Single target', 'Medium', 1, 'Projectile', 'Basic defense'),
    defense('archer-tower', 'Archer Tower', ['at'], ['Ground', 'Air'], 'Single target', 'Long', 2, 'Projectile', 'Versatile defense'),
    defense('mortar', 'Mortar', [], ['Ground'], 'Splash', 'Very Long', 3, 'Lobbed projectile', 'Minimum range'),
    defense('air-defense', 'Air Defense', ['ad'], ['Air'], 'Single target', 'Long', 4, 'Projectile', 'Anti-air specialist'),
    defense('wizard-tower', 'Wizard Tower', ['wt'], ['Ground', 'Air'], 'Splash', 'Medium', 5, 'Projectile', 'Area damage'),
    defense('air-sweeper', 'Air Sweeper', ['sweeper'], ['Air'], 'Control', 'Medium', 6, 'Push', 'Directional cone'),
    defense('hidden-tesla', 'Hidden Tesla', ['tesla'], ['Ground', 'Air'], 'Single target', 'Medium', 7, 'Lightning', 'Hidden until triggered', false, 'Hidden'),
    defense('bomb-tower', 'Bomb Tower', ['bt'], ['Ground'], 'Splash', 'Medium', 8, 'Projectile', 'Death bomb'),
    defense('x-bow', 'X-Bow', ['xbow'], ['Ground', 'Air'], 'Single target', 'Very Long', 9, 'Rapid projectile', 'Switchable targeting'),
    defense('inferno-tower', 'Inferno Tower', ['inferno'], ['Ground', 'Air'], 'Single or multi', 'Long', 10, 'Beam', 'Switchable mode'),
    defense('eagle-artillery', 'Eagle Artillery', ['eagle'], ['Ground', 'Air'], 'Splash', 'Very Long', 11, 'Artillery', 'Activation threshold'),
    defense('scattershot', 'Scattershot', ['scatter'], ['Ground', 'Air'], 'Splash', 'Long', 13, 'Lobbed projectile', 'Secondary splash'),
    defense('builders-hut-defense', "Builder's Hut", ['builder hut'], ['Ground', 'Air'], 'Single target', 'Short', 14, 'Projectile', 'Repairs nearby defenses'),
    defense('spell-tower', 'Spell Tower', [], ['Ground', 'Air'], 'Support', 'Medium', 15, 'Spell cast', 'Selectable spell'),
    defense('monolith', 'Monolith', [], ['Ground', 'Air'], 'Single target', 'Long', 15, 'Projectile', 'Percentage damage'),
    defense('ricochet-cannon', 'Ricochet Cannon', ['ricochet'], ['Ground'], 'Single target', 'Medium', 16, 'Bouncing projectile', 'Second target bounce', true),
    defense('multi-archer-tower', 'Multi-Archer Tower', ['mat'], ['Ground', 'Air'], 'Multiple targets', 'Long', 16, 'Multi projectile', 'Three targets', true),
    defense('firespitter', 'Firespitter', [], ['Ground', 'Air'], 'Rapid fire', 'Long', 17, 'Directional projectile', 'Aimed cone'),
    defense('multi-gear-tower', 'Multi-Gear Tower', ['mgt'], ['Ground', 'Air'], 'Single target', 'Very Long', 17, 'Projectile', 'Long or fast mode', true),
    defense('revenge-tower', 'Revenge Tower', [], ['Ground', 'Air'], 'Escalating', 'Long', 18, 'Projectile', 'Powers up as buildings fall'),
    defense('super-wizard-tower', 'Super Wizard Tower', ['swt'], ['Ground', 'Air'], 'Chain', 'Long', 18, 'Chain lightning', 'Chains to many targets', true),

    resourceBuilding('gold-mine', 'Gold Mine', [], 'Gold', 'Production', 1, '3x3', true, false, 'Collector', 'Multiple'),
    resourceBuilding('elixir-collector', 'Elixir Collector', ['collector'], 'Elixir', 'Production', 1, '3x3', true, false, 'Collector', 'Multiple'),
    resourceBuilding('gold-storage', 'Gold Storage', [], 'Gold', 'Storage', 2, '3x3', false, true, 'Storage', 'Multiple'),
    resourceBuilding('elixir-storage', 'Elixir Storage', [], 'Elixir', 'Storage', 2, '3x3', false, true, 'Storage', 'Multiple'),
    resourceBuilding('dark-elixir-drill', 'Dark Elixir Drill', ['de drill'], 'Dark Elixir', 'Production', 7, '3x3', true, false, 'Collector', 'Multiple'),
    resourceBuilding('dark-elixir-storage', 'Dark Elixir Storage', ['de storage'], 'Dark Elixir', 'Storage', 7, '3x3', false, true, 'Storage', 'Single'),

    armyBuilding('army-camp', 'Army Camp', [], 'Troops', 'Army capacity', 1, '5x5', true, false, 'Elixir', 'Multiple'),
    armyBuilding('barracks', 'Barracks', [], 'Troops', 'Unlock Elixir troops', 1, '3x3', false, true, 'Elixir'),
    armyBuilding('clan-castle', 'Clan Castle', ['cc'], 'Reinforcements', 'Store donated units', 2, '3x3', true, false, 'Gold'),
    armyBuilding('laboratory', 'Laboratory', ['lab'], 'Research', 'Upgrade troops and spells', 3, '3x3', false, false, 'Elixir'),
    armyBuilding('spell-factory', 'Spell Factory', [], 'Spells', 'Unlock Elixir spells', 5, '3x3', false, true, 'Elixir'),
    armyBuilding('dark-barracks', 'Dark Barracks', [], 'Troops', 'Unlock Dark Elixir troops', 7, '3x3', false, true, 'Elixir'),
    armyBuilding('hero-hall', 'Hero Hall', [], 'Heroes', 'Manage and upgrade Heroes', 7, '4x4', false, true, 'Mixed'),
    armyBuilding('dark-spell-factory', 'Dark Spell Factory', [], 'Spells', 'Unlock Dark Elixir spells', 8, '3x3', false, true, 'Elixir'),
    armyBuilding('blacksmith', 'Blacksmith', [], 'Equipment', 'Manage Hero Equipment', 8, '3x3', false, true, 'Gold'),
    armyBuilding('super-sauna', 'Super Sauna', ['super troop building'], 'Super Troops', 'Activate Super Troops', 11, '3x3', false, true, 'None'),
    armyBuilding('siege-workshop', 'Siege Workshop', ['workshop'], 'Siege Machines', 'Unlock Siege Machines', 12, '3x3', false, true, 'Elixir'),
    armyBuilding('pet-house', 'Pet House', [], 'Hero Pets', 'Unlock and upgrade Pets', 14, '3x3', false, true, 'Elixir'),

    utilityBuilding('town-hall', 'Town Hall', ['th'], 'Village core', 'Unlock progression', 1, '4x4', true, true, 'Home Village'),
    utilityBuilding('builders-hut-utility', "Builder's Hut", ['builder hut'], 'Construction', 'Provides a Builder', 1, '2x2', true, true, 'Home Village', 'Multiple'),
    utilityBuilding('wall', 'Wall', [], 'Base layout', 'Block ground movement', 2, '1x1', true, true, 'Home Village', 'Multiple'),
    utilityBuilding('boat', 'Boat', [], 'Travel', 'Open Builder Base', 6, '2x2', false, false, 'Builder Base'),
    utilityBuilding('forge', 'Forge', [], 'Clan Capital', 'Produce Capital Gold', 6, '3x3', false, true, 'Clan Capital'),
    utilityBuilding('airship', 'Airship', [], 'Travel', 'Open Clan Capital', 6, '3x3', false, false, 'Clan Capital'),
    utilityBuilding('helper-hut', 'Helper Hut', [], 'Helpers', 'Manage Village Helpers', 9, '3x3', true, true, 'Home Village'),

    trap('bomb', 'Bomb', [], ['Ground'], 'Damage', 'Hidden', 3, 'Small', 'Fixed', 'Anti-swarm', true),
    trap('spring-trap', 'Spring Trap', ['spring'], ['Ground'], 'Launch', 'Hidden', 4, 'Small', 'Fixed', 'Removal', false),
    trap('air-bomb', 'Air Bomb', [], ['Air'], 'Damage', 'Hidden', 5, 'Medium', 'Fixed', 'Anti-swarm', true),
    trap('giant-bomb', 'Giant Bomb', ['gb'], ['Ground'], 'Damage', 'Hidden', 6, 'Large', 'Fixed', 'Area damage', true),
    trap('seeking-air-mine', 'Seeking Air Mine', ['sam'], ['Air'], 'Damage', 'Hidden', 7, 'Single', 'Fixed', 'Anti-heavy', true),
    trap('skeleton-trap', 'Skeleton Trap', ['skelly trap'], ['Ground', 'Air'], 'Summon', 'Hidden', 8, 'Small', 'Switchable', 'Distraction', false),
    trap('tornado-trap', 'Tornado Trap', ['tornado'], ['Ground', 'Air'], 'Control', 'Hidden', 11, 'Medium', 'Fixed', 'Displacement', false),
    trap('giga-bomb', 'Giga Bomb', [], ['Ground', 'Air'], 'Damage and pushback', 'Visible', 17, 'Large', 'Fixed', 'Area denial', true)
]);
