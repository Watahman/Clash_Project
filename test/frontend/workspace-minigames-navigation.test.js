import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { workspaceLocales } from '../../src/assets/js/i18n/workspace-locales.js?v=20260829-public-auth-v1';

describe('workspace Minigames navigation', () => {
    it('shows Minigames as a normal workspace link', () => {
        const registry = readFileSync('src/assets/js/shell/module-registry.js', 'utf8');
        const dashboard = readFileSync('src/subpages/dashboard.html', 'utf8');

        expect(registry).toContain("['minigames', 'nav.minigames', 'Minigames', 'play', '/app/minigames', true]");
        expect(dashboard).toContain('data-pillar="play" href="/app/minigames"');
        expect(registry).toContain("['advancedStats', 'nav.advancedStats'");
        expect(registry).toContain("['achievements', 'nav.achievements'");
        expect(registry).toContain("['advancedStats', 'nav.advancedStats', 'Advanced Stats', 'progress', '/app/advanced-stats', true, true]");
        expect(registry).toContain("['achievements', 'nav.achievements', 'Achievements', 'progress', '/app/achievements', true, true]");
    });

    it.each(['en', 'nl', 'fr', 'de', 'es'])(
        'has a translated label for %s',
        language => {
            expect(workspaceLocales[language]['nav.minigames']).toBeTruthy();
        }
    );

    it('keeps Games and Progress tools in deterministic registry sections', () => {
        const registry = readFileSync('src/assets/js/shell/module-registry.js', 'utf8');
        const shell = readFileSync('src/assets/js/shell/workspace-shell-markup.js', 'utf8');

        expect(registry).toContain("['minigames', 'nav.minigames', 'Minigames', 'play'");
        expect(registry).toContain("['minigames', 'nav.minigames', 'Minigames', 'play', '/app/minigames', true]");
        expect(registry).toContain("['advancedStats', 'nav.advancedStats', 'Advanced Stats', 'progress'");
        expect(registry).toContain("['achievements', 'nav.achievements', 'Achievements', 'progress'");
        expect(shell).toContain('workspace-nav-coming-soon');
        expect(shell).toContain('getWorkspaceSections().map');
        expect(shell).not.toContain('MutationObserver');
    });

    it('keeps the public hub and exposes the same game surface in the private shell', () => {
        const publicPage = readFileSync('src/minigames.html', 'utf8');
        const privatePage = readFileSync('src/subpages/minigames.html', 'utf8');
        const privateStyles = readFileSync('src/assets/css/workspace-minigames.css', 'utf8');
        const gameStyles = readFileSync('src/assets/css/minigames.css', 'utf8');

        expect(publicPage).toContain('class="public-site minigames-page"');
        expect(privatePage).toContain('class="workspace-app minigames-page" data-workspace-page="minigames"');
        expect(privatePage).toContain('<meta name="robots" content="noindex, nofollow">');
        [
            'data-minigame-select="entity"',
            'data-minigame-select="higher-lower"',
            'data-minigame-view="entity"',
            'data-minigame-view="higher-lower"',
            'data-higher-lower-game',
            'data-guess-form',
            'data-hl-choice="higher"'
        ].forEach(attribute => {
            expect(privatePage).toContain(attribute);
            expect(publicPage).toContain(attribute);
        });
        expect(privatePage).toContain('/assets/js/pages/minigames-hub.js?v=20260828-seo-links');
        expect(privatePage).toContain('/assets/js/pages/minigames-phase2b.js?v=20260814-entity-mode-fix');
        expect(privatePage).toContain('/assets/js/pages/higher-lower.js?v=20260814-metric-card-labels');
        expect(privatePage).toContain('minigames-entity-guesser.css?v=20260814-practice-picker');
        expect(privatePage).toContain('minigames.css?v=20260814-games-header-visible');
        expect(gameStyles).toContain('padding-block: 3rem 3rem');
        expect(privateStyles).toContain('padding-block-start: 1.25rem');
        expect(privatePage).not.toContain('class="public-header"');
    });
});
