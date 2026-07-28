import { leagueProfile } from './cwl-auto-plan-scoring.js';

export function calculateClanReadiness(clan, players, schedule) {
    const profile = leagueProfile(clan);
    const core = players.filter(entry => entry.role === 'core');
    const active = players.filter(entry => entry.role !== 'reserve');
    const known = active.filter(entry => entry.score.hasHistory
        && Number.isFinite(entry.score.expectedStars));
    const reliabilityKnown = active.filter(entry =>
        Number.isFinite(entry.player.performance?.reliability)
    );
    const reliability = reliabilityKnown.length
        ? average(reliabilityKnown.map(entry => entry.player.performance.reliability))
        : null;
    const expectedPerRound = average(
        schedule.lineups.map(lineup => lineup.expectedStars).filter(Number.isFinite)
    );
    const coverage = active.length ? known.length / active.length : 0;

    if (coverage < 0.5 || expectedPerRound == null) {
        return {
            status: 'low-confidence',
            label: 'Low confidence',
            explanation: 'There is not enough historical CWL data for a reliable league estimate.',
            explanationKey: 'autoPlan.readinessLowConfidenceText',
            explanationParams: {},
            expectedPerRound: expectedPerRound == null ? null : round(expectedPerRound, 1),
            reliability: reliability == null ? null : round(reliability, 0)
        };
    }

    const expectedAverage = expectedPerRound / clan.capacity;
    const lowExpected = core.filter(entry =>
        entry.score.expectedStars != null
        && entry.score.expectedStars < profile.readinessStars - 0.25
    ).length;
    const risk = expectedAverage < profile.readinessStars - 0.12
        || (core.length && lowExpected / core.length >= 0.4);
    return {
        status: risk ? 'risk' : 'good',
        label: risk ? 'Risk' : 'Good',
        explanation: risk
            ? lowExpected
                ? `${lowExpected} of ${core.length} Core players have low expected performance at this league level.`
                : `Even the strongest available lineup appears weak for ${clan.league || 'this league'}.`
            : 'The planned lineup is a reasonable match for this league.',
        explanationKey: risk
            ? lowExpected
                ? 'autoPlan.readinessLowPlayersText'
                : 'autoPlan.readinessWeakLineupText'
            : 'autoPlan.readinessGoodText',
        explanationParams: {
            count: lowExpected,
            core: core.length,
            league: clan.league || 'this league'
        },
        expectedPerRound: round(expectedPerRound, 1),
        reliability: reliability == null ? null : round(reliability, 0)
    };
}

function average(values) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + Number(value), 0) / values.length;
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}
