import { describe, expect, it } from 'vitest';

import {
    buildWinCondition,
    possibleImprovements
} from '../../src/assets/js/operation-board/operation-board-win-condition.js';

describe('Operation Board win condition', () => {
    it('caps maximum star improvement at the best current result per base', () => {
        const outcomes = possibleImprovements([
            { bestStars: 2, bestDestruction: 80 },
            { bestStars: 3, bestDestruction: 100 },
            { bestStars: 1, bestDestruction: 65 }
        ], 1);

        expect(Math.max(...outcomes.map(outcome => outcome.stars))).toBe(2);
    });

    it('marks the current opponent score impossible when too few net stars remain', () => {
        const report = liveReport({
            ownStars: 28,
            opponentStars: 31,
            ownDestruction: 80,
            opponentDestruction: 83,
            targetBestStars: 2
        });

        const condition = buildWinCondition(report);

        expect(condition.state).toBe('trailing');
        expect(condition.maxStarImprovement).toBe(1);
        expect(condition.maxFinalStars).toBe(29);
        expect(condition.mathematicallyPossible).toBe(false);
        expect(condition.opponentCanRespond).toBe(true);
    });

    it('uses destruction as the tie-break requirement at equal stars', () => {
        const report = liveReport({
            ownStars: 31,
            opponentStars: 31,
            ownDestruction: 80,
            opponentDestruction: 82.6,
            targetBestStars: 2
        });

        const condition = buildWinCondition(report);

        expect(condition.requirement).toMatchObject({
            type: 'matchAndDestruction',
            matchStars: 31
        });
        expect(condition.requirement.destruction).toBeCloseTo(2.7);
        expect(condition.mathematicallyPossible).toBe(true);
    });
});

function liveReport({
    ownStars,
    opponentStars,
    ownDestruction,
    opponentDestruction,
    targetBestStars
}) {
    const ownMembers = [
        {
            tag: '#USED',
            mapPosition: 1,
            townhallLevel: 17,
            attacks: [{
                defenderTag: '#TARGET',
                stars: targetBestStars,
                destructionPercentage: 80
            }]
        },
        {
            tag: '#USED2',
            mapPosition: 2,
            townhallLevel: 17,
            attacks: [{
                defenderTag: '#CLOSED',
                stars: 3,
                destructionPercentage: 100
            }]
        },
        {
            tag: '#READY',
            mapPosition: 3,
            townhallLevel: 17,
            attacks: []
        }
    ];
    const opponentMembers = [
        {
            tag: '#TARGET',
            mapPosition: 1,
            townhallLevel: 17,
            attacks: [{
                defenderTag: '#USED',
                stars: 3,
                destructionPercentage: 100
            }]
        },
        {
            tag: '#CLOSED',
            mapPosition: 2,
            townhallLevel: 17,
            attacks: []
        }
    ];
    return {
        clan: { tag: '#SELF', name: 'ClashPanel' },
        rounds: [{ day: 4, state: 'live', result: 'pending' }],
        wars: [{
            _round: 4,
            state: 'inWar',
            attacksPerMember: 1,
            clan: {
                tag: '#SELF',
                name: 'ClashPanel',
                stars: ownStars,
                destructionPercentage: ownDestruction,
                attacks: 2,
                members: ownMembers
            },
            opponent: {
                tag: '#ENEMY',
                name: 'Enemy',
                stars: opponentStars,
                destructionPercentage: opponentDestruction,
                attacks: 1,
                members: opponentMembers
            }
        }]
    };
}
