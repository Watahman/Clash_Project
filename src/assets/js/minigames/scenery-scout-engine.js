export const SCENERY_MODES = Object.freeze({
    normal: Object.freeze({ rounds: 10, options: 4, timeLimit: 20, difficulties: ['normal'] }),
    hard: Object.freeze({ rounds: 10, options: 6, timeLimit: 15, difficulties: ['hard'] }),
    expert: Object.freeze({ rounds: 10, options: 8, timeLimit: 10, difficulties: ['expert'] }),
    'sudden-death': Object.freeze({ rounds: 40, options: 4, timeLimit: 18, suddenDeath: true }),
    daily: Object.freeze({ rounds: 5, options: 4, timeLimit: 18, difficulties: ['normal', 'normal', 'hard', 'expert', 'hard'] })
});

const DIFFICULTY_POINTS = Object.freeze({ normal: 600, hard: 800, expert: 1000 });

export function utcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

export function createSeededRandom(seed) {
    let state = hashSeed(String(seed)) || 0x6d2b79f5;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

export function getRoundDifficulty(mode, index) {
    if (mode === 'sudden-death') {
        if (index < 5) return 'normal';
        if (index < 10) return 'hard';
        return 'expert';
    }
    const settings = SCENERY_MODES[mode] || SCENERY_MODES.normal;
    return settings.difficulties[index % settings.difficulties.length];
}

export function buildGameQuestions(manifest, options = {}) {
    const mode = normalizeMode(options.mode);
    const settings = SCENERY_MODES[mode];
    const sceneries = activeSceneries(manifest);
    if (sceneries.length < settings.options) throw new Error('Not enough active scenery assets.');
    const seed = options.seed || (mode === 'daily'
        ? `scenery-scout:${manifest.catalogRevision}:${options.dateKey || utcDateKey()}`
        : `practice:${Date.now()}:${Math.random()}`);
    const random = options.random || createSeededRandom(seed);
    const rounds = Math.min(options.rounds || settings.rounds, sceneries.length);
    const pool = shuffle(sceneries, random).slice(0, rounds);

    return pool.map((scenery, index) => {
        const difficulty = getRoundDifficulty(mode, index);
        const crop = chooseCrop(scenery, difficulty, random);
        const distractors = chooseDistractors(scenery, sceneries, settings.options - 1, difficulty, random);
        return {
            id: `${mode}:${index}:${crop.id}`,
            index,
            mode,
            difficulty,
            sceneryId: scenery.id,
            correctName: scenery.name,
            crop,
            options: shuffle([scenery, ...distractors].map(item => ({ id: item.id, name: item.name })), random),
            timeLimit: mode === 'sudden-death' ? Math.max(8, settings.timeLimit - Math.floor(index / 5) * 2) : settings.timeLimit
        };
    });
}

export function scoreAnswer({ correct, responseMs, timeLimit, difficulty, streak = 0 }) {
    if (!correct) return { base: 0, timeBonus: 0, streakBonus: 0, total: 0 };
    const base = DIFFICULTY_POINTS[difficulty] || DIFFICULTY_POINTS.normal;
    const safeLimit = Math.max(1, Number(timeLimit) || 20) * 1000;
    const remaining = Math.max(0, 1 - Math.max(0, responseMs) / safeLimit);
    const timeBonus = Math.round(400 * remaining);
    const streakBonus = Math.min(400, Math.max(0, streak) * 40);
    return { base, timeBonus, streakBonus, total: base + timeBonus + streakBonus };
}

export function validateManifest(manifest) {
    if (!manifest || !Array.isArray(manifest.sceneries)) return false;
    return manifest.sceneries.every(scenery => Boolean(
        scenery?.id && scenery?.name && Array.isArray(scenery.tags)
        && Array.isArray(scenery.crops)
        && scenery.crops.every(crop => crop?.id && crop?.image && crop?.difficulty)
    ));
}

function activeSceneries(manifest) {
    if (!validateManifest(manifest)) throw new Error('The scenery manifest is invalid.');
    return manifest.sceneries.filter(scenery => scenery.active && scenery.crops.some(crop => crop.enabled));
}

function chooseCrop(scenery, difficulty, random) {
    const enabled = scenery.crops.filter(crop => crop.enabled);
    const matching = enabled.filter(crop => crop.difficulty === difficulty);
    const pool = matching.length ? matching : enabled;
    return pool[Math.floor(random() * pool.length)];
}

function chooseDistractors(correct, sceneries, count, difficulty, random) {
    const ranked = sceneries.filter(item => item.id !== correct.id).map(item => ({
        item,
        score: similarity(correct, item) + random() * (difficulty === 'normal' ? 2.2 : .45)
    })).sort((left, right) => right.score - left.score);
    const shortlist = difficulty === 'normal' ? ranked.slice(0, Math.max(count * 3, count)) : ranked;
    return shuffle(shortlist, random).sort((left, right) => right.score - left.score).slice(0, count).map(entry => entry.item);
}

function similarity(left, right) {
    const rightTags = new Set(right.tags || []);
    const shared = (left.tags || []).filter(tag => tag !== 'home' && rightTags.has(tag)).length;
    const prefix = left.id.split('-')[0] === right.id.split('-')[0] ? 1 : 0;
    return shared * 3 + prefix;
}

function shuffle(values, random) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
}

function normalizeMode(mode) {
    return Object.hasOwn(SCENERY_MODES, mode) ? mode : 'normal';
}

function hashSeed(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
