import { describe, expect, it } from 'vitest';
import { buildAutoPlan } from '../../src/assets/js/cwl/auto-plan/cwl-auto-planner.js';
import {
    compareClanPriority,
    scorePlayerForClan
} from '../../src/assets/js/cwl/auto-plan/cwl-auto-plan-scoring.js';

describe('CWL Auto Plan priority rules', () => {
    it('keeps Auto clan ordering on league rank', () => {
        const result = buildAutoPlan({
            players: equalPlayers(15),
            clans: [
                clan('gold', '#GOLD', 'Gold League I'),
                clan('champion', '#CHAMPION', 'Champion League I')
            ]
        });

        expect(result.clans.find(item => item.status === 'active')?.id)
            .toBe('champion');
    });

    it('puts an explicit clan priority before league rank as a preference', () => {
        const gold = { ...clan('gold', '#GOLD', 'Gold League I'), clanPriority: 'primary' };
        const champion = clan('champion', '#CHAMPION', 'Champion League I');

        expect([gold, champion].sort(compareClanPriority).map(item => item.id))
            .toEqual(['gold', 'champion']);

        const result = buildAutoPlan({
            players: equalPlayers(15),
            clans: [gold, champion]
        });
        expect(result.clans.find(item => item.status === 'active')?.id).toBe('gold');
    });

    it('applies only a bounded High/Low fit modifier', () => {
        const normal = scorePlayerForClan(player({ performance: 100 }), clan());
        const high = scorePlayerForClan(
            player({ performance: 100, playerPriority: 'high' }),
            clan()
        );
        const low = scorePlayerForClan(
            player({ performance: 100, playerPriority: 'low' }),
            clan()
        );
        const lowerPerformanceHigh = scorePlayerForClan(
            player({ performance: 80, playerPriority: 'high' }),
            clan()
        );
        const higherPerformanceLow = scorePlayerForClan(
            player({ performance: 100, playerPriority: 'low' }),
            clan()
        );

        expect(high.fit - normal.fit).toBe(1.5);
        expect(low.fit - normal.fit).toBe(-1.5);
        expect(high.priorityModifier).toBe(1.5);
        expect(low.priorityModifier).toBe(-1.5);
        expect(higherPerformanceLow.fit).toBeGreaterThan(lowerPerformanceHigh.fit);
    });

    it('keeps an existing core ahead of a normal player despite Low priority', () => {
        const roster = equalPlayers(16);
        roster[15].currentRole = 'core';
        roster[15].playerPriority = 'low';

        const result = buildAutoPlan({ players: roster, clans: [clan()] });
        const planned = result.clans[0].players;

        expect(planned.find(player => player.tag === '#P015')).toMatchObject({
            role: 'core',
            playerPriority: 'low'
        });
        expect(result.freePlayers).not.toContainEqual(
            expect.objectContaining({ tag: '#P015' })
        );
    });

    it('keeps Exclude players out of automatic assignment', () => {
        const players = equalPlayers(16);
        players[0].playerPriority = 'exclude';

        const result = buildAutoPlan({ players, clans: [clan()] });
        const planned = result.clans[0].players;

        expect(planned).toHaveLength(15);
        expect(planned).not.toContainEqual(expect.objectContaining({ tag: '#P000' }));
        expect(result.freePlayers).toContainEqual(expect.objectContaining({
            tag: '#P000',
            playerPriority: 'exclude'
        }));
    });

    it('honours a hard guided/CWL lock even when the player is Excluded', () => {
        const players = equalPlayers(16);
        players[0].playerPriority = 'exclude';

        const result = buildAutoPlan({
            mode: 'guided',
            players,
            clans: [clan()],
            locks: {
                assignments: { '#P000': 'alpha' },
                roles: { '#P000': 'reserve' },
                reasons: { '#P000': 'registered-cwl-roster' }
            }
        });
        const locked = result.clans[0].players.find(player => player.tag === '#P000');

        expect(locked).toMatchObject({
            tag: '#P000',
            role: 'reserve',
            hardLocked: true,
            playerPriority: 'exclude'
        });
        expect(result.freePlayers).not.toContainEqual(
            expect.objectContaining({ tag: '#P000' })
        );
    });
});

function equalPlayers(count) {
    return Array.from({ length: count }, (_, index) => player({
        tag: `#P${String(index).padStart(3, '0')}`
    }));
}

function player(overrides = {}) {
    const performanceOverride = typeof overrides.performance === 'object'
        ? overrides.performance
        : { performance: overrides.performance };
    const performance = {
        status: 'ready',
        scope: 'CWL',
        performance: 100,
        reliability: 95,
        avgStars: 2.5,
        attackCount: 10,
        sameThCount: 8,
        upHitCount: 1,
        confidence: 'High',
        form: { delta: 0 },
        ...(overrides.performance == null ? {} : performanceOverride)
    };
    return {
        tag: '#PLAYER',
        name: 'Player',
        townHallLevel: 17,
        availability: { state: 'yes', availableDays: [1, 2, 3, 4, 5, 6, 7] },
        ...overrides,
        performance
    };
}

function clan(id = 'alpha', tag = '#ALPHA', league = 'Master League I') {
    return { id, tag, name: id, league, capacity: 15 };
}
