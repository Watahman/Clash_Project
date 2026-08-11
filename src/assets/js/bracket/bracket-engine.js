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
        drawOrder: seeded,
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
    for (let matchIndex = 0; matchIndex < round.length; matchIndex += 1) {
        const match = round[matchIndex];
        const expectedId = `r${roundIndex + 1}m${matchIndex + 1}`;
        if (!isRecord(match)
            || match.id !== expectedId
            || match.round !== roundIndex + 1
            || match.index !== matchIndex
            || !Array.isArray(match.players)
            || match.players.length !== 2) {
            throw bracketError('One match in the bracket file is not valid.', 'invalid-match');
        }
        match.players.forEach(player => {
            if (player !== null && (!isParticipantString(player) || !participantSet.has(player))) {
                throw bracketError('A match contains an unknown participant.', 'unknown-participant');
            }
        });
        if (match.winner !== null
            && (!isParticipantString(match.winner)
                || !participantSet.has(match.winner)
                || !match.players.includes(match.winner))) {
            throw bracketError('A match winner is not one of its participants.', 'invalid-winner');
        }
    }
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isParticipantString(value) {
    return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isBracketId(value) {
    return isParticipantString(value) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);
}

function validateImportedMetadata(parsed) {
    if (!isBracketId(parsed.id)
        || !isParticipantString(parsed.name)
        || !isValidTimestamp(parsed.createdAt)
        || !isValidTimestamp(parsed.updatedAt)) {
        throw bracketError('This bracket file is missing valid metadata.', 'invalid-metadata');
    }
}

function isValidTimestamp(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateImportedParticipants(parsed) {
    if (!Array.isArray(parsed.participants)
        || parsed.participants.some(participant => !isParticipantString(participant))) {
        throw bracketError('This bracket file contains an invalid participant list.', 'invalid-participants');
    }
    return validateParticipants(parsed.participants);
}

function validateImportedDrawOrder(parsed, participants) {
    if (parsed.drawOrder === undefined) return null;
    if (!Array.isArray(parsed.drawOrder)
        || parsed.drawOrder.length !== participants.length
        || parsed.drawOrder.some(participant => !isParticipantString(participant))) {
        throw bracketError('This bracket file contains an invalid draw order.', 'invalid-draw-order');
    }
    const expected = new Set(participants);
    const actual = new Set(parsed.drawOrder);
    if (actual.size !== expected.size || parsed.drawOrder.some(participant => !expected.has(participant))) {
        throw bracketError('This bracket file contains an invalid draw order.', 'invalid-draw-order');
    }
    return parsed.drawOrder;
}

function openingSlots(participants) {
    const size = nextPowerOfTwo(participants.length);
    const byeCount = size - participants.length;
    return participants.flatMap((participant, index) => (
        index < byeCount ? [participant, null] : [participant]
    ));
}

function samePlayers(actual, expected) {
    return actual.length === expected.length && actual.every((player, index) => player === expected[index]);
}

function sameParticipantSet(actualSlots, participants) {
    const actual = actualSlots.filter(Boolean);
    const expected = new Set(participants);
    return actual.length === participants.length
        && new Set(actual).size === expected.size
        && actual.every(participant => expected.has(participant));
}

function validLegacyOpening(actualSlots, participants) {
    const expectedShape = openingSlots(participants).map(player => player === null);
    return actualSlots.every((player, index) => (player === null) === expectedShape[index])
        && sameParticipantSet(actualSlots, participants);
}

function validateOpeningRound(round, participants, drawOrder) {
    const actualSlots = round.flatMap(match => match.players);
    const validSlots = drawOrder
        ? samePlayers(actualSlots, openingSlots(drawOrder))
        : validLegacyOpening(actualSlots, participants);
    if (!validSlots) {
        throw bracketError('The opening matches do not match the participant seeds or BYEs.', 'invalid-opening-round');
    }
    round.forEach(match => {
        const realPlayers = match.players.filter(Boolean);
        if (realPlayers.length === 1 && match.winner !== realPlayers[0]) {
            throw bracketError('A BYE must advance its opening participant.', 'invalid-bye');
        }
    });
}

function validateRoundPropagation(round, previousRound) {
    round.forEach((match, matchIndex) => {
        const expectedPlayers = [
            previousRound[matchIndex * 2].winner,
            previousRound[matchIndex * 2 + 1].winner
        ];
        if (!samePlayers(match.players, expectedPlayers)) {
            throw bracketError('A later round does not follow the winners from the previous round.', 'invalid-propagation');
        }
    });
}

function validateImportedBracket(parsed) {
    if (!isRecord(parsed)
            || parsed.schemaVersion !== BRACKET_SCHEMA_VERSION
            || !Array.isArray(parsed.rounds)) {
        throw bracketError('This bracket file is invalid or unsupported.', 'invalid-file');
    }
    validateImportedMetadata(parsed);
    const validatedParticipants = validateImportedParticipants(parsed);
    const drawOrder = validateImportedDrawOrder(parsed, validatedParticipants);
    const participantSet = new Set(validatedParticipants);
    const size = nextPowerOfTwo(validatedParticipants.length);
    const expectedRounds = Math.log2(size);
    if (parsed.rounds.length !== expectedRounds) {
        throw bracketError('The bracket rounds are incomplete or out of order.', 'invalid-rounds');
    }
    for (let roundIndex = 0; roundIndex < parsed.rounds.length; roundIndex += 1) {
        const round = parsed.rounds[roundIndex];
        validateImportedRound(round, roundIndex, participantSet, size / (2 ** (roundIndex + 1)));
    }
    validateOpeningRound(parsed.rounds[0], validatedParticipants, drawOrder);
    for (let roundIndex = 1; roundIndex < parsed.rounds.length; roundIndex += 1) {
        validateRoundPropagation(parsed.rounds[roundIndex], parsed.rounds[roundIndex - 1]);
    }
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
