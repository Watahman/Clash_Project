import { getRedesignFixture } from '../fixtures/redesign-fixture-mode.js';

const ACCOUNT = Object.freeze({ tag: '#CPACHV01', name: 'Fixture Collector', townHallLevel: 17 });
const SOURCE_ORDER = Object.freeze([
    'live_profile', 'base_data', 'base_history', 'advanced_stats', 'war', 'cwl_history', 'raid_history',
    'legend_history', 'clashking_history', 'clan_profile', 'clashpanel', 'clan_family', 'mixed'
]);

function sourceState(id, deepHistory = false) {
    const missing = id === 'achievements-missing-source';
    return Object.fromEntries(SOURCE_ORDER.map(source => [source, {
        available: source === 'cwl_history' ? deepHistory : !missing || ['live_profile', 'base_data', 'clashpanel'].includes(source),
        detail: source === 'cwl_history' && !deepHistory ? 'Loading history…' : undefined
    }]));
}

function row(family, tier, config = {}) {
    const target = config.target || tier * 100;
    const unlocked = config.unlocked ?? false;
    const known = config.known ?? true;
    return {
        achievement_key: `${family}_${tier}`,
        family_key: family,
        title: `${config.title || 'Milestone'} ${['I', 'II', 'III', 'IV'][tier - 1] || tier}`,
        description: config.description || 'Complete a tracked ClashPanel milestone',
        category: config.category || 'progression',
        category_label: config.categoryLabel || '',
        scope: config.scope || 'player',
        rarity: config.rarity || ['common', 'uncommon', 'rare', 'epic'][tier - 1] || 'legendary',
        tier,
        tier_label: `Tier ${tier}`,
        xp: tier * 50,
        progress: known ? (config.progress ?? (unlocked ? target : 0)) : 0,
        target,
        threshold_text: String(target),
        unlocked,
        progress_known: known,
        source_available: known,
        has_stored_progress: unlocked || Boolean(config.progress),
        source: config.source || 'live_profile',
        source_codes: config.sourceCodes || ['FIXTURE'],
        entity: config.entity
    };
}

function family(index, config = {}) {
    const key = `fixture_family_${index}`;
    const title = config.title || `Milestone ${index}`;
    const tierCount = config.tierCount || 3;
    return Array.from({ length: tierCount }, (_, offset) => row(key, offset + 1, { ...config, title }));
}

function catalog(id) {
    if (id === 'achievements-new') return [
        ...family(1, { title: 'First steps', category: 'progression', progress: 20 }),
        ...family(2, { title: 'Army builder', category: 'collection', source: 'base_data' }),
        ...family(3, { title: 'Battle ready', category: 'attack', source: 'advanced_stats' })
    ];
    const rows = [
        ...family(1, { title: 'First steps', category: 'progression', progress: 80 }),
        ...family(2, { title: 'Root Rider captain', category: 'attack', source: 'advanced_stats', progress: 64, entity: 'root-rider' }),
        ...family(3, { title: 'Village curator', category: 'village', source: 'base_data', unlocked: true, entity: 'town-hall-17' }),
        ...family(4, { title: 'War record', category: 'war', source: 'war', unlocked: true }),
        ...family(5, { title: 'Snapshot historian', category: 'collection', source: 'base_history', progress: 120 }),
        ...family(6, { title: 'Waiting source', category: 'stats', source: 'raid_history', known: false })
    ];
    if (id === 'achievements-rich') {
        for (let index = 7; index <= 90; index += 1) rows.push(...family(index, {
            title: `Collector ${index}`,
            category: ['progression', 'collection', 'attack', 'defense', 'war', 'stats'][index % 6],
            source: index % 4 === 0 ? 'clashpanel' : 'live_profile',
            progress: index % 3 === 0 ? 100 : 0,
            unlocked: index % 7 === 0
        }));
    }
    if (id === 'achievements-missing-source') {
        rows.push(...family(7, { title: 'Historical raids', category: 'stats', source: 'raid_history', known: false }));
        rows.push(...family(8, { title: 'Legend archive', category: 'stats', source: 'legend_history', known: false }));
    }
    if (id === 'achievements-import-valid' || id === 'achievements-import-invalid') {
        rows.push(...family(7, { title: 'Village snapshot', category: 'village', source: 'base_data', progress: 300, entity: 'town-hall-17' }));
    }
    return rows;
}

function response(id, deepHistory = false) {
    return {
        playerTag: ACCOUNT.tag,
        deepHistory,
        achievements: catalog(id),
        latestSnapshot: id === 'achievements-import-valid' ? {
            source_timestamp: 1786035596,
            imported_at: '2026-08-09T10:00:00.000Z',
            checksum: 'fixture-checksum',
            metrics: { buildings: 14 }
        } : null,
        sources: sourceState(id, deepHistory),
        history: { snapshots: id === 'achievements-import-valid' ? 2 : 0 }
    };
}

function validImport() {
    return JSON.stringify({
        tag: ACCOUNT.tag,
        timestamp: 1786035596,
        buildings: [{ data: 1000000, lvl: 17, cnt: 1 }],
        traps: [{ data: 12000000, lvl: 10, cnt: 4 }],
        units: [{ data: 4000000, lvl: 12, cnt: 20 }],
        heroes: [{ data: 28000000, lvl: 100 }]
    });
}

function makeClient(id) {
    const invalid = id === 'achievements-import-invalid';
    return {
        fixtureId: id,
        accounts: id === 'achievements-no-account' ? [] : [ACCOUNT],
        fixtureImportText: id === 'achievements-import-valid' ? validImport() : invalid ? '{malformed' : '',
        getAchievements: async (_, options = {}) => response(id, Boolean(options.deepHistory)),
        importAchievementBaseData: async data => ({
            playerTag: data.tag,
            unlockedCount: 4,
            achievements: catalog(id),
            sources: sourceState(id, true)
        })
    };
}

export async function getAchievementsFixture() {
    const scenario = await getRedesignFixture();
    if (!scenario || scenario.module !== 'achievements') return null;
    return makeClient(scenario.id);
}
