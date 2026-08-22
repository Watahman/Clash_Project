import { describe, expect, it } from 'vitest';

import { buildLiveView } from '../../src/assets/js/operation-board/operation-board-live-model.js';

describe('Operation Board Live model', () => {
    it('selects the active round and derives score and remaining attacks', () => {
        const live = buildLiveView({
            clan: { tag: '#PQL', name: 'Belgian Warriors' },
            rounds: [{ day: 4, state: 'live', result: 'pending' }],
            wars: [{
                _round: 4,
                state: 'inWar',
                attacksPerMember: 1,
                clan: {
                    tag: '#PQL',
                    name: 'Belgian Warriors',
                    badgeUrls: { small: 'https://example.test/own.png' },
                    stars: 31,
                    destructionPercentage: 82.4,
                    attacks: 12,
                    members: Array.from({ length: 15 }, () => ({ attacks: [] }))
                },
                opponent: {
                    tag: '#AAA',
                    name: 'Northern Kings',
                    badgeUrls: { medium: 'https://example.test/opponent.png' },
                    stars: 30,
                    destructionPercentage: 83.1,
                    attacks: 13,
                    members: Array.from({ length: 15 }, () => ({ attacks: [] }))
                }
            }]
        });

        expect(live).toMatchObject({
            day: 4,
            state: 'live',
            own: {
                badgeUrl: 'https://example.test/own.png',
                stars: 31,
                attacksUsed: 12,
                availableAttacks: 15,
                remainingAttacks: 3
            },
            opponent: {
                name: 'Northern Kings',
                badgeUrl: 'https://example.test/opponent.png',
                stars: 30,
                remainingAttacks: 2
            }
        });
    });

    it('derives the final result from stars and destruction', () => {
        const live = buildLiveView({
            clan: { tag: '#PQL', name: 'Belgian Warriors' },
            rounds: [{ day: 7, state: 'completed' }],
            wars: [{
                _round: 7,
                state: 'warEnded',
                attacksPerMember: 1,
                clan: {
                    tag: '#PQL',
                    stars: 31,
                    destructionPercentage: 91.4,
                    attacks: 15,
                    members: Array.from({ length: 15 }, () => ({ attacks: [{}] }))
                },
                opponent: {
                    tag: '#AAA',
                    stars: 31,
                    destructionPercentage: 90.8,
                    attacks: 15,
                    members: Array.from({ length: 15 }, () => ({ attacks: [{}] }))
                }
            }]
        });

        expect(live).toMatchObject({
            state: 'completed',
            result: 'win',
            own: { remainingAttacks: 0 },
            opponent: { remainingAttacks: 0 }
        });
    });
});
