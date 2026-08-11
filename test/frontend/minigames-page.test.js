import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ClashPanel minigames public page', () => {
    const page = readFileSync('src/minigames.html', 'utf8');
    const entityController = readFileSync('src/assets/js/pages/minigames-phase2b.js', 'utf8');
    const entityCopy = readFileSync('src/assets/js/minigames/entity-guesser-copy.js', 'utf8');
    const entityPicker = readFileSync('src/assets/js/minigames/entity-guesser-picker.js', 'utf8');
    const entityImages = readFileSync('src/assets/js/minigames/entity-guesser-images.js', 'utf8');
    const entityEngine = readFileSync('src/assets/js/minigames/entity-guesser-engine-v2.js', 'utf8');
    const higherLowerController = readFileSync('src/assets/js/pages/higher-lower.js', 'utf8');
    const higherLowerCopy = readFileSync('src/assets/js/minigames/higher-lower-copy.js', 'utf8');
    const higherLowerEngine = readFileSync('src/assets/js/minigames/higher-lower-engine.js', 'utf8');
    const minigamesState = readFileSync('src/assets/js/minigames/minigames-state.js', 'utf8');
    const hubController = readFileSync('src/assets/js/pages/minigames-hub.js', 'utf8');

    it('loads the game hub, Entity Guesser and Higher or Lower controllers', () => {
        expect(page).toContain('/assets/js/pages/minigames-hub.js?v=20260811-2');
        expect(page).toContain('/assets/js/pages/minigames-phase2b.js');
        expect(page).toContain('/assets/js/pages/higher-lower.js');
        expect(page).toContain('/assets/css/minigames-entity-guesser.css');
        expect(page).toContain('/assets/css/minigames-higher-lower-responsive.css');
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

    it('presents the complete catalog as four broad newcomer-friendly categories', () => {
        expect(page).toContain('Four broad categories. Less menu, more guessing.');
        expect(page).toContain('Related Clash items now play together');
        expect(page).toContain('Compare nine values and build a combo.');
        [
            'Defenses',
            'Other buildings',
            'Troops &amp; Heroes',
            'Spells &amp; Equipment'
        ].forEach(label => expect(page).toContain(label));
        expect(entityCopy).toContain("otherBuildings: 'Other Buildings'");
        expect(entityCopy).toContain("troopsHeroes: 'Troops & Heroes'");
        expect(entityCopy).toContain("spellsEquipment: 'Spells & Equipment'");
    });

    it('gives new players a concise, keyboard-accessible guide to both games', () => {
        expect(page).toContain('<details class="minigames-help">');
        expect(page).toContain('<strong>What can I do here?</strong>');
        expect(page).toContain('You have six tries and two optional hints.');
        expect(page).toContain('Judge nine fair comparisons.');
        expect(page).toContain('resets at 00:00 UTC');
    });

    it('keeps all five supported interface languages in both games', () => {
        [
            'en: {',
            'nl: {',
            'de: {',
            'fr: {',
            'es: {'
        ].forEach(locale => expect(entityCopy).toContain(locale));

        [
            "en: {",
            "nl: {",
            "de: {",
            "fr: {",
            "es: {"
        ].forEach(locale => expect(higherLowerCopy).toContain(locale));
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
        expect(entityPicker).toContain('searchEntities(query, entities, entities.length)');
        expect(entityPicker).toContain('option.tabIndex = -1');
        expect(entityPicker).toContain('elements.input.addEventListener(\'click\', reopen)');
        expect(entityPicker).toContain("render(true, '')");
        expect(entityPicker).toContain("selectedId = ''");
        expect(entityPicker).toContain("event.key === 'ArrowDown'");
    });

    it('uses a disclosure chevron instead of turning a plus into a close icon', () => {
        const styles = readFileSync('src/assets/css/minigames-guide.css', 'utf8');
        expect(page).toContain('<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>');
        expect(page).not.toContain('<span class="minigames-help-toggle" aria-hidden="true">+</span>');
        expect(styles).toContain('.minigames-help[open] .minigames-help-toggle { transform: rotate(180deg); }');
        expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('versions the changed module graph so existing browsers cannot keep the broken picker', () => {
        expect(page).toContain('/assets/js/pages/minigames-phase2b.js?v=20260811-2');
        expect(page).toContain('/assets/js/pages/higher-lower.js?v=20260811-2');
        expect(page).toContain('/assets/css/minigames.css?v=20260811-1');
        expect(hubController).toContain("higher-lower-engine.js?v=20260809-3");
        expect(hubController).toContain("minigames-state.js?v=20260809-3");
        expect(entityController).toContain("entity-guesser-catalog.js?v=20260809-3");
        expect(entityController).toContain("entity-guesser-engine-v2.js?v=20260811-2");
        expect(entityEngine).toContain("entity-guesser-catalog.js?v=20260809-3");
        expect(higherLowerController).toContain("higher-lower-engine.js?v=20260809-3");
        expect(higherLowerEngine).toContain("entity-guesser-catalog.js?v=20260809-3");
        expect(minigamesState).toContain("higher-lower-engine.js?v=20260809-3");
    });

    it('keeps the answer picker usable on narrow touch screens', () => {
        const styles = [
            readFileSync('src/assets/css/minigames-entity-guesser.css', 'utf8'),
            readFileSync('src/assets/css/minigames-entity-guesser-board.css', 'utf8'),
            readFileSync('src/assets/css/minigames-entity-guesser-responsive.css', 'utf8')
        ].join('\n');
        expect(styles).toMatch(/\.entity-suggestion\s*\{[^}]*min-height:\s*2\.75rem/s);
        expect(styles).toMatch(/\.entity-suggestions\s*\{[^}]*overflow-y:\s*auto/s);
        expect(styles).toMatch(/@media\s*\(max-width:\s*42rem\)[\s\S]*\.guess-entry-row\s*\{\s*grid-template-columns:\s*1fr;/);
        expect(page).toContain('data-game-i18n="scrollHelp"');
        expect(styles).toMatch(/@media\s*\(max-width:\s*42rem\)[\s\S]*\.game-scroll-help\s*\{\s*display:\s*block;/);
    });
});
