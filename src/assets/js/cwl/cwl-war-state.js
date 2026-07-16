export function parseClashTime(value) {
    if (!value) return null;
    const text = String(value).replace(/(\d{8})T(\d{6})\.000Z/, '$1T$2Z');
    const compact = text.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    const date = compact
        ? new Date(Date.UTC(
            Number(compact[1]),
            Number(compact[2]) - 1,
            Number(compact[3]),
            Number(compact[4]),
            Number(compact[5]),
            Number(compact[6])
        ))
        : new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeWarState(war, currentTime = Date.now()) {
    const state = String(war?.state || '').trim().toLowerCase().replaceAll('_', '');
    if (['warended', 'ended', 'completed'].includes(state)) return 'completed';
    if (['inwar', 'live'].includes(state)) return 'live';
    if (['preparation', 'matchmaking'].includes(state)) return 'preparation';
    if (['notstarted', 'upcoming'].includes(state)) return 'notStarted';
    if (['notinwar', 'private', 'unavailable'].includes(state)) return 'notAvailable';

    const start = parseClashTime(war?.startTime)?.getTime();
    const end = parseClashTime(war?.endTime)?.getTime();
    if (end && currentTime >= end) return 'completed';
    if (start && currentTime < start) return 'preparation';
    if (start && end && currentTime >= start && currentTime < end) return 'live';
    return 'unknown';
}

export function isAttackCountingState(state) {
    return state === 'live' || state === 'completed';
}

export function isMissedCountingState(state) {
    return state === 'completed';
}

export function isResultFinalState(state) {
    return state === 'completed';
}

export function decideWarResult(stars, destruction, opponentStars, opponentDestruction, state) {
    if (!isResultFinalState(state)) {
        if (state === 'live') return 'pending';
        if (state === 'preparation' || state === 'notStarted') return 'notStarted';
        return 'notAvailable';
    }
    if (stars > opponentStars) return 'win';
    if (stars < opponentStars) return 'loss';
    if (destruction > opponentDestruction) return 'win';
    if (destruction < opponentDestruction) return 'loss';
    return 'draw';
}
