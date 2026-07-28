import { leagueProfile } from '../auto-plan/cwl-auto-plan-scoring.js';

export function calculateChangeCost(actions, clanById) {
    const changedPlayers = new Set(actions.map(action => action.playerTag)).size;
    const base = actions.reduce((total, action) => {
        const clan = clanById.get(action.toClanId || action.clanId);
        const rank = leagueProfile(clan).rank;
        if (action.type === 'move') return total + 9 + rank * 2.5;
        if (action.type === 'free') return total + 5 + rank;
        if (action.type === 'role') {
            return total + (action.fromRole === 'core' ? 5 : 2) + rank;
        }
        if (action.type === 'days') {
            const changedDays = symmetricDifference(action.fromDays, action.days);
            return total + changedDays * (0.35 + rank * 0.12);
        }
        return total;
    }, 0);
    return round(base + Math.max(0, changedPlayers - 2) * 2, 2);
}

function symmetricDifference(left = [], right = []) {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    return [...leftSet].filter(value => !rightSet.has(value)).length
        + [...rightSet].filter(value => !leftSet.has(value)).length;
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}
