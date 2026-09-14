const list = value => Array.isArray(value) ? value : [];

const COMPARISON_ALIASES = Object.freeze({
    '>=': 'GTE',
    'GREATER_THAN_OR_EQUAL': 'GTE',
    'GREATER_THAN_OR_EQUAL_TO': 'GTE',
    '<=': 'LTE',
    'LESS_THAN_OR_EQUAL': 'LTE',
    'LESS_THAN_OR_EQUAL_TO': 'LTE',
    'BOOL': 'BOOLEAN'
});

function stringValue(value) {
    return String(value ?? '').trim();
}

function numberFrom(value) {
    if (value === undefined || value === null || stringValue(value) === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function explicitState(value) {
    return stringValue(value?.state ?? value?.status).toLowerCase().replace(/-/g, '_');
}

function hasStoredUnlock(value) {
    return value?.unlocked === true
        || value?.complete === true
        || list(value?.unlockedTiers).length > 0
        || ['unlocked', 'complete', 'completed', 'earned'].includes(explicitState(value));
}

function hasStoredEvidence(value) {
    return value?.hasStoredProgress === true
        || value?.has_stored_progress === true
        || hasStoredUnlock(value)
        || progressValueOf(value) > 0
        || list(value?.tiers).some(tier => hasStoredEvidence(tier));
}

function hasExplicitComparison(value) {
    return [value?.comparison, value?.comparator, value?.operator]
        .some(candidate => stringValue(candidate) !== '');
}

export function comparisonOf(value) {
    const raw = value?.comparison ?? value?.comparator ?? value?.operator;
    if (raw === undefined || raw === null || stringValue(raw) === '') return 'GTE';
    const normalized = stringValue(raw).toUpperCase();
    return COMPARISON_ALIASES[normalized] || normalized;
}

export function progressValueOf(value) {
    return numberFrom(value?.progress ?? value?.currentProgress ?? value?.current_progress);
}

export function targetValueOf(value) {
    const direct = numberFrom(value?.target ?? value?.threshold);
    if (direct !== null) return direct;
    const display = stringValue(value?.thresholdText ?? value?.threshold_text);
    return /^[-+]?\d+(?:\.\d+)?$/u.test(display) ? Number(display) : null;
}

export function progressIsAvailable(value) {
    return value?.progressKnown !== false
        && value?.progress_known !== false
        && value?.sourceAvailable !== false
        && value?.source_available !== false;
}

export function evaluateThreshold(value) {
    const comparison = comparisonOf(value);
    const progress = progressValueOf(value);
    const target = targetValueOf(value) ?? (comparison === 'BOOLEAN' ? 1 : null);
    const supported = ['GTE', 'LTE', 'BOOLEAN'].includes(comparison);
    const progressKnown = value?.progressKnown !== false && value?.progress_known !== false;
    const known = supported && progressKnown && progress !== null && target !== null;
    let meets = null;
    if (known) {
        if (comparison === 'GTE') meets = progress >= target;
        if (comparison === 'LTE') meets = progress > 0 && progress <= target;
        if (comparison === 'BOOLEAN') meets = progress > 0;
    }
    return { comparison, progress, target, supported, known, meets };
}

export function isTierUnlocked(value) {
    const evaluation = evaluateThreshold(value);
    if (evaluation.meets !== null) return evaluation.meets;
    if (hasExplicitComparison(value) && evaluation.supported && !evaluation.known) return false;
    if (explicitState(value) === 'unknown' || value?.progressKnown === false || value?.progress_known === false) {
        return false;
    }
    return hasStoredUnlock(value);
}

export function hasKnownThresholdViolation(value) {
    return evaluateThreshold(value).meets === false;
}

export function progressRatioOf(value) {
    const evaluation = evaluateThreshold(value);
    if (!evaluation.known) return null;
    if (evaluation.comparison === 'BOOLEAN') return evaluation.meets ? 1 : 0;
    if (evaluation.target <= 0) return evaluation.meets ? 1 : 0;
    if (evaluation.comparison === 'LTE') {
        if (evaluation.progress <= 0) return 0;
        return evaluation.progress <= evaluation.target
            ? 1 : Math.max(0, Math.min(1, evaluation.target / evaluation.progress));
    }
    return Math.max(0, Math.min(1, evaluation.progress / evaluation.target));
}

export function progressIsUnknown(value) {
    if (explicitState(value) === 'unknown') return true;
    if (value?.progressKnown === false || value?.progress_known === false) return true;
    const evaluation = evaluateThreshold(value);
    if (evaluation.meets !== null) return false;
    if (!list(value?.tiers).length && hasExplicitComparison(value) && evaluation.supported && !evaluation.known) {
        return true;
    }
    if (!evaluation.supported && !hasStoredUnlock(value)) return true;
    const sourceUnavailable = !progressIsAvailable(value);
    if (sourceUnavailable && !hasStoredEvidence(value)) return true;
    return list(value?.tiers).some(tier => progressIsUnknown(tier));
}

export function isFamilyComplete(value) {
    const tiers = list(value?.tiers);
    if (explicitState(value) === 'unknown' || value?.progressKnown === false || value?.progress_known === false) {
        return false;
    }
    if (tiers.length) return tiers.every(isTierUnlocked);
    return value?.complete === true || explicitState(value) === 'complete';
}

export function stateForValue(value) {
    const tiers = list(value?.tiers);
    if (tiers.length && isFamilyComplete(value)) return 'complete';
    if (progressIsUnknown(value)) return 'unknown';

    if (tiers.length && explicitState(value) === 'complete') {
        const currentTier = tiers.find(tier => !isTierUnlocked(tier)) || tiers.at(-1);
        const currentEvaluation = evaluateThreshold(currentTier);
        if (currentEvaluation.meets === false) {
            return currentEvaluation.progress !== null && currentEvaluation.progress > 0
                ? 'in_progress' : 'locked';
        }
        if (currentEvaluation.meets === true) return 'unlocked';
        return isTierUnlocked(currentTier) ? 'unlocked' : 'locked';
    }

    const evaluation = evaluateThreshold(value);
    if (evaluation.meets === false) {
        return evaluation.progress !== null && evaluation.progress > 0 ? 'in_progress' : 'locked';
    }
    if (evaluation.meets === true) {
        return value?.complete === true || explicitState(value) === 'complete' ? 'complete' : 'unlocked';
    }

    const state = explicitState(value);
    if (state === 'complete') return 'complete';
    if (state === 'unlocked' || hasStoredUnlock(value)) return 'unlocked';
    if (state === 'in_progress') return 'in_progress';
    return progressValueOf(value) > 0 ? 'in_progress' : 'locked';
}

function tierIdentity(value, index) {
    const achievementKey = stringValue(value?.achievementKey ?? value?.achievement_key);
    const tier = numberFrom(value?.tier ?? value?.tierNumber);
    const keys = [
        achievementKey ? `achievement:${achievementKey}` : '',
        Number.isInteger(tier) && tier > 0 ? `tier:${tier}` : ''
    ].filter(Boolean);
    if (keys.length) return keys;
    const anonymous = JSON.stringify([
        stringValue(value?.familyKey ?? value?.family_key),
        stringValue(value?.title),
        numberFrom(value?.target ?? value?.threshold),
        progressValueOf(value)
    ]);
    return [`anonymous:${anonymous || index}`];
}

export function dedupeAchievementTiers(tiers) {
    const seen = new Set();
    return list(tiers).filter((tier, index) => {
        const keys = tierIdentity(tier, index);
        if (keys.some(key => seen.has(key))) return false;
        keys.forEach(key => seen.add(key));
        return true;
    });
}
