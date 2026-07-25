export const BRACKET_SCHEMA_VERSION = 1;
export const BRACKET_MAX_PARTICIPANTS = 128;

function nextPowerOfTwo(value) {
    let power = 1;
    while (power < value) power *= 2;
    return power;
}

function shuffled(values, random = Math.random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

export function createBracket(participants, { shuffle = false, random = Math.random, name = 'Bracket' } = {}) {
    const unique = [...new Set(
        (Array.isArray(participants) ? participants : [])
            .map(participant => String(participant || '').trim())
            .filter(Boolean)
    )];
    if (unique.length < 2) throw new Error('Voeg minstens twee deelnemers toe.');
    if (unique.length > BRACKET_MAX_PARTICIPANTS) {
        throw new Error(`Een bracket kan maximaal ${BRACKET_MAX_PARTICIPANTS} deelnemers bevatten.`);
    }
    const seeded = shuffle ? shuffled(unique, random) : unique;
    const size = nextPowerOfTwo(seeded.length);
    const byeCount = size - seeded.length;
    const slots = [];
    seeded.forEach((participant, index) => {
        slots.push(participant);
        if (index < byeCount) slots.push(null);
    });
    const rounds = [];
    let matches = size / 2;
    for (let round = 0; matches >= 1; round += 1, matches /= 2) {
        rounds.push(Array.from({ length: matches }, (_, index) => ({
            id: `r${round + 1}m${index + 1}`,
            round: round + 1,
            index,
            players: round === 0 ? [slots[index * 2], slots[index * 2 + 1]] : [null, null],
            winner: null
        })));
    }
    const bracket = {
        schemaVersion: BRACKET_SCHEMA_VERSION,
        id: crypto.randomUUID(),
        name: String(name || 'Bracket').trim() || 'Bracket',
        participants: unique,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rounds
    };
    propagateAutomaticWinners(bracket);
    return bracket;
}

export function setMatchWinner(bracket, matchId, winner) {
    const match = bracket.rounds.flat().find(item => item.id === matchId);
    if (!match) throw new Error('Match niet gevonden.');
    if (!match.players.includes(winner)) throw new Error('Winnaar speelt niet in deze match.');
    if (match.winner && match.winner !== winner) clearDownstream(bracket, match);
    match.winner = winner;
    placeWinnerInNextRound(bracket, match);
    propagateAutomaticWinners(bracket);
    bracket.updatedAt = new Date().toISOString();
    return bracket;
}

function clearDownstream(bracket, match) {
    const nextRound = bracket.rounds[match.round];
    if (!nextRound) return;
    const nextMatch = nextRound[Math.floor(match.index / 2)];
    if (!nextMatch) return;
    const slot = match.index % 2;
    const oldWinner = match.winner;
    if (nextMatch.players[slot] === oldWinner) {
        const downstreamWinner = nextMatch.winner;
        nextMatch.players[slot] = null;
        nextMatch.winner = null;
        if (downstreamWinner) clearDownstream(bracket, nextMatch);
    }
}

function placeWinnerInNextRound(bracket, match) {
    const nextRound = bracket.rounds[match.round];
    if (!nextRound) return;
    const nextMatch = nextRound[Math.floor(match.index / 2)];
    nextMatch.players[match.index % 2] = match.winner;
}

function propagateAutomaticWinners(bracket) {
    const openingRound = bracket.rounds[0] || [];
    openingRound.forEach(match => {
        const realPlayers = match.players.filter(Boolean);
        if (realPlayers.length === 1 && !match.winner) {
            match.winner = realPlayers[0];
            placeWinnerInNextRound(bracket, match);
        }
    });
}

export function importBracket(value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || parsed.schemaVersion !== BRACKET_SCHEMA_VERSION || !Array.isArray(parsed.rounds)) {
        throw new Error('Invalid or unsupported bracket file.');
    }
    if (!Array.isArray(parsed.participants)
            || parsed.participants.length < 2
            || parsed.participants.length > BRACKET_MAX_PARTICIPANTS) {
        throw new Error('Invalid number of participants.');
    }
    parsed.rounds.forEach(round => {
        if (!Array.isArray(round)) throw new Error('Invalid bracket structure.');
        round.forEach(match => {
            if (!match?.id || !Array.isArray(match.players) || match.players.length !== 2) {
                throw new Error('Invalid match structure.');
            }
        });
    });
    return structuredClone(parsed);
}

export function bracketChampion(bracket) {
    return bracket?.rounds?.at(-1)?.[0]?.winner || null;
}
