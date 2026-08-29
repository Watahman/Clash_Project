import {
    BRACKET_MAX_PARTICIPANTS,
    BRACKET_MIN_PARTICIPANTS
} from './bracket-engine.js';
import { bracketText } from './bracket-copy.js?v=20260829-public-auth-v1';

export function snapshotMatches(bracket) {
    return new Map(bracket.rounds.flat().map(match => [
        match.id,
        JSON.stringify({ players: match.players, winner: match.winner })
    ]));
}

export function changedMatches(bracket, before) {
    return new Set([...snapshotMatches(bracket).entries()]
        .filter(([id, value]) => before.get(id) !== value)
        .map(([id]) => id));
}

export function bracketErrorCopy(error) {
    const messages = {
        'duplicate-participants': 'duplicate',
        'too-few-participants': 'minimum',
        'too-many-participants': 'maximum'
    };
    return bracketText(messages[error?.code] || 'importError', {
        min: BRACKET_MIN_PARTICIPANTS,
        max: BRACKET_MAX_PARTICIPANTS
    });
}
