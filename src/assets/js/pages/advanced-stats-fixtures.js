import { getRedesignFixture } from '../fixtures/redesign-fixture-mode.js';

const FIXTURE_ACCOUNT = Object.freeze({
    tag: '#CPSTAT01',
    name: 'Fixture Strategist',
    townHallLevel: 17
});
const FIXTURE_START = '2026-06-01T09:00:00.000Z';
const FIXTURE_UPDATE = '2026-08-10T18:30:00.000Z';
const FIXTURE_UNITS = Object.freeze([
    { key: 'root-rider', name: 'Root Rider', category: 'TROOP', totalQuantity: 280, battlesPresent: 18, usageRate: 90 },
    { key: 'valkyrie', name: 'Valkyrie', category: 'TROOP', totalQuantity: 140, battlesPresent: 12, usageRate: 60 },
    { key: 'freeze-spell', name: 'Freeze Spell', category: 'SPELL', totalQuantity: 58, battlesPresent: 17, usageRate: 85 },
    { key: 'overgrowth-spell', name: 'Overgrowth Spell', category: 'SPELL', totalQuantity: 31, battlesPresent: 11, usageRate: 55 },
    { key: 'wall-wrecker', name: 'Wall Wrecker', category: 'SIEGE', totalQuantity: 13, battlesPresent: 13, usageRate: 65 },
    { key: 'archer-queen', name: 'Archer Queen', category: 'HERO', totalQuantity: 18, battlesPresent: 18, usageRate: 90 },
    { key: 'unicorn', name: 'Unicorn', category: 'PET', totalQuantity: 18, battlesPresent: 18, usageRate: 90 },
    { key: 'frozen-arrow', name: 'Frozen Arrow', category: 'EQUIPMENT', totalQuantity: 18, battlesPresent: 18, usageRate: 90 }
]);

function dateAt(day) {
    return new Date(Date.UTC(2026, 5, 1 + day, 18, 0, 0)).toISOString();
}

function army(units = FIXTURE_UNITS.slice(0, 5)) {
    return { units: units.map(unit => ({ key: unit.key, name: unit.name, category: unit.category, quantity: unit.category === 'SPELL' ? 2 : 12 })) };
}

function battle(index) {
    const stars = index % 5 === 0 ? 2 : 3;
    return {
        id: `fixture-battle-${index}`,
        battleAt: dateAt(index),
        opponentName: `Practice Base ${index + 1}`,
        opponentPlayerTag: `#OPP${String(index + 1).padStart(4, '0')}`,
        opponentTownHall: 16 + (index % 2),
        playerTownHall: 17,
        stars,
        destructionPercentage: stars === 3 ? 93 + (index % 6) : 71 + (index % 8),
        units: army().units,
        army: army()
    };
}

function trend(days) {
    return Array.from({ length: days }, (_, index) => ({
        date: dateAt(index).slice(0, 10),
        attacks: 1 + (index % 3),
        averageStars: Number((2.2 + ((index * 7) % 8) / 10).toFixed(2)),
        averageDestruction: 78 + ((index * 11) % 18),
        threeStarRate: 42 + ((index * 13) % 50)
    }));
}

function overview(attacks) {
    if (!attacks) return { data: { summary: { attacks: 0, averageStars: 0, threeStarRate: 0, averageDestruction: 0 }, favorites: {} } };
    return {
        data: {
            summary: { attacks, averageStars: 2.72, threeStarRate: 72.2, averageDestruction: 88.4 },
            favorites: {
                troop: { key: 'root-rider', name: 'Root Rider', battlesPresent: 18 },
                spell: { key: 'freeze-spell', name: 'Freeze Spell', battlesPresent: 17 },
                siege: { key: 'wall-wrecker', name: 'Wall Wrecker', battlesPresent: 13 },
                army: { army: army(), battleCount: 13, averageStars: 2.85, averageDestruction: 91.2 }
            }
        }
    };
}

function armies(attacks) {
    if (!attacks) return { items: [] };
    return {
        items: [
            { armyHash: 'fixture-army-1', army: army(), battleCount: 13, averageStars: 2.85, averageDestruction: 91.2 },
            { armyHash: 'fixture-army-2', army: army(FIXTURE_UNITS.slice(0, 4)), battleCount: 5, averageStars: 2.4, averageDestruction: 82.6 }
        ]
    };
}

function dataFor(id) {
    const noAttacks = id === 'stats-no-attacks';
    const rich = id === 'stats-rich-90d';
    const attacks = noAttacks ? 0 : rich ? 120 : 20;
    const items = Array.from({ length: rich ? 30 : Math.min(attacks, 20) }, (_, index) => battle(index));
    return {
        attacks,
        overview: overview(attacks),
        units: { items: noAttacks ? [] : [...FIXTURE_UNITS] },
        armies: armies(attacks),
        trends: { points: noAttacks ? [] : trend(rich ? 90 : 20) },
        battles: { items, hasMore: rich, nextCursor: rich ? 'fixture-next-page' : null },
        failures: id === 'stats-partial' ? { armies: true } : {}
    };
}

function trackingFor(status, attacks, gap = false) {
    const stopped = status === 'STOPPED';
    return {
        trackingExists: true,
        enabled: !stopped,
        status,
        playerTag: FIXTURE_ACCOUNT.tag,
        playerName: FIXTURE_ACCOUNT.name,
        townHallLevel: FIXTURE_ACCOUNT.townHallLevel,
        trackingStartedAt: FIXTURE_START,
        bootstrapCompletedAt: status === 'INITIALIZING' ? null : FIXTURE_START,
        lastPollAt: FIXTURE_UPDATE,
        lastSuccessfulPollAt: status === 'ERROR' ? '2026-08-09T18:30:00.000Z' : FIXTURE_UPDATE,
        nextPollAt: stopped ? null : '2026-08-10T19:00:00.000Z',
        gapStartedAt: gap || ['PAUSED', 'DEGRADED', 'STOPPED', 'ERROR'].includes(status) ? '2026-08-08T10:00:00.000Z' : null,
        dataCompleteSince: '2026-06-01T09:00:00.000Z',
        consecutiveFailures: status === 'ERROR' ? 4 : status === 'DEGRADED' ? 2 : 0,
        battlesProcessed: attacks
    };
}

function makeClient(id) {
    const noAccount = id === 'stats-no-account';
    const initializing = id === 'stats-initializing';
    const data = dataFor(id);
    let tracking = noAccount
        ? { trackingExists: false, enabled: false, status: 'DISABLED' }
        : trackingFor(
            id === 'stats-not-tracking' ? 'DISABLED' : initializing ? 'INITIALIZING' : id === 'stats-paused' ? 'PAUSED' : id === 'stats-degraded' ? 'DEGRADED' : id === 'stats-error' ? 'ERROR' : 'ACTIVE',
            data.attacks,
            id === 'stats-partial'
        );
    const response = (value, name) => data.failures[name]
        ? Promise.reject(new Error(`Fixture ${name} source unavailable`))
        : Promise.resolve(value);
    return {
        accounts: noAccount ? [] : [FIXTURE_ACCOUNT],
        getTracking: async () => tracking,
        startTracking: async () => { tracking = trackingFor('INITIALIZING', data.attacks); return tracking; },
        pauseTracking: async () => { tracking = trackingFor('PAUSED', data.attacks); return tracking; },
        resumeTracking: async () => { tracking = trackingFor('ACTIVE', data.attacks); return tracking; },
        stopTracking: async () => { tracking = trackingFor('STOPPED', data.attacks); return tracking; },
        deleteTracking: async () => { tracking = { trackingExists: false, enabled: false, status: 'DISABLED' }; return tracking; },
        getOverview: async () => response(data.overview, 'overview'),
        getUnits: async () => response(data.units, 'units'),
        getArmies: async () => response(data.armies, 'armies'),
        getTrends: async () => response(data.trends, 'trends'),
        getBattles: async (_, __, options = {}) => {
            if (options.cursor) return response({ items: [], hasMore: false, nextCursor: null }, 'battles');
            return response(data.battles, 'battles');
        }
    };
}

export async function getAdvancedStatsFixture() {
    const scenario = await getRedesignFixture();
    if (!scenario || scenario.module !== 'advanced-stats') return null;
    return makeClient(scenario.id);
}
