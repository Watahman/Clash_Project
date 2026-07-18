import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/assets/js/profile/profile_popup.js', () => ({ profileHTML: vi.fn() }));
vi.mock('../../src/assets/js/auth/auth-client.js', () => ({ syncAuthSession: vi.fn().mockResolvedValue(null) }));
vi.mock('../../src/assets/js/utils/user.js', () => ({ getCurrentUserId: () => null }));
vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    initI18n: vi.fn(),
    t: (key, values = {}) => ({
        'groups.login': 'Log in',
        'op.selectPlanFirst': 'Kies eerst een plan',
        'op.stateUnknown': 'Onbekend',
        'op.stateNotAvailable': 'Niet beschikbaar',
        'op.noPlayedRounds': 'Geen gespeelde rondes',
        'op.roundsShort': 'rondes',
        'op.liveLoaded': 'Live geladen',
        'op.players': 'spelers',
        'op.viewAll': 'Alles',
        'op.viewPlanned': 'Gepland',
        'op.viewUnplanned': 'Niet gepland',
        'op.viewMissed': 'Gemist',
        'op.day': 'Dag',
        'op.dayShort': 'D',
        'op.starsChartLabel': 'Sterren per dag',
        'op.chartDaysAvailable': `${values.count || 0}/${values.total || 7} dagen`,
        'op.starsChartPoint': `Dag ${values.day}: ${values.stars} sterren tegen ${values.opponent}`,
        'op.destruction': 'destruction',
        'op.chartOpponent': `Tegen ${values.opponent}`,
        'op.starsChartEmpty': 'Geen rondes',
        'op.chartDayEmpty': `Dag ${values.day}: geen data`,
        'op.chartDayValue': `Dag ${values.day}: ${values.stars} sterren`,
        'op.positionChartLabel': 'Positie per dag',
        'op.positionChartPoint': `Dag ${values.day}: positie ${values.rank}/${values.total}`,
        'op.chartCumulativeStars': `${values.stars} sterren cumulatief`,
        'op.positionChartEmpty': 'Geen complete dagstanden',
        'op.positionDayEmpty': `Dag ${values.day}: geen complete stand`,
        'op.positionDayValue': `Dag ${values.day}: positie ${values.rank}/${values.total}`,
        'op.standingsNote': `${values.count || 0} wars`,
        'op.planned': 'Gepland',
        'op.notPlanned': 'Niet gepland',
        'op.inAnyWar': 'In war',
        'op.notInWar': 'Niet in war',
        'op.unplannedParticipant': 'Niet gepland',
        'op.plannedOnly': 'Rotatie',
        'op.apiOnly': 'Bench',
        'op.ok': 'Klaar',
        'op.noRoster': 'Nog geen roster',
        'op.syncIdle': 'Nog niet gesynchroniseerd',
        'op.importedState': 'JSON geïmporteerd'
    })[key] || key
}));

describe('CWL Operation Board', () => {
    beforeEach(() => {
        vi.resetModules();
        document.body.innerHTML = `
            <select id="op-plan-select"></select><select id="op-clan-select"></select>
            <button id="op-refresh"></button><button id="op-export"></button><button id="op-import-json"></button>
            <input id="op-import-file" type="file"><input id="op-standalone-clan-tag"><button id="op-standalone-load"></button>
            <span id="op-live-state"></span><span id="op-cwl-phase"></span><p id="op-help"></p>
            <strong id="op-total-stars"></strong><strong id="op-avg-destruction"></strong>
            <strong id="op-attacks-used"></strong><strong id="op-missed-attacks"></strong><strong id="op-current-position"></strong>
            <div id="op-th-list"></div><div id="op-rounds-list"></div><span id="op-round-state"></span><span id="op-round-count"></span>
            <div id="op-stars-chart"></div><span id="op-stars-chart-state"></span>
            <div id="op-position-chart"></div><span id="op-position-chart-state"></span>
            <span id="op-standings-state"></span><div id="op-standings-list"></div><p id="op-standings-note"></p>
            <span id="op-roster-count"></span><table><tbody id="op-roster-body"></tbody></table><input id="op-roster-filter"><select id="op-roster-view"></select>
            <ol id="op-bonus-list"></ol><div class="profile-placeholder"></div>`;
    });

    it('renders imported live data with all standings rows and marks the own clan', async () => {
        const { applyImportedJson } = await import('../../src/assets/js/pages/cwl-operation-board.js');
        await vi.waitFor(() => expect(document.querySelector('#op-roster-body').children.length).toBe(1));

        applyImportedJson({
            clan: { tag: '#PQL', name: 'Belgian Warriors' },
            phase: 'live',
            wars: [{ id: 'war-1' }],
            rounds: [{ day: 1, state: 'completed', stateText: 'Afgerond', opponent: 'Northern Kings', stars: 33, destruction: 91.2, attacksUsed: 15, availableAttacks: 15, result: 'win' }],
            leagueGroup: {
                clans: [{ tag: '#PQL' }, { tag: '#AAA' }, { tag: '#BBB' }, { tag: '#CCC' }],
                rounds: [{ warTags: ['#WAR1', '#WAR2'] }, ...Array.from({ length: 6 }, () => ({ warTags: ['#0', '#0'] }))]
            },
            leagueWars: [
                { _round: 1, _warTag: '#WAR1', state: 'warEnded', clan: { tag: '#PQL', name: 'Belgian Warriors', stars: 31, destructionPercentage: 91.2 }, opponent: { tag: '#AAA', name: 'Northern Kings', stars: 30, destructionPercentage: 90.1 } },
                { _round: 1, _warTag: '#WAR2', state: 'warEnded', clan: { tag: '#BBB', name: 'Les Titans', stars: 33, destructionPercentage: 92.1 }, opponent: { tag: '#CCC', name: 'Nordic Force', stars: 27, destructionPercentage: 86.4 } }
            ],
            roster: [
                { tag: '#P001', name: 'Emile', townHall: 17, planned: true, warParticipant: true, attacksUsed: 2, availableAttacks: 2, stars: 6, destruction: 100, missed: 0, status: 'ok' },
                { tag: '#P002', name: 'Luna', townHall: 16, planned: true, warParticipant: false, attacksUsed: 0, availableAttacks: 0, stars: 0, destruction: 0, missed: 0, status: 'plannedOnly' }
            ],
            standings: {
                completedWars: 12,
                selectedIndex: 1,
                rows: [
                    { rank: 1, tag: '#AAA', name: 'Northern Kings', stars: 131, destruction: 94.1 },
                    { rank: 2, tag: '#PQL', name: 'Belgian Warriors', stars: 126, destruction: 92.4 },
                    { rank: 3, tag: '#BBB', name: 'Les Titans', stars: 122, destruction: 91.8 },
                    { rank: 4, tag: '#CCC', name: 'Nordic Force', stars: 118, destruction: 90.9 }
                ]
            }
        });

        expect(document.querySelectorAll('#op-standings-list .op-standing-row')).toHaveLength(4);
        expect(document.querySelector('#op-standings-list .is-selected strong').textContent).toBe('Belgian Warriors');
        expect(document.querySelector('#op-current-position').textContent).toBe('#2');
        expect(document.querySelector('#op-total-stars').textContent).toBe('33');
        expect(document.querySelectorAll('#op-stars-chart .op-stars-point')).toHaveLength(1);
        expect(document.querySelectorAll('#op-stars-chart .op-stars-x-axis > span')).toHaveLength(7);
        expect(document.querySelectorAll('#op-position-chart .op-ranking-point')).toHaveLength(1);
        expect(document.querySelector('#op-position-chart-state').textContent).toBe('1/7 dagen');
        expect(document.querySelectorAll('#op-roster-body tr')).toHaveLength(2);
        expect(document.querySelectorAll('#op-bonus-list li')).toHaveLength(2);
        expect(document.querySelector('#op-live-state').dataset.state).toBe('imported');
    });
});
