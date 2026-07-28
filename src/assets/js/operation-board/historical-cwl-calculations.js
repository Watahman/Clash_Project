import { normalizeTag, number } from './operation-board-utils.js';

export function calculateHistoricalSeason(data) {
    const wars = (data?.wars || []).filter(war => war.state === 'completed');
    const ownAttacks = attacksFrom(wars, 'clan');
    const defenseWars = wars.filter(war => war.detailsComplete);
    const enemyAttacks = attacksFrom(defenseWars, 'opponent');
    const reliabilityKnown = wars.length > 0
        && wars.every(war => war.detailsComplete);
    const availableAttacks = reliabilityKnown
        ? sum(wars, war =>
            number(war.teamSize, 0) * number(war.attacksPerMember, 1))
        : null;
    const attacksUsed = sum(wars, war => number(war.clan?.attacks, 0));
    const starDifferential = average(wars.map(war =>
        number(war.clan?.stars, 0) - number(war.opponent?.stars, 0)
    ));
    const destructionDifferential = average(wars.map(war =>
        number(war.clan?.destruction, 0)
        - number(war.opponent?.destruction, 0)
    ));
    return {
        season: data?.season || '',
        league: data?.league || { id: null, name: '' },
        position: finiteOrNull(data?.position),
        record: record(data, wars),
        offense: attackMetrics(ownAttacks, {
            starsPerWar: average(wars.map(war => number(war.clan?.stars, 0))),
            attacksUsed,
            availableAttacks
        }),
        defense: enemyAttacks.length
            ? attackMetrics(enemyAttacks, {
                starsPerWar: average(
                    defenseWars.map(war => number(war.opponent?.stars, 0))
                )
            })
            : null,
        starDifferential,
        destructionDifferential,
        missedAttacks: availableAttacks == null
            ? null
            : Math.max(0, availableAttacks - attacksUsed),
        attackUsage: availableAttacks
            ? attacksUsed / availableAttacks
            : null,
        closeWars: wars.filter(war =>
            Math.abs(
                number(war.clan?.stars, 0)
                - number(war.opponent?.stars, 0)
            ) <= 1
        ).length,
        roster: calculateHistoricalRoster(data, wars),
        wars,
        dataQuality: data?.dataQuality || 'Insufficient data',
        warDetailsComplete: reliabilityKnown
    };
}

export function calculateHistoricalRoster(data, completedWars = null) {
    const wars = completedWars || (data?.wars || [])
        .filter(war => war.state === 'completed');
    const players = new Map();
    const ensure = source => {
        const tag = normalizeTag(source?.tag);
        if (!tag) return null;
        if (!players.has(tag)) {
            players.set(tag, {
                tag,
                name: source?.name || tag,
                townHall: number(source?.townHall, 0),
                attacksUsed: 0,
                availableAttacks: 0,
                stars: 0,
                destructionTotal: 0,
                triples: 0,
                missed: 0,
                defenses: 0,
                defenseDestructionTotal: 0,
                roundsPlayed: 0,
                netStarsContributed: 0,
                reliabilityKnown: true,
                dayStats: {},
                status: 'ok'
            });
        }
        const player = players.get(tag);
        if (source?.name && player.name === player.tag) player.name = source.name;
        player.townHall = Math.max(player.townHall, number(source?.townHall, 0));
        return player;
    };
    (data?.roster || []).forEach(ensure);
    wars.forEach(war => {
        const defensesByPlayer = new Map();
        if (war.detailsComplete) {
            (war.opponent?.members || []).forEach(member => {
                (member.attacks || []).forEach(attack => {
                    const defender = normalizeTag(attack.defenderTag);
                    if (!defender) return;
                    const defenses = defensesByPlayer.get(defender) || [];
                    defenses.push(attack);
                    defensesByPlayer.set(defender, defenses);
                });
            });
        }
        const bestByDefender = new Map();
        const ordered = (war.clan?.members || []).flatMap(member =>
            (member.attacks || []).map(attack => ({ ...attack, member }))
        ).sort((a, b) =>
            number(a.order, Number.MAX_SAFE_INTEGER)
            - number(b.order, Number.MAX_SAFE_INTEGER)
        );
        const contribution = new Map();
        ordered.forEach(attack => {
            const defender = normalizeTag(attack.defenderTag);
            const previous = bestByDefender.get(defender) || 0;
            const earned = Math.max(0, number(attack.stars, 0) - previous);
            bestByDefender.set(defender, Math.max(previous, number(attack.stars, 0)));
            const tag = normalizeTag(attack.member?.tag || attack.attackerTag);
            contribution.set(tag, (contribution.get(tag) || 0) + earned);
        });
        (war.clan?.members || []).forEach(member => {
            const player = ensure(member);
            if (!player) return;
            const attacks = member.attacks || [];
            player.roundsPlayed += 1;
            player.attacksUsed += attacks.length;
            player.stars += sum(attacks, attack => number(attack.stars, 0));
            player.destructionTotal += sum(
                attacks,
                attack => number(attack.destruction, 0)
            );
            player.triples += attacks.filter(attack =>
                number(attack.stars, 0) === 3
            ).length;
            const defenses = defensesByPlayer.get(player.tag) || [];
            player.defenses += defenses.length;
            player.defenseDestructionTotal += sum(
                defenses,
                defense => number(defense.destruction, 0)
            );
            player.netStarsContributed += contribution.get(player.tag) || 0;
            if (war.detailsComplete) {
                const available = number(war.attacksPerMember, 1);
                player.availableAttacks += available;
                player.missed += Math.max(0, available - attacks.length);
            } else {
                player.reliabilityKnown = false;
            }
            player.dayStats[war.day] = playerDayStat(war, attacks, defenses);
        });
    });
    const ranked = Array.from(players.values()).map(player => ({
        ...player,
        destruction: player.attacksUsed
            ? player.destructionTotal / player.attacksUsed
            : 0,
        avgStars: player.attacksUsed ? player.stars / player.attacksUsed : 0,
        tripleRate: player.attacksUsed
            ? player.triples / player.attacksUsed
            : 0,
        avgDefense: player.defenses
            ? player.defenseDestructionTotal / player.defenses
            : null,
        missed: player.reliabilityKnown ? player.missed : null,
        availableAttacks: player.reliabilityKnown
            ? player.availableAttacks
            : null
    })).sort((a, b) =>
        b.avgStars - a.avgStars
        || b.destruction - a.destruction
        || a.name.localeCompare(b.name)
    );
    ranked.forEach((player, index) => {
        player.offensiveRank = player.attacksUsed ? index + 1 : null;
    });
    return ranked.sort((a, b) =>
        b.townHall - a.townHall || a.name.localeCompare(b.name)
    );
}

function attackMetrics(attacks, extra = {}) {
    const stars = sum(attacks, attack => number(attack.stars, 0));
    const destruction = sum(
        attacks,
        attack => number(attack.destruction, 0)
    );
    return {
        attacks: attacks.length,
        avgStars: attacks.length ? stars / attacks.length : null,
        avgDestruction: attacks.length ? destruction / attacks.length : null,
        tripleRate: attacks.length
            ? attacks.filter(attack => number(attack.stars, 0) === 3).length
                / attacks.length
            : null,
        lowStarRate: attacks.length
            ? attacks.filter(attack => number(attack.stars, 0) <= 1).length
                / attacks.length
            : null,
        ...extra
    };
}

function attacksFrom(wars, side) {
    return wars.flatMap(war =>
        (war[side]?.members || []).flatMap(member => member.attacks || [])
    );
}

function playerDayStat(war, attacks, defenses = []) {
    const available = war.detailsComplete
        ? number(war.attacksPerMember, 1)
        : null;
    return {
        day: war.day,
        opponent: war.opponent?.name || '-',
        state: war.state,
        warParticipant: true,
        attacksUsed: attacks.length,
        availableAttacks: available,
        stars: sum(attacks, attack => number(attack.stars, 0)),
        destruction: attacks.length
            ? sum(attacks, attack => number(attack.destruction, 0))
                / attacks.length
            : 0,
        avgDefense: defenses.length
            ? sum(defenses, defense => number(defense.destruction, 0))
                / defenses.length
            : null,
        missed: available == null ? null : Math.max(0, available - attacks.length),
        result: war.result
    };
}

function record(data, wars) {
    if (data?.record) return data.record;
    return {
        wins: wars.filter(war => war.result === 'win').length,
        losses: wars.filter(war => war.result === 'loss').length,
        draws: wars.filter(war => war.result === 'draw').length
    };
}

function sum(items, selector) {
    return items.reduce((total, item) => total + selector(item), 0);
}

function average(values) {
    return values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null;
}

function finiteOrNull(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
