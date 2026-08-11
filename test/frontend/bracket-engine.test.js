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

    it('rejects malformed imports without accepting unknown participants', () => {
        const bracket = createBracket(['A', 'B', 'C', 'D']);
        const invalid = structuredClone(bracket);
        invalid.rounds[0][0].players[0] = 'Unknown';
        expect(() => importBracket(invalid)).toThrow(/unknown participant/i);
        expect(bracket.rounds[0][0].players[0]).toBe('A');
    });
});
