import { attackQuality } from '../cwl/cwl-matchup-difficulty.js';
import { normalizeWarState } from '../cwl/cwl-war-state.js';
import { calculateCwlContributions } from './operation-board-bonus-contribution.js';
import {
    BONUS_COMPONENTS,
    bonusWeightTotal,
    resolveBonusWeights,
    validBonusWeights
} from './operation-board-bonus-strategies.js';
import {
    clamp,
    getWarSide,
    normalizeTag,
    number
} from './operation-board-utils.js';

export function buildBonusCalculator(
    report = {},
    { strategy = 'fair', customWeights = {}, recipientCount = null } = {}
) {
    const contributions = calculateCwlContributions(report);
    const concluded = calculateConcludedReliability(report);
    const defenses = calculateCurrentCwlDefense(report);
    const weights = resolveBonusWeights(strategy, customWeights);
    const weightsValid = strategy !== 'custom' || validBonusWeights(weights);
    const recipientConfig = resolveRecipientCount(report, recipientCount);
    const players = (report.roster || [])
        .filter(isRelevantPlayer)
        .map(player => scorePlayer(
            player,
            report,
            contributions.get(normalizeTag(player.tag)),
            concluded.get(normalizeTag(player.tag)),
            defenses.get(normalizeTag(player.tag)),
            weights,
            weightsValid
        ))
        .sort(comparePlayers)
        .map((player, index) => ({
            ...player,
            rank: index + 1,
            recommended: weightsValid
                && recipientConfig.count != null
                && index < recipientConfig.count
        }));
    return {
        strategy,
        weights,
        weightTotal: bonusWeightTotal(weights),
        weightsValid,
        recipients: recipientConfig,
        provisional: isProvisional(report),
        players
    };
}

function scorePlayer(player, report, contribution, reliability, defense, weights, valid) {
    const attacks = number(contribution?.attacks, number(player.attacksUsed, 0));
    const performance = performanceScore(player, contribution);
    const contributionScore = currentContributionScore(
        player,
        contribution
    );
    const reliabilityScore = reliability?.available
        ? 100 * reliability.used / reliability.available
        : 50;
    const defenseScore = defense?.score ?? 50;
    const subscores = {
        performance,
        contribution: contributionScore,
        reliability: clamp(reliabilityScore, 0, 100),
        defense: clamp(defenseScore, 0, 100)
    };
    const score = valid
        ? BONUS_COMPONENTS.reduce(
            (total, component) =>
                total + subscores[component] * weights[component] / 100,
            0
        )
        : null;
    const historical = report.historicalPerformance?.[normalizeTag(player.tag)];
    return {
        tag: normalizeTag(player.tag),
        name: player.name || normalizeTag(player.tag),
        townHall: number(player.townHall, 0),
        attacks,
        stars: number(contribution?.stars, number(player.stars, 0)),
        destruction: attacks
            ? number(
                contribution?.destruction,
                number(player.destruction, 0) * attacks
            ) / attacks
            : 0,
        adjustedStars: number(
            contribution?.difficultyAdjustedStars,
            player.difficultyAdjustedStars
        ),
        avgDifficulty: attacks
            ? number(
                contribution?.difficultyTotal,
                number(player.attackDifficulty?.multiplier, 1) * attacks
            ) / attacks
            : 1,
        netStars: number(contribution?.netStars, 0),
        destructionImprovement: number(
            contribution?.destructionImprovement,
            0
        ),
        contributionTracked: Boolean(contribution),
        contributionOrdered: Boolean(contribution?.hasOrderedAttacks),
        reliability: reliability || { used: 0, available: 0, missed: 0 },
        defense: defense || { count: 0, stars: null, destruction: null, score: 50 },
        subscores,
        score,
        historical: historical?.status === 'ready' ? historical : null
    };
}

function performanceScore(player, contribution) {
    if (contribution?.attacks) {
        return clamp(
            contribution.performanceQuality / contribution.attacks,
            0,
            100
        );
    }
    const attacks = number(player.attacksUsed, 0);
    if (!attacks) return 0;
    const stars = number(player.stars, 0) / attacks;
    const difficulty = number(player.attackDifficulty?.multiplier, 1);
    return clamp(
        attackQuality(stars, number(player.destruction, 0)) * difficulty,
        0,
        100
    );
}

function currentContributionScore(player, contribution) {
    if (contribution?.attacks) {
        return clamp(
            contribution.contributionQuality / contribution.attacks,
            0,
            100
        );
    }
    return number(player.attacksUsed, 0) ? 50 : 0;
}

function calculateConcludedReliability(report) {
    const players = new Map();
    (report.wars || []).forEach(war => {
        if (normalizeWarState(war) !== 'completed') return;
        const side = getWarSide(war, report.clan?.tag);
        if (!side) return;
        const attacksPerMember = Math.max(1, number(war.attacksPerMember, 1));
        (side.self?.members || []).forEach(member => {
            const stats = ensure(players, member.tag);
            stats.available += attacksPerMember;
            stats.used += Math.min(attacksPerMember, (member.attacks || []).length);
            stats.missed = stats.available - stats.used;
        });
    });
    if (players.size) return players;
    (report.roster || []).forEach(player => {
        const completed = Object.values(player.dayStats || {}).filter(
            stat => stat.state === 'completed'
        );
        if (!completed.length) return;
        players.set(normalizeTag(player.tag), completed.reduce(
            (total, stat) => ({
                used: total.used + number(stat.attacksUsed, 0),
                available: total.available + number(stat.availableAttacks, 0),
                missed: total.missed + number(stat.missed, 0)
            }),
            { used: 0, available: 0, missed: 0 }
        ));
    });
    return players;
}

function calculateCurrentCwlDefense(report) {
    const players = new Map();
    (report.wars || []).forEach(war => {
        const side = getWarSide(war, report.clan?.tag);
        if (!side) return;
        const ownTags = new Set(
            (side.self?.members || []).map(member => normalizeTag(member.tag))
        );
        (side.opponent?.members || []).forEach(member => {
            (member.attacks || []).forEach(attack => {
                const tag = normalizeTag(attack.defenderTag);
                if (!ownTags.has(tag)) return;
                const stats = ensureDefense(players, tag);
                stats.count += 1;
                stats.totalStars += number(attack.stars, 0);
                stats.totalDestruction += number(
                    attack.destructionPercentage,
                    0
                );
            });
        });
    });
    players.forEach(stats => {
        stats.stars = stats.totalStars / stats.count;
        stats.destruction = stats.totalDestruction / stats.count;
        const observed = 75 * (1 - stats.stars / 3)
            + 25 * (1 - stats.destruction / 100);
        const sampleWeight = Math.min(1, stats.count / 3);
        stats.score = 50 + (observed - 50) * sampleWeight;
    });
    return players;
}

function resolveRecipientCount(report, requested) {
    const configured = [
        report.bonusRecipients,
        report.bonusConfig?.recipients,
        report.config?.bonusRecipients,
        report.leagueGroup?.bonusRecipients
    ].map(value => Number(value)).find(value =>
        Number.isInteger(value) && value >= 0
    );
    if (configured != null) {
        return { count: configured, source: 'config', editable: false };
    }
    const manual = requested == null || requested === ''
        ? Number.NaN
        : Number(requested);
    return {
        count: Number.isInteger(manual) && manual >= 0 ? manual : null,
        source: 'manual',
        editable: true
    };
}

function isRelevantPlayer(player) {
    return Boolean(
        player.warParticipant
        || number(player.attacksUsed, 0)
        || number(player.availableAttacks, 0)
    );
}

function isProvisional(report) {
    if (report.phase !== 'completed') return true;
    return (report.rounds || []).some(round => round.state !== 'completed');
}

function comparePlayers(a, b) {
    return number(b.score, -1) - number(a.score, -1)
        || b.subscores.performance - a.subscores.performance
        || b.subscores.contribution - a.subscores.contribution
        || number(b.historical?.performance, 0)
            - number(a.historical?.performance, 0)
        || a.name.localeCompare(b.name);
}

function ensure(players, tag) {
    const normalized = normalizeTag(tag);
    if (!players.has(normalized)) {
        players.set(normalized, { used: 0, available: 0, missed: 0 });
    }
    return players.get(normalized);
}

function ensureDefense(players, tag) {
    if (!players.has(tag)) {
        players.set(tag, {
            count: 0,
            totalStars: 0,
            totalDestruction: 0,
            stars: null,
            destruction: null,
            score: 50
        });
    }
    return players.get(tag);
}
