import { compareMatchupStrength } from './cwl-matchup-difficulty.js';
import { normalizeWarState } from './cwl-war-state.js';

const DEFAULT_STARS = 2;
const DEFAULT_DESTRUCTION = 70;

export function buildLeagueRoundPredictions(report, roster, insightByTag) {
    const wars = report.leagueWars?.length ? report.leagueWars : report.wars || [];
    const currentByTag = buildCurrentCwlPerformance(wars);
    const rosterByTag = new Map(
        (roster || []).map(player => [normalizeTag(player.tag), player])
    );
    const leaguePredictions = wars
        .filter(war => normalizeWarState(war) !== 'completed')
        .map(war => predictWar(war, rosterByTag, currentByTag, insightByTag))
        .filter(Boolean);
    const selectedTag = normalizeTag(report.clan?.tag);
    const roundPredictions = new Map();
    leaguePredictions.forEach(war => {
        const side = normalizeTag(war.clan.tag) === selectedTag
            ? war.clan
            : normalizeTag(war.opponent.tag) === selectedTag
                ? war.opponent
                : null;
        if (side) roundPredictions.set(war.day, side);
    });
    return { roundPredictions, leaguePredictions };
}

function predictWar(war, rosterByTag, currentByTag, insightByTag) {
    if (!war?.clan?.members?.length || !war?.opponent?.members?.length) return null;
    return {
        id: normalizeTag(war._warTag) || `${war._round}:${war.clan.tag}:${war.opponent.tag}`,
        day: Math.max(1, number(war._round, 1)),
        state: normalizeWarState(war),
        clan: predictClanSide(
            war.clan,
            war.opponent,
            rosterByTag,
            currentByTag,
            insightByTag
        ),
        opponent: predictClanSide(
            war.opponent,
            war.clan,
            rosterByTag,
            currentByTag,
            insightByTag
        )
    };
}

function predictClanSide(self, opponent, rosterByTag, currentByTag, insightByTag) {
    const opponents = opponent.members || [];
    const matchups = (self.members || []).map(member => {
        const tag = normalizeTag(member.tag);
        const target = findOpponent(member, opponents);
        const insight = insightByTag.get(tag) || {};
        return {
            attacked: Boolean(member.attacks?.length),
            ...predictMatchup(
                rosterByTag.get(tag) || currentByTag.get(tag) || {},
                member,
                target,
                insight,
                insightByTag.get(normalizeTag(target.tag)) || {}
            ),
            historicalAttacks: number(insight.historical?.attackCount, 0),
            covered: insight.historical?.status === 'ready'
        };
    });
    const remaining = matchups.filter(matchup => !matchup.attacked);
    const attacksUsed = number(
        self.attacks,
        matchups.filter(matchup => matchup.attacked).length
    );
    const expectedAttacks = remaining.reduce(
        (sum, matchup) => sum + matchup.attackProbability,
        0
    );
    const predictedStars = remaining.reduce(
        (sum, matchup) => sum + matchup.stars * matchup.attackProbability,
        0
    );
    const predictedDestruction = remaining.reduce(
        (sum, matchup) => sum + matchup.destruction * matchup.attackProbability,
        0
    );
    const totalWeight = attacksUsed + expectedAttacks;
    const destruction = totalWeight
        ? (
            number(self.destructionPercentage, 0) * attacksUsed
            + predictedDestruction
        ) / totalWeight
        : 0;
    const coverage = matchups.length
        ? matchups.filter(matchup => matchup.covered).length / matchups.length
        : 0;
    const historicalAttacks = matchups.reduce(
        (sum, matchup) => sum + matchup.historicalAttacks,
        0
    );
    return {
        tag: normalizeTag(self.tag),
        name: self.name || normalizeTag(self.tag),
        stars: clamp(
            number(self.stars, 0) + predictedStars,
            0,
            matchups.length * 3
        ),
        destruction: clamp(destruction, 0, 100),
        attacksUsed: attacksUsed + expectedAttacks,
        availableAttacks: matchups.length,
        sampleSize: matchups.length,
        historicalAttacks,
        coverage,
        confidence: confidenceFor(coverage, historicalAttacks)
    };
}

function predictMatchup(player, member, opponent, insight, opponentInsight) {
    const baseline = playerBaseline(player, insight);
    const comparison = compareMatchupStrength(
        strengthOf(member, insight, true),
        strengthOf(opponent, opponentInsight)
    );
    return {
        stars: clamp(baseline.stars + comparison.starAdjustment, 0, 3),
        destruction: clamp(
            baseline.destruction + comparison.destructionAdjustment,
            0,
            100
        ),
        attackProbability: clamp(baseline.attackRate * 0.82 + 0.16, 0.5, 0.99)
    };
}

function playerBaseline(player, insight) {
    const historical = insight.historical;
    const historicalReady = historical?.status === 'ready';
    const currentAttacks = number(player.attacksUsed ?? player.attacks, 0);
    const currentStars = currentAttacks
        ? number(player.stars, 0) / currentAttacks
        : null;
    const currentDestruction = currentAttacks
        ? number(
            player.destruction
            ?? number(player.destructionTotal, 0) / currentAttacks,
            DEFAULT_DESTRUCTION
        )
        : null;
    const currentWeight = historicalReady
        ? Math.min(0.25, currentAttacks * 0.04)
        : currentAttacks ? 1 : 0;
    const historicalStars = historicalReady
        ? number(historical.avgStars, DEFAULT_STARS)
        : number(insight.offense?.stars, DEFAULT_STARS);
    const historicalDestruction = historicalReady
        ? number(historical.avgDestruction, DEFAULT_DESTRUCTION)
        : number(insight.offense?.destruction, DEFAULT_DESTRUCTION);
    const performanceAdjustment = historicalReady
        ? clamp((number(historical.performance, 100) - 100) * 0.003, -0.12, 0.12)
        : 0;
    const historicalRate = historical?.reliability == null
        ? 0.94
        : clamp(number(historical.reliability, 94) / 100, 0.5, 1);
    const currentRate = player.availableAttacks
        ? clamp(currentAttacks / number(player.availableAttacks, 1), 0, 1)
        : historicalRate;
    return {
        stars: blend(
            historicalStars + performanceAdjustment,
            currentStars,
            currentWeight
        ),
        destruction: blend(
            historicalDestruction,
            currentDestruction,
            currentWeight
        ),
        attackRate: blend(historicalRate, currentRate, currentWeight)
    };
}

function buildCurrentCwlPerformance(wars) {
    const players = new Map();
    wars.forEach(war => {
        [war.clan, war.opponent].forEach(clan => {
            (clan?.members || []).forEach(member => {
                const tag = normalizeTag(member.tag);
                if (!tag) return;
                const current = players.get(tag) || {
                    tag,
                    attacks: 0,
                    stars: 0,
                    destructionTotal: 0
                };
                (member.attacks || []).forEach(attack => {
                    current.attacks += 1;
                    current.stars += number(attack.stars, 0);
                    current.destructionTotal += number(
                        attack.destructionPercentage,
                        0
                    );
                });
                players.set(tag, current);
            });
        });
    });
    return players;
}

function strengthOf(member = {}, insight = {}, includeProgress = false) {
    return {
        townHall: number(
            member.townhallLevel || member.townHallLevel || insight.townHall,
            0
        ),
        progression: includeProgress ? number(insight.progression, 0.5) : 0.5
    };
}

function findOpponent(member, opponents) {
    const position = number(member.mapPosition, 0);
    return opponents.find(item => number(item.mapPosition, 0) === position)
        || opponents[Math.max(0, position - 1)]
        || opponents[0]
        || {};
}

function confidenceFor(coverage, attacks) {
    if (coverage >= 0.75 && attacks >= 50) return 'High';
    if (coverage >= 0.5 && attacks >= 20) return 'Medium';
    return 'Low';
}

function blend(baseline, current, currentWeight) {
    return current == null
        ? baseline
        : baseline * (1 - currentWeight) + current * currentWeight;
}

function normalizeTag(value = '') {
    const clean = String(value || '').trim().toUpperCase();
    if (!clean || clean === '#0') return '';
    return clean.startsWith('#') ? clean : `#${clean}`;
}

function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}
