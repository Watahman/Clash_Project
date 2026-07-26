function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

export function matchupDifficultyMultiplier(attacker = {}, defender = {}) {
    const townHallDelta = number(attacker.townHall) - number(defender.townHall);
    const progressionDelta =
        number(attacker.progression, 0.5) - number(defender.progression, 0.5);
    return clamp(1 - townHallDelta * 0.12 - progressionDelta * 0.3, 0.7, 1.35);
}

export function compareMatchupStrength(attacker = {}, defender = {}) {
    const townHallDelta = number(attacker.townHall) - number(defender.townHall);
    const progressionDelta =
        number(attacker.progression, 0.5) - number(defender.progression, 0.5);
    return {
        starAdjustment: townHallDelta * 0.3 + progressionDelta * 0.65,
        destructionAdjustment: townHallDelta * 6 + progressionDelta * 14,
        difficultyMultiplier: matchupDifficultyMultiplier(attacker, defender)
    };
}

export function attackQuality(stars, destruction) {
    return 75 * (clamp(number(stars), 0, 3) / 3)
        + 25 * (clamp(number(destruction), 0, 100) / 100);
}
