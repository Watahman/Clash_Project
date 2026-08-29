import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initPlannerSurface } from '../../src/assets/js/cwl/cwl-planner-ui.js?v=20260829-public-auth-v1';

describe('CWL planner redesign surface', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <main class="workspace-planner">
                <details data-cwl-tools-menu>
                    <summary>Tools</summary>
                    <div class="cwl-tools-menu-content"><button type="button">Auto plan</button></div>
                </details>
                <nav>
                    <button data-planner-mobile-view="players">Players</button>
                    <button data-planner-mobile-view="clans">Clans</button>
                </nav>
                <section class="cwl-planner-layout"></section>
                <article id="cwl-all-clans"></article>
            </main>
            <aside id="cwl-player-inspector" class="hidden" aria-hidden="true">
                <button id="cwl-player-inspector-close">Close</button>
                <div id="cwl-player-inspector-body"></div>
            </aside>
            <div id="cwl-player-inspector-backdrop" class="hidden"></div>`;
    });

    it('switches the compact planner between player and clan views', () => {
        initPlannerSurface({ root: document });
        const layout = document.querySelector('.cwl-planner-layout');
        const players = document.querySelector('[data-planner-mobile-view="players"]');
        const clans = document.querySelector('[data-planner-mobile-view="clans"]');

        expect(layout.dataset.mobileView).toBe('players');
        expect(players.getAttribute('aria-selected')).toBe('true');
        clans.click();
        expect(layout.dataset.mobileView).toBe('clans');
        expect(clans.getAttribute('aria-selected')).toBe('true');
        expect(players.getAttribute('aria-selected')).toBe('false');
    });

    it('closes the tools menu after selecting an action or pressing Escape', () => {
        initPlannerSurface({ root: document });
        const menu = document.querySelector('[data-cwl-tools-menu]');
        menu.open = true;
        menu.querySelector('button').click();
        expect(menu.open).toBe(false);

        menu.open = true;
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(menu.open).toBe(false);
        expect(document.activeElement).toBe(menu.querySelector('summary'));
    });

    it('opens the real player inspector from a keyboard-accessible card trigger', () => {
        const card = document.createElement('article');
        card.className = 'cwl-player-article';
        card.dataset.plannerCard = 'true';
        card.dataset.playerTag = '#PLAYER2';
        card.dataset.townHall = '16';
        card.innerHTML = '<div class="cwl-player-info" tabindex="0"><p class="cwl-player-name">Player Two</p></div>';
        document.body.appendChild(card);

        initPlannerSurface({ root: document });
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

    it('keeps the compact roster and inspector as responsive contracts', () => {
        const css = readFileSync('src/assets/css/cwl-planner-redesign.css', 'utf8');
        const rosterCss = readFileSync('src/assets/css/cwl-planner-roster.css', 'utf8');
        const drawerCss = readFileSync('src/assets/css/cwl-planner-drawers.css', 'utf8');
        const html = readFileSync('src/subpages/cwl-planner.html', 'utf8');

        expect(rosterCss.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(300);
        expect(css).toContain('.cwl-planner-layout');
        expect(rosterCss).toContain('scrollbar-gutter: stable;');
        expect(rosterCss).toContain('grid-template-columns: repeat(auto-fit');
        expect(html).toContain('data-planner-mobile-view="players"');
        expect(html).toContain('id="cwl-player-inspector"');
        expect(drawerCss).toContain('.cwl-player-inspector');
        expect(html).not.toContain('cwl-planner-schedule.css');
    });

    it('keeps planner priority labels refreshable and its changed graph cache-busted', () => {
        const planner = readFileSync('src/assets/js/pages/cwl-planner.js', 'utf8');
        const html = readFileSync('src/subpages/cwl-planner.html', 'utf8');
        expect(planner).toContain("window.addEventListener('clashtools:language-changed', refreshPlannerLabels);");
        expect(planner).toContain('refreshPlannerPriorityLabels();');
        expect(planner).toContain('cwl-priority-labels.js?v=20260829-public-auth-v1');
        const priorityLabels = readFileSync('src/assets/js/cwl/cwl-priority-labels.js', 'utf8');
        expect(priorityLabels).toContain('export function refreshPlannerPriorityLabels');
        expect(priorityLabels).toContain("select.setAttribute('aria-label', playerLabel)");
        expect(priorityLabels).toContain("select.setAttribute('aria-label', clanLabel)");
        expect(priorityLabels.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(300);

        const assets = [
            'cwl-planner-workspace.css',
            'cwl-player-card.css',
            'cwl-player-performance-popover.css',
            'cwl-planner-roster.css',
            'cwl-planner-roster-controls.css',
            'pages/cwl-planner.js'
        ];
        const versions = assets.map(asset => html.match(
            new RegExp(`${asset.replace('.', '\\.?')}\\?v=([^\\\"]+)`)
        )?.[1]).filter(Boolean);
        expect(versions).toHaveLength(assets.length);
        expect(versions).toEqual([
            '20260829-public-auth-v1',
            '20260828-cwl-planner-v2',
            '20260828-cwl-planner-v2',
            '20260828-cwl-planner-v2',
            '20260828-cwl-planner-v2',
            '20260829-public-auth-v1'
        ]);
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
