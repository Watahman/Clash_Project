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
        expect(shell).toContain("navLink('minigames', '/minigames')");
        expect(shell).not.toContain("comingSoonNavItem('minigames')");
    });

    it.each(['en', 'nl', 'fr', 'de', 'es'])(
        'has a translated label for %s',
        language => {
            expect(workspaceLocales[language]['nav.minigames']).toBeTruthy();
        }
    );
});
