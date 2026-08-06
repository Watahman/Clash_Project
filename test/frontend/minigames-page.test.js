import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ClashPanel minigames public page', () => {
    const page = readFileSync('src/minigames.html', 'utf8');
    const entityController = readFileSync('src/assets/js/pages/minigames-phase2b.js', 'utf8');
    const higherLowerController = readFileSync('src/assets/js/pages/higher-lower.js', 'utf8');
    const hubController = readFileSync('src/assets/js/pages/minigames-hub.js', 'utf8');

    it('loads the game hub, Entity Guesser and Higher or Lower controllers', () => {
        expect(page).toContain('/assets/js/pages/minigames-hub.js');
        expect(page).toContain('/assets/js/pages/minigames-phase2b.js');
        expect(page).toContain('/assets/js/pages/higher-lower.js');
        expect(page).toContain('/assets/css/minigames-higher-lower.css');
        expect(page).not.toContain('src="/assets/js/pages/minigames.js"');
    });

    it('contains two isolated, switchable game views', () => {
        expect(page).toContain('data-minigame-select="entity"');
        expect(page).toContain('data-minigame-select="higher-lower"');
        expect(page).toContain('data-minigame-view="entity"');
        expect(page).toContain('data-minigame-view="higher-lower"');
        expect(page).toContain('data-higher-lower-game');
        expect(hubController).toContain("url.searchParams.set('game', selected)");
        expect(hubController).toContain("url.searchParams.delete('game')");
    });

    it('advertises the complete shared ten-category catalog', () => {
        expect(page).toContain('Ten knowledge categories, reused across both games.');
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

    it('keeps all five supported interface languages in both games', () => {
        [
            "en:{daily:'Daily'",
            "nl:{daily:'Dagelijks'",
            "de:{daily:'Täglich'",
            "fr:{daily:'Quotidien'",
            "es:{daily:'Diario'"
        ].forEach(locale => expect(entityController).toContain(locale));

        [
            "en: {",
            "nl: {",
            "de: {",
            "fr: {",
            "es: {"
        ].forEach(locale => expect(higherLowerController).toContain(locale));
    });

    it('wires all Higher or Lower controls without reusing Entity Guesser attributes', () => {
        [
            'data-hl-mode="daily"',
            'data-hl-mode="practice"',
            'data-hl-filter',
            'data-hl-left-value',
            'data-hl-right-value',
            'data-hl-choice="higher"',
            'data-hl-choice="lower"',
            'data-hl-next',
            'data-hl-share'
        ].forEach(attribute => expect(page).toContain(attribute));
        expect(higherLowerController).toContain("root.querySelector('[data-hl-left-name]')");
        expect(higherLowerController).toContain("root.querySelectorAll('[data-hl-choice]')");
    });
});
