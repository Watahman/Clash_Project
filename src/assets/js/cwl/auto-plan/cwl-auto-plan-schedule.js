import {
    comparePlayerScores,
    leagueProfile
} from './cwl-auto-plan-scoring.js';

const DEFAULT_ROUNDS = 7;

export function buildDailySchedule(clan, classified, rounds = DEFAULT_ROUNDS) {
    const profile = leagueProfile(clan);
    const appearances = new Map(classified.map(entry => [entry.player.tag, 0]));
    const lineups = [];
    const warnings = [];
    let previous = [];

    for (let day = 1; day <= rounds; day += 1) {
        const selected = selectCore(classified, day, clan.capacity);
        const remaining = clan.capacity - selected.length;
        if (remaining > 0) {
            const rotations = classified.filter(entry =>
                entry.role === 'rotation' && isAvailable(entry.player, day)
            );
            selected.push(...selectRotations({
                rotations,
                previous,
                selected,
                appearances,
                count: remaining,
                day,
                profile,
                opponent: Array.isArray(clan.opponents)
                    ? clan.opponents[day - 1]
                    : null
            }));
        }
        if (selected.length < clan.capacity) {
            const reserves = classified
                .filter(entry => entry.role === 'reserve' && isAvailable(entry.player, day))
                .filter(entry => !selected.some(item => item.player.tag === entry.player.tag))
                .sort(comparePlayerScores);
            selected.push(...reserves.slice(0, clan.capacity - selected.length));
            if (reserves.length) warnings.push({
                code: 'reserve_used',
                day,
                message: `Reserve coverage is required on day ${day}.`
            });
        }

        const lineup = selected.slice(0, clan.capacity).sort(comparePlayerScores);
        lineup.forEach(entry => {
            appearances.set(entry.player.tag, appearances.get(entry.player.tag) + 1);
        });
        if (lineup.length < clan.capacity) {
            warnings.push({
                code: 'incomplete_day',
                day,
                missing: clan.capacity - lineup.length,
                message: `Day ${day} is missing ${clan.capacity - lineup.length} player(s).`
            });
        }
        lineups.push({
            day,
            playerTags: lineup.map(entry => entry.player.tag),
            expectedStars: expectedStars(lineup),
            changes: previous.length ? enteringCount(previous, lineup) : 0
        });
        previous = lineup;
    }

    const plannedDays = Object.fromEntries(classified.map(entry => [
        entry.player.tag,
        lineups.filter(lineup => lineup.playerTags.includes(entry.player.tag))
            .map(lineup => lineup.day)
    ]));
    return {
        lineups,
        plannedDays,
        changes: lineups.reduce((total, lineup) => total + lineup.changes, 0),
        warnings: uniqueWarnings(warnings)
    };
}

export function evaluatePlannedSchedule(clan, classified, rounds = DEFAULT_ROUNDS) {
    const lineups = [];
    const warnings = [];
    let previous = [];
    for (let day = 1; day <= rounds; day += 1) {
        const planned = classified
            .filter(entry => entry.player.plannedDays?.includes(day))
            .sort(comparePlannedPlayers);
        const unavailable = planned.filter(entry => !isAvailable(entry.player, day));
        unavailable.forEach(entry => warnings.push({
            code: 'availability_conflict',
            day,
            playerTag: entry.player.tag,
            message: `${entry.player.name || entry.player.tag} is unavailable on day ${day}.`
        }));
        const lineup = planned.filter(entry => isAvailable(entry.player, day))
            .slice(0, clan.capacity);
        if (lineup.some(entry => entry.role === 'reserve')) {
            warnings.push({
                code: 'reserve_used',
                day,
                message: `Reserve coverage is required on day ${day}.`
            });
        }
        if (lineup.length < clan.capacity) {
            warnings.push({
                code: 'incomplete_day',
                day,
                missing: clan.capacity - lineup.length,
                message: `Day ${day} is missing ${clan.capacity - lineup.length} player(s).`
            });
        }
        lineups.push({
            day,
            playerTags: lineup.map(entry => entry.player.tag),
            expectedStars: expectedStars(lineup),
            changes: previous.length ? enteringCount(previous, lineup) : 0
        });
        previous = lineup;
    }
    return {
        lineups,
        plannedDays: Object.fromEntries(classified.map(entry => [
            entry.player.tag,
            [...(entry.player.plannedDays || [])]
        ])),
        changes: lineups.reduce((total, lineup) => total + lineup.changes, 0),
        warnings: uniqueWarnings(warnings)
    };
}

function selectCore(players, day, capacity) {
    return players
        .filter(entry => entry.role === 'core' && isAvailable(entry.player, day))
        .sort(comparePlayerScores)
        .slice(0, capacity);
}

function comparePlannedPlayers(left, right) {
    const roleOrder = { core: 0, rotation: 1, reserve: 2 };
    return (roleOrder[left.role] ?? 3) - (roleOrder[right.role] ?? 3)
        || comparePlayerScores(left, right);
}

function selectRotations({
    rotations, previous, selected, appearances, count, day, profile, opponent
}) {
    const selectedTags = new Set(selected.map(entry => entry.player.tag));
    const available = rotations.filter(entry => !selectedTags.has(entry.player.tag));
    const previousRotation = available
        .filter(entry => previous.some(item => item.player.tag === entry.player.tag))
        .sort(comparePlayerScores);
    if (isDifficultOpponent(opponent)) {
        return [...available].sort(comparePlayerScores).slice(0, count);
    }
    if (day === 1 || day % profile.blockDays !== 1) {
        return fill(previousRotation, available, count);
    }

    const fairOrder = [...available].sort((left, right) =>
        appearances.get(left.player.tag) - appearances.get(right.player.tag)
        || comparePlayerScores(left, right)
    );
    const stable = previousRotation.slice(0, count);
    const bench = fairOrder.filter(entry =>
        !stable.some(item => item.player.tag === entry.player.tag)
    );
    if (!stable.length || !bench.length) return fill(stable, fairOrder, count);

    const outgoing = [...stable].sort((left, right) =>
        appearances.get(right.player.tag) - appearances.get(left.player.tag)
        || comparePlayerScores(right, left)
    )[0];
    const incoming = bench[0];
    const meaningfulFairnessGain = appearances.get(outgoing.player.tag)
        - appearances.get(incoming.player.tag) >= profile.blockDays - 1;
    const acceptableLoss = outgoing.score.fit - incoming.score.fit <= profile.changeTolerance;
    if (meaningfulFairnessGain && acceptableLoss) {
        const index = stable.findIndex(entry => entry.player.tag === outgoing.player.tag);
        stable.splice(index, 1, incoming);
    }
    return fill(stable, fairOrder, count);
}

function isDifficultOpponent(opponent) {
    if (!opponent) return false;
    if (opponent.difficulty === 'hard' || opponent.difficulty === 'difficult') return true;
    return Number(opponent.difficulty) >= 0.65
        || Number(opponent.strength) >= 0.65;
}

function fill(preferred, all, count) {
    const result = [...preferred];
    const used = new Set(result.map(entry => entry.player.tag));
    for (const entry of all) {
        if (result.length >= count) break;
        if (!used.has(entry.player.tag)) {
            result.push(entry);
            used.add(entry.player.tag);
        }
    }
    return result.slice(0, count);
}

function isAvailable(player, day) {
    const days = player.availability?.availableDays;
    return !Array.isArray(days) || days.includes(day);
}

function expectedStars(lineup) {
    const known = lineup.map(entry => entry.score.expectedStars)
        .filter(Number.isFinite);
    if (known.length !== lineup.length || !known.length) return null;
    return Math.round(known.reduce((sum, value) => sum + value, 0) * 10) / 10;
}

function enteringCount(previous, current) {
    const previousTags = new Set(previous.map(entry => entry.player.tag));
    return current.filter(entry => !previousTags.has(entry.player.tag)).length;
}

function uniqueWarnings(warnings) {
    const seen = new Set();
    return warnings.filter(warning => {
        const key = `${warning.code}:${warning.day || ''}:${warning.playerTag || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
