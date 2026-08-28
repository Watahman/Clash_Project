import { normalizeCwlLeagueName } from '../cwl-league-rules.js';
import {
    normalizeClanPriority,
    normalizePlayerPriority
} from '../cwl-plan-schema.js';

const PLAYER_PRIORITY_MODIFIERS = Object.freeze({ high: 1.5, normal: 0, low: -1.5, exclude: 0 });
const CLAN_PRIORITY_TIERS = Object.freeze({ primary: 3, auto: 2, secondary: 1, development: 0 });

const LEAGUE_PROFILES = Object.freeze({
    elite: Object.freeze({
        rank: 4, rotationPositions: 1, reserve15: 2, reserve30: 3,
        targetTownHall: 17, readinessStars: 2.55, rotationTolerance: 5,
        changeTolerance: 4, blockDays: 4
    }),
    master: Object.freeze({
        rank: 3, rotationPositions: 2, reserve15: 2, reserve30: 3,
        targetTownHall: 16, readinessStars: 2.35, rotationTolerance: 12,
        changeTolerance: 8, blockDays: 3
    }),
    crystal: Object.freeze({
        rank: 2, rotationPositions: 3, reserve15: 2, reserve30: 3,
        targetTownHall: 15, readinessStars: 2.15, rotationTolerance: 20,
        changeTolerance: 14, blockDays: 2
    }),
    lower: Object.freeze({
        rank: 1, rotationPositions: 4, reserve15: 2, reserve30: 3,
        targetTownHall: 14, readinessStars: 1.9, rotationTolerance: 28,
        changeTolerance: 20, blockDays: 2
    }),
    unknown: Object.freeze({
        rank: 0, rotationPositions: 1, reserve15: 2, reserve30: 3,
        targetTownHall: 15, readinessStars: 2.15, rotationTolerance: 12,
        changeTolerance: 8, blockDays: 3
    })
});

export function leagueBand(leagueName) {
    const league = normalizeCwlLeagueName(leagueName);
    if (/^(legend|titan|champion)/.test(league)) return 'elite';
    if (league.startsWith('master')) return 'master';
    if (league.startsWith('crystal')) return 'crystal';
    if (/^(gold|silver|bronze)/.test(league)) return 'lower';
    return 'unknown';
}

export function leagueProfile(clan) {
    const profile = LEAGUE_PROFILES[leagueBand(clan?.league)];
    const capacity = Number(clan?.capacity) === 30 ? 30 : 15;
    return {
        ...profile,
        reserveCap: capacity === 30 ? profile.reserve30 : profile.reserve15,
        rotationPositions: capacity === 30
            ? Math.min(6, profile.rotationPositions * 2)
            : profile.rotationPositions
    };
}

export function scorePlayerForClan(player, clan) {
    const profile = leagueProfile(clan);
    const history = player.performance || {};
    const townHall = clamp(Number(player.townHallLevel) || 1, 1, 20);
    const performance = finite(history.performance)
        ? history.performance
        : 68 + townHall * 2;
    const reliability = finite(history.reliability) ? history.reliability : 72;
    const form = finite(history.form?.delta) ? clamp(history.form.delta, -20, 20) : 0;
    const attacks = Math.max(0, Number(history.attackCount) || 0);
    const matchupImpact = attacks
        ? 100 * ((Number(history.sameThCount) || 0) + (Number(history.upHitCount) || 0) * 1.15) / attacks
        : 50;
    const townHallGap = Math.max(0, profile.targetTownHall - townHall);
    const scopeBonus = history.scope === 'CWL' ? 2.5 : 0;
    const confidencePenalty = history.status === 'ready'
        ? ({ High: 0, Medium: 2, Low: 5 }[history.confidence] ?? 5)
        : 8;
    const priorityModifier = PLAYER_PRIORITY_MODIFIERS[
        normalizePlayerPriority(player?.playerPriority)
    ];
    const fit = performance * 0.58
        + reliability * 0.16
        + form * 0.1
        + townHall * 1.55
        + matchupImpact * 0.07
        + scopeBonus
        - townHallGap * profile.rank * 2.1
        - confidencePenalty
        + priorityModifier;
    return {
        fit: round(fit, 3),
        reliability: round(reliability, 1),
        performance: round(performance, 1),
        expectedStars: finite(history.avgStars) ? round(history.avgStars, 2) : null,
        hasHistory: history.status === 'ready' && finite(history.performance),
        townHall,
        priorityModifier
    };
}

export function comparePlayerScores(left, right) {
    return right.score.fit - left.score.fit
        || right.score.reliability - left.score.reliability
        || right.score.performance - left.score.performance
        || right.score.townHall - left.score.townHall
        || String(left.player.tag).localeCompare(String(right.player.tag));
}

export function compareClanPriority(left, right) {
    const priorityDifference = clanPriorityTier(right) - clanPriorityTier(left);
    if (priorityDifference) return priorityDifference;
    const leftProfile = leagueProfile(left);
    const rightProfile = leagueProfile(right);
    return rightProfile.rank - leftProfile.rank
        || String(left.tag).localeCompare(String(right.tag));
}

export function clanPriorityTier(clan) {
    return CLAN_PRIORITY_TIERS[normalizeClanPriority(clan?.clanPriority)];
}

function finite(value) {
    return Number.isFinite(Number(value));
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}
