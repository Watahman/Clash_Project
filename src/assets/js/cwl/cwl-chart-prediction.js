const DEFAULT_DAY_COUNT = 7;

function buildWeightedPrediction(points = [], valueKey, {
    dayCount = DEFAULT_DAY_COUNT,
    minimum = Number.NEGATIVE_INFINITY,
    maximum = Number.POSITIVE_INFINITY
} = {}) {
    const history = points
        .filter(point => point?.[valueKey] !== null && point?.[valueKey] !== undefined && point?.[valueKey] !== '')
        .map(point => ({ day: Number(point?.day), value: Number(point?.[valueKey]) }))
        .filter(point => Number.isFinite(point.day) && Number.isFinite(point.value))
        .sort((a, b) => a.day - b.day);

    const last = history.at(-1);
    if (!last || last.day >= dayCount) return [];

    const recent = history.slice(-3);
    const weightTotal = recent.reduce((total, _point, index) => total + index + 1, 0);
    const weightedAverage = recent.reduce(
        (total, point, index) => total + point.value * (index + 1),
        0
    ) / weightTotal;
    const expected = Math.min(maximum, Math.max(minimum, weightedAverage));
    const prediction = [{ day: last.day, value: last.value }];

    for (let day = last.day + 1; day <= dayCount; day += 1) {
        prediction.push({ day, value: expected });
    }

    return prediction;
}

export { buildWeightedPrediction };
