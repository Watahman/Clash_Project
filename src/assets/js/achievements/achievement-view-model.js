const ROMAN_TIER_SUFFIX = /\s+(?:I|II|III|IV)$/;
const DESCRIPTION_TARGET_SUFFIX = /:\s*[\d,.]+\s*$/;

export function normalizePlayerTag(value) {
    const compact = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9#]/g, '')
        .replace(/O/g, '0');
    if (!compact) return '';
    return compact.startsWith('#') ? compact : `#${compact}`;
}

export function parseBaseDataText(text) {
    const source = String(text || '').trim();
    if (!source) {
        return { valid: false, error: 'Paste the copied JSON first.' };
    }

    let parsed;
    try {
        parsed = JSON.parse(source);
    } catch {
        return { valid: false, error: 'This is not valid JSON.' };
    }

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        return { valid: false, error: 'The copied data must be one JSON object.' };
    }

    const data = parsed.baseData && typeof parsed.baseData === 'object' && !Array.isArray(parsed.baseData)
        ? parsed.baseData
        : parsed;
    const tag = normalizePlayerTag(data.tag);
    const timestamp = Number(data.timestamp);
    if (!tag || tag === '#') {
        return { valid: false, error: 'The JSON does not contain a player tag.' };
    }
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return { valid: false, error: 'The JSON does not contain a valid timestamp.' };
    }

    const recognizedSections = [
        'helpers', 'buildings', 'traps', 'decos', 'obstacles', 'units',
        'siege_machines', 'heroes', 'spells', 'pets', 'equipment',
        'house_parts', 'skins', 'sceneries', 'buildings2', 'traps2',
        'decos2', 'obstacles2', 'units2', 'heroes2', 'skins2', 'sceneries2'
    ].filter(key => Array.isArray(data[key]));

    if (recognizedSections.length < 3) {
        return {
            valid: false,
            error: 'The JSON does not look like complete Clash of Clans base data.'
        };
    }

    const itemCount = recognizedSections.reduce(
        (total, key) => total + data[key].length,
        0
    );

    return {
        valid: true,
        data,
        tag,
        timestamp: Math.trunc(timestamp),
        recognizedSections,
        itemCount
    };
}

export function collectLinkedAccounts(input) {
    const accounts = new Map();
    const visited = new Set();

    const visit = value => {
        if (value === null || value === undefined) return;
        if (typeof value === 'string') {
            const tag = normalizePlayerTag(value);
            if (/^#[A-Z0-9]{3,}$/.test(tag) && !accounts.has(tag)) {
                accounts.set(tag, { tag, name: '', townHallLevel: null });
            }
            return;
        }
        if (typeof value !== 'object' || visited.has(value)) return;
        visited.add(value);

        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }

        const rawTag = value.tag ?? value.playerTag ?? value.accountTag ?? value.clashTag;
        const tag = normalizePlayerTag(rawTag);
        if (/^#[A-Z0-9]{3,}$/.test(tag)) {
            const previous = accounts.get(tag) || {};
            const townHall = Number(
                value.townHallLevel ?? value.townhall ?? value.townHall ?? value.th
            );
            accounts.set(tag, {
                tag,
                name: String(
                    value.name ?? value.playerName ?? value.accountName ?? previous.name ?? ''
                ).trim(),
                townHallLevel: Number.isFinite(townHall) && townHall > 0
                    ? Math.trunc(townHall)
                    : previous.townHallLevel ?? null
            });
        }

        if ('accounts' in value) visit(value.accounts);
    };

    visit(input);
    return [...accounts.values()].sort((left, right) => {
        const byName = left.name.localeCompare(right.name);
        return byName || left.tag.localeCompare(right.tag);
    });
}

function normalizedRow(row) {
    const target = Math.max(0, Number(row?.target) || 0);
    const progress = Math.max(0, Number(row?.progress) || 0);
    return {
        ...row,
        family_key: String(row?.family_key || row?.familyKey || ''),
        achievement_key: String(row?.achievement_key || row?.achievementKey || ''),
        title: String(row?.title || 'Achievement'),
        description: String(row?.description || ''),
        category: String(row?.category || 'other'),
        rarity: String(row?.rarity || 'common'),
        metric: String(row?.metric || ''),
        tier: Math.max(1, Number(row?.tier) || 1),
        xp: Math.max(0, Number(row?.xp) || 0),
        target,
        progress,
        unlocked: row?.unlocked === true,
        unlocked_at: row?.unlocked_at || row?.unlockedAt || null
    };
}

export function groupAchievementFamilies(rows) {
    const groups = new Map();

    for (const sourceRow of Array.isArray(rows) ? rows : []) {
        const row = normalizedRow(sourceRow);
        const familyKey = row.family_key || row.achievement_key || `achievement-${groups.size}`;
        if (!groups.has(familyKey)) groups.set(familyKey, []);
        groups.get(familyKey).push(row);
    }

    return [...groups.entries()].map(([familyKey, tiers]) => {
        tiers.sort((left, right) => left.tier - right.tier);
        const unlockedTiers = tiers.filter(tier => tier.unlocked);
        const currentTier = tiers.find(tier => !tier.unlocked) || tiers.at(-1);
        const highestUnlocked = unlockedTiers.at(-1) || null;
        const complete = unlockedTiers.length === tiers.length && tiers.length > 0;
        const progressRatio = currentTier?.target > 0
            ? Math.min(1, currentTier.progress / currentTier.target)
            : complete ? 1 : 0;
        const state = complete
            ? 'complete'
            : unlockedTiers.length > 0
                ? 'unlocked'
                : currentTier?.progress > 0
                    ? 'in_progress'
                    : 'locked';
        const first = tiers[0];

        return {
            familyKey,
            title: first.title.replace(ROMAN_TIER_SUFFIX, ''),
            description: first.description.replace(DESCRIPTION_TARGET_SUFFIX, ''),
            category: first.category,
            tiers,
            unlockedTiers,
            highestUnlocked,
            currentTier,
            complete,
            state,
            progressRatio,
            totalXp: unlockedTiers.reduce((sum, tier) => sum + tier.xp, 0)
        };
    }).sort((left, right) => {
        const stateOrder = { in_progress: 0, unlocked: 1, locked: 2, complete: 3 };
        return (stateOrder[left.state] ?? 9) - (stateOrder[right.state] ?? 9)
            || left.category.localeCompare(right.category)
            || left.title.localeCompare(right.title);
    });
}

export function achievementLevelFromXp(totalXp) {
    const xp = Math.max(0, Number(totalXp) || 0);
    const level = Math.floor(Math.sqrt(xp / 250)) + 1;
    const floorXp = 250 * (level - 1) ** 2;
    const nextXp = 250 * level ** 2;
    const progress = nextXp > floorXp
        ? (xp - floorXp) / (nextXp - floorXp)
        : 1;
    return {
        level,
        floorXp,
        nextXp,
        progress: Math.max(0, Math.min(1, progress))
    };
}

export function buildAchievementSummary(families) {
    const list = Array.isArray(families) ? families : [];
    const allTiers = list.flatMap(family => family.tiers || []);
    const unlockedTiers = allTiers.filter(tier => tier.unlocked);
    const totalXp = unlockedTiers.reduce((sum, tier) => sum + tier.xp, 0);
    return {
        familyCount: list.length,
        completedFamilies: list.filter(family => family.complete).length,
        unlockedTierCount: unlockedTiers.length,
        totalTierCount: allTiers.length,
        totalXp,
        completion: allTiers.length ? unlockedTiers.length / allTiers.length : 0,
        level: achievementLevelFromXp(totalXp)
    };
}

export function filterAchievementFamilies(families, filters = {}) {
    const search = String(filters.search || '').trim().toLowerCase();
    const category = String(filters.category || 'all');
    const rarity = String(filters.rarity || 'all');
    const status = String(filters.status || 'all');

    return (Array.isArray(families) ? families : []).filter(family => {
        if (category !== 'all' && family.category !== category) return false;
        if (status !== 'all' && family.state !== status) return false;
        if (rarity !== 'all' && !family.tiers.some(tier => tier.rarity === rarity)) return false;
        if (!search) return true;
        const searchable = [
            family.title,
            family.description,
            family.category,
            ...family.tiers.map(tier => tier.title)
        ].join(' ').toLowerCase();
        return searchable.includes(search);
    });
}
