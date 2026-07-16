import { describe, expect, it } from 'vitest';
import {
    bracketChampion,
    createBracket,
    importBracket,
    setMatchWinner
} from '../../src/assets/js/bracket/bracket-engine.js';

describe('single-elimination bracket engine', () => {
    it('pads non-power-of-two fields and advances byes', () => {
        const bracket = createBracket(['A', 'B', 'C']);
        expect(bracket.rounds).toHaveLength(2);
        expect(bracket.rounds[0]).toHaveLength(2);
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

    it('round-trips a versioned JSON export', () => {
        const bracket = createBracket(['A', 'B']);
        expect(importBracket(JSON.stringify(bracket))).toEqual(bracket);
    });
});
