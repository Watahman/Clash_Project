import { describe, expect, it } from 'vitest';
import {
    buildAcceptedOptimization,
    buildOptimizePlan
} from '../../src/assets/js/cwl/optimize-plan/cwl-optimize-planner.js';
import { calculateChangeCost } from '../../src/assets/js/cwl/optimize-plan/cwl-optimize-plan-cost.js';

describe('CWL Optimize Plan', () => {
    it('keeps a strong complete Champion plan unchanged', () => {
        const input = planInput({
            clans: [clan('alpha', '#ALPHA', 'Champion League I')],
            players: playersForClan('alpha', 15)
        });

        const result = buildOptimizePlan(input);

        expect(result.suggestions).toEqual([]);
        expect(result.clanAdvice.alpha.status).toBe('no-changes');
        expect(result.comparison.playerChanges).toBe(0);
    });

    it('fills an incomplete clan from another clan its excess reserve first', () => {
        const alpha = playersForClan('alpha', 17).map((player, index) => ({
            ...player,
            currentRole: index < 15 ? 'core' : 'reserve'
        }));
        const beta = playersForClan('beta', 14, { offset: 20 });
        const result = buildOptimizePlan(planInput({
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                clan('beta', '#BETA', 'Crystal League I')
            ],
            players: [...alpha, ...beta]
        }));

        expect(result.suggestions[0]).toMatchObject({
            type: 'structural',
            clanIds: expect.arrayContaining(['alpha', 'beta'])
        });
        expect(result.suggestions[0].actions).toContainEqual(expect.objectContaining({
            type: 'move',
            fromClanId: 'alpha',
            toClanId: 'beta'
        }));
        expect(result.optimized.clans.find(item => item.id === 'beta').players)
            .toHaveLength(15);
    });

    it('never proposes cross-clan movement after CWL has started', () => {
        const alpha = playersForClan('alpha', 17).map((player, index) => ({
            ...player,
            currentRole: index < 15 ? 'core' : 'reserve'
        }));
        const beta = playersForClan('beta', 14, { offset: 20 });
        const result = buildOptimizePlan(planInput({
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                clan('beta', '#BETA', 'Crystal League I')
            ],
            players: [...alpha, ...beta],
            locks: {
                assignments: {},
                roles: {},
                reasons: {},
                startedClanIds: ['beta']
            }
        }));

        expect(result.suggestions.flatMap(item => item.actions)
            .some(action => action.type === 'move')).toBe(false);
    });

    it('can suggest one clearly useful cross-clan swap before CWL starts', () => {
        const champion = playersForClan('alpha', 15, { equalScores: true });
        const gold = playersForClan('beta', 15, { equalScores: true, offset: 20 });
        champion[0].townHallLevel = 14;
        gold[0].townHallLevel = 17;
        const result = buildOptimizePlan(planInput({
            clans: [
                clan('alpha', '#ALPHA', 'Champion League I'),
                clan('beta', '#BETA', 'Gold League I')
            ],
            players: [...champion, ...gold]
        }));

        expect(result.suggestions).toContainEqual(expect.objectContaining({
            type: 'cross-clan-swap',
            clanIds: ['alpha', 'beta'],
            actions: expect.arrayContaining([
                expect.objectContaining({ type: 'move', toClanId: 'alpha' }),
                expect.objectContaining({ type: 'move', toClanId: 'beta' })
            ])
        }));
    });

    it('does not remove excess players from a clan whose CWL has started', () => {
        const result = buildOptimizePlan(planInput({
            clans: [clan('alpha', '#ALPHA', 'Master League I')],
            players: playersForClan('alpha', 19).map((player, index) => ({
                ...player,
                currentRole: index < 15 ? 'core' : 'reserve'
            })),
            locks: {
                assignments: {},
                roles: {},
                reasons: {},
                startedClanIds: ['alpha']
            }
        }));

        expect(result.suggestions.flatMap(item => item.actions)
            .some(action => action.type === 'free' || action.type === 'move')).toBe(false);
    });

    it.each([
        { capacity: 15, reserveCount: 4 },
        { capacity: 30, reserveCount: 5 }
    ])('keeps at least $capacity active players while removing excess depth', ({
        capacity,
        reserveCount
    }) => {
        const roster = playersForClan('alpha', capacity + reserveCount)
            .map((player, index) => ({
                ...player,
                currentRole: index < capacity ? 'core' : 'reserve'
            }));
        roster[capacity - 1].performance.performance = 20;
        roster.slice(capacity).forEach(player => {
            player.performance.performance = 150;
        });
        const result = buildOptimizePlan(planInput({
            clans: [{
                ...clan('alpha', '#ALPHA', 'Master League I'),
                capacity
            }],
            players: roster
        }));
        const optimizedClan = result.optimized.clans.find(item => item.id === 'alpha');

        expect(optimizedClan.players.filter(player => player.role !== 'reserve'))
            .toHaveLength(capacity);
        expect(optimizedClan.warnings).not.toContainEqual(expect.objectContaining({
            code: 'incomplete_roster'
        }));
    });

    it('fills a 30v30 clan without taking a 15v15 source below its minimum', () => {
        const source = playersForClan('alpha', 17).map((player, index) => ({
            ...player,
            currentRole: index < 15 ? 'core' : 'reserve'
        }));
        const target = playersForClan('large', 29, { offset: 40 });
        const result = buildOptimizePlan(planInput({
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                { ...clan('large', '#LARGE', 'Crystal League I'), capacity: 30 }
            ],
            players: [...source, ...target]
        }));
        const sourceClan = result.optimized.clans.find(item => item.id === 'alpha');
        const targetClan = result.optimized.clans.find(item => item.id === 'large');

        expect(sourceClan.players.filter(player => player.role !== 'reserve')).toHaveLength(15);
        expect(targetClan.players.filter(player => player.role !== 'reserve')).toHaveLength(30);
    });

    it('does not infer role changes from removed daily schedules', () => {
        const roster = playersForClan('alpha', 16).map((player, index) => ({
            ...player,
            currentRole: index < 15 ? 'core' : 'reserve'
        }));
        roster[14].availability = {
            state: 'partial',
            availableDays: [1, 2, 3, 4, 5, 6]
        };
        roster[15].availability = {
            state: 'partial',
            availableDays: [7]
        };
        const result = buildOptimizePlan(planInput({
            clans: [clan('alpha', '#ALPHA', 'Master League I')],
            players: roster
        }));

        expect(result.suggestions.flatMap(item => item.actions)
            .some(action => action.type === 'days')).toBe(false);
        expect(result.optimized.clans[0].warnings).not.toContainEqual(expect.objectContaining({
            code: 'incomplete_day'
        }));
    });

    it('suggests a local role swap only when the improvement is meaningful', () => {
        const roster = playersForClan('alpha', 16, { equalScores: true })
            .map((player, index) => ({
                ...player,
                currentRole: index < 15 ? 'core' : 'reserve'
            }));
        roster[0].performance.performance = 45;
        roster[0].performance.reliability = 55;
        roster[15].performance.performance = 125;
        roster[15].performance.reliability = 99;

        const result = buildOptimizePlan(planInput({
            clans: [clan('alpha', '#ALPHA', 'Master League I')],
            players: roster
        }));

        expect(result.suggestions).toContainEqual(expect.objectContaining({
            type: 'role-swap',
            actions: expect.arrayContaining([
                expect.objectContaining({ playerTag: '#P000', role: 'reserve' }),
                expect.objectContaining({ playerTag: '#P015', role: 'core' })
            ])
        }));
    });

    it('does not disturb a marginal role difference', () => {
        const roster = playersForClan('alpha', 16, { equalScores: true })
            .map((player, index) => ({
                ...player,
                currentRole: index === 14 ? 'reserve' : index < 15 ? 'core' : 'core'
            }));

        const result = buildOptimizePlan(planInput({
            clans: [clan('alpha', '#ALPHA', 'Champion League I')],
            players: roster
        }));

        expect(result.suggestions.some(item => item.type === 'role-swap')).toBe(false);
    });

    it('ignores legacy daily schedules after schedule editing was removed', () => {
        const roster = playersForClan('alpha', 16, { equalScores: true })
            .map((player, index) => {
                const rotation = index >= 14;
                return {
                    ...player,
                    currentRole: rotation ? 'rotation' : 'core',
                    hasPlannedDays: true,
                    plannedDays: rotation
                        ? index === 14 ? [1, 3, 5, 7] : [2, 4, 6]
                        : [1, 2, 3, 4, 5, 6, 7]
                };
            });
        const result = buildOptimizePlan(planInput({
            clans: [clan('alpha', '#ALPHA', 'Champion League I')],
            players: roster
        }));
        expect(result.suggestions.some(item => item.type === 'schedule-cleanup')).toBe(false);
        expect(result.suggestions.flatMap(item => item.actions)
            .some(action => action.type === 'days')).toBe(false);
        expect(result.optimized.metrics.lineupChanges).toBeUndefined();
    });

    it('applies only the suggestions selected by the user', () => {
        const alpha = playersForClan('alpha', 17).map((player, index) => ({
            ...player,
            currentRole: index < 15 ? 'core' : 'reserve'
        }));
        const result = buildOptimizePlan(planInput({
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                clan('beta', '#BETA', 'Crystal League I')
            ],
            players: [...alpha, ...playersForClan('beta', 14, { offset: 20 })]
        }));
        const unchanged = buildAcceptedOptimization(result, []);
        const applied = buildAcceptedOptimization(result, [result.suggestions[0].id]);

        expect(unchanged.state.clans.find(item => item.id === 'beta').players)
            .toHaveLength(14);
        expect(applied.state.clans.find(item => item.id === 'beta').players)
            .toHaveLength(15);
    });

    it('rejects an accepted suggestion that would break a complete minimum roster', () => {
        const result = buildOptimizePlan(planInput({
            clans: [clan('alpha', '#ALPHA', 'Master League I')],
            players: playersForClan('alpha', 15)
        }));
        const unsafeSuggestion = {
            id: 'unsafe-role-change',
            type: 'role-swap',
            clanIds: ['alpha'],
            actions: [{
                type: 'role',
                playerTag: '#P000',
                clanId: 'alpha',
                fromRole: 'core',
                role: 'reserve'
            }]
        };
        const accepted = buildAcceptedOptimization({
            ...result,
            suggestions: [unsafeSuggestion]
        }, [unsafeSuggestion.id]);

        expect(accepted.state.clans[0].players.filter(player => player.role !== 'reserve'))
            .toHaveLength(15);
        expect(accepted.state.clans[0].warnings).not.toContainEqual(expect.objectContaining({
            code: 'incomplete_roster'
        }));
    });

    it('is deterministic for the same plan input', () => {
        const input = planInput({
            clans: [
                clan('alpha', '#ALPHA', 'Master League I'),
                clan('beta', '#BETA', 'Crystal League I')
            ],
            players: [
                ...playersForClan('alpha', 17),
                ...playersForClan('beta', 14, { offset: 20 })
            ]
        });

        expect(buildOptimizePlan(structuredClone(input))).toEqual(buildOptimizePlan(input));
    });

    it('charges a higher stability cost for the same change in a higher league', () => {
        const action = [{
            type: 'role',
            playerTag: '#P000',
            clanId: 'target',
            fromRole: 'core',
            role: 'rotation'
        }];
        const championCost = calculateChangeCost(
            action,
            new Map([['target', clan('target', '#TARGET', 'Champion League I')]])
        );
        const goldCost = calculateChangeCost(
            action,
            new Map([['target', clan('target', '#TARGET', 'Gold League I')]])
        );

        expect(championCost).toBeGreaterThan(goldCost);
    });
});

function planInput({ clans, players, locks }) {
    return {
        rounds: 7,
        clans,
        players,
        locks: locks || {
            assignments: {},
            roles: {},
            reasons: {},
            startedClanIds: []
        }
    };
}

function playersForClan(clanId, count, options = {}) {
    const offset = options.offset || 0;
    return Array.from({ length: count }, (_, position) => {
        const index = offset + position;
        return {
            tag: `#P${String(index).padStart(3, '0')}`,
            name: `Player ${index}`,
            townHallLevel: index < 30 ? 17 : 16,
            currentClanId: clanId,
            currentRole: 'core',
            plannedDays: [],
            hasPlannedDays: false,
            availability: {
                state: 'yes',
                availableDays: [1, 2, 3, 4, 5, 6, 7]
            },
            performance: {
                status: 'ready',
                scope: 'CWL',
                performance: options.equalScores ? 100 : 118 - position,
                reliability: options.equalScores ? 95 : 99 - position * 0.5,
                avgStars: options.equalScores ? 2.5 : 2.8 - position * 0.02,
                attackCount: 14,
                sameThCount: 12,
                upHitCount: 1,
                downHitCount: 1,
                confidence: 'High',
                form: { delta: 0 }
            }
        };
    });
}

function clan(id, tag, league) {
    return { id, tag, name: id, league, capacity: 15 };
}
