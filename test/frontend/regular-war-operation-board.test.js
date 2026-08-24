import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    ActiveCwlWarError,
    buildWarBoardReport,
    currentWarPlayerContext
} from '../../src/assets/js/war-operation-board/war-report-model.js';
import { buildWarContributions } from '../../src/assets/js/war-operation-board/war-contribution.js';
import { buildWarMap } from '../../src/assets/js/war-operation-board/war-map-model.js';
import { buildMathematicalWarStatus } from '../../src/assets/js/war-operation-board/war-outcome-model.js';
import { applyCwlPredictions } from '../../src/assets/js/cwl/cwl-performance-prediction.js';

describe('regular Clan War operation board', () => {
    it('exposes the verified engine through the central canonical route', () => {
        const registry = readFileSync('src/assets/js/shell/module-registry.js', 'utf8');
        const routes = readFileSync('worker/app-routes.js', 'utf8');
        expect(registry).toContain("['warOperation', 'nav.warOperation', 'War Board', 'compete', '/app/war-board', true]");
        expect(routes).toContain('["/app/war-board", "/subpages/war-operation-board"]');
        expect(routes).toContain('["/app/war-operation-board", "/app/war-board"]');
    });

    it('normalizes the selected clan and calculates net stars in attack order', () => {
        const report = buildWarBoardReport(warFixture(), '#AAA');
        const contributions = buildWarContributions(report);
        const first = contributions.find(player => player.tag === '#P1');
        const second = contributions.find(player => player.tag === '#P2');

        expect(report.kind).toBe('regular-war');
        expect(report.clan.name).toBe('Own clan');
        expect(report.roster.map(player => player.name)).toEqual(['Alpha', 'Bravo']);
        expect(first.netStars).toBe(2);
        expect(second.netStars).toBe(1);
    });

    it('keeps missed attacks hidden until the regular war has ended', () => {
        const live = buildWarBoardReport(warFixture(), '#AAA');
        const ended = buildWarBoardReport({
            ...warFixture(),
            state: 'warEnded'
        }, '#AAA');

        expect(currentWarPlayerContext(live, '#P1').missed).toBeNull();
        expect(currentWarPlayerContext(ended, '#P1').missed).toBe(1);
    });

    it('uses per-base remaining star potential for the mathematical status', () => {
        const report = buildWarBoardReport(warFixture(), '#AAA');
        const status = buildMathematicalWarStatus(report);

        expect(status.ownPotential).toBe(3);
        expect(status.opponentPotential).toBe(4);
        expect(status.status).toBe('open');
    });

    it('builds both live map sides from the selected clan perspective', () => {
        const report = buildWarBoardReport(warFixture(), '#AAA');
        const ownBases = buildWarMap(report, 'own');
        const enemyBases = buildWarMap(report, 'enemy');

        expect(ownBases[0].name).toBe('Alpha');
        expect(ownBases[0].attacks[0].attackerName).toBe('Enemy one');
        expect(enemyBases[0].name).toBe('Enemy one');
        expect(enemyBases[0].attacks[0].attackerName).toBe('Alpha');
    });

    it('rejects a CWL war instead of leaking it into the regular-war board', () => {
        expect(() => buildWarBoardReport({
            ...warFixture(),
            tag: '#CWLWAR'
        }, '#AAA')).toThrow(ActiveCwlWarError);
    });

    it('can enrich a regular-war report without a missing matchup helper', () => {
        const report = buildWarBoardReport(warFixture(), '#AAA');
        const enriched = applyCwlPredictions(report, new Map());

        expect(enriched.predictionState).toBe('ready');
        expect(enriched.roster).toHaveLength(2);
    });
});

function warFixture() {
    return {
        state: 'inWar',
        teamSize: 2,
        attacksPerMember: 2,
        preparationStartTime: '20990101T000000.000Z',
        startTime: '20990102T000000.000Z',
        endTime: '20990103T000000.000Z',
        clan: {
            tag: '#AAA',
            name: 'Own clan',
            stars: 3,
            destructionPercentage: 75,
            attacks: 2,
            members: [
                {
                    tag: '#P1',
                    name: 'Alpha',
                    townhallLevel: 16,
                    mapPosition: 1,
                    attacks: [{
                        attackerTag: '#P1',
                        defenderTag: '#E1',
                        stars: 2,
                        destructionPercentage: 80,
                        order: 1
                    }]
                },
                {
                    tag: '#P2',
                    name: 'Bravo',
                    townhallLevel: 15,
                    mapPosition: 2,
                    attacks: [{
                        attackerTag: '#P2',
                        defenderTag: '#E1',
                        stars: 3,
                        destructionPercentage: 100,
                        order: 2
                    }]
                }
            ]
        },
        opponent: {
            tag: '#BBB',
            name: 'Opponent',
            stars: 2,
            destructionPercentage: 60,
            attacks: 1,
            members: [
                {
                    tag: '#E1',
                    name: 'Enemy one',
                    townhallLevel: 16,
                    mapPosition: 1,
                    attacks: [{
                        attackerTag: '#E1',
                        defenderTag: '#P1',
                        stars: 2,
                        destructionPercentage: 80,
                        order: 1
                    }]
                },
                {
                    tag: '#E2',
                    name: 'Enemy two',
                    townhallLevel: 15,
                    mapPosition: 2,
                    attacks: []
                }
            ]
        }
    };
}
