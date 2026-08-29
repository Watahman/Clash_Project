import { describe, expect, it } from 'vitest';
import { renderPlayerRow } from '../../src/assets/js/operation-board/operation-board-roster-row-renderer.js?v=20260829-public-auth-v1';
import { buildWarBoardReport } from '../../src/assets/js/war-operation-board/war-report-model.js?v=20260829-public-auth-v1';
import { renderScoreStrip } from '../../src/assets/js/war-operation-board/war-renderer.js?v=20260829-public-auth-v1';

describe('Compete renderer safety', () => {
    it('escapes roster names and tags while keeping Town Hall assets local', () => {
        const row = renderPlayerRow(
            {
                name: '<img src=x onerror=alert(1)>',
                tag: '" onmouseover="alert(1)',
                townHall: 17,
                status: 'ok',
                planned: true
            },
            {
                attacksUsed: 1,
                availableAttacks: 2,
                stars: 2,
                destruction: 75,
                missed: 0,
                avgDefense: null
            },
            { mode: 'current' },
            false
        );

        expect(row.querySelector('[onerror], [onmouseover]')).toBeNull();
        expect(row.textContent).toContain('<img src=x onerror=alert(1)>');
        expect(row.querySelector('img.compete-townhall').getAttribute('src'))
            .toBe('/assets/game/town-halls/town-hall-17.webp');
    });

    it('rejects unsafe badge schemes and escapes API-provided clan names', () => {
        const report = buildWarBoardReport({
            state: 'warEnded',
            teamSize: 1,
            attacksPerMember: 1,
            clan: {
                tag: '#AAA',
                name: '<svg onload=alert(1)>',
                badgeUrl: 'javascript:alert(1)',
                stars: 1,
                destructionPercentage: 50,
                attacks: 0,
                members: [{ tag: '#P1', name: 'Player', townhallLevel: 17, mapPosition: 1, attacks: [] }]
            },
            opponent: {
                tag: '#BBB',
                name: 'Opponent',
                badgeUrl: '" onerror="alert(1)',
                stars: 0,
                destructionPercentage: 40,
                attacks: 0,
                members: [{ tag: '#E1', name: 'Enemy', townhallLevel: 16, mapPosition: 1, attacks: [] }]
            }
        }, '#AAA');
        const container = document.createElement('section');

        renderScoreStrip(container, report);

        expect(container.querySelector('script, svg, [onerror], [onload]')).toBeNull();
        expect(container.textContent).toContain('<svg onload=alert(1)>');
        expect(Array.from(container.querySelectorAll('img')).every(image =>
            !image.src.startsWith('javascript:')
        )).toBe(true);
    });
});
