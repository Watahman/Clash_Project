import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const mocks = vi.hoisted(() => ({
    availability: { state: 'partial', availableDays: [1, 3, 5], rounds: 7 },
    savePlan: vi.fn()
}));

vi.mock('../../src/assets/js/cwl/cwl-availability.js', () => ({
    getPlayerAvailability: () => ({ ...mocks.availability })
}));
vi.mock('../../src/assets/js/cwl/cwl-player-controls.js', () => ({
    syncPlayerPlannedDays: (card, days) => {
        if (days.length) card.dataset.plannedDays = days.join(',');
        else delete card.dataset.plannedDays;
        return days;
    },
    syncPlayerRosterStatus: vi.fn()
}));
vi.mock('../../src/assets/js/cwl/cwl-planner-card-state.js', () => ({
    rememberPlannerPlayers: vi.fn(),
    updateAllPlayerCounters: vi.fn()
}));
vi.mock('../../src/assets/js/cwl/cwl-plan-io.js', () => ({ savePlan: mocks.savePlan }));
vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, values = {}) => Object.entries(values).reduce(
        (result, [name, value]) => result.replaceAll(`{${name}}`, value),
        ({
            'cwl.clan': 'Clan',
            'cwl.playersSub': 'Free roster',
            'cwl.addClanToPlan': 'Add a clan to this plan',
            'cwl.clansTitle': 'Clans',
            'autoPlan.dayShort': 'D{day}',
            'autoPlan.sevenDayPreview': '7-day lineup preview',
            'autoPlan.warningIncompleteDay': 'Day {day} is missing {missing} player(s).',
            'autoPlan.playsDay': '{player} is planned for day {day}',
            'cwl.notAvailableCwl': 'Not available for CWL',
            'cwl.partialAvailabilityTooltip': 'Available: day {available}. Not available: day {unavailable}'
        }[key] || key)
    )
}));

describe('CWL planner redesign surface', () => {
    beforeEach(() => {
        mocks.availability = { state: 'partial', availableDays: [1, 3, 5], rounds: 7 };
        mocks.savePlan.mockClear();
        document.body.innerHTML = `
            <main class="workspace-planner">
                <section id="cwl-mobile-planner-sequence">
                    <select id="cwl-mobile-clan-select"></select>
                    <select id="cwl-mobile-day-select"><option value="1">D1</option><option value="2">D2</option></select>
                    <div id="cwl-mobile-day-list"></div>
                </section>
                <article id="cwl-all-clans"></article>
            </main>`;
    });

    it('renders seven schedule targets and the same planned player in the mobile sequence', async () => {
        const clan = document.createElement('article');
        clan.className = 'cwl-clan-article';
        clan.id = 'clan-alpha';
        clan.dataset.clanName = 'Alpha';
        clan.innerHTML = '<div class="cwl-clan-player-list"></div>';
        const card = document.createElement('article');
        card.className = 'cwl-player-article';
        card.dataset.plannerCard = 'true';
        card.dataset.playerTag = '#PLAYER1';
        card.dataset.townHall = '17';
        card.dataset.plannedDays = '1,3';
        card.innerHTML = '<p class="cwl-player-name">Player One</p>';
        clan.querySelector('.cwl-clan-player-list').appendChild(card);
        document.querySelector('#cwl-all-clans').appendChild(clan);

        const { initPlannerSchedule } = await import(
            '../../src/assets/js/cwl/cwl-planner-schedule.js'
        );
        initPlannerSchedule();

        expect(clan.querySelectorAll('.cwl-day-column')).toHaveLength(7);
        expect(clan.querySelector('[data-day="1"] .cwl-day-player').textContent)
            .toContain('Player One');
        expect(document.querySelector('#cwl-mobile-day-list [data-mobile-player-tag="#PLAYER1"]'))
            .not.toBeNull();
    });

    it('rejects unavailable day drops before a player can be moved', async () => {
        const { getPlannerDayDropValidation } = await import(
            '../../src/assets/js/cwl/cwl-planner-schedule.js'
        );
        const card = document.createElement('article');
        card.dataset.playerTag = '#PLAYER1';
        const target = document.createElement('div');
        target.className = 'cwl-day-dropzone';
        target.dataset.day = '2';

        expect(getPlannerDayDropValidation(card, target)).toEqual({
            legal: false,
            reason: 'Available: day 1, 3, 5. Not available: day 2, 4, 6, 7'
        });
        target.dataset.day = '3';
        expect(getPlannerDayDropValidation(card, target)).toEqual({ legal: true, reason: '' });
    });

    it('opens the real player inspector from a keyboard-accessible card trigger', async () => {
        document.body.insertAdjacentHTML('beforeend', `
            <aside id="cwl-player-inspector" class="hidden" aria-hidden="true">
                <button id="cwl-player-inspector-close">Close</button>
                <div id="cwl-player-inspector-body"></div>
            </aside>
            <div id="cwl-player-inspector-backdrop" class="hidden"></div>`);
        const card = document.createElement('article');
        card.className = 'cwl-player-article';
        card.dataset.plannerCard = 'true';
        card.dataset.playerTag = '#PLAYER2';
        card.dataset.townHall = '16';
        card.innerHTML = '<div class="cwl-player-info" tabindex="0"><p class="cwl-player-name">Player Two</p></div>';
        document.body.appendChild(card);

        const { initPlayerInspector } = await import(
            '../../src/assets/js/cwl/cwl-player-inspector.js'
        );
        initPlayerInspector();
        card.querySelector('.cwl-player-info').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        expect(document.querySelector('#cwl-player-inspector').classList.contains('hidden')).toBe(false);
        expect(document.querySelector('#cwl-player-inspector-body').textContent).toContain('Player Two');
        document.querySelector('#cwl-player-inspector').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        expect(document.querySelector('#cwl-player-inspector').classList.contains('hidden')).toBe(true);
    });

    it('keeps the purpose-built mobile sequence and pool sheet as responsive contracts', () => {
        const css = readFileSync('src/assets/css/cwl-planner-redesign.css', 'utf8');
        const scheduleCss = readFileSync('src/assets/css/cwl-planner-schedule.css', 'utf8');
        expect(css).toContain('position: fixed;');
        expect(css).toContain('max-height: min(86dvh, 720px);');
        expect(css).toContain('.workspace-planner .cwl-mobile-planner-sequence { display: block; }');
        expect(scheduleCss).toContain('grid-template-columns: repeat(7, minmax(76px, 1fr));');
        expect(scheduleCss).toContain('min-height: 44px;');
    });

    it('keeps saved plans as stacked mobile records with an explicit delete dialog', () => {
        const css = readFileSync('src/assets/css/cwl-saved-plans.css', 'utf8');
        const html = readFileSync('src/subpages/cwl-planner-drafts.html', 'utf8');
        expect(css).toContain('@media (max-width: 760px)');
        expect(css).toContain('.saved-plans-page .drafts-table tbody,');
        expect(css).toContain('content: attr(data-label);');
        expect(html).toContain('id="saved-plan-delete-dialog"');
        expect(html).toContain('data-delete-confirm');
    });
});
