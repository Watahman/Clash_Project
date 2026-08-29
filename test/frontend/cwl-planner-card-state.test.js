import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CWL remembered planner players', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        document.body.innerHTML = `
            <div id="cwl-available-players">
                <article class="cwl-player-article" data-planner-card="true"
                         data-player-tag="#HIGH" data-town-hall="17"
                         data-player-priority="HIGH">
                    <p class="cwl-player-name">High priority</p>
                    <p class="cwl-player-clan">North</p>
                    <p class="cwl-player-hashtag">#HIGH</p>
                </article>
                <article class="cwl-player-article" data-planner-card="true"
                         data-player-tag="#DEFAULT" data-town-hall="16">
                    <p class="cwl-player-name">Default priority</p>
                    <p class="cwl-player-clan">South</p>
                    <p class="cwl-player-hashtag">#DEFAULT</p>
                </article>
            </div>`;
    });

    it('keeps the legacy cache only when planner auth is not configured', async () => {
        const { rememberPlannerPlayers } = await import(
            '../../src/assets/js/cwl/cwl-planner-card-state.js?v=20260829-public-auth-v1'
        );

        rememberPlannerPlayers();

        expect(JSON.parse(localStorage.getItem('clashtools_last_planner_players')))
            .toEqual([
                expect.objectContaining({ tag: '#HIGH', playerPriority: 'high' }),
                expect.objectContaining({ tag: '#DEFAULT', playerPriority: 'normal' })
            ]);
    });

    it('namespaces remembered players for the authenticated planner account', async () => {
        const { configureGuestPlanner } = await import(
            '../../src/assets/js/cwl/cwl-planner-guest-storage.js?v=20260829-public-auth-v1'
        );
        configureGuestPlanner({
            authState: { status: 'authenticated', session: { user: { id: 'user-a' } } }
        });
        const { rememberPlannerPlayers } = await import(
            '../../src/assets/js/cwl/cwl-planner-card-state.js?v=20260829-public-auth-v1'
        );

        rememberPlannerPlayers();

        expect(JSON.parse(localStorage.getItem('clashpanel:planner:user-a:players')))
            .toEqual([
                expect.objectContaining({ tag: '#HIGH', playerPriority: 'high' }),
                expect.objectContaining({ tag: '#DEFAULT', playerPriority: 'normal' })
            ]);
        expect(localStorage.getItem('clashtools_last_planner_players')).toBeNull();
    });
});
