import { beforeEach, describe, expect, it, vi } from 'vitest';

const { savePlan } = vi.hoisted(() => ({ savePlan: vi.fn() }));

vi.mock('../../src/assets/js/cwl/cwl-plan-io.js', () => ({ savePlan }));
vi.mock('../../src/assets/js/cwl/cwl-availability.js', () => ({
    applyAvailabilityToCard: vi.fn()
}));
vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: (key, params = {}) => {
        let value = ({
            'cwl.clan': 'Clan',
            'cwl.deleteClan': 'Clan verwijderen',
            'cwl.removePlayer': 'Speler verwijderen',
            'cwl.movePlayer': 'Speler verplaatsen',
            'cwl.moveToAvailable': 'Beschikbaar',
            'cwl.noClan': 'Geen clan',
            'cwl.rosterStatus': 'Rol in CWL',
            'cwl.rosterCore': 'Kernspeler',
            'cwl.rosterRotation': 'Roulatiespeler',
            'cwl.rosterReserve': 'Reserve',
            'cwl.reserveCountOne': '+{count} reserve',
            'cwl.reserveCountMany': '+{count} reserves',
            'cwl.rosterCounterTitle': '{total} spelers: {active} actief voor {capacity} plaatsen, {reserve} reserve',
            'planner.format': 'Formaat'
        })[key] || key;
        Object.entries(params).forEach(([name, replacement]) => {
            value = value.replaceAll(`{${name}}`, replacement);
        });
        return value;
    }
}));

describe('CWL planner clan rows', () => {
    beforeEach(() => {
        savePlan.mockClear();
        localStorage.clear();
        document.body.innerHTML = `
            <div id="cwl-all-clans"></div>
            <div id="cwl-available-players"></div>
            <p id="cwl-total-player-amount">0</p>
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
                        <button class="cwl-delete-clan" type="button"><img alt=""></button>
                    </div>
                    <div class="cwl-clan-player-list"></div>
                </article>
            </template>`;
    });

    it('renders stacked clan metadata and persists a changed 15/30 capacity', async () => {
        const { createClanCard } = await import('../../src/assets/js/templates/CWLTemplates.js');
        createClanCard({
            tag: '#AAA111',
            name: 'North Guard',
            warLeague: { name: 'Master League I' }
        }, 15, 'north');

        const clan = document.querySelector('.cwl-clan-article');
        expect(clan.dataset.clanTag).toBe('#AAA111');
        expect(clan.querySelector('.cwl-clan-name').textContent).toBe('North Guard');
        expect(clan.querySelector('.cwl-clan-league').textContent).toContain('Master League I');
        expect(clan.querySelector('.cwl-amount-of-players-in-clan').textContent).toBe('0/15');

        const capacity = clan.querySelector('.cwl-clan-capacity');
        savePlan.mockClear();
        capacity.value = '30';
        capacity.dispatchEvent(new Event('change'));

        expect(clan.dataset.clanCapacity).toBe('30');
        expect(clan.querySelector('.cwl-amount-of-players-in-clan').textContent).toBe('0/30');
        expect(savePlan).toHaveBeenCalledOnce();
    });

    it('allows players beyond capacity and automatically marks overflow as reserve', async () => {
        const { createClanCard, createPlayerCard } = await import('../../src/assets/js/templates/CWLTemplates.js');
        createClanCard({ tag: '#AAA111', name: 'North Guard' }, 15, 'north');

        for (let index = 0; index < 16; index += 1) {
            createPlayerCard({
                tag: `#PLAYER${index}`,
                name: `Player ${index}`,
                townHallLevel: 17
            }, 'north');
        }

        const clan = document.querySelector('.cwl-clan-article');
        const players = clan.querySelectorAll('.cwl-player-article');
        expect(players).toHaveLength(16);
        expect(players[14].dataset.rosterStatus).toBe('core');
        expect(players[15].dataset.rosterStatus).toBe('reserve');
        expect(players[15].querySelector('.cwl-roster-status')?.value).toBe('reserve');
        expect(clan.querySelector('.cwl-amount-of-players-in-clan').textContent).toBe('15/15 · +1 reserve');

        const status = players[15].querySelector('.cwl-roster-status');
        status.value = 'rotation';
        status.dispatchEvent(new Event('change'));
        expect(players[15].dataset.rosterStatus).toBe('rotation');
        expect(clan.querySelector('.cwl-amount-of-players-in-clan').textContent).toBe('16/15');
    });

    it('only shows the roster role selector while a player is inside a clan', async () => {
        const { createPlayerCard } = await import('../../src/assets/js/templates/CWLTemplates.js');
        createPlayerCard({ tag: '#FREE1', name: 'Free player', townHallLevel: 16 }, null);

        const player = document.querySelector('#cwl-available-players .cwl-player-article');
        expect(player.querySelector('.cwl-roster-status')).toBeNull();
        expect(player.dataset.rosterStatus).toBeUndefined();
        expect(player.querySelector('.cwl-move-player')?.value).toBe('free');
    });

    it("keeps the move selector aligned with the player's current clan", async () => {
        const { createClanCard, createPlayerCard } = await import(
            '../../src/assets/js/templates/CWLTemplates.js'
        );
        const { syncPlayerRosterStatus } = await import(
            '../../src/assets/js/cwl/cwl-player-controls.js'
        );
        createClanCard({ tag: '#AAA111', name: 'North Guard' }, 15, 'north');
        createPlayerCard({ tag: '#FREE1', name: 'Free player', townHallLevel: 16 }, null);
        const player = document.querySelector('#cwl-available-players .cwl-player-article');
        const clanList = document.querySelector('#cwl-clan-template_north .cwl-clan-player-list');

        clanList.appendChild(player);
        syncPlayerRosterStatus(player);

        expect(player.querySelector('.cwl-move-player')?.value)
            .toBe('cwl-clan-template_north');

        document.querySelector('#cwl-available-players').appendChild(player);
        syncPlayerRosterStatus(player);
        expect(player.querySelector('.cwl-move-player')?.value).toBe('free');
    });

});
