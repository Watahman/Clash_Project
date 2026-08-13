import { leagueProfile } from './cwl-auto-plan-scoring.js';

export function calculateClanReadiness(clan, players) {
    const profile = leagueProfile(clan);
    const active = players.filter(entry => entry.role !== 'reserve');
    const selected = [...active]
        .sort((left, right) => right.score.fit - left.score.fit)
        .slice(0, clan.capacity);
    const known = selected.filter(entry => entry.score.hasHistory
        && Number.isFinite(entry.score.expectedStars));
    const reliabilityKnown = selected.filter(entry =>
        Number.isFinite(entry.player.performance?.reliability)
    );
    const reliability = average(reliabilityKnown.map(entry =>
        entry.player.performance.reliability
    ));
    const expectedPerRound = known.length
        ? sum(known.map(entry => entry.score.expectedStars))
            * (selected.length / known.length)
        : null;
    const coverage = selected.length ? known.length / selected.length : 0;

    if (selected.length < clan.capacity || coverage < 0.5 || expectedPerRound == null) {
        return lowConfidence(expectedPerRound, reliability);
    }
    const expectedAverage = expectedPerRound / clan.capacity;
    const lowExpected = selected.filter(entry =>
        entry.score.expectedStars < profile.readinessStars - 0.25
    ).length;
    const risk = expectedAverage < profile.readinessStars - 0.12
        || lowExpected / selected.length >= 0.4;
    return readinessResult({
        clan,
        expectedPerRound,
        reliability,
        lowExpected,
        selectedCount: selected.length,
        risk
    });
}

function lowConfidence(expectedPerRound, reliability) {
    return {
        status: 'low-confidence',
        label: 'Low confidence',
        explanation: 'There is not enough historical CWL data for a reliable roster estimate.',
        explanationKey: 'autoPlan.readinessLowConfidenceText',
        explanationParams: {},
        expectedPerRound: finiteRound(expectedPerRound, 1),
        reliability: finiteRound(reliability, 0)
    };
}

function readinessResult({
    clan, expectedPerRound, reliability, lowExpected, selectedCount, risk
}) {
    return {
        status: risk ? 'risk' : 'good',
        label: risk ? 'Risk' : 'Good',
        explanation: risk
            ? `${lowExpected} of ${selectedCount} selected players may struggle at this league level.`
            : 'The selected roster is a reasonable match for this league.',
        explanationKey: risk
            ? 'autoPlan.readinessLowPlayersText'
            : 'autoPlan.readinessGoodText',
        explanationParams: {
            count: lowExpected,
            core: selectedCount,
            league: clan.league || 'this league'
        },
        expectedPerRound: round(expectedPerRound, 1),
        reliability: finiteRound(reliability, 0)
    };
}

function average(values) {
    return values.length ? sum(values) / values.length : null;
}

function sum(values) {
    return values.reduce((total, value) => total + Number(value), 0);
}

function finiteRound(value, places) {
    return Number.isFinite(value) ? round(value, places) : null;
}

function round(value, places) {
    const factor = 10 ** places;
    return Math.round(value * factor) / factor;
}
