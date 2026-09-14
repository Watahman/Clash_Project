import {
    ACHIEVEMENT_COLLECTION_DEFINITIONS,
    collectionDefinition,
    collectionKeyForSourceCategory
} from './achievement-collection-definitions.js?v=20260914-achievement-polish-v1';
import {
    comparisonOf,
    dedupeAchievementTiers,
    evaluateThreshold,
    isFamilyComplete,
    isTierUnlocked,
    progressIsUnknown,
    stateForValue,
    targetValueOf
} from '../achievements/achievement-progress-semantics.js?v=20260914-achievement-reconciled-v1';

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

function dedupeTiers(tiers) {
    return dedupeAchievementTiers(tiers);
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
        .map(tier => ({ tier, number: tierNumber(tier) }))
        .sort((left, right) => (left.number ?? Infinity) - (right.number ?? Infinity));
    if (ordered.some(item => item.number === null)) return false;
    if (!ordered.every((item, index) => {
        if (familyKeyOf(item.tier) && familyKeyOf(item.tier) !== familyKey) return false;
        return index === 0 || item.number === ordered[index - 1].number + 1;
    })) return false;
    return validThresholdSequence(ordered.map(item => item.tier));
}

function specialThreshold(tier) {
    const display = text(tier?.thresholdText || tier?.threshold_text);
    const label = text(tier?.tierLabel || tier?.tier_label).toLowerCase();
    return (display !== '' && targetValueOf({ thresholdText: display }) === null)
        || label === 'all';
}

function metricOf(tier) {
    return text(tier?.metric || tier?.specMetric || tier?.spec_metric);
}

function validThresholdSequence(tiers) {
    for (let index = 1; index < tiers.length; index += 1) {
        const previousComparison = comparisonOf(tiers[index - 1]);
        const currentComparison = comparisonOf(tiers[index]);
        if (previousComparison !== currentComparison || !['GTE', 'LTE'].includes(currentComparison)) continue;
        const previousMetric = metricOf(tiers[index - 1]);
        const currentMetric = metricOf(tiers[index]);
        if (previousMetric && currentMetric && previousMetric !== currentMetric) continue;
        const previous = evaluateThreshold(tiers[index - 1]);
        const current = evaluateThreshold(tiers[index]);
        if (specialThreshold(tiers[index - 1]) || specialThreshold(tiers[index])) continue;
        if (previous.target === null || current.target === null) continue;
        if (currentComparison === 'GTE' && current.target <= previous.target) return false;
        if (currentComparison === 'LTE' && current.target >= previous.target) return false;
    }
    return true;
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
        || isTierUnlocked(tier)
        || Number(tier?.progress) > 0
    ));
}

function familyIsUnknown(family) {
    return progressIsUnknown(family)
        || family?.state === 'unknown'
        || family?.progressKnown === false
        || (family?.sourceAvailable === false && !familyHasStoredProgress(family));
}

function familyIsComplete(family) {
    return isFamilyComplete(family);
}

function normalizeTier(tier) {
    const normalized = { ...tier };
    const evaluation = evaluateThreshold(normalized);
    if (evaluation.meets === true) normalized.unlocked = true;
    if (evaluation.meets === false) {
        normalized.unlocked = false;
        normalized.complete = false;
    }
    normalized.state = stateForValue(normalized);
    return normalized;
}

function normalizeCandidate(candidate) {
    const sourceCategory = sourceCategoryOf(candidate) || 'other';
    const rawTiers = Array.isArray(candidate?.tiers) ? candidate.tiers : [candidate];
    const tiers = dedupeTiers(rawTiers).map(normalizeTier);
    const familyKey = provenFamilyKey(candidate, tiers);
    const normalized = { ...candidate, category: sourceCategory, sourceCategory, familyKey, tiers };
    const complete = familyIsComplete(normalized);
    return {
        ...normalized,
        sourceFamilyKey: familyKey || null,
        complete,
        state: complete ? 'complete' : familyIsUnknown(normalized) ? 'unknown' : stateForValue(normalized),
        structure: isConsecutiveChain(familyKey, tiers) ? 'progression' : 'standalone'
    };
}

function mergeCandidates(items) {
    const grouped = new Map();
    const standalone = new Map();
    items.forEach((candidate, index) => {
        const sourceCategory = sourceCategoryOf(candidate) || 'other';
        const rawTiers = Array.isArray(candidate?.tiers) ? candidate.tiers : [candidate];
        const familyKey = provenFamilyKey(candidate, rawTiers);
        if (!familyKey) {
            const achievementKey = achievementKeyOf(candidate) || achievementKeyOf(rawTiers[0]);
            if (!achievementKey) {
                standalone.set(`row:${index}`, { ...candidate, sourceCategory });
                return;
            }
            const groupKey = `${sourceCategory}\u0000achievement\u0000${achievementKey}`;
            const current = standalone.get(groupKey);
            if (current) current.tiers.push(...rawTiers);
            else standalone.set(groupKey, {
                ...candidate,
                sourceCategory,
                tiers: [...rawTiers]
            });
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
    return [...grouped.values(), ...standalone.values()].map(normalizeCandidate);
}

function collectionProgress(families) {
    const tiers = families.flatMap(family => list(family.tiers));
    const completedFamilies = families.filter(familyIsComplete).length;
    const unlockedTiers = tiers.filter(isTierUnlocked).length;
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
    const state = unlocked ? 'unlocked' : progress.progressKnown ? 'locked' : 'unknown';
    return {
        ...definition.badge,
        label: definition.badge.name,
        state,
        tier: state,
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
