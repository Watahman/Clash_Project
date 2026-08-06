export const ENTITY_GUESSER_DATA_VERSION = '2026-08-foundation-1';

export const TROOP_CATEGORY = Object.freeze({
    id: 'troops',
    label: 'Home Village Troops',
    maxAttempts: 6,
    columns: Object.freeze([
        { key: 'resource', label: 'Type', kind: 'exact' },
        { key: 'movement', label: 'Move', kind: 'exact' },
        { key: 'targets', label: 'Targets', kind: 'exact' },
        { key: 'favorite', label: 'Favorite', kind: 'exact' },
        { key: 'housing', label: 'Housing', kind: 'number', closeWithin: 3 },
        { key: 'unlockTh', label: 'TH', kind: 'number', closeWithin: 1 },
        { key: 'attackStyle', label: 'Attack', kind: 'exact' },
        { key: 'role', label: 'Role', kind: 'exact' }
    ])
});

export const TROOPS = Object.freeze([
    { id: 'barbarian', name: 'Barbarian', aliases: ['barb'], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Any', housing: 1, unlockTh: 1, attackStyle: 'Melee', role: 'Damage' },
    { id: 'archer', name: 'Archer', aliases: [], resource: 'Elixir', movement: 'Ground', targets: 'Ground & Air', favorite: 'Any', housing: 1, unlockTh: 2, attackStyle: 'Ranged', role: 'Damage' },
    { id: 'giant', name: 'Giant', aliases: [], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Defenses', housing: 5, unlockTh: 3, attackStyle: 'Melee', role: 'Tank' },
    { id: 'goblin', name: 'Goblin', aliases: ['gob'], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Resources', housing: 1, unlockTh: 2, attackStyle: 'Melee', role: 'Resource' },
    { id: 'wall-breaker', name: 'Wall Breaker', aliases: ['wallbreaker', 'wb'], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Walls', housing: 2, unlockTh: 3, attackStyle: 'Ranged', role: 'Funnel' },
    { id: 'balloon', name: 'Balloon', aliases: ['loon'], resource: 'Elixir', movement: 'Air', targets: 'Ground', favorite: 'Defenses', housing: 5, unlockTh: 4, attackStyle: 'Ranged', role: 'Damage' },
    { id: 'wizard', name: 'Wizard', aliases: ['wiz'], resource: 'Elixir', movement: 'Ground', targets: 'Ground & Air', favorite: 'Any', housing: 4, unlockTh: 5, attackStyle: 'Ranged', role: 'Splash' },
    { id: 'dragon', name: 'Dragon', aliases: ['drag'], resource: 'Elixir', movement: 'Air', targets: 'Ground & Air', favorite: 'Any', housing: 20, unlockTh: 7, attackStyle: 'Ranged', role: 'Splash' },
    { id: 'pekka', name: 'P.E.K.K.A', aliases: ['pekka', 'p.e.k.k.a.'], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Any', housing: 25, unlockTh: 8, attackStyle: 'Melee', role: 'Damage' },
    { id: 'baby-dragon', name: 'Baby Dragon', aliases: ['baby drag', 'bd'], resource: 'Elixir', movement: 'Air', targets: 'Ground & Air', favorite: 'Any', housing: 10, unlockTh: 9, attackStyle: 'Ranged', role: 'Splash' },
    { id: 'miner', name: 'Miner', aliases: [], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Any', housing: 6, unlockTh: 10, attackStyle: 'Melee', role: 'Damage' },
    { id: 'electro-dragon', name: 'Electro Dragon', aliases: ['edrag', 'e-drag'], resource: 'Elixir', movement: 'Air', targets: 'Ground & Air', favorite: 'Any', housing: 30, unlockTh: 11, attackStyle: 'Ranged', role: 'Chain' },
    { id: 'yeti', name: 'Yeti', aliases: [], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Any', housing: 18, unlockTh: 12, attackStyle: 'Melee', role: 'Tank' },
    { id: 'dragon-rider', name: 'Dragon Rider', aliases: ['drider'], resource: 'Elixir', movement: 'Air', targets: 'Ground', favorite: 'Defenses', housing: 25, unlockTh: 13, attackStyle: 'Ranged', role: 'Damage' },
    { id: 'electro-titan', name: 'Electro Titan', aliases: ['etitan', 'e-titan'], resource: 'Elixir', movement: 'Ground', targets: 'Ground & Air', favorite: 'Any', housing: 32, unlockTh: 14, attackStyle: 'Melee', role: 'Aura' },
    { id: 'root-rider', name: 'Root Rider', aliases: ['rr'], resource: 'Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Defenses', housing: 20, unlockTh: 15, attackStyle: 'Melee', role: 'Tank' },
    { id: 'thrower', name: 'Thrower', aliases: [], resource: 'Elixir', movement: 'Ground', targets: 'Ground & Air', favorite: 'Any', housing: 16, unlockTh: 17, attackStyle: 'Ranged', role: 'Damage' },

    { id: 'minion', name: 'Minion', aliases: [], resource: 'Dark Elixir', movement: 'Air', targets: 'Ground & Air', favorite: 'Any', housing: 2, unlockTh: 7, attackStyle: 'Ranged', role: 'Damage' },
    { id: 'hog-rider', name: 'Hog Rider', aliases: ['hog'], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Defenses', housing: 5, unlockTh: 7, attackStyle: 'Melee', role: 'Damage' },
    { id: 'valkyrie', name: 'Valkyrie', aliases: ['valk'], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Any', housing: 8, unlockTh: 8, attackStyle: 'Melee', role: 'Splash' },
    { id: 'golem', name: 'Golem', aliases: [], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Defenses', housing: 30, unlockTh: 8, attackStyle: 'Melee', role: 'Tank' },
    { id: 'witch', name: 'Witch', aliases: [], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground & Air', favorite: 'Any', housing: 12, unlockTh: 9, attackStyle: 'Ranged', role: 'Summon' },
    { id: 'lava-hound', name: 'Lava Hound', aliases: ['hound', 'lh'], resource: 'Dark Elixir', movement: 'Air', targets: 'Ground', favorite: 'Air Defenses', housing: 30, unlockTh: 9, attackStyle: 'Melee', role: 'Tank' },
    { id: 'bowler', name: 'Bowler', aliases: [], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Any', housing: 6, unlockTh: 10, attackStyle: 'Ranged', role: 'Splash' },
    { id: 'ice-golem', name: 'Ice Golem', aliases: ['ig'], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground', favorite: 'Defenses', housing: 15, unlockTh: 11, attackStyle: 'Melee', role: 'Control' },
    { id: 'headhunter', name: 'Headhunter', aliases: ['hh'], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground & Air', favorite: 'Heroes', housing: 6, unlockTh: 12, attackStyle: 'Ranged', role: 'Specialist' },
    { id: 'apprentice-warden', name: 'Apprentice Warden', aliases: ['apprentice', 'aw'], resource: 'Dark Elixir', movement: 'Ground', targets: 'Ground & Air', favorite: 'Any', housing: 20, unlockTh: 13, attackStyle: 'Ranged', role: 'Support' }
]);
