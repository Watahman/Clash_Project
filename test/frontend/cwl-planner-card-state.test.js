import { beforeEach, describe, expect, it } from 'vitest';

describe('CWL remembered planner players', () => {
    beforeEach(() => {
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

    it('stores canonical player priorities in the legacy local cache', async () => {
        const { rememberPlannerPlayers } = await import(
            '../../src/assets/js/cwl/cwl-planner-card-state.js'
        );

        rememberPlannerPlayers();

        expect(JSON.parse(localStorage.getItem('clashtools_last_planner_players')))
            .toEqual([
                expect.objectContaining({ tag: '#HIGH', playerPriority: 'high' }),
                expect.objectContaining({ tag: '#DEFAULT', playerPriority: 'normal' })
            ]);
    });
});
