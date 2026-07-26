import { describe, expect, it } from 'vitest';
import {
    matchesRosterView,
    playerNeedsAttention
} from '../../src/assets/js/operation-board/operation-board-roster-filter.js';

describe('Operation Board roster filters', () => {
    it('filters planning, concluded misses and round participation', () => {
        const player = {
            planned: false,
            status: 'apiOnly',
            missed: 1,
            dayStats: {
                1: { warParticipant: true },
                2: { warParticipant: false }
            }
        };

        expect(matchesRosterView(player, 'planned')).toBe(false);
        expect(matchesRosterView(player, 'unplanned')).toBe(true);
        expect(matchesRosterView(player, 'missed')).toBe(true);
        expect(matchesRosterView(player, 'day:1')).toBe(true);
        expect(matchesRosterView(player, 'day:2')).toBe(false);
    });

    it('flags low reliability or declining historical form without recalculating it', () => {
        const lowReliability = {
            missed: 0,
            insight: {
                historical: {
                    status: 'ready',
                    reliability: 79,
                    form: { trend: 'stable' }
                }
            }
        };
        const declining = {
            missed: 0,
            insight: {
                historical: {
                    status: 'ready',
                    reliability: 97,
                    form: { trend: 'declining' }
                }
            }
        };

        expect(playerNeedsAttention(lowReliability)).toBe(true);
        expect(playerNeedsAttention(declining)).toBe(true);
        expect(matchesRosterView(declining, 'attention')).toBe(true);
    });
});
