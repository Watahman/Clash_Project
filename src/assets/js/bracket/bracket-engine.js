export const BRACKET_SCHEMA_VERSION = 1;
export const BRACKET_MIN_PARTICIPANTS = 4;
export const BRACKET_MAX_PARTICIPANTS = 128;

function bracketError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

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

function normalizedParticipants(participants) {
    return (Array.isArray(participants) ? participants : [])
        .map(participant => String(participant ?? '').trim())
        .filter(Boolean);
}

function validateParticipants(participants) {
    const values = normalizedParticipants(participants);
    const seen = new Set();
    const duplicates = new Set();
    values.forEach(value => {
        const key = value.toLocaleLowerCase();
        if (seen.has(key)) duplicates.add(value);
        seen.add(key);
    });
    if (duplicates.size) {
        throw bracketError('Each participant must have a unique name.', 'duplicate-participants');
    }
    if (values.length < BRACKET_MIN_PARTICIPANTS) {
        throw bracketError(
            `A bracket needs at least ${BRACKET_MIN_PARTICIPANTS} unique participants.`,
            'too-few-participants'
        );
    }
    if (values.length > BRACKET_MAX_PARTICIPANTS) {
        throw bracketError(
            `A bracket can contain at most ${BRACKET_MAX_PARTICIPANTS} participants.`,
            'too-many-participants'
        );
    }
    return values;
}

function createBracketId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `bracket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBracket(participants, { shuffle = false, random = Math.random, name = 'Bracket' } = {}) {
    const unique = validateParticipants(participants);
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
        id: createBracketId(),
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
    if (!match) throw bracketError('That match could not be found.', 'match-not-found');
    if (!winner || !match.players.includes(winner)) {
        throw bracketError('Choose a participant from this match.', 'invalid-winner');
    }
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

function validateImportedRound(round, roundIndex, participantSet, expectedMatches) {
    if (!Array.isArray(round) || round.length !== expectedMatches) {
        throw bracketError('The bracket rounds are incomplete or out of order.', 'invalid-rounds');
    }
    round.forEach((match, matchIndex) => {
        const expectedId = `r${roundIndex + 1}m${matchIndex + 1}`;
        if (!match || match.id !== expectedId || !Array.isArray(match.players) || match.players.length !== 2) {
            throw bracketError('One match in the bracket file is not valid.', 'invalid-match');
        }
        match.players.forEach(player => {
            if (player !== null && (!participantSet.has(player) || typeof player !== 'string')) {
                throw bracketError('A match contains an unknown participant.', 'unknown-participant');
            }
        });
        if (match.winner !== null && (!participantSet.has(match.winner) || !match.players.includes(match.winner))) {
            throw bracketError('A match winner is not one of its participants.', 'invalid-winner');
        }
    });
}

function validateImportedBracket(parsed) {
    if (!parsed || typeof parsed !== 'object'
            || parsed.schemaVersion !== BRACKET_SCHEMA_VERSION
            || !Array.isArray(parsed.rounds)) {
        throw bracketError('This bracket file is invalid or unsupported.', 'invalid-file');
    }
    const participants = normalizedParticipants(parsed.participants);
    if (participants.length !== parsed.participants?.length) {
        throw bracketError('This bracket file contains an invalid participant list.', 'invalid-participants');
    }
    const validatedParticipants = validateParticipants(participants);
    const participantSet = new Set(validatedParticipants);
    const size = nextPowerOfTwo(validatedParticipants.length);
    const expectedRounds = Math.log2(size);
    if (parsed.rounds.length !== expectedRounds) {
        throw bracketError('The bracket rounds are incomplete or out of order.', 'invalid-rounds');
    }
    parsed.rounds.forEach((round, roundIndex) => {
        validateImportedRound(round, roundIndex, participantSet, size / (2 ** (roundIndex + 1)));
    });
}

export function importBracket(value) {
    let parsed;
    try {
        parsed = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        throw bracketError('This bracket file is not valid JSON.', 'invalid-json');
    }
    validateImportedBracket(parsed);
    return typeof structuredClone === 'function'
        ? structuredClone(parsed)
        : JSON.parse(JSON.stringify(parsed));
}

export function bracketChampion(bracket) {
    return bracket?.rounds?.at(-1)?.[0]?.winner || null;
}
