import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initWorkspaceGuidance } from '../../src/assets/js/shell/workspace-guidance.js?v=20260829-public-auth-v1';
import { initI18n } from '../../src/assets/js/i18n/i18n.js?v=20260829-public-auth-v1';

const guidanceCss = readFileSync(
    'src/assets/css/workspace-guidance.css',
    'utf8'
);

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
        expect(document.querySelector('.workspace-help-links')).toBeNull();

        const tabs = document.querySelectorAll('.workspace-help-tabs [role="tab"]');
        expect(tabs).toHaveLength(2);
        expect(tabs[0].textContent).toBe('This page');
        expect(tabs[1].textContent).toBe('Profile');
        tabs[1].click();
        expect(document.querySelector('#workspace-help-title')?.textContent).toBe('Your profile is useful too');
        expect(document.querySelectorAll('.workspace-help-list li')).toHaveLength(4);
        expect(document.querySelector('.workspace-help-list')?.textContent).toContain('Add and verify');
    });

    it('keeps the dashboard guide aligned with Games, Achievements and Advanced Stats', () => {
        shell('dashboard', '<header class="workspace-page-header"><h1>Dashboard</h1><p>Intro</p></header>');

        initWorkspaceGuidance('dashboard');
        initI18n(document.body);
        document.querySelector('.workspace-page-help-trigger').click();

        const copy = document.querySelector('.workspace-help-list')?.textContent || '';
        expect(document.querySelectorAll('.workspace-help-list li')).toHaveLength(6);
        expect(copy).toContain('Games');
        expect(copy).toContain('Achievements');
        expect(copy).toContain('Advanced Stats');
    });

    it.each([
        ['achievements', '<header class="achievement-hero"><div class="achievement-hero-copy"><h1>Achievements</h1><p>Intro</p></div></header>', 'Understand your achievement progress', 'independent data'],
        ['advancedStats', '<header class="advanced-stats__hero"><div><h1>Advanced Stats</h1><p>Intro</p></div></header>', 'Build and review tracked attack history', 'eligible linked account']
    ])('provides accurate page help for %s', (page, content, title, expectedCopy) => {
        shell(page, content);

        initWorkspaceGuidance(page);
        initI18n(document.body);
        document.querySelector('.workspace-page-help-trigger').click();

        expect(document.querySelector('#workspace-help-title')?.textContent).toBe(title);
        expect(document.querySelectorAll('.workspace-help-list li')).toHaveLength(4);
        expect(document.querySelector('.workspace-help-intro')?.textContent).toContain(expectedCopy);
    });

    it('derives planner empty states from the real free and assigned rosters', () => {
        shell('planner', `
            <header class="cwl-page-header"><div><h1>July</h1><p>Intro</p></div></header>
            <span id="cwl-total-player-amount">3</span>
            <div id="cwl-available-players"><article class="cwl-player-article" data-planner-card="true"></article></div>
            <div id="cwl-all-clans"><article class="cwl-clan-article">
                <article class="cwl-player-article" data-planner-card="true"></article>
                <article class="cwl-player-article" data-planner-card="true"></article>
            </article></div>
            <button id="cwl-add-players-button"></button><button id="cwl-add-clan-button"></button>`);

        initWorkspaceGuidance('planner');

        expect(document.querySelector('#cwl-guidance-workflow')).toBeNull();
        expect(document.querySelector('#cwl-available-players .workspace-guidance-empty')).toBeNull();
        expect(document.querySelector('#cwl-all-clans .workspace-guidance-empty')).toBeNull();
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

    it('keeps saved-plan help concise without a trailing plan-limit line', () => {
        shell('drafts', `
            <header class="drafts-header"><div><h1>Saved plans</h1><p>Intro</p></div></header>`);

        initWorkspaceGuidance('drafts');
        initI18n(document.body);
        document.querySelector('.workspace-page-help-trigger').click();

        expect(document.querySelectorAll('.workspace-help-list li')).toHaveLength(2);
        expect(document.querySelector('.workspace-help-list')?.textContent).not.toContain('three plans');
    });

    it('isolates the help header from legacy page-wide header styles', () => {
        const isolatedHeader = guidanceCss.match(
            /body\.workspace-app \.workspace-help-drawer \.workspace-help-drawer-panel > header\s*\{([^}]+)}/
        )?.[1] || '';

        expect(isolatedHeader).toContain('position: static');
        expect(isolatedHeader).toContain('grid-template-columns: none');
        expect(isolatedHeader).toContain('height: auto');
        expect(isolatedHeader).toContain('padding: 0');
        expect(isolatedHeader).toContain('background: transparent');
        expect(isolatedHeader).toContain('backdrop-filter: none');
        expect(isolatedHeader).toContain('box-shadow: none');
    });

    it('does not query an empty selector for unknown workspace pages', () => {
        shell('unknown-page', '<main><h1>Unknown page</h1></main>');

        expect(() => initWorkspaceGuidance('unknown-page')).not.toThrow();
        expect(document.querySelector('#workspace-help-button')).toBeTruthy();
        expect(document.querySelector('.workspace-page-help-trigger')).toBeNull();
    });
});
