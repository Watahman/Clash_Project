const BADGE_THRESHOLDS = Object.freeze([
    ['master', 1],
    ['gold', 0.75],
    ['silver', 0.5],
    ['bronze', 0.25]
]);

function list(value) {
    return Array.isArray(value) ? value : [];
}

function completionRatio(completed, total) {
    return total > 0 ? completed / total : 0;
}

function percentage(ratio) {
    return Math.round(ratio * 10000) / 100;
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

function familyNeedsUnknownBadge(family) {
    return family?.state === 'unknown'
        || (family?.sourceAvailable === false && !familyHasStoredProgress(family));
}

function familyIsComplete(family) {
    if (family?.complete !== undefined) return family.complete === true;
    if (family?.state === 'complete') return true;
    const tiers = list(family?.tiers);
    return tiers.length > 0 && tiers.every(tier => tier?.unlocked === true);
}

export function achievementStructure(family) {
    return list(family?.tiers).length > 1 ? 'progression' : 'standalone';
}

function badgeState(ratio, unknown) {
    if (unknown) return 'unknown';
    return BADGE_THRESHOLDS.find(([, threshold]) => ratio >= threshold)?.[0] || 'none';
}

function badgeFor(ratio, unknown) {
    const state = badgeState(ratio, unknown);
    return {
        state,
        progress: ratio,
        percentage: percentage(ratio),
        unlocked: state === 'master',
        confirmedUnlocked: state === 'master' && !unknown
    };
}

function categoryProgress(families) {
    const totalFamilies = families.length;
    const completedFamilies = families.filter(familyIsComplete).length;
    const completion = completionRatio(completedFamilies, totalFamilies);
    const tiers = families.flatMap(family => list(family?.tiers));
    const unlockedTiers = tiers.filter(tier => tier?.unlocked === true).length;
    const tierCompletion = completionRatio(unlockedTiers, tiers.length);
    return {
        familyCount: totalFamilies,
        completedFamilyCount: completedFamilies,
        completedFamilies,
        completion,
        completionPercent: percentage(completion),
        completionPercentage: percentage(completion),
        tierCount: tiers.length,
        totalTiers: tiers.length,
        unlockedTierCount: unlockedTiers,
        unlockedTiers,
        tierCompletion,
        tierCompletionPercent: percentage(tierCompletion),
        tierCompletionPercentage: percentage(tierCompletion)
    };
}

function makeCategory(key, families) {
    const first = families[0] || {};
    const progressionFamilies = families.filter(family => achievementStructure(family) === 'progression');
    const standaloneFamilies = families.filter(family => achievementStructure(family) === 'standalone');
    const progress = categoryProgress(families);
    const unknown = families.some(familyNeedsUnknownBadge);
    const badge = badgeFor(progress.completion, unknown);
    return {
        key,
        category: key,
        label: first.categoryLabel ?? '',
        categoryLabel: first.categoryLabel ?? '',
        families,
        progressionFamilies,
        standaloneFamilies,
        ...progress,
        badge,
        badgeState: badge.state,
        badgeTier: badge.state,
        badgeConfirmedUnlocked: badge.confirmedUnlocked
    };
}

export function buildAchievementCategories(families) {
    const categories = new Map();
    for (const family of list(families)) {
        const key = family?.category ?? '';
        if (!categories.has(key)) categories.set(key, []);
        categories.get(key).push(family);
    }
    return [...categories.entries()].map(([key, categoryFamilies]) => makeCategory(key, categoryFamilies));
}

export function categoryByKey(categories, key) {
    return list(categories).find(category => category?.key === key);
}
