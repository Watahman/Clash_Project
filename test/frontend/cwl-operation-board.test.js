import { beforeEach, describe, expect, it, vi } from 'vitest';

const clanApiMocks = vi.hoisted(() => ({
    getClanInfoRequest: vi.fn(),
    getClanMembersRequest: vi.fn(),
    getClanCurrentWarLeagueGroupRequest: vi.fn(),
    getClanWarLeagueWarRequest: vi.fn()
}));
const playerApiMocks = vi.hoisted(() => ({
    getPlayerBattleLogRequest: vi.fn(),
    getPlayerInfoRequest: vi.fn()
}));

vi.mock('../../src/assets/js/API/API-Clan.js', () => clanApiMocks);
vi.mock('../../src/assets/js/API/API-Clan.js?v=20260826-live-refresh', () => clanApiMocks);
vi.mock('../../src/assets/js/API/API-Player.js', () => playerApiMocks);

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
        'op.viewAttention': 'Aandacht nodig',
        'op.rank': 'Positie',
        'op.clan': 'Clan',
        'op.wins': 'Wins',
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
        'op.singleClanContext': 'Single clan',
        'op.cwlDayContext': `CWL Day ${values.day || ''}`,
        'op.syncedNow': 'Synced just now',
        'op.importedState': 'JSON geïmporteerd'
    })[key] || key
}));

describe('CWL Operation Board', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        clanApiMocks.getClanInfoRequest.mockResolvedValue({ tag: '#PQL', name: 'Belgian Warriors' });
        clanApiMocks.getClanMembersRequest.mockResolvedValue({ items: [] });
        clanApiMocks.getClanCurrentWarLeagueGroupRequest.mockResolvedValue({ state: 'inWar', rounds: [{ warTags: ['#0'] }] });
        clanApiMocks.getClanWarLeagueWarRequest.mockResolvedValue({});
        playerApiMocks.getPlayerInfoRequest.mockResolvedValue({});
        playerApiMocks.getPlayerBattleLogRequest.mockResolvedValue({});
        document.body.innerHTML = `
            <select id="op-plan-select"></select><select id="op-clan-select"></select>
            <button id="op-refresh"></button><button id="op-export"></button><button id="op-import-json"></button>
            <input id="op-import-file" type="file"><input id="op-standalone-clan-tag"><button id="op-standalone-load"></button>
            <span id="op-live-state"></span><span id="op-cwl-phase"></span><p id="op-help"></p><p id="op-board-context"></p>
            <nav id="op-board-tabs" hidden>
                <button data-op-tab="live" aria-controls="op-panel-live"></button>
                <button data-op-tab="league" aria-controls="op-panel-league"></button>
                <button data-op-tab="roster" aria-controls="op-panel-roster"></button>
                <button data-op-tab="bonuses" aria-controls="op-panel-bonuses"></button>
            </nav>
            <section id="op-panel-live" hidden><div id="op-live-content"></div></section>
            <section id="op-panel-league" hidden></section><section id="op-panel-roster" hidden></section><section id="op-panel-bonuses" hidden></section>
            <strong id="op-current-position"></strong><strong id="op-projected-finish"></strong><small id="op-finish-probabilities"></small><strong id="op-completed-rounds"></strong><strong id="op-record"></strong>
            <div id="op-rounds-list"></div><span id="op-round-state"></span><span id="op-round-count"></span>
            <div id="op-stars-chart"></div><span id="op-stars-chart-state"></span>
            <div id="op-position-chart"></div><span id="op-position-chart-state"></span>
            <span id="op-standings-state"></span><div id="op-standings-list"></div><p id="op-standings-note"></p>
            <span id="op-roster-count"></span><table><thead><tr><th>Player</th><th>TH</th><th data-op-roster-column="planning">Planning</th><th>Attacks</th><th>Stars</th><th>Avg. destruction</th><th>Missed</th></tr></thead><tbody id="op-roster-body"></tbody></table><input id="op-roster-filter"><select id="op-roster-view"></select>
            <ol id="op-bonus-list"></ol>`;
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

        expect(document.querySelectorAll(
            '#op-standings-list .op-standing-row:not(.op-standing-header)'
        )).toHaveLength(4);
        expect(document.querySelector('#op-standings-list .is-selected strong').textContent).toBe('Belgian Warriors');
        expect(document.querySelector('#op-current-position').textContent).toBe('#2');
        expect(document.querySelector('#op-completed-rounds').textContent).toBe('1/1');
        expect(document.querySelector('#op-record').textContent).toBe('1W · 0L · 0D');
        expect(document.querySelectorAll('#op-stars-chart .op-stars-point')).toHaveLength(1);
        expect(document.querySelectorAll('#op-stars-chart .op-stars-x-axis > span')).toHaveLength(7);
        expect(document.querySelectorAll('#op-position-chart .op-ranking-point')).toHaveLength(1);
        expect(document.querySelector('#op-position-chart-state').textContent).toBe('1/7 dagen');
        expect(document.querySelectorAll('#op-roster-body tr')).toHaveLength(2);
        expect(document.querySelector('#op-roster-body tr').dataset.performanceCard).toBe('true');
        expect(document.querySelector('#op-roster-body .cwl-player-info')).not.toBeNull();
        expect(document.querySelectorAll('#op-bonus-list li')).toHaveLength(1);
        expect(document.querySelector('#op-live-state').dataset.state).toBe('imported');
    });

    it('moves into history without showing a no-active-CWL error', async () => {
        const noCwlError = Object.assign(new Error('notFound'), { status: 404 });
        clanApiMocks.getClanCurrentWarLeagueGroupRequest.mockRejectedValueOnce(noCwlError);

        await import('../../src/assets/js/pages/cwl-operation-board.js');
        await vi.waitFor(() => expect(document.querySelector('#op-roster-body').children.length).toBe(1));

        document.querySelector('#op-standalone-clan-tag').value = '#PQL';
        document.querySelector('#op-standalone-load').click();

        await vi.waitFor(() =>
            expect(document.querySelector('#op-help').textContent)
                .toBe('Loading CWL history…')
        );
        expect(document.querySelector('#op-help').textContent)
            .not.toBe('Geen actieve CWL');
        expect(document.querySelector('#op-live-state').dataset.state).toBe('idle');
        expect(document.querySelector('#op-roster-count').textContent).toBe('0 spelers');
        expect(document.querySelectorAll('#op-roster-body .op-player-row')).toHaveLength(0);
        expect(clanApiMocks.getClanWarLeagueWarRequest).not.toHaveBeenCalled();
        expect(document.querySelector('#op-board-tabs').hidden).toBe(true);
    });

    it('hides planner-specific roster data for a directly loaded clan tag', async () => {
        clanApiMocks.getClanMembersRequest.mockResolvedValue({
            items: [{ tag: '#P0L', name: 'Emile', townHallLevel: 17 }]
        });

        await import('../../src/assets/js/pages/cwl-operation-board.js');
        await vi.waitFor(() => expect(document.querySelector('#op-roster-body').children.length).toBe(1));

        document.querySelector('#op-standalone-clan-tag').value = '#PQL';
        document.querySelector('#op-standalone-load').click();

        await vi.waitFor(() => expect(document.querySelectorAll('#op-roster-body .op-player-row')).toHaveLength(1));
        expect(document.querySelector('[data-op-roster-column="planning"]').hidden).toBe(true);
        expect(document.querySelector('[data-op-roster-column="war"]')).toBeNull();
        expect(document.querySelector('#op-roster-body .op-player-row').children).toHaveLength(6);
        expect(document.querySelector('#op-board-context').textContent).toContain('Single clan');
        expect(Array.from(document.querySelector('#op-roster-view').options).map(option => option.value)).not.toContain('planned');
        expect(Array.from(document.querySelector('#op-roster-view').options).map(option => option.value)).not.toContain('unplanned');
        expect(document.querySelector('[data-op-tab="roster"]').getAttribute('aria-selected')).toBe('true');

        const leagueCalls = clanApiMocks.getClanCurrentWarLeagueGroupRequest.mock.calls.length;
        document.querySelector('[data-op-tab="bonuses"]').click();
        expect(document.querySelector('[data-op-tab="bonuses"]').getAttribute('aria-selected')).toBe('true');
        expect(document.querySelector('#op-panel-bonuses').hidden).toBe(false);
        expect(document.querySelector('#op-panel-roster').hidden).toBe(true);
        expect(clanApiMocks.getClanCurrentWarLeagueGroupRequest).toHaveBeenCalledTimes(leagueCalls);

        document.querySelector('#op-refresh').click();
        await vi.waitFor(() =>
            expect(clanApiMocks.getClanCurrentWarLeagueGroupRequest)
                .toHaveBeenCalledTimes(leagueCalls + 1)
        );
        await vi.waitFor(() =>
            expect(document.querySelector('#op-board-tabs').hidden).toBe(false)
        );
        expect(document.querySelector('[data-op-tab="bonuses"]').getAttribute('aria-selected')).toBe('true');
    });

    it('keeps the newest clan report when an earlier request finishes later', async () => {
        let resolveFirstGroup;
        clanApiMocks.getClanInfoRequest.mockImplementation(tag => Promise.resolve({
            tag,
            name: tag === '#PQL' ? 'First Clan' : 'Second Clan'
        }));
        clanApiMocks.getClanMembersRequest.mockImplementation(tag => Promise.resolve({
            items: [{
                tag: tag === '#PQL' ? '#P2Y' : '#P0L',
                name: tag === '#PQL' ? 'First Player' : 'Second Player',
                townHallLevel: 17
            }]
        }));
        clanApiMocks.getClanCurrentWarLeagueGroupRequest
            .mockImplementationOnce(() => new Promise(resolve => {
                resolveFirstGroup = resolve;
            }))
            .mockResolvedValueOnce({ state: 'inWar', rounds: [{ warTags: ['#0'] }] });

        await import('../../src/assets/js/pages/cwl-operation-board.js');
        await vi.waitFor(() => expect(document.querySelector('#op-roster-body').children.length).toBe(1));

        const clanInput = document.querySelector('#op-standalone-clan-tag');
        clanInput.value = '#PQL';
        document.querySelector('#op-standalone-load').click();
        await vi.waitFor(() => expect(clanApiMocks.getClanCurrentWarLeagueGroupRequest).toHaveBeenCalledTimes(1));

        clanInput.value = '#P0L';
        document.querySelector('#op-standalone-load').click();
        await vi.waitFor(() => expect(document.querySelector('#op-roster-body').textContent).toContain('Second Player'));

        resolveFirstGroup({ state: 'inWar', rounds: [{ warTags: ['#0'] }] });
        await vi.waitFor(() => expect(document.querySelector('#op-live-state').dataset.state).toBe('ready'));

        expect(document.querySelector('#op-roster-body').textContent).toContain('Second Player');
        expect(document.querySelector('#op-roster-body').textContent).not.toContain('First Player');
    });

});
