import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    savePlan: vi.fn(() => Promise.resolve({ id: 'saved' })),
    getClanCurrentWarLeagueGroupRequest: vi.fn()
}));

vi.mock('../../src/assets/js/cwl/cwl-plan-io.js', () => ({
    savePlan: mocks.savePlan
}));
vi.mock('../../src/assets/js/API/API-Clan.js', () => ({
    getClanCurrentWarLeagueGroupRequest: mocks.getClanCurrentWarLeagueGroupRequest
}));

describe('CWL Auto Plan source adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = `
            <p id="cwl-total-player-amount"></p>
            <div id="cwl-available-players">
                ${player('#FREE', 'Free')}
            </div>
            <div id="cwl-all-clans">
                <article class="cwl-clan-article" id="cwl-clan-template_alpha"
                         data-clan-tag="#ALPHA" data-clan-name="Alpha"
                         data-clan-capacity="15">
                    <select class="cwl-clan-capacity"><option selected>15</option></select>
                    <p class="cwl-amount-of-players-in-clan"></p>
                    <div class="cwl-clan-player-list">
                        ${player('#ASSIGNED', 'Assigned', 'core')}
                    </div>
                </article>
            </div>`;
        localStorage.clear();
    });

    it('locks registered CWL members to the clan roster returned by Clash', async () => {
        mocks.getClanCurrentWarLeagueGroupRequest.mockResolvedValue({
            state: 'inWar',
            clans: [{
                tag: '#ALPHA',
                members: [{ tag: '#FREE' }, { tag: '#ASSIGNED' }]
            }]
        });
        const { loadCwlRegistrationLocks } = await import(
            '../../src/assets/js/cwl/auto-plan/cwl-auto-plan-source.js'
        );

        const locks = await loadCwlRegistrationLocks([
            { id: 'alpha', tag: '#ALPHA' }
        ]);

        expect(locks.assignments).toEqual({
            '#ASSIGNED': 'alpha',
            '#FREE': 'alpha'
        });
        expect(locks.reasons['#FREE']).toBe('registered-cwl-roster');
        expect(locks.startedClanIds).toEqual(['alpha']);
    });

    it('applies roster placement and roles only after preview confirmation', async () => {
        const { applyAutoPlanResult } = await import(
            '../../src/assets/js/cwl/auto-plan/cwl-auto-plan-source.js'
        );

        await applyAutoPlanResult({
            mode: 'automatic',
            freePlayers: [{ tag: '#ASSIGNED' }],
            clans: [{
                id: 'alpha',
                players: [{
                    tag: '#FREE',
                    role: 'rotation'
                }]
            }]
        });

        const moved = document.querySelector(
            '#cwl-clan-template_alpha [data-player-tag="#FREE"]'
        );
        expect(moved?.dataset.rosterStatus).toBe('rotation');
        expect(moved?.dataset.plannedDays).toBeUndefined();
        expect(document.querySelector(
            '#cwl-available-players [data-player-tag="#ASSIGNED"]'
        )).not.toBeNull();
        expect(mocks.savePlan).toHaveBeenCalledOnce();
    });
});

function player(tag, name, role = '') {
    return `<article class="cwl-player-article" data-planner-card="true"
                     data-player-tag="${tag}" data-town-hall="17"
                     ${role ? `data-roster-status="${role}"` : ''}>
        <div class="cwl-player-info"><p class="cwl-player-name">${name}</p></div>
        <p class="cwl-player-clan"></p>
        <p class="cwl-player-hashtag">${tag}</p>
    </article>`;
}
