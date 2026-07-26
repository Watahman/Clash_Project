import { describe, expect, it } from 'vitest';
import {
    getCurrentCwlPlayerContext
} from '../../src/assets/js/operation-board/operation-board-player-context.js';

describe('Operation Board current CWL player context', () => {
    it('keeps current CWL totals separate and counts played rounds', () => {
        const report = {
            roster: [{
                tag: '#P0L',
                attacksUsed: 4,
                availableAttacks: 5,
                stars: 10,
                destruction: 88.25,
                missed: 1,
                dayStats: {
                    1: { warParticipant: true, state: 'completed' },
                    2: { warParticipant: true, state: 'live' },
                    3: { warParticipant: true, state: 'preparation' }
                }
            }]
        };

        expect(getCurrentCwlPlayerContext(report, 'p0l')).toEqual({
            attacksUsed: 4,
            availableAttacks: 5,
            stars: 10,
            avgDestruction: 88.25,
            missed: 1,
            roundsPlayed: 2
        });
        expect(getCurrentCwlPlayerContext(report, '#NONE')).toBeNull();
    });
});
