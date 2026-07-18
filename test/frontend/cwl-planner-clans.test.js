import { beforeEach, describe, expect, it, vi } from 'vitest';

const { savePlan } = vi.hoisted(() => ({ savePlan: vi.fn() }));

vi.mock('../../src/assets/js/cwl/cwl-plan-io.js', () => ({ savePlan }));
vi.mock('../../src/assets/js/i18n/i18n.js', () => ({
    t: key => ({
        'cwl.clan': 'Clan',
        'cwl.deleteClan': 'Clan verwijderen',
        'planner.format': 'Formaat'
    })[key] || key
}));

describe('CWL planner clan rows', () => {
    beforeEach(() => {
        savePlan.mockClear();
        localStorage.clear();
        document.body.innerHTML = `
            <div id="cwl-all-clans"></div>
            <div id="cwl-available-players"></div>
            <p id="cwl-total-player-amount">0</p>
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
});
