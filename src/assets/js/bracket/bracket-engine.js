import {
    BRACKET_SCHEMA_VERSION,
    BRACKET_MIN_PARTICIPANTS,
    BRACKET_MAX_PARTICIPANTS,
    bracketError,
    nextPowerOfTwo,
    participantName,
    validateParticipants
} from './bracket-model.js';
import { validateImportedBracket } from './bracket-import-validator.js';

export {
    BRACKET_SCHEMA_VERSION,
    BRACKET_MIN_PARTICIPANTS,
    BRACKET_MAX_PARTICIPANTS
};

function shuffled(values, random = Math.random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

function createBracketId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    return `bracket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createParticipantIds(participants) {
    return participants.map((_, index) => `participant-${index + 1}`);
}

function createRounds(seeded) {
    const size = nextPowerOfTwo(seeded.length);
    const byeCount = size - seeded.length;
    const slots = seeded.flatMap((participant, index) => (
        index < byeCount ? [participant, null] : [participant]
    ));
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
    return rounds;
}

export function createBracket(participants, { shuffle = false, random = Math.random, name = 'Bracket' } = {}) {
    const names = validateParticipants(participants);
    const participantIds = createParticipantIds(names);
    const participantLabels = Object.fromEntries(
        participantIds.map((id, index) => [id, names[index]])
    );
    const seeded = shuffle ? shuffled(participantIds, random) : participantIds;
    const rounds = createRounds(seeded);
    const bracket = {
        schemaVersion: BRACKET_SCHEMA_VERSION,
        id: createBracketId(),
        name: String(name || 'Bracket').trim() || 'Bracket',
        participants: names,
        participantIds,
        participantLabels,
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
    const winnerId = match.players.find(player => player === winner
        || (participantName(bracket, player) === winner && !match.players.includes(winner)));
    if (!winnerId) {
        throw bracketError('Choose a participant from this match.', 'invalid-winner');
    }
    if (match.winner && match.winner !== winnerId) clearDownstream(bracket, match);
    match.winner = winnerId;
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
