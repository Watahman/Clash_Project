import {
    DAILY_CATEGORY_SEQUENCE,
    ENTITY_CATEGORIES,
    getCategory,
    getEntities
} from './entity-guesser-catalog.js';

export const DAILY_STORAGE_KEY = 'clashpanel:minigames:entity-guesser:daily:v2';
export const STATS_STORAGE_KEY = 'clashpanel:minigames:entity-guesser:stats:v2';
export const PRACTICE_CATEGORY_KEY = 'clashpanel:minigames:entity-guesser:practice-category:v1';

export function normalizeGuess(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[.']/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
}

export function findEntity(value, entities) {
    const normalized = normalizeGuess(value);
    if (!normalized) return null;
    return entities.find(entity => {
        const candidates = [entity.name, ...(entity.aliases || [])];
        return candidates.some(candidate => normalizeGuess(candidate) === normalized);
    }) || null;
}

export function searchEntities(value, entities, limit = 8) {
    const normalized = normalizeGuess(value);
    if (!normalized) {
        return [...entities]
            .sort((left, right) => left.name.localeCompare(right.name))
            .slice(0, limit);
    }
    return entities
        .filter(entity => [entity.name, ...(entity.aliases || [])]
            .some(candidate => normalizeGuess(candidate).includes(normalized)))
        .sort((left, right) => {
            const leftName = normalizeGuess(left.name);
            const rightName = normalizeGuess(right.name);
            const leftStarts = leftName.startsWith(normalized) ? 0 : 1;
            const rightStarts = rightName.startsWith(normalized) ? 0 : 1;
            return leftStarts - rightStarts || left.name.localeCompare(right.name);
        })
        .slice(0, limit);
}

export function utcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

export function previousUtcDateKey(dateKey) {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return utcDateKey(date);
}

export function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function dayNumber(dateKey = utcDateKey()) {
    return Math.floor(Date.parse(`${dateKey}T00:00:00.000Z`) / 86_400_000);
}

export function getDailyCategory(dateKey = utcDateKey()) {
    const index = Math.abs(dayNumber(dateKey)) % DAILY_CATEGORY_SEQUENCE.length;
    return getCategory(DAILY_CATEGORY_SEQUENCE[index]);
}

export function getDailyEntity(dateKey = utcDateKey(), category = getDailyCategory(dateKey)) {
    const entities = getEntities(category.id, { dailyOnly: true });
    if (!entities.length) throw new Error(`Entity Guesser requires daily entities for ${category.id}.`);
    return entities[stableHash(`clashpanel:${dateKey}:${category.id}`) % entities.length];
}

export function getPracticeEntity(category, random = Math.random) {
    const entities = getEntities(category.id);
    if (!entities.length) throw new Error(`Entity Guesser requires entities for ${category.id}.`);
    return entities[Math.floor(random() * entities.length) % entities.length];
}

export function formatValue(value) {
    if (Array.isArray(value)) return value.join(' & ');
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === null || value === undefined || value === '') return 'N/A';
    return String(value);
}

function setsOverlap(left, right) {
    const leftValues = new Set(Array.isArray(left) ? left : [left]);
    const rightValues = Array.isArray(right) ? right : [right];
    return rightValues.some(value => leftValues.has(value));
}

export function compareValue(guessValue, answerValue, column) {
    if (guessValue === null || guessValue === undefined || answerValue === null || answerValue === undefined) {
        return { state: 'notComparable', direction: null };
    }

    if (column.kind === 'number') {
        const difference = Number(guessValue) - Number(answerValue);
        if (difference === 0) return { state: 'correct', direction: null };
        const close = Math.abs(difference) <= Number(column.closeWithin || 0);
        return {
            state: close ? 'close' : 'wrong',
            direction: difference < 0 ? 'higher' : 'lower'
        };
    }

    if (column.kind === 'ordered') {
        const order = Array.isArray(column.order) ? column.order : [];
        const guessIndex = order.indexOf(guessValue);
        const answerIndex = order.indexOf(answerValue);
        if (guessIndex === answerIndex) return { state: 'correct', direction: null };
        if (guessIndex < 0 || answerIndex < 0) return { state: 'wrong', direction: null };
        return {
            state: Math.abs(guessIndex - answerIndex) === 1 ? 'close' : 'wrong',
            direction: guessIndex < answerIndex ? 'higher' : 'lower'
        };
    }

    if (column.kind === 'set') {
        const guessFormatted = formatValue(guessValue);
        const answerFormatted = formatValue(answerValue);
        if (guessFormatted === answerFormatted) return { state: 'correct', direction: null };
        return { state: setsOverlap(guessValue, answerValue) ? 'partial' : 'wrong', direction: null };
    }

    return {
        state: guessValue === answerValue ? 'correct' : 'wrong',
        direction: null
    };
}

export function compareEntity(guess, answer, category) {
    return category.columns.map(column => ({
        key: column.key,
        value: guess[column.key],
        displayValue: formatValue(guess[column.key]),
        ...compareValue(guess[column.key], answer[column.key], column)
    }));
}

export function isWinningGuess(guess, answer) {
    return Boolean(guess && answer && guess.id === answer.id);
}

export function calculateScore(attemptNumber, hintsUsed = 0, won = true, maxAttempts = 6) {
    if (!won) return 0;
    const scoreSteps = maxAttempts <= 5
        ? [1000, 800, 600, 400, 250]
        : [1000, 850, 700, 550, 400, 250];
    const base = scoreSteps[Math.max(0, Math.min(scoreSteps.length - 1, attemptNumber - 1))];
    const hintPenalty = hintsUsed === 0 ? 0 : hintsUsed === 1 ? 100 : 250;
    return Math.max(100, base - hintPenalty);
}

export function availableHintCount(attempts, usedHints, maxAttempts = 6) {
    const firstUnlock = maxAttempts <= 5 ? 2 : 3;
    const secondUnlock = maxAttempts <= 5 ? 4 : 5;
    const unlocked = attempts >= secondUnlock ? 2 : attempts >= firstUnlock ? 1 : 0;
    return Math.max(0, unlocked - usedHints);
}

export function buildHint(answer, category, hintNumber) {
    const hintBuilders = {
        troops: [
            entity => `${entity.movement} troop · targets ${formatValue(entity.targets).toLowerCase()}.`,
            entity => `${entity.resource} · ${entity.role.toLowerCase()} role · ${entity.housing} housing space.`
        ],
        spells: [
            entity => `${entity.resource} spell · ${entity.effect.toLowerCase()} effect.`,
            entity => `${entity.housing} housing space · ${entity.unlockTier.toLowerCase()}-game unlock · ${entity.role.toLowerCase()} role.`
        ],
        heroes: [
            entity => `${entity.movement} Hero · ${entity.attackStyle.toLowerCase()} attacker.`,
            entity => `${entity.role} role · favors ${entity.favorite.toLowerCase()} targets.`
        ],
        pets: [
            entity => `${entity.movement} Pet · ${entity.role.toLowerCase()} role.`,
            entity => `Pet House level ${entity.petHouse} · ${entity.attackStyle.toLowerCase()} attacker.`
        ],
        equipment: [
            entity => `${entity.rarity} ${entity.activation.toLowerCase()} equipment for the ${entity.hero}.`,
            entity => `${entity.effect} effect · mainly ${entity.role.toLowerCase()} · obtained from ${entity.source.toLowerCase()}.`
        ],
        defenses: [
            entity => `${formatValue(entity.targets)} defense · ${entity.damageType.toLowerCase()} damage.`,
            entity => `${entity.rangeClass.toLowerCase()} range · ${entity.special.toLowerCase()} · ${entity.attackStyle.toLowerCase()}.`
        ],
        resourceBuildings: [
            entity => `${entity.resource} building · used for ${entity.function.toLowerCase()}.`,
            entity => `${entity.footprint} footprint · ${entity.countClass.toLowerCase()} building · ${entity.lootRole.toLowerCase()} loot role.`
        ],
        armyBuildings: [
            entity => `${entity.system} building · ${entity.function.toLowerCase()}.`,
            entity => `${entity.footprint} footprint · upgraded with ${entity.upgradeResource.toLowerCase()} · ${entity.capacityBased ? 'capacity based' : 'fixed function'}.`
        ],
        utilityBuildings: [
            entity => `${entity.system} utility · ${entity.function.toLowerCase()}.`,
            entity => `${entity.footprint} footprint · connects to ${entity.connectsArea} · ${entity.upgradeable ? 'upgradeable' : 'not upgradeable'}.`
        ],
        traps: [
            entity => `${formatValue(entity.targets)} trap · ${entity.effect.toLowerCase()} effect.`,
            entity => `${entity.visibility.toLowerCase()} · ${entity.area.toLowerCase()} area · ${entity.mode.toLowerCase()} mode.`
        ]
    };
    const builders = hintBuilders[category.id] || [];
    return builders[Math.max(0, hintNumber - 1)]?.(answer) || `Starts with “${answer.name.charAt(0)}”.`;
}

export function updateStreak(stats, completedDateKey, won, categoryId) {
    const current = Number(stats?.currentStreak || 0);
    const best = Number(stats?.bestStreak || 0);
    const last = stats?.lastCompletedDate || null;
    let nextCurrent = current;

    if (last !== completedDateKey) {
        nextCurrent = last === previousUtcDateKey(completedDateKey) ? current + 1 : 1;
    }

    const categoryStats = { ...(stats?.categories || {}) };
    const previousCategory = categoryStats[categoryId] || { played: 0, won: 0 };
    if (last !== completedDateKey) {
        categoryStats[categoryId] = {
            played: Number(previousCategory.played || 0) + 1,
            won: Number(previousCategory.won || 0) + (won ? 1 : 0)
        };
    }

    return {
        gamesPlayed: Number(stats?.gamesPlayed || 0) + (last === completedDateKey ? 0 : 1),
        gamesWon: Number(stats?.gamesWon || 0) + (last === completedDateKey || !won ? 0 : 1),
        currentStreak: nextCurrent,
        bestStreak: Math.max(best, nextCurrent),
        lastCompletedDate: completedDateKey,
        categories: categoryStats
    };
}

export function resultSquares(comparisonRows) {
    return comparisonRows.map(row => row.map(cell => {
        if (cell.state === 'correct') return '🟩';
        if (cell.state === 'close' || cell.state === 'partial') return '🟨';
        if (cell.state === 'notComparable') return '⬜';
        return '⬛';
    }).join(''));
}

export function validateCatalog() {
    const ids = new Set();
    const errors = [];

    for (const category of ENTITY_CATEGORIES) {
        const entities = getEntities(category.id);
        if (entities.length < 5) errors.push(`${category.id} needs at least five entities.`);
        for (const entity of entities) {
            if (ids.has(entity.id)) errors.push(`Duplicate entity id: ${entity.id}`);
            ids.add(entity.id);
            for (const column of category.columns) {
                if (!(column.key in entity)) errors.push(`${entity.id} is missing ${column.key}.`);
            }
        }
    }

    return errors;
}
