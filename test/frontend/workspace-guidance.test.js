import { beforeEach, describe, expect, it } from 'vitest';
import { initWorkspaceGuidance } from '../../src/assets/js/shell/workspace-guidance.js';
import { initI18n } from '../../src/assets/js/i18n/i18n.js';

function shell(page, content) {
    document.body.removeAttribute('data-guidance-ready');
    document.body.dataset.workspacePage = page;
    document.body.innerHTML = `
        <div class="workspace-top-actions"><div id="workspace-notifications-root"></div></div>
        ${content}`;
}

describe('workspace guidance', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.lang = 'en';
    });

    it('adds contextual help without changing workspace navigation', () => {
        shell('operation', `
            <header class="op-page-header"><div><h1>CWL Operation Board</h1><p>Intro</p></div></header>
            <section id="op-panel-live"></section>
            <section id="op-panel-league"></section>
            <section id="op-panel-roster"></section>
            <section id="op-panel-bonuses"></section>
            <section id="op-panel-summary"></section>`);

        initWorkspaceGuidance('operation');
        initI18n(document.body);

        expect(document.querySelector('#workspace-help-button')).toBeTruthy();
        expect(document.querySelector('.workspace-page-help-trigger')).toBeTruthy();
        expect(document.querySelector('#op-panel-live > .workspace-tab-description')?.textContent)
            .toContain('active matchup');
        document.querySelector('.workspace-page-help-trigger').click();
        expect(document.querySelector('#workspace-help-title')?.textContent).toBe('Follow a CWL');
        expect(document.querySelector('#workspace-help-drawer')?.hasAttribute('open')).toBe(true);
    });

    it('derives planner progress from the real roster, poll, lineups and saved-plan state', () => {
        localStorage.setItem('planner_id', 'plan-1');
        shell('planner', `
            <header class="cwl-page-header"><div><h1>July</h1><p>Intro</p></div></header>
            <span id="cwl-total-player-amount">3</span>
            <select id="cwl-roster-poll-select"><option value="poll-1" selected>July poll</option></select>
            <span id="cwl-save-status" data-state="idle">Saved</span>
            <div id="cwl-available-players"><article class="cwl-player-article" data-planner-card="true"></article></div>
            <div id="cwl-all-clans"><article class="cwl-clan-article">
                <article class="cwl-player-article" data-planner-card="true"></article>
                <article class="cwl-player-article" data-planner-card="true"></article>
            </article></div>
            <button id="cwl-add-players-button"></button><button id="cwl-add-clan-button"></button>`);

        initWorkspaceGuidance('planner');

        const workflow = document.querySelector('#cwl-guidance-workflow');
        expect(workflow.querySelector('[data-guidance-step="roster"]').classList).toContain('is-complete');
        expect(workflow.querySelector('[data-guidance-step="availability"]').classList).toContain('is-complete');
        expect(workflow.querySelector('[data-guidance-step="lineups"] small').textContent)
            .toBe('2 players assigned across 1 clans');
        expect(workflow.querySelector('[data-guidance-step="save"]').classList).toContain('is-complete');
    });

    it('uses Clan Family statistics for the setup checklist and collapses it when complete', () => {
        shell('groups', `
            <header class="groups-page-header"><div><h1>Clan Family</h1><p>Intro</p></div></header>
            <div id="groups-detail-content"></div>
            <span id="groups-inspector-clans">2</span>
            <span id="groups-inspector-accounts">7</span>
            <div id="groups-admin-polls-list"><div class="groups-admin-member"></div></div>
            <div id="groups-poll-notice" class="hidden"></div>`);

        initWorkspaceGuidance('groups');

        const checklist = document.querySelector('#groups-setup-checklist');
        expect(checklist.open).toBe(false);
        expect(checklist.querySelectorAll('li.is-complete')).toHaveLength(4);
        expect(checklist.querySelector('summary strong').textContent).toBe('Clan Family is ready');
    });
});
