import {
    dedupeAchievementTiers,
    isFamilyComplete,
    isTierUnlocked,
    stateForValue
} from '../achievements/achievement-progress-semantics.js?v=20260914-achievement-reconciled-v1';

const list = value => Array.isArray(value) ? value : [];

function label(value, fallback = '') {
    const result = String(value ?? '').trim();
    return result || fallback;
}

export function familiesOf(category) {
    const families = [
        ...(Array.isArray(category?.progressionFamilies) ? category.progressionFamilies : []),
        ...(Array.isArray(category?.standaloneFamilies) ? category.standaloneFamilies : [])
    ];
    const seen = new Set();
    return families.filter((family, index) => {
        const key = label(family?.familyKey ?? family?.family_key ?? family?.key ?? family?.id,
            `family-${index}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function tiersOf(family) {
    if (Array.isArray(family?.tiers) && family.tiers.length) return dedupeAchievementTiers(family.tiers);
    return [family];
}

function completionFields(category) {
    return category?.completion && typeof category.completion === 'object' ? category.completion : {};
}

export function countsFor(category) {
    const families = familiesOf(category);
    const tiers = families.flatMap(tiersOf);
    const completion = completionFields(category);
    const hasFamilyData = families.some(family => Array.isArray(family?.tiers) && family.tiers.length);
    const explicitTotal = Number(category?.totalCount ?? category?.totalAchievements ?? category?.familyCount
        ?? category?.total ?? completion.total);
    const explicitUnlocked = Number(category?.completedCount ?? category?.completedAchievements
        ?? category?.completedFamilyCount ?? category?.completedFamilies ?? category?.unlockedCount
        ?? category?.unlocked ?? completion.completed ?? completion.unlocked);
    const total = Number.isFinite(explicitTotal) && explicitTotal >= 0
        ? explicitTotal : (families.length ? families.length : tiers.length);
    const completeFamilies = families.filter(isFamilyComplete).length;
    const unlockedTiers = tiers.filter(isTierUnlocked).length;
    const evidenceUnlocked = families.length ? completeFamilies : unlockedTiers;
    const unlocked = hasFamilyData
        ? Math.min(total, evidenceUnlocked)
        : Number.isFinite(explicitUnlocked) && explicitUnlocked >= 0
            ? Math.min(total, explicitUnlocked) : Math.min(total, evidenceUnlocked);
    const explicitPercent = category?.completionPercent ?? category?.completionPercentage
        ?? category?.progressPercent ?? category?.percentage ?? completion.percent;
    const hasUnknown = families.some(family => stateForValue(family) === 'unknown'
        || tiersOf(family).some(tier => stateForValue(tier) === 'unknown'));
    const percentValue = Number(explicitPercent);
    const percent = Number.isFinite(percentValue) && !hasFamilyData
        ? Math.max(0, Math.min(100, percentValue <= 1 ? percentValue * 100 : percentValue))
        : total > 0 && !hasUnknown ? (unlocked / total) * 100 : null;
    return { total, unlocked, percent };
}

function badgeDefinitionOf(category) {
    const definition = category?.badgeDefinition ?? category?.badge;
    return definition && typeof definition === 'object' ? definition : {};
}

export function badgeInfo(category) {
    const definition = badgeDefinitionOf(category);
    const counts = countsFor(category);
    const unlocked = counts.total > 0 && counts.percent === 100;
    const state = unlocked ? 'unlocked' : counts.percent === null ? 'unknown' : 'locked';
    return {
        label: label(definition.label ?? definition.displayLabel, 'Completion badge'),
        state,
        tier: state
    };
}
