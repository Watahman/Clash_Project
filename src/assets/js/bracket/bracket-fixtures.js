import {
    bracketChampion,
    createBracket,
    setMatchWinner
} from './bracket-engine.js';

const FIXTURE_PARTICIPANTS = Object.freeze({
    'bracket-4': ['North', 'East', 'South', 'West'],
    'bracket-8': ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'],
    'bracket-12-byes': Array.from({ length: 12 }, (_, index) => `Clan ${String(index + 1).padStart(2, '0')}`),
    'bracket-32': Array.from({ length: 32 }, (_, index) => `Seed ${String(index + 1).padStart(2, '0')}`),
    'bracket-complete': ['Northwind', 'Redwood', 'Harbor', 'Summit']
});

const FIXTURE_NAMES = Object.freeze({
    'bracket-4': 'Fixture · 4 participants',
    'bracket-8': 'Fixture · 8 participants',
    'bracket-12-byes': 'Fixture · 12 participants with BYEs',
    'bracket-32': 'Fixture · 32 participants',
    'bracket-complete': 'Fixture · completed bracket'
});

function seededRandom(seed) {
    let value = seed;
    return () => {
        value = (value * 1664525 + 1013904223) % 4294967296;
        return value / 4294967296;
    };
}

function finishBracket(bracket) {
    let guard = 0;
    while (!bracketChampion(bracket) && guard < 128) {
        const match = bracket.rounds.flat().find(item =>
            item.players.every(Boolean) && !item.winner
        );
        if (!match) break;
        setMatchWinner(bracket, match.id, match.players[0]);
        guard += 1;
    }
}

export function createBracketFixture(id) {
    const participants = FIXTURE_PARTICIPANTS[id];
    if (!participants) return null;
    const bracket = createBracket(participants, {
        name: FIXTURE_NAMES[id],
        shuffle: id === 'bracket-32',
        random: seededRandom(32)
    });
    bracket.id = `fixture-${id}`;
    bracket.createdAt = '2026-01-01T00:00:00.000Z';
    bracket.updatedAt = bracket.createdAt;
    if (id === 'bracket-complete') {
        finishBracket(bracket);
        bracket.updatedAt = '2026-01-01T00:00:00.000Z';
    }
    return bracket;
}

export const BRACKET_FIXTURE_IDS = Object.freeze(Object.keys(FIXTURE_PARTICIPANTS));
