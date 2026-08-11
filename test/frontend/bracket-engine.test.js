import { describe, expect, it } from 'vitest';
import {
    BRACKET_MAX_PARTICIPANTS,
    BRACKET_MIN_PARTICIPANTS,
    bracketChampion,
    createBracket,
    importBracket,
    setMatchWinner
} from '../../src/assets/js/bracket/bracket-engine.js';

describe('single-elimination bracket engine', () => {
    it('requires 4–128 unique participants', () => {
        expect(() => createBracket(['A', 'B', 'C'])).toThrow(/at least 4/i);
        expect(() => createBracket(['A', 'B', 'C', 'a'])).toThrow(/unique/i);
        expect(() => createBracket(Array.from({ length: BRACKET_MAX_PARTICIPANTS + 1 }, (_, index) => `P${index}`)))
            .toThrow(/at most 128/i);
        expect(BRACKET_MIN_PARTICIPANTS).toBe(4);
    });

    it('pads non-power-of-two fields and advances byes', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D', 'E']);
        expect(bracket.rounds).toHaveLength(3);
        expect(bracket.rounds[0]).toHaveLength(4);
        expect(bracket.rounds[0][0].winner).toBe('A');
        expect(bracket.rounds[1][0].players[0]).toBe('A');
        expect(bracketChampion(bracket)).toBeNull();
    });

    it('distributes byes without creating empty matches or double advancement', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D', 'E']);
        expect(bracket.rounds[0].every(match => match.players.some(Boolean))).toBe(true);
        expect(bracket.rounds[0].filter(match => match.winner).map(match => match.winner))
            .toEqual(['A', 'B', 'C']);
        expect(bracketChampion(bracket)).toBeNull();
    });

    it('advances selected winners to the final and champion', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        setMatchWinner(bracket, 'r1m1', 'A');
        setMatchWinner(bracket, 'r1m2', 'D');
        expect(bracket.rounds[1][0].players).toEqual(['A', 'D']);
        setMatchWinner(bracket, 'r2m1', 'D');
        expect(bracketChampion(bracket)).toBe('D');
    });

    it('clears a downstream winner when an earlier winner changes', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        setMatchWinner(bracket, 'r1m1', 'A');
        setMatchWinner(bracket, 'r1m2', 'D');
        setMatchWinner(bracket, 'r2m1', 'A');
        setMatchWinner(bracket, 'r1m1', 'B');
        expect(bracket.rounds[1][0].players).toEqual(['B', 'D']);
        expect(bracket.rounds[1][0].winner).toBeNull();
        expect(bracketChampion(bracket)).toBeNull();
    });

    it('round-trips a versioned JSON export', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        expect(importBracket(JSON.stringify(bracket))).toEqual(bracket);
    });

    it('round-trips a valid BYE bracket without rewriting it', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D', 'E']);
        const imported = importBracket(JSON.stringify(bracket));
        expect(imported).toEqual(bracket);
        expect(imported.rounds[0].slice(0, 3).map(match => match.winner))
            .toEqual(['A', 'B', 'C']);
    });

    it('round-trips shuffled exports and legacy shuffled exports', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D', 'E'], {
            shuffle: true,
            random: () => 0
        });
        expect(bracket.drawOrder).not.toEqual(bracket.participants);
        expect(importBracket(JSON.stringify(bracket))).toEqual(bracket);

        const legacy = structuredClone(bracket);
        delete legacy.drawOrder;
        expect(importBracket(legacy)).toEqual(legacy);
    });

    it('rejects malformed imports without accepting unknown participants', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        const invalid = structuredClone(bracket);
        invalid.rounds[0][0].players[0] = 'Unknown';
        expect(() => importBracket(invalid)).toThrow(/unknown participant/i);
        expect(bracket.rounds[0][0].players[0]).toBe('A');
    });

    it('rejects duplicate or reordered opening placement', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        const invalid = structuredClone(bracket);
        invalid.rounds[0][1].players = ['A', 'D'];
        expect(() => importBracket(invalid)).toThrow(/opening.*seeds|BYEs/i);
        expect(invalid.rounds[0][1].players).toEqual(['A', 'D']);
    });

    it('rejects later-round players that do not follow prior winners', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        const invalid = structuredClone(bracket);
        invalid.rounds[1][0].players = ['A', null];
        expect(() => importBracket(invalid)).toThrow(/later round|previous round/i);
        expect(bracket.rounds[1][0].players).toEqual([null, null]);
    });

    it('rejects malformed match IDs and round metadata', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        const invalidBracketId = structuredClone(bracket);
        invalidBracketId.id = 'bracket" onmouseover="alert(1)';
        expect(() => importBracket(invalidBracketId)).toThrow(/metadata/i);

        const invalidId = structuredClone(bracket);
        invalidId.rounds[0][0].id = 'r1m99';
        expect(() => importBracket(invalidId)).toThrow(/match.*valid/i);

        const invalidRound = structuredClone(bracket);
        invalidRound.rounds[1][0].round = 1;
        expect(() => importBracket(invalidRound)).toThrow(/match.*valid/i);
    });

    it('does not mutate an object rejected for impossible propagation', () => {
        const invalid = structuredClone(createBracket(['A', 'B', 'C', 'D']));
        invalid.rounds[1][0].winner = 'A';
        const beforeImport = structuredClone(invalid);
        expect(() => importBracket(invalid)).toThrow(/winner|previous round|later round/i);
        expect(invalid).toEqual(beforeImport);
    });
});
