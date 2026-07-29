import {
    buildLeagueRoundPredictions
} from './cwl-round-prediction.js';
import { compareMatchupStrength } from './cwl-matchup-difficulty.js';

function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
}

function normalizeTag(tag = '') {
    const clean = String(tag || '').trim().toUpperCase();
    if (!clean || clean === '#0') return '';
    return clean.startsWith('#') ? clean : `#${clean}`;
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

function getWarSide(war, clanTag) {
    const selected = normalizeTag(clanTag);
    if (normalizeTag(war?.clan?.tag) === selected) return { self: war.clan, opponent: war.opponent };
    if (normalizeTag(war?.opponent?.tag) === selected) return { self: war.opponent, opponent: war.clan };
    return null;
}

function buildWarPerformance(report, insightByTag) {
    const performance = new Map();
    const ensure = tag => {
        const normalized = normalizeTag(tag);
        if (!performance.has(normalized)) {
            performance.set(normalized, {
                adjustedStars: 0,
                attacks: 0,
                difficultyTotal: 0,
                defenses: 0,
                concededStars: 0,
                concededDestruction: 0
            });
        }
        return performance.get(normalized);
    };

    (report.wars || []).forEach(war => {
        const side = getWarSide(war, report.clan?.tag);
        if (!side) return;
        const ownMembers = Array.isArray(side.self?.members) ? side.self.members : [];
        const opponents = Array.isArray(side.opponent?.members) ? side.opponent.members : [];
        const opponentByTag = new Map(opponents.map(member => [normalizeTag(member.tag), member]));
        const ownByTag = new Map(ownMembers.map(member => [normalizeTag(member.tag), member]));

        ownMembers.forEach(member => {
            const player = ensure(member.tag);
            (member.attacks || []).forEach(attack => {
                const defender = opponentByTag.get(normalizeTag(attack.defenderTag)) || {};
                const comparison = compareMatchupStrength(
                    strengthOf(member, insightByTag.get(normalizeTag(member.tag)), true),
                    strengthOf(defender, insightByTag.get(normalizeTag(defender.tag)))
                );
                player.attacks += 1;
                player.adjustedStars += number(attack.stars, 0) * comparison.difficultyMultiplier;
                player.difficultyTotal += comparison.difficultyMultiplier;
            });
        });

        opponents.forEach(member => {
            (member.attacks || []).forEach(attack => {
                const defenderTag = normalizeTag(attack.defenderTag);
                if (!ownByTag.has(defenderTag)) return;
                const player = ensure(defenderTag);
                player.defenses += 1;
                player.concededStars += number(attack.stars, 0);
                player.concededDestruction += number(attack.destructionPercentage, 0);
            });
        });
    });
    return performance;
}

function applyPerformanceToRoster(roster, insightByTag, performance) {
    return roster.map(player => {
        const tag = normalizeTag(player.tag);
        const insight = insightByTag.get(tag) || {};
        const result = performance.get(tag) || {};
        const attacks = number(result.attacks, 0);
        const defenses = number(result.defenses, 0);
        const defenseStars = defenses ? number(result.concededStars, 0) / defenses : insight?.defense?.stars;
        const defenseDestruction = defenses ? number(result.concededDestruction, 0) / defenses : insight?.defense?.destruction;
        const defenseRating = defenseStars == null || defenseDestruction == null
            ? 0
            : clamp((3 - defenseStars) / 3, 0, 1) * 0.62 + clamp((100 - defenseDestruction) / 100, 0, 1) * 0.38;
        return {
            ...player,
            insight,
            difficultyAdjustedStars: attacks ? number(result.adjustedStars, 0) : number(player.stars, 0),
            attackDifficulty: {
                count: attacks,
                multiplier: attacks ? number(result.difficultyTotal, attacks) / attacks : null
            },
            defense: {
                count: defenses || number(insight?.defense?.count, 0),
                stars: defenseStars,
                destruction: defenseDestruction,
                rating: defenseRating
            }
        };
    });
}

function applyCwlPredictions(report, insightByTag = new Map()) {
    const performance = buildWarPerformance(report, insightByTag);
    const roster = applyPerformanceToRoster(report.roster || [], insightByTag, performance);
    const {
        roundPredictions,
        leaguePredictions
    } = buildLeagueRoundPredictions(report, roster, insightByTag);
    const rounds = (report.rounds || []).map(round => ({
        ...round,
        prediction: roundPredictions.get(number(round.day, 0)) || null
    }));
    return {
        ...report,
        roster,
        rounds,
        leaguePredictions,
        predictionState: 'ready'
    };
}

function collectPredictionPlayerTags(report) {
    const tags = new Set();
    const wars = report.leagueWars?.length ? report.leagueWars : report.wars || [];
    wars.forEach(war => {
        [war.clan, war.opponent].forEach(clan => {
            (clan?.members || []).forEach(member => {
                const tag = normalizeTag(member?.tag);
                if (tag) tags.add(tag);
            });
        });
    });
    return Array.from(tags);
}

export {
    applyCwlPredictions,
    collectPredictionPlayerTags
};
