import { describe, expect, it } from 'vitest';
import { buildAutoPlan } from '../../src/assets/js/cwl/auto-plan/cwl-auto-planner.js';

describe('CWL Auto Planner', () => {
    it('fills every required lineup globally before adding depth', () => {
        const input = {
            players: players(36),
            clans: [
                clan('alpha', '#ALPHA', 'Champion League II'),
                clan('beta', '#BETA', 'Crystal League I')
            ]
        };

        const result = buildAutoPlan(input);
        const activeCounts = result.clans.map(item =>
            item.players.filter(player => player.role !== 'reserve').length
        );

        expect(activeCounts).toEqual([expect.any(Number), expect.any(Number)]);
        expect(activeCounts.every(count => count >= 15)).toBe(true);
        expect(result.clans.flatMap(item => item.players)
            .filter(player => player.role === 'reserve')).toHaveLength(4);
        expect(result.clans.every(item =>
            item.players.filter(player => player.role === 'reserve').length <= 2
        )).toBe(true);
    });

    it('is deterministic and uses the player tag as the final stable tie-breaker', () => {
        const input = {
            players: players(32).reverse(),
            clans: [
                clan('beta', '#BETA', 'Master League I'),
                clan('alpha', '#ALPHA', 'Master League I')
            ]
        };

        const first = buildAutoPlan(input);
        const second = buildAutoPlan(structuredClone(input));

        expect(second).toEqual(first);
        const assignedTags = first.clans.flatMap(item => item.players.map(player => player.tag));
        expect(new Set([...assignedTags, ...first.freePlayers.map(player => player.tag)]).size)
            .toBe(input.players.length);
    });

    it('keeps registered players locked to their spun CWL clan', () => {
        const input = {
            players: players(31),
            clans: [
                clan('alpha', '#ALPHA', 'Champion League I'),
                clan('beta', '#BETA', 'Gold League I')
            ],
            locks: {
                assignments: { '#P030': 'beta' },
                roles: {},
                reasons: { '#P030': 'registered-cwl-roster' }
            }
        };

        const result = buildAutoPlan(input);
        const beta = result.clans.find(item => item.id === 'beta');
        const locked = beta.players.find(player => player.tag === '#P030');

        expect(locked).toMatchObject({ tag: '#P030', hardLocked: true });
        expect(result.clans.find(item => item.id === 'alpha').players)
            .not.toContainEqual(expect.objectContaining({ tag: '#P030' }));
    });

    it('fills one usable clan instead of spreading a shortage across two clans', () => {
        const result = buildAutoPlan({
            players: players(20),
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                clan('beta', '#BETA', 'Crystal League I')
            ]
        });
        const active = result.clans.filter(item => item.status === 'active');
        const unused = result.clans.filter(item => item.status === 'not-used');

        expect(active).toHaveLength(1);
        expect(active[0].players.filter(player => player.role !== 'reserve')).toHaveLength(15);
        expect(active[0].players.filter(player => player.role === 'reserve')).toHaveLength(2);
        expect(unused).toHaveLength(1);
        expect(unused[0]).toMatchObject({
            reasonCode: 'not_enough_remaining_players',
            players: []
        });
        expect(result.freePlayers).toHaveLength(3);
        expect(result.warnings).toHaveLength(0);
    });

    it('keeps reserves limited and never schedules them by default', () => {
        const result = buildAutoPlan({
            players: players(18, { equalScores: true }),
            clans: [clan('alpha', '#ALPHA', 'Champion League I')]
        });
        const planned = result.clans[0];
        const reserves = planned.players.filter(player => player.role === 'reserve');

        expect(planned.lineups).toHaveLength(7);
        expect(planned.lineups.every(lineup => lineup.playerTags.length === 15)).toBe(true);
        expect(planned.players.filter(player => player.role !== 'reserve')).toHaveLength(15);
        expect(reserves).toHaveLength(2);
        expect(reserves.every(player => player.plannedDays.length === 0)).toBe(true);
        expect(result.freePlayers).toHaveLength(1);
        expect(planned.lineupChanges).toBe(0);
    });

    it('replans around a guided hard role lock', () => {
        const result = buildAutoPlan({
            mode: 'guided',
            players: players(18),
            clans: [clan('alpha', '#ALPHA', 'Master League I')],
            locks: {
                assignments: { '#P000': 'alpha' },
                roles: { '#P000': 'reserve' },
                reasons: { '#P000': 'guided-role-lock' }
            }
        });
        const planned = result.clans[0];

        expect(planned.players.find(player => player.tag === '#P000')?.role).toBe('reserve');
        expect(planned.players.filter(player => player.role !== 'reserve')).toHaveLength(15);
        expect(planned.players.filter(player => player.role === 'reserve').length).toBeLessThanOrEqual(2);
    });

    it('does not add rotation depth when a fully available lineup is stronger', () => {
        const roster = players(18);
        roster[0].availability = {
            state: 'partial',
            rounds: 7,
            availableDays: [1, 2, 3, 4, 5, 6]
        };
        const result = buildAutoPlan({
            players: roster,
            clans: [clan('alpha', '#ALPHA', 'Crystal League I')]
        });
        const planned = result.clans[0];

        expect(planned.players.filter(player => player.role !== 'reserve')).toHaveLength(15);
        expect(planned.lineups.every(lineup => lineup.playerTags.length === 15)).toBe(true);
        expect(planned.warnings.some(warning => warning.code === 'reserve_used')).toBe(false);
    });

    it('fills two clans completely and leaves the third unused', () => {
        const result = buildAutoPlan({
            players: players(36),
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                clan('beta', '#BETA', 'Crystal League I'),
                clan('gamma', '#GAMMA', 'Gold League I')
            ]
        });
        const active = result.clans.filter(item => item.status === 'active');
        const unused = result.clans.filter(item => item.status === 'not-used');

        expect(result).toMatchObject({ activeCount: 2, totalClanCount: 3 });
        expect(active).toHaveLength(2);
        expect(active.every(item =>
            item.players.filter(player => player.role !== 'reserve').length === 15
        )).toBe(true);
        expect(active.flatMap(item => item.players)
            .filter(player => player.role === 'reserve')).toHaveLength(4);
        expect(unused).toHaveLength(1);
        expect(unused[0].players).toEqual([]);
        expect(result.freePlayers).toHaveLength(2);
    });

    it('chooses a lower league when the available roster fits it clearly better', () => {
        const roster = players(15, { equalScores: true })
            .map(player => ({ ...player, townHallLevel: 14 }));
        const result = buildAutoPlan({
            players: roster,
            clans: [
                clan('champion', '#CHAMP', 'Champion League I'),
                clan('gold', '#GOLD', 'Gold League I')
            ]
        });

        expect(result.clans.find(item => item.status === 'active')?.id).toBe('gold');
        expect(result.clans.find(item => item.id === 'champion')?.status).toBe('not-used');
    });

    it('leaves every clan unused when no complete lineup is possible', () => {
        const result = buildAutoPlan({
            players: players(14),
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                clan('beta', '#BETA', 'Crystal League I')
            ]
        });

        expect(result.activeCount).toBe(0);
        expect(result.clans.every(item =>
            item.status === 'not-used'
            && item.reasonCode === 'not_enough_complete_roster'
            && item.players.length === 0
        )).toBe(true);
        expect(result.freePlayers).toHaveLength(14);
    });

    it('prefers two complete 15v15 clans over one complete 30v30 clan', () => {
        const result = buildAutoPlan({
            players: players(30),
            clans: [
                { ...clan('large', '#LARGE', 'Master League I'), capacity: 30 },
                clan('alpha', '#ALPHA', 'Crystal League I'),
                clan('beta', '#BETA', 'Gold League I')
            ]
        });

        expect(result.activeCount).toBe(2);
        expect(result.clans.find(item => item.id === 'large')?.status).toBe('not-used');
        expect(result.clans.filter(item => item.status === 'active').map(item => item.id).sort())
            .toEqual(['alpha', 'beta']);
    });

    it('keeps a hard-locked clan active when only one clan can be filled', () => {
        const result = buildAutoPlan({
            players: players(20),
            clans: [
                clan('alpha', '#ALPHA', 'Champion League I'),
                clan('beta', '#BETA', 'Gold League I')
            ],
            locks: {
                assignments: { '#P019': 'beta' },
                roles: {},
                reasons: { '#P019': 'registered-cwl-roster' }
            }
        });

        expect(result.clans.find(item => item.id === 'beta')).toMatchObject({
            status: 'active'
        });
        expect(result.clans.find(item => item.id === 'beta').players)
            .toContainEqual(expect.objectContaining({ tag: '#P019', hardLocked: true }));
        expect(result.clans.find(item => item.id === 'alpha')?.status).toBe('not-used');
    });

    it('keeps an existing Core player when the score difference is only marginal', () => {
        const roster = players(16, { equalScores: true });
        roster[15].currentRole = 'core';
        const result = buildAutoPlan({
            players: roster,
            clans: [clan('alpha', '#ALPHA', 'Master League I')]
        });

        expect(result.clans[0].players.find(player => player.tag === '#P015')?.role)
            .toBe('core');
    });
});

function players(count, options = {}) {
    return Array.from({ length: count }, (_, index) => {
        const performance = options.equalScores ? 100 : 112 - index * 0.8;
        return {
            tag: `#P${String(index).padStart(3, '0')}`,
            name: `Player ${index}`,
            townHallLevel: index < 20 ? 17 : index < 30 ? 16 : 15,
            availability: {
                state: 'yes',
                rounds: 7,
                availableDays: [1, 2, 3, 4, 5, 6, 7]
            },
            performance: {
                status: 'ready',
                scope: 'CWL',
                performance,
                reliability: options.equalScores ? 96 : 99 - index * 0.3,
                avgStars: options.equalScores ? 2.4 : 2.75 - index * 0.015,
                attackCount: 15,
                sameThCount: 12,
                upHitCount: 2,
                downHitCount: 1,
                confidence: 'High',
                form: { delta: 0, trend: 'stable' }
            }
        };
    });
}

function clan(id, tag, league) {
    return { id, tag, name: id, league, capacity: 15 };
}
