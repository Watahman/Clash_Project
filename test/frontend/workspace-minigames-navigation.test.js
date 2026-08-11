import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { workspaceLocales } from '../../src/assets/js/i18n/workspace-locales.js';

describe('workspace Minigames navigation', () => {
    it('shows Minigames as a normal workspace link', () => {
        const registry = readFileSync('src/assets/js/shell/module-registry.js', 'utf8');

        expect(registry).toContain("['minigames', 'nav.minigames', 'Games', 'play', '/minigames', true]");
        expect(registry).toContain("['advancedStats', 'nav.advancedStats'");
        expect(registry).toContain("['achievements', 'nav.achievements'");
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

        expect(registry).toContain("['minigames', 'nav.minigames', 'Games', 'play'");
        expect(registry).toContain("['advancedStats', 'nav.advancedStats', 'Advanced Stats', 'progress'");
        expect(registry).toContain("['achievements', 'nav.achievements', 'Achievements', 'progress'");
        expect(shell).toContain('getWorkspaceSections().map');
        expect(shell).not.toContain('MutationObserver');
    });
});
