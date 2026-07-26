export const BONUS_STRATEGIES = Object.freeze({
    fair: Object.freeze({
        performance: 45,
        contribution: 25,
        reliability: 20,
        defense: 10
    }),
    performance: Object.freeze({
        performance: 65,
        contribution: 15,
        reliability: 15,
        defense: 5
    }),
    contribution: Object.freeze({
        performance: 35,
        contribution: 45,
        reliability: 15,
        defense: 5
    })
});

export const BONUS_COMPONENTS = Object.freeze([
    'performance',
    'contribution',
    'reliability',
    'defense'
]);

export function resolveBonusWeights(strategy = 'fair', customWeights = {}) {
    if (strategy !== 'custom') return BONUS_STRATEGIES[strategy] || BONUS_STRATEGIES.fair;
    return Object.fromEntries(
        BONUS_COMPONENTS.map(component => [
            component,
            clampWeight(customWeights[component])
        ])
    );
}

export function bonusWeightTotal(weights = {}) {
    return BONUS_COMPONENTS.reduce(
        (total, component) => total + clampWeight(weights[component]),
        0
    );
}

export function validBonusWeights(weights = {}) {
    return bonusWeightTotal(weights) === 100;
}

function clampWeight(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed)
        ? Math.min(100, Math.max(0, Math.round(parsed)))
        : 0;
}
