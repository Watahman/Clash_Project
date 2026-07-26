import { describe, expect, it } from 'vitest';

import {
    getAdjacentOperationTab,
    getBoardIdentity,
    getDefaultOperationTab
} from '../../src/assets/js/operation-board/operation-board-tabs.js';

describe('Operation Board tabs', () => {
    it('opens Live for an active matchup', () => {
        expect(getDefaultOperationTab({
            phase: 'live',
            clan: { tag: '#PQL' },
            roster: [],
            standings: { rows: [] },
            rounds: [{ day: 4, state: 'live' }],
            wars: []
        })).toBe('live');
    });

    it('opens League for a completed CWL and Roster for roster-only data', () => {
        expect(getDefaultOperationTab({
            phase: 'completed',
            roster: [],
            standings: { rows: [{ rank: 1 }] },
            rounds: [],
            wars: []
        })).toBe('league');
        expect(getDefaultOperationTab({
            phase: 'unknown',
            roster: [{ tag: '#P0L' }],
            standings: { rows: [] },
            rounds: [],
            wars: []
        })).toBe('roster');
    });

    it('shows no tab without usable board data', () => {
        expect(getDefaultOperationTab({
            phase: 'unknown',
            roster: [],
            standings: { rows: [] },
            rounds: Array.from({ length: 7 }, (_, index) => ({
                day: index + 1,
                state: 'notStarted'
            })),
            wars: []
        })).toBeNull();
    });

    it('keeps board identity scoped to plan, clan and standalone mode', () => {
        const report = {
            plan: { id: 'plan-a' },
            clan: { tag: '#PQL' }
        };
        expect(getBoardIdentity(report)).toBe('plan-a:#PQL');
        expect(getBoardIdentity({
            ...report,
            clan: { tag: '#PQL', standalone: true }
        })).toBe('standalone:#PQL');
    });

    it('supports wrapped arrow-key tab navigation', () => {
        expect(getAdjacentOperationTab('live', 'ArrowLeft')).toBe('bonuses');
        expect(getAdjacentOperationTab('bonuses', 'ArrowRight')).toBe('live');
        expect(getAdjacentOperationTab('roster', 'Home')).toBe('live');
        expect(getAdjacentOperationTab('roster', 'End')).toBe('bonuses');
    });
});
