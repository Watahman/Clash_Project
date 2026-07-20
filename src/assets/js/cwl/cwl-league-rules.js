const FIFTEEN_ONLY_LEAGUE_PREFIXES = Object.freeze([
    'champion',
    'titan',
    'legend'
]);

export function normalizeCwlLeagueName(leagueName) {
    return String(leagueName || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

export function allowsThirtyPlayerCwl(leagueName) {
    const normalized = normalizeCwlLeagueName(leagueName);
    if (!normalized) return true;
    return !FIFTEEN_ONLY_LEAGUE_PREFIXES.some(prefix => normalized.startsWith(prefix));
}

export function normalizeCwlCapacity(capacity, leagueName) {
    const requestedCapacity = Number(capacity) === 30 ? 30 : 15;
    return requestedCapacity === 30 && !allowsThirtyPlayerCwl(leagueName)
        ? 15
        : requestedCapacity;
}
