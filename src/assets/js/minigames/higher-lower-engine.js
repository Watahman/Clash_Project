import { ENTITY_GUESSER_DATA_VERSION, getEntitiesBySourceCategory } from './entity-guesser-catalog.js?v=20260809-2';

export const HIGHER_LOWER_DATA_VERSION = `${ENTITY_GUESSER_DATA_VERSION}-higher-lower-v1`;
export const HIGHER_LOWER_DAILY_KEY = 'clashpanel:minigames:higher-lower:daily:v1';
export const HIGHER_LOWER_STATS_KEY = 'clashpanel:minigames:higher-lower:stats:v1';
export const HIGHER_LOWER_PRACTICE_FILTER_KEY = 'clashpanel:minigames:higher-lower:practice-filter:v1';
export const DAILY_QUESTION_COUNT = 9;

export const COMPARISON_PROFILES = Object.freeze([
    { id: 'troops-housing', groupId: 'troopsHeroes', sourceCategoryId: 'troops', key: 'housing', labelKey: 'housingSpace', unitKey: 'housingSpaces', kind: 'number' },
    { id: 'heroes-equipment', groupId: 'troopsHeroes', sourceCategoryId: 'heroes', key: 'equipmentCount', labelKey: 'equipmentCount', unitKey: 'equipmentItems', kind: 'number' },
    { id: 'pets-house', groupId: 'troopsHeroes', sourceCategoryId: 'pets', key: 'petHouse', labelKey: 'petHouseRequirement', unitKey: 'petHouseLevel', kind: 'number' },
    { id: 'spells-housing', groupId: 'spellsEquipment', sourceCategoryId: 'spells', key: 'housing', labelKey: 'housingSpace', unitKey: 'housingSpaces', kind: 'number' },
    { id: 'equipment-max-level', groupId: 'spellsEquipment', sourceCategoryId: 'equipment', key: 'maxLevel', labelKey: 'maximumLevel', unitKey: 'levels', kind: 'number' },
    { id: 'defenses-range', groupId: 'defenses', sourceCategoryId: 'defenses', key: 'rangeClass', labelKey: 'rangeClass', unitKey: 'rangeClassUnit', kind: 'ordered', order: ['Short', 'Medium', 'Long', 'Very Long'] },
    { id: 'traps-area', groupId: 'defenses', sourceCategoryId: 'traps', key: 'area', labelKey: 'effectArea', unitKey: 'areaClass', kind: 'ordered', order: ['Single', 'Small', 'Medium', 'Large'] },
    { id: 'army-footprint', groupId: 'otherBuildings', sourceCategoryId: 'armyBuildings', key: 'footprint', labelKey: 'buildingFootprint', unitKey: 'tiles', kind: 'footprint' },
    { id: 'utility-footprint', groupId: 'otherBuildings', sourceCategoryId: 'utilityBuildings', key: 'footprint', labelKey: 'buildingFootprint', unitKey: 'tiles', kind: 'footprint' }
]);

export const DAILY_CATEGORY_IDS = Object.freeze([
    'defenses',
    'otherBuildings',
    'troopsHeroes',
    'spellsEquipment',
    'defenses',
    'troopsHeroes',
    'spellsEquipment',
    'otherBuildings',
    'troopsHeroes'
]);

export function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function utcDateKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

export function getMetricValue(entity, profile) {
    const rawValue = entity?.[profile.key];
    if (rawValue === null || rawValue === undefined) return null;

    if (profile.kind === 'number') {
        const value = Number(rawValue);
        return Number.isFinite(value) ? value : null;
    }

    if (profile.kind === 'ordered') {
        const index = profile.order.indexOf(rawValue);
        return index >= 0 ? index : null;
    }

    if (profile.kind === 'footprint') {
        const match = String(rawValue).match(/^(\d+)x(\d+)$/i);
        return match ? Number(match[1]) * Number(match[2]) : null;
    }

    return null;
}

export function formatMetricValue(entity, profile) {
    const rawValue = entity?.[profile.key];
    if (rawValue === null || rawValue === undefined) return 'N/A';
    if (profile.kind === 'footprint') return `${rawValue} (${getMetricValue(entity, profile)} tiles)`;
    return String(rawValue);
}

export function getProfiles(categoryId = 'all') {
    return categoryId === 'all'
        ? COMPARISON_PROFILES
        : COMPARISON_PROFILES.filter(profile => profile.groupId === categoryId);
}

export function buildComparablePairs(profile) {
    const entities = getEntitiesBySourceCategory(profile.sourceCategoryId);
    const pairs = [];

    for (let leftIndex = 0; leftIndex < entities.length; leftIndex += 1) {
        const left = entities[leftIndex];
        const leftValue = getMetricValue(left, profile);
        if (leftValue === null) continue;

        for (let rightIndex = leftIndex + 1; rightIndex < entities.length; rightIndex += 1) {
            const right = entities[rightIndex];
            const rightValue = getMetricValue(right, profile);
            if (rightValue === null || rightValue === leftValue) continue;
            pairs.push({ left, right, leftValue, rightValue });
        }
    }

    return pairs;
}

export function createQuestion(profile, pair, { id, flip = false } = {}) {
    const left = flip ? pair.right : pair.left;
    const right = flip ? pair.left : pair.right;
    const leftValue = flip ? pair.rightValue : pair.leftValue;
    const rightValue = flip ? pair.leftValue : pair.rightValue;

    return {
        id: id || `${profile.id}:${left.id}:${right.id}`,
        categoryId: profile.groupId,
        sourceCategoryId: profile.sourceCategoryId,
        profileId: profile.id,
        labelKey: profile.labelKey,
        unitKey: profile.unitKey,
        leftEntityId: left.id,
        leftName: left.name,
        leftValue,
        leftDisplayValue: formatMetricValue(left, profile),
        rightEntityId: right.id,
        rightName: right.name,
        rightValue,
        rightDisplayValue: formatMetricValue(right, profile),
        correctChoice: rightValue > leftValue ? 'higher' : 'lower'
    };
}

function chooseProfile(categoryId, seed) {
    const profiles = getProfiles(categoryId);
    if (!profiles.length) throw new Error(`No Higher or Lower profiles for ${categoryId}.`);
    return profiles[stableHash(`${seed}:profile`) % profiles.length];
}

function choosePair(profile, seed) {
    const pairs = buildComparablePairs(profile);
    if (!pairs.length) throw new Error(`No non-tied Higher or Lower pairs for ${profile.id}.`);
    return pairs[stableHash(`${seed}:pair`) % pairs.length];
}

export function buildDailyQuestions(dateKey = utcDateKey()) {
    const categories = [...DAILY_CATEGORY_IDS]
        .sort((left, right) => stableHash(`${dateKey}:${left}`) - stableHash(`${dateKey}:${right}`));

    return categories.map((categoryId, index) => {
        const seed = `${dateKey}:${categoryId}:${index}`;
        const profile = chooseProfile(categoryId, seed);
        const pair = choosePair(profile, seed);
        return createQuestion(profile, pair, {
            id: `daily:${dateKey}:${index}:${profile.id}`,
            flip: stableHash(`${seed}:flip`) % 2 === 1
        });
    });
}

export function buildPracticeQuestion(categoryId = 'all', previousQuestionId = '', random = Math.random) {
    const profiles = getProfiles(categoryId);
    if (!profiles.length) throw new Error(`No Higher or Lower profiles for ${categoryId}.`);

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const profile = profiles[Math.floor(random() * profiles.length) % profiles.length];
        const pairs = buildComparablePairs(profile);
        const pair = pairs[Math.floor(random() * pairs.length) % pairs.length];
        const flip = random() >= 0.5;
        const question = createQuestion(profile, pair, {
            id: `practice:${profile.id}:${pair.left.id}:${pair.right.id}:${flip ? 1 : 0}`,
            flip
        });
        if (question.id !== previousQuestionId) return question;
    }

    const profile = profiles[0];
    const pair = buildComparablePairs(profile)[0];
    return createQuestion(profile, pair, { id: `practice:fallback:${profile.id}` });
}

export function getComboBonus(combo) {
    if (combo >= 8) return 30;
    if (combo >= 5) return 20;
    if (combo >= 3) return 10;
    return 0;
}

export function scoreChoice(isCorrect, currentCombo = 0) {
    if (!isCorrect) {
        return { points: 0, combo: 0, bonus: 0 };
    }
    const combo = currentCombo + 1;
    const bonus = getComboBonus(combo);
    return { points: 100 + bonus, combo, bonus };
}

export function applyChoice(run, question, choice) {
    if (run.completed || run.revealed) return run;
    const correct = choice === question.correctChoice;
    const scored = scoreChoice(correct, run.combo);
    const answers = [...run.answers, {
        questionId: question.id,
        choice,
        correct,
        correctChoice: question.correctChoice
    }];
    const answeredCount = answers.length;
    const completed = run.mode === 'daily' && answeredCount >= DAILY_QUESTION_COUNT;

    return {
        ...run,
        answers,
        score: run.score + scored.points,
        correctCount: run.correctCount + (correct ? 1 : 0),
        combo: scored.combo,
        bestCombo: Math.max(run.bestCombo, scored.combo),
        revealed: true,
        lastCorrect: correct,
        lastBonus: scored.bonus,
        completed
    };
}

export function advanceRun(run) {
    if (!run.revealed || run.completed) return run;
    return {
        ...run,
        currentIndex: run.currentIndex + 1,
        revealed: false,
        lastCorrect: null,
        lastBonus: 0
    };
}

export function createDailyRun(dateKey = utcDateKey()) {
    return {
        mode: 'daily',
        dateKey,
        dataVersion: HIGHER_LOWER_DATA_VERSION,
        currentIndex: 0,
        answers: [],
        score: 0,
        correctCount: 0,
        combo: 0,
        bestCombo: 0,
        revealed: false,
        lastCorrect: null,
        lastBonus: 0,
        completed: false
    };
}

export function createPracticeRun(categoryId = 'all') {
    return {
        mode: 'practice',
        categoryId,
        dataVersion: HIGHER_LOWER_DATA_VERSION,
        currentIndex: 0,
        answers: [],
        score: 0,
        correctCount: 0,
        combo: 0,
        bestCombo: 0,
        revealed: false,
        lastCorrect: null,
        lastBonus: 0,
        completed: false
    };
}

export function updateLifetimeStats(stats, run) {
    if (!run.completed || stats?.lastCompletedDate === run.dateKey) return stats || {};
    const played = Number(stats?.runsPlayed || 0) + 1;
    const correct = Number(stats?.totalCorrect || 0) + run.correctCount;
    const questions = Number(stats?.totalQuestions || 0) + DAILY_QUESTION_COUNT;
    return {
        runsPlayed: played,
        totalCorrect: correct,
        totalQuestions: questions,
        bestScore: Math.max(Number(stats?.bestScore || 0), run.score),
        bestCombo: Math.max(Number(stats?.bestCombo || 0), run.bestCombo),
        perfectRuns: Number(stats?.perfectRuns || 0) + (run.correctCount === DAILY_QUESTION_COUNT ? 1 : 0),
        lastCompletedDate: run.dateKey
    };
}

export function resultSymbols(answers) {
    return answers.map(answer => answer.correct ? '✅' : '❌').join('');
}
