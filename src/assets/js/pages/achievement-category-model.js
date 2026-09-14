import {
    ACHIEVEMENT_COLLECTION_DEFINITIONS,
    collectionDefinition,
    collectionKeyForSourceCategory
} from './achievement-collection-definitions.js?v=20260914-achievement-collection-v2';

const list = value => Array.isArray(value) ? value : [];

function text(value) {
    return String(value ?? '').trim();
}

function sourceCategoryOf(value) {
    return text(value?.sourceCategory || value?.category || value?.category_key);
}

function familyKeyOf(value) {
    return text(value?.familyKey || value?.family_key);
}

function achievementKeyOf(value) {
    return text(value?.achievementKey || value?.achievement_key);
}

function tierNumber(value) {
    const candidate = Number(value?.tier ?? value?.tierNumber);
    return Number.isInteger(candidate) && candidate > 0 ? candidate : null;
}

function tierIdentity(value, index) {
    const achievementKey = achievementKeyOf(value);
    const tier = tierNumber(value);
    return {
        keys: [
            achievementKey ? `achievement:${achievementKey}` : '',
            tier === null ? '' : `tier:${tier}`
        ].filter(Boolean),
        fallback: `row:${index}`
    };
}

function dedupeTiers(tiers) {
    const seen = new Set();
    return list(tiers).filter((tier, index) => {
        const identity = tierIdentity(tier, index);
        if (identity.keys.some(key => seen.has(key))) return false;
        identity.keys.forEach(key => seen.add(key));
        return true;
    });
}

function provenFamilyKey(candidate, tiers) {
    const candidateKey = familyKeyOf(candidate);
    const tierKeys = [...new Set(list(tiers).map(familyKeyOf).filter(Boolean))];
    if (candidateKey && tierKeys.every(key => key === candidateKey)) return candidateKey;
    if (!candidateKey && tierKeys.length === 1) return tierKeys[0];
    return candidateKey && !tierKeys.length ? candidateKey : '';
}

function isConsecutiveChain(familyKey, tiers) {
    if (!familyKey || tiers.length < 2) return false;
    const ordered = tiers
        .map((tier, index) => ({ tier, index, number: tierNumber(tier) }))
        .sort((left, right) => (left.number ?? Infinity) - (right.number ?? Infinity));
    if (ordered.some(item => item.number === null)) return false;
    return ordered.every((item, index) => {
        if (familyKeyOf(item.tier) && familyKeyOf(item.tier) !== familyKey) return false;
        return index === 0 || item.number === ordered[index - 1].number + 1;
    });
}

export function achievementStructure(family) {
    const tiers = dedupeTiers(family?.tiers);
    const familyKey = provenFamilyKey(family, tiers);
    return isConsecutiveChain(familyKey, tiers) ? 'progression' : 'standalone';
}

function familyHasStoredProgress(family) {
    if (family?.hasStoredProgress === true || family?.has_stored_progress === true) return true;
    return list(family?.tiers).some(tier => (
        tier?.hasStoredProgress === true
        || tier?.has_stored_progress === true
        || tier?.unlocked === true
        || Number(tier?.progress) > 0
    ));
}

function familyIsUnknown(family) {
    return family?.state === 'unknown'
        || family?.progressKnown === false
        || (family?.sourceAvailable === false && !familyHasStoredProgress(family));
}

function familyIsComplete(family) {
    if (family?.complete !== undefined) return family.complete === true;
    if (family?.state === 'complete') return true;
    const tiers = list(family?.tiers);
    return tiers.length > 0 && tiers.every(tier => tier?.unlocked === true);
}

function normalizeCandidate(candidate) {
    const sourceCategory = sourceCategoryOf(candidate) || 'other';
    const rawTiers = Array.isArray(candidate?.tiers) ? candidate.tiers : [candidate];
    const tiers = dedupeTiers(rawTiers);
    const familyKey = provenFamilyKey(candidate, tiers);
    return {
        ...candidate,
        category: sourceCategory,
        sourceCategory,
        familyKey,
        sourceFamilyKey: familyKey || null,
        tiers,
        structure: isConsecutiveChain(familyKey, tiers) ? 'progression' : 'standalone'
    };
}

function mergeCandidates(items) {
    const grouped = new Map();
    const standalone = [];
    items.forEach((candidate, index) => {
        const sourceCategory = sourceCategoryOf(candidate) || 'other';
        const rawTiers = Array.isArray(candidate?.tiers) ? candidate.tiers : [candidate];
        const familyKey = provenFamilyKey(candidate, rawTiers);
        if (!familyKey) {
            standalone.push(normalizeCandidate({ ...candidate, sourceCategory }));
            return;
        }
        const groupKey = `${sourceCategory}\u0000${familyKey}`;
        const current = grouped.get(groupKey);
        if (current) {
            current.tiers.push(...rawTiers);
            return;
        }
        grouped.set(groupKey, {
            ...candidate,
            sourceCategory,
            familyKey,
            tiers: [...rawTiers],
            sourceIndex: index
        });
    });
    return [...grouped.values(), ...standalone].map(normalizeCandidate);
}

function collectionProgress(families) {
    const tiers = families.flatMap(family => list(family.tiers));
    const completedFamilies = families.filter(familyIsComplete).length;
    const unlockedTiers = tiers.filter(tier => tier?.unlocked === true).length;
    const unknownFamilyCount = families.filter(familyIsUnknown).length;
    const progressKnown = families.length > 0 && unknownFamilyCount === 0;
    const completion = progressKnown ? completedFamilies / families.length : null;
    const tierCompletion = progressKnown && tiers.length ? unlockedTiers / tiers.length : null;
    const percent = value => value === null ? null : Math.round(value * 10000) / 100;
    return {
        familyCount: families.length,
        totalFamilies: families.length,
        completedFamilyCount: completedFamilies,
        completedFamilies,
        completion,
        completionPercent: percent(completion),
        completionPercentage: percent(completion),
        tierCount: tiers.length,
        totalTiers: tiers.length,
        unlockedTierCount: unlockedTiers,
        unlockedTiers,
        tierCompletion,
        tierCompletionPercent: percent(tierCompletion),
        unknownFamilyCount,
        progressKnown,
        state: progressKnown ? (completion === 1 ? 'complete' : 'in_progress') : 'unknown'
    };
}

function collectionBadge(definition, progress) {
    const unlocked = progress.progressKnown && progress.completion === 1 && progress.familyCount > 0;
    return {
        ...definition.badge,
        label: definition.badge.name,
        state: unlocked ? 'unlocked' : 'locked',
        tier: unlocked ? 'unlocked' : 'locked',
        unlocked,
        confirmedUnlocked: unlocked,
        progress: progress.completion,
        percentage: progress.completionPercent,
        status: progress.state
    };
}

function familiesForDefinition(families, definition) {
    return families.filter(family => (
        collectionKeyForSourceCategory(family.sourceCategory || family.category) === definition.key
    ));
}

function makeCollection(definition, families) {
    const sourceFamilies = familiesForDefinition(families, definition);
    const progress = collectionProgress(sourceFamilies);
    const actualSourceCategories = [...new Set(sourceFamilies.map(family => family.sourceCategory))];
    const sourceFamiliesByCategory = Object.fromEntries(actualSourceCategories.map(category => [
        category,
        sourceFamilies.filter(family => family.sourceCategory === category)
    ]));
    const progressionFamilies = sourceFamilies.filter(family => achievementStructure(family) === 'progression');
    const standaloneFamilies = sourceFamilies.filter(family => achievementStructure(family) === 'standalone');
    const badge = collectionBadge(definition, progress);
    return {
        key: definition.key,
        collectionKey: definition.key,
        id: definition.key,
        category: definition.key,
        categoryKey: definition.key,
        title: definition.title,
        name: definition.title,
        label: definition.title,
        categoryLabel: definition.title,
        description: definition.description,
        icon: definition.icon,
        iconFamily: definition.iconFamily,
        sourceCategories: [...definition.sourceCategories],
        sourceCategoryKeys: actualSourceCategories,
        sourceFamilies,
        sourceFamiliesByCategory,
        families: sourceFamilies,
        progressionFamilies,
        standaloneFamilies,
        ...progress,
        badge,
        badgeDefinition: badge
    };
}

export function buildAchievementCollections(input) {
    const candidates = list(input);
    const families = mergeCandidates(candidates);
    return ACHIEVEMENT_COLLECTION_DEFINITIONS.map(definition => makeCollection(definition, families));
}

export const buildAchievementCategories = buildAchievementCollections;

export function categoryByKey(categories, key) {
    const requested = text(key);
    return list(categories).find(category => (
        text(category?.key ?? category?.categoryKey ?? category?.id ?? category?.category) === requested
    ));
}

export { collectionDefinition };
