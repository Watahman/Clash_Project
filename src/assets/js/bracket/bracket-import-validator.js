import {
    BRACKET_SCHEMA_VERSION,
    bracketError,
    nextPowerOfTwo,
    validateParticipants
} from './bracket-model.js';

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isParticipantString(value) {
    return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isBracketId(value) {
    return isParticipantString(value) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value);
}

function isValidTimestamp(value) {
    return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validateImportedMetadata(parsed) {
    if (!isBracketId(parsed.id)
        || !isParticipantString(parsed.name)
        || !isValidTimestamp(parsed.createdAt)
        || !isValidTimestamp(parsed.updatedAt)) {
        throw bracketError('This bracket file is missing valid metadata.', 'invalid-metadata');
    }
}

function validateImportedParticipants(parsed) {
    if (!Array.isArray(parsed.participants)
        || parsed.participants.some(participant => !isParticipantString(participant))) {
        throw bracketError('This bracket file contains an invalid participant list.', 'invalid-participants');
    }
    return validateParticipants(parsed.participants);
}

function validateImportedIdentity(parsed, participants) {
    if (parsed.participantIds === undefined && parsed.participantLabels === undefined) return null;
    if (!Array.isArray(parsed.participantIds)
        || parsed.participantIds.length !== participants.length
        || parsed.participantIds.some(id => !isParticipantString(id))
        || new Set(parsed.participantIds).size !== parsed.participantIds.length
        || !isRecord(parsed.participantLabels)
        || parsed.participantIds.some((id, index) => parsed.participantLabels[id] !== participants[index])) {
        throw bracketError('This bracket file contains invalid participant identities.', 'invalid-identities');
    }
    return parsed.participantIds;
}

function validateImportedDrawOrder(parsed, participants, participantIds) {
    if (parsed.drawOrder === undefined) return null;
    const expectedValues = participantIds || participants;
    if (!Array.isArray(parsed.drawOrder)
        || parsed.drawOrder.length !== expectedValues.length
        || parsed.drawOrder.some(participant => !isParticipantString(participant))) {
        throw bracketError('This bracket file contains an invalid draw order.', 'invalid-draw-order');
    }
    const expected = new Set(expectedValues);
    const actual = new Set(parsed.drawOrder);
    if (actual.size !== expected.size || parsed.drawOrder.some(participant => !expected.has(participant))) {
        throw bracketError('This bracket file contains an invalid draw order.', 'invalid-draw-order');
    }
    return parsed.drawOrder;
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

export function validateImportedBracket(parsed) {
    if (!isRecord(parsed)
        || parsed.schemaVersion !== BRACKET_SCHEMA_VERSION
        || !Array.isArray(parsed.rounds)) {
        throw bracketError('This bracket file is invalid or unsupported.', 'invalid-file');
    }
    validateImportedMetadata(parsed);
    const participants = validateImportedParticipants(parsed);
    const participantIds = validateImportedIdentity(parsed, participants);
    const drawOrder = validateImportedDrawOrder(parsed, participants, participantIds);
    const participantSet = new Set(participantIds || participants);
    const size = nextPowerOfTwo(participants.length);
    const expectedRounds = Math.log2(size);
    if (parsed.rounds.length !== expectedRounds) {
        throw bracketError('The bracket rounds are incomplete or out of order.', 'invalid-rounds');
    }
    for (let roundIndex = 0; roundIndex < parsed.rounds.length; roundIndex += 1) {
        const round = parsed.rounds[roundIndex];
        validateImportedRound(round, roundIndex, participantSet, size / (2 ** (roundIndex + 1)));
    }
    validateOpeningRound(parsed.rounds[0], participants, drawOrder);
    for (let roundIndex = 1; roundIndex < parsed.rounds.length; roundIndex += 1) {
        validateRoundPropagation(parsed.rounds[roundIndex], parsed.rounds[roundIndex - 1]);
    }
}
