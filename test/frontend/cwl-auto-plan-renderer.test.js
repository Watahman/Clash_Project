import { beforeEach, describe, expect, it } from 'vitest';
import { renderAutoPlanPreview } from '../../src/assets/js/cwl/auto-plan/cwl-auto-plan-renderer.js';

describe('CWL Auto Plan preview', () => {
    beforeEach(() => {
        localStorage.setItem('clashtools_language', 'en');
        document.body.innerHTML = '<div id="preview"></div>';
    });

    it('renders readiness, role totals and all seven daily decisions', () => {
        const result = previewResult('automatic');
        renderAutoPlanPreview({
            container: document.querySelector('#preview'),
            result,
            guidedOverrides: new Map(),
            registrationReasons: {}
        });

        expect(document.querySelector('.cwl-auto-plan-clan-heading').textContent)
            .toContain('Alpha · Master League I');
        expect(document.querySelector('.cwl-auto-plan-readiness').textContent)
            .toContain('Good');
        expect(document.querySelectorAll('thead th')).toHaveLength(9);
        expect(document.querySelectorAll('tbody .is-planned')).toHaveLength(7);
        expect(document.querySelector('.cwl-auto-plan-changes').textContent)
            .toContain('Player One');
    });

    it('does not offer a spun-CWL player as a Guided replacement', () => {
        const result = previewResult('guided');
        result.clans[0].players.push({
            ...result.clans[0].players[0],
            tag: '#LOCKED',
            name: 'Locked player',
            role: 'reserve',
            plannedDays: []
        });
        result.freePlayers = [{ tag: '#FREE', name: 'Free player' }];

        renderAutoPlanPreview({
            container: document.querySelector('#preview'),
            result,
            guidedOverrides: new Map(),
            registrationReasons: { '#LOCKED': 'registered-cwl-roster' }
        });

        const replaceOptions = Array.from(
            document.querySelector('[data-auto-swap-out]').options
        ).map(option => option.value);
        expect(replaceOptions).toEqual(['#ONE']);
        expect(document.querySelector('[data-auto-swap-in]').value).toBe('#FREE');
    });

    it('separates active clans from clans that are not used', () => {
        const result = previewResult('automatic');
        result.totalClanCount = 2;
        result.clans.push({
            id: 'beta',
            tag: '#BETA',
            name: 'Beta',
            league: 'Crystal League I',
            capacity: 15,
            status: 'not-used',
            reasonCode: 'not_enough_remaining_players',
            players: [],
            lineups: [],
            warnings: []
        });

        renderAutoPlanPreview({
            container: document.querySelector('#preview'),
            result,
            guidedOverrides: new Map(),
            registrationReasons: {}
        });

        expect(document.querySelector('.cwl-auto-plan-fill-summary').textContent)
            .toBe('1 of 2 clans can be filled properly');
        expect(document.querySelector('.cwl-auto-plan-group.is-active').textContent)
            .toContain('Active');
        expect(document.querySelector('.cwl-auto-plan-group.is-unused').textContent)
            .toContain('Not used');
        expect(document.querySelector('.cwl-auto-plan-unused-clan').textContent)
            .toContain('Not enough remaining players');
        expect(document.querySelectorAll('.cwl-auto-plan-clan')).toHaveLength(1);
    });
});

function previewResult(mode) {
    return {
        mode,
        rounds: 7,
        warnings: [],
        activeCount: 1,
        totalClanCount: 1,
        freePlayers: [],
        changes: [{
            playerTag: '#ONE',
            playerName: 'Player One',
            toClanName: 'Alpha',
            role: 'core'
        }],
        clans: [{
            id: 'alpha',
            tag: '#ALPHA',
            name: 'Alpha',
            league: 'Master League I',
            capacity: 15,
            status: 'active',
            lineupChanges: 0,
            warnings: [],
            readiness: {
                status: 'good',
                label: 'Good',
                explanation: 'Ready.',
                expectedPerRound: 35.1,
                reliability: 96
            },
            players: [{
                tag: '#ONE',
                name: 'Player One',
                role: 'core',
                plannedDays: [1, 2, 3, 4, 5, 6, 7]
            }]
        }]
    };
}
