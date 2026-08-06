import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Phase 2B minigames public page', () => {
    const page = readFileSync('src/minigames.html', 'utf8');
    const controller = readFileSync('src/assets/js/pages/minigames-phase2b.js', 'utf8');

    it('loads only the current phase 2B controller and layout extension', () => {
        expect(page).toContain('/assets/js/pages/minigames-phase2b.js');
        expect(page).toContain('/assets/css/minigames-phase2b.css');
        expect(page).not.toContain('src="/assets/js/pages/minigames.js"');
    });

    it('advertises the complete ten-category catalog', () => {
        expect(page).toContain('Ten fully playable knowledge categories.');
        [
            'Home Village troops',
            'Home Village spells',
            'Heroes',
            'Hero Pets',
            'Hero Equipment items',
            'Permanent defenses',
            'Resource buildings',
            'Army buildings',
            'Utility buildings',
            'Traps'
        ].forEach(label => expect(page).toContain(label));
    });

    it('keeps all five supported interface languages', () => {
        ['en:', 'nl:', 'de:', 'fr:', 'es:'].forEach(locale => {
            expect(controller).toContain(locale);
        });
        ['defenses', 'resourceBuildings', 'armyBuildings', 'utilityBuildings', 'traps'].forEach(category => {
            expect(controller).toContain(`${category}:`);
        });
    });
});
