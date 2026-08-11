export const BRACKET_SCHEMA_VERSION = 1;
export const BRACKET_MIN_PARTICIPANTS = 4;
export const BRACKET_MAX_PARTICIPANTS = 128;

export function bracketError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
}

export function nextPowerOfTwo(value) {
    let power = 1;
    while (power < value) power *= 2;
    return power;
}

function normalizedParticipants(participants) {
    return (Array.isArray(participants) ? participants : [])
        .map(participant => String(participant ?? '').trim())
        .filter(Boolean);
}

export function validateParticipants(participants) {
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
