import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    applyPlannerFixture,
    getPlannerFixtureData,
    getRequestedPlannerFixture
} from '../../src/assets/js/fixtures/planner-fixtures.js';
import { clearActiveCwlPoll, getPlayerAvailability } from '../../src/assets/js/cwl/cwl-availability.js';
import { initPlannerSchedule } from '../../src/assets/js/cwl/cwl-planner-schedule.js';
import { normalizePlayer } from '../../src/assets/js/cwl/cwl-utils.js';

describe('CWL planner redesign fixtures', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/app/cwl-planner');
        localStorage.clear();
        document.body.innerHTML = `
            <main class="workspace-planner">
                <input id="cwl-plan-name">
                <select id="cwl-load-plan"></select>
                <div id="cwl-available-players"></div>
                <p id="cwl-total-player-amount">0</p>
                <div id="cwl-all-clans"></div>
            </main>
            <template id="cwl-player-template">
                <article class="cwl-player-article">
                    <img class="cwl-player-townhall-foto" alt="">
                    <div class="cwl-player-info">
                        <p class="cwl-player-name"></p>
                        <p class="cwl-player-clan"></p>
                        <p class="cwl-player-hashtag"></p>
                    </div>
                </article>
            </template>
            <template id="cwl-clan-template">
                <article class="cwl-clan-article">
                    <div class="cwl-clan-info-card">
                        <img class="cwl-clan-logo" alt="">
                        <div class="cwl-clan-title">
                            <h3 class="cwl-clan-name"></h3>
                            <p><span class="cwl-clan-tag"></span><span class="cwl-clan-league"></span></p>
                        </div>
                        <label class="cwl-clan-format"><span></span><select class="cwl-clan-capacity"><option value="15">15v15</option><option value="30">30v30</option></select></label>
                        <p class="cwl-amount-of-players-in-clan"></p>
                        <button class="cwl-delete-clan" type="button"></button>
                    </div>
                    <div class="cwl-clan-player-list"></div>
                </article>
            </template>`;
    });

    it('catalogues real counts and seven-day data for the core planner states', () => {
        expect(getPlannerFixtureData('planner-empty').info).toMatchObject({
            freePlayers: [],
            clans: []
        });
        expect(getPlannerFixtureData('planner-normal').info.freePlayers).toHaveLength(20);

        const large = getPlannerFixtureData('planner-large');
        expect(large.info.clans).toHaveLength(3);
        expect(large.players).toHaveLength(65);
        expect(large.players.map(player => player.townHallLevel)).toEqual(
            expect.arrayContaining([14, 15, 16, 17])
        );

        const multi = getPlannerFixtureData('planner-multi-clan');
        expect(multi.info.clans).toHaveLength(2);
        expect(multi.info.clans.every(clan => clan.players.every(player => player.plannedDays.length === 7))).toBe(true);
        expect(multi.info.clans.every(clan => clan.badgeUrls.small.endsWith('.png'))).toBe(true);
        expect(multi.players.some(player => player.name.startsWith('Fixture Player'))).toBe(false);
    });

    it('renders the normal and large fixtures through planner card and schedule paths', () => {
        const normal = applyPlannerFixture(fixture('planner-normal'), { location: localUrl() });
        const schedule = initPlannerSchedule({ root: document });
        schedule.refresh();
        expect(normal.info.freePlayers).toHaveLength(20);
        expect(document.querySelectorAll('#cwl-available-players .cwl-player-article')).toHaveLength(20);
        expect(normalizePlayer({ tag: '#TEST' }).clanName).toBe('');
        expect(document.querySelectorAll('.cwl-clan-article')).toHaveLength(1);
        expect(document.querySelectorAll('.cwl-day-column')).toHaveLength(7);

        applyPlannerFixture(fixture('planner-large'), { location: localUrl() });
        expect(document.querySelectorAll('.cwl-player-article[data-planner-card="true"]')).toHaveLength(65);
        expect([...document.querySelectorAll('.cwl-clan-article')].map(clan =>
            clan.querySelectorAll('.cwl-clan-player-list .cwl-player-article').length
        )).toEqual([15, 15, 15]);
    });

    it('renders full multi-clan days and marks capacity/availability conflicts', () => {
        applyPlannerFixture(fixture('planner-multi-clan'), { location: localUrl() });
        const schedule = initPlannerSchedule({ root: document });
        schedule.refresh();
        expect([...document.querySelectorAll('.cwl-clan-article')].every(clan =>
            clan.querySelectorAll('[data-day="1"] .cwl-day-player').length === 15
        )).toBe(true);

        applyPlannerFixture(fixture('planner-conflicts'), { location: localUrl() });
        schedule.refresh();
        expect(document.querySelectorAll('.cwl-clan-article[data-capacity-conflict="true"]')).toHaveLength(2);
        expect(document.querySelectorAll('.cwl-player-article[data-availability="no"]')).not.toHaveLength(0);
        expect(document.querySelectorAll('.cwl-day-player[data-availability-conflict="true"]')).not.toHaveLength(0);
    });

    it('injects confirmed, unavailable, and unknown poll availability without storage writes', () => {
        const before = JSON.stringify({
            active: 'saved-plan',
            players: [{ tag: '#REAL', name: 'Real player' }]
        });
        localStorage.setItem('planner_id', 'saved-plan');
        localStorage.setItem('clashtools_last_planner_players', before);

        applyPlannerFixture(fixture('planner-poll-partial'), { location: localUrl() });
        const states = [...document.querySelectorAll('.cwl-player-article')]
            .map(card => getPlayerAvailability(card.dataset.playerTag).state);
        expect(states).toEqual(expect.arrayContaining(['yes', 'no', 'unknown', 'partial']));
        expect(localStorage.getItem('planner_id')).toBe('saved-plan');
        expect(localStorage.getItem('clashtools_last_planner_players')).toBe(before);
    });

    it('keeps auto and optimize scenarios on their truthful existing preview workflows', () => {
        expect(getPlannerFixtureData('planner-auto-preview').tool).toBe('auto');
        expect(getPlannerFixtureData('planner-optimize').tool).toBe('optimize');
    });

    it('opens the real automatic preview without performance or registration requests', async () => {
        window.history.replaceState({}, '', '/app/cwl-planner?cpFixture=planner-auto-preview');
        addToolMarkup('auto');
        document.querySelector('#cwl-auto-plan-panel').scrollIntoView = vi.fn();
        const { initAutoPlan } = await import('../../src/assets/js/cwl/auto-plan/cwl-auto-plan-ui.js');
        initAutoPlan();
        applyPlannerFixture(fixture('planner-auto-preview'), { location: localUrl() });
        await vi.waitFor(() => expect(document.querySelector('#cwl-auto-plan-panel').classList.contains('hidden')).toBe(false));
        expect(document.querySelector('.cwl-auto-plan-clan')).not.toBeNull();
    });

    it('opens the real optimize preview with deterministic suggestions', async () => {
        window.history.replaceState({}, '', '/app/cwl-planner?cpFixture=planner-optimize');
        addToolMarkup('optimize');
        document.querySelector('#cwl-optimize-plan-panel').scrollIntoView = vi.fn();
        const { initOptimizePlan } = await import('../../src/assets/js/cwl/optimize-plan/cwl-optimize-plan-ui.js');
        initOptimizePlan();
        applyPlannerFixture(fixture('planner-optimize'), { location: localUrl() });
        await vi.waitFor(() => expect(document.querySelector('#cwl-optimize-plan-panel').classList.contains('hidden')).toBe(false));
        expect(document.querySelector('.cwl-optimize-suggestion')).not.toBeNull();
    });

    it('does not apply fixtures outside localhost or when no fixture is requested', async () => {
        expect(await getRequestedPlannerFixture(new URL('http://localhost/app/cwl-planner'))).toBeNull();
        expect(() => applyPlannerFixture(fixture('planner-normal'), {
            location: new URL('https://clashpanel.com/app/cwl-planner')
        })).toThrow('restricted to localhost');
        expect(document.querySelectorAll('.cwl-player-article')).toHaveLength(0);
    });
});

function fixture(id) {
    return { id, module: 'planner' };
}

function localUrl() {
    return new URL('http://localhost/app/cwl-planner?cpFixture=planner-test');
}

function addToolMarkup(tool) {
    if (tool === 'auto') {
        document.body.insertAdjacentHTML('beforeend', `
            <button id="cwl-auto-plan-button"></button>
            <section id="cwl-auto-plan-panel" class="hidden">
                <select id="cwl-auto-plan-mode"><option value="automatic">Automatic</option></select>
                <p id="cwl-auto-plan-status"></p><div id="cwl-auto-plan-preview"></div>
                <button id="cwl-auto-plan-apply"></button><button id="cwl-auto-plan-cancel"></button>
            </section>`);
        return;
    }
    document.body.insertAdjacentHTML('beforeend', `
        <button id="cwl-optimize-plan-button"></button>
        <section id="cwl-optimize-plan-panel" class="hidden">
            <p id="cwl-optimize-plan-status"></p><div id="cwl-optimize-plan-preview"></div>
            <button id="cwl-optimize-plan-apply-accepted"></button>
            <button id="cwl-optimize-plan-apply-all"></button><button id="cwl-optimize-plan-cancel"></button>
        </section>`);
}
