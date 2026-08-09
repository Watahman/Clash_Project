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

    it('uses minigames metadata rather than Entity-Guesser-only metadata', () => {
        expect(page).toContain('<title>Daily Clash of Clans Minigames | ClashPanel</title>');
        expect(page).toContain('Entity Guesser and Higher or Lower games');
        expect(page).toContain('ClashPanel Higher or Lower');
    });

    it('advertises the complete catalog without implying every game uses every category', () => {
        expect(page).toContain('Ten knowledge categories across the games.');
        expect(page).toContain('Entity Guesser uses all ten categories.');
        expect(page).toContain('Compare nine values and build a combo.');
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

    it('uses a complete touch-friendly answer picker instead of a limited datalist', () => {
        expect(page).toContain('role="combobox"');
        expect(page).toContain('role="listbox"');
        expect(page).toContain('data-picker-help');
        expect(page).not.toContain('<datalist');
        expect(entityController).toContain('searchEntities(E.input.value,entities,entities.length)');
        expect(entityController).toContain("E.input.addEventListener('click',()=>suggestions(true))");
        expect(entityController).toContain("event.key==='ArrowDown'");
    });

    it('versions the changed module graph so existing browsers cannot keep the broken picker', () => {
        expect(page).toContain('/assets/js/pages/minigames-phase2b.js?v=20260809-1');
        expect(page).toContain('/assets/js/pages/higher-lower.js?v=20260809-1');
        expect(page).toContain('/assets/css/minigames.css?v=20260809-1');
        expect(entityController).toContain("entity-guesser-catalog.js?v=20260809-1");
        expect(entityController).toContain("entity-guesser-engine-v2.js?v=20260809-1");
        expect(higherLowerController).toContain("higher-lower-engine.js?v=20260809-1");
    });

    it('keeps the answer picker usable on narrow touch screens', () => {
        const styles = readFileSync('src/assets/css/minigames.css', 'utf8');
        expect(styles).toMatch(/\.entity-suggestion\s*\{[^}]*min-height:\s*2\.75rem/s);
        expect(styles).toMatch(/\.entity-suggestions\s*\{[^}]*overflow-y:\s*auto/s);
        expect(styles).toMatch(/@media\s*\(max-width:\s*42rem\)[\s\S]*\.guess-entry-row\s*\{\s*grid-template-columns:\s*1fr;/);
        expect(page).toContain('data-game-i18n="scrollHelp"');
        expect(styles).toMatch(/@media\s*\(max-width:\s*42rem\)[\s\S]*\.game-scroll-help\s*\{\s*display:\s*block;/);
    });
});
