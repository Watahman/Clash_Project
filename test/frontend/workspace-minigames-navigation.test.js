import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { workspaceLocales } from '../../src/assets/js/i18n/workspace-locales.js';

describe('workspace Minigames navigation', () => {
    it('shows Minigames as a normal workspace link', () => {
        const shell = readFileSync(
            'src/assets/js/shell/workspace-shell.js',
            'utf8'
        );

        expect(shell).toContain("minigames: { key: 'nav.minigames'");
        expect(shell).toContain('<p data-player-progress-nav-section data-i18n="shell.progression">Progression</p>');
        expect(shell).toContain("navLink('minigames', '/minigames')");
        expect(shell).not.toContain("comingSoonNavItem('minigames')");
    });

    it.each(['en', 'nl', 'fr', 'de', 'es'])(
        'has a translated label for %s',
        language => {
            expect(workspaceLocales[language]['nav.minigames']).toBeTruthy();
        }
    );

    it('keeps Games, Achievements and Advanced Stats in one deterministic Player group', () => {
        const achievements = readFileSync('src/assets/js/shell/achievements-navigation.js', 'utf8');
        const advancedStats = readFileSync('src/assets/js/shell/advanced-stats-navigation.js', 'utf8');

        expect(achievements).toContain("navigation.querySelector('[data-workspace-nav=\"minigames\"]')");
        expect(advancedStats).toContain("navigation.querySelector('[data-player-progress-nav-section]')");
        expect(advancedStats).toContain("navigation.querySelector('[data-workspace-nav=\"achievements\"]')");
        expect(advancedStats).toContain("heading.dataset.i18n = 'shell.progression'");
    });
});
