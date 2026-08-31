import { existsSync, readFileSync } from 'node:fs';
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
    const higherLowerRenderer = readFileSync('src/assets/js/minigames/higher-lower-renderer.js', 'utf8');
    const minigamesState = readFileSync('src/assets/js/minigames/minigames-state.js', 'utf8');
    const sceneryCopy = readFileSync('src/assets/js/minigames/scenery-scout-copy.js', 'utf8');
    const sceneryController = readFileSync('src/assets/js/pages/scenery-scout.js', 'utf8');
    const hubController = readFileSync('src/assets/js/pages/minigames-hub.js', 'utf8');

    it('loads the hub and all three game controllers', () => {
        expect(page).toContain('/assets/js/pages/minigames-hub.js?v=20260828-seo-links');
        expect(page).toContain('/assets/js/pages/minigames-phase2b.js');
        expect(page).toContain('/assets/js/pages/higher-lower.js');
        expect(page).toContain('/assets/js/pages/scenery-scout.js?v=20260831-v1');
        expect(page).toContain('/assets/css/minigames-entity-guesser.css');
        expect(page).toContain('/assets/css/minigames-higher-lower-responsive.css');
        expect(page).not.toContain('src="/assets/js/pages/minigames.js"');
    });

    it('contains three isolated, switchable game views', () => {
        expect(page).toContain('data-minigame-select="entity"');
        expect(page).toContain('data-minigame-select="higher-lower"');
        expect(page).toContain('data-minigame-view="entity"');
        expect(page).toContain('data-minigame-view="higher-lower"');
        expect(page).toContain('data-minigame-select="scenery-scout"');
        expect(page).toContain('data-minigame-view="scenery-scout"');
        expect(page).toContain('data-scenery-scout-game');
        expect(page).toContain('data-higher-lower-game');
        expect(hubController).toContain("url.searchParams.set('game', selected)");
        expect(hubController).toContain("url.searchParams.delete('game')");
    });

    it('uses minigames metadata rather than Entity-Guesser-only metadata', () => {
        expect(page).toContain('<title>Daily Clash of Clans Minigames &amp; Scenery Quiz | ClashPanel</title>');
        expect(page).toContain('Entity Guesser, Higher or Lower and Scenery Scout');
        expect(page).toContain('ClashPanel Higher or Lower');
        expect(page).toContain('ClashPanel Scenery Scout');
    });

    it('publishes a complete large social preview for the games hub', () => {
        expect(existsSync('src/assets/social/minigames.png')).toBe(true);
        expect(page).toContain('<meta property="og:image" content="https://clashpanel.com/assets/social/minigames.png">');
        expect(page).toContain('<meta property="og:image:width" content="1200">');
        expect(page).toContain('<meta property="og:image:height" content="630">');
        expect(page).toContain('<meta name="twitter:card" content="summary_large_image">');
        expect(page).toContain('<meta name="twitter:image" content="https://clashpanel.com/assets/social/minigames.png">');
        expect(page).toContain('<meta name="twitter:image:alt"');
    });

    it('links the games hub directly to the public bracket generator', () => {
        expect(page).toContain('href="/bracket-generator"');
        expect(page).toContain('data-hub-i18n="bracketLink"');
        expect(hubController).toContain("bracketLink: 'Build a tournament bracket →'");
    });

    it('presents the complete catalog as four broad newcomer-friendly categories', () => {
        expect(page).toContain('Four broad categories. Less menu, more guessing.');
        expect(page).toContain('Related Clash items now play together');
        expect(page).toContain('data-hub-i18n="catalogTitle"');
        expect(page).toContain('data-hub-i18n="policy"');
        expect(hubController).toContain('localizedCategory(category.id)');
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

    it('gives new players a concise, keyboard-accessible guide to all games', () => {
        expect(page).toContain('<details class="minigames-help">');
        expect(page).toContain('<strong>What can I do here?</strong>');
        expect(page).toContain('You have six tries and two optional hints.');
        expect(page).toContain('Judge nine fair comparisons.');
        expect(page).toContain('Recognize the world beyond the village.');
        expect(page).toContain('resets at 00:00 UTC');
    });

    it('keeps all five supported interface languages in every game', () => {
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

        ['en:', 'nl:', 'de:', 'fr:', 'es:'].forEach(locale => expect(sceneryCopy).toContain(locale));
    });

    it('wires all Higher or Lower controls without reusing Entity Guesser attributes', () => {
        [
            'data-hl-mode="daily"',
            'data-hl-mode="practice"',
            'data-hl-filter',
            'data-hl-left-label',
            'data-hl-left-value',
            'data-hl-right-label',
            'data-hl-right-value',
            'data-hl-choice="higher"',
            'data-hl-choice="lower"',
            'data-hl-next',
            'data-hl-share'
        ].forEach(attribute => expect(page).toContain(attribute));
        expect(higherLowerController).toContain("root.querySelector('[data-hl-left-name]')");
        expect(higherLowerController).toContain("root.querySelectorAll('[data-hl-choice]')");
    });

    it('keeps the Higher or Lower question counter free of a duplicated label', () => {
        expect(higherLowerRenderer).toContain('elements.question.textContent = count;');
        expect(higherLowerRenderer).not.toContain("elements.question.textContent = `${text('question')} ${count}`;");
    });

    it('labels both Higher or Lower cards with the active statistic', () => {
        expect(higherLowerController).toContain("leftLabel: root.querySelector('[data-hl-left-label]')");
        expect(higherLowerController).toContain("rightLabel: root.querySelector('[data-hl-right-label]')");
        expect(higherLowerRenderer).toContain('elements.leftLabel.textContent = metricLabel;');
        expect(higherLowerRenderer).toContain('elements.rightLabel.textContent = metricLabel;');
    });

    it('keeps mode changes from focusing and reopening the answer picker', () => {
        expect(entityController).toMatch(/function setMode\(mode, categoryId = state\?\.categoryId\) \{[\s\S]*?hydrate\(createState\(mode, categoryId\)\);[\s\S]*?render\(\);\s*\}/);
        expect(entityController).not.toMatch(/function setMode\([\s\S]*?elements\.input\.focus\(\);/);
    });

    it('styles the Entity Guesser practice category control as a real workspace field', () => {
        const styles = readFileSync('src/assets/css/minigames-entity-guesser.css', 'utf8');
        expect(page).toContain('minigames-entity-guesser.css?v=20260814-practice-picker');
        expect(styles).toContain('.game-category-picker {');
        expect(styles).toContain('.game-category-picker select {');
        expect(styles).toContain('.game-category-picker select:focus-visible {');
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
        expect(page).toContain('/assets/js/pages/minigames-phase2b.js?v=20260814-entity-mode-fix');
        expect(page).toContain('/assets/js/pages/higher-lower.js?v=20260814-metric-card-labels');
        expect(page).toContain('/assets/js/pages/scenery-scout.js?v=20260831-v1');
        expect(sceneryController).toContain("scenery-scout-engine.js");
        expect(page).toContain('/assets/css/minigames.css?v=20260814-games-header-visible');
        expect(hubController).toContain("higher-lower-engine.js?v=20260809-3");
        expect(hubController).toContain("minigames-state.js?v=20260809-3");
        expect(entityController).toContain("entity-guesser-catalog.js?v=20260809-3");
        expect(entityController).toContain("entity-guesser-engine-v2.js?v=20260811-2");
        expect(entityEngine).toContain("entity-guesser-catalog.js?v=20260809-3");
        expect(higherLowerController).toContain("higher-lower-engine.js?v=20260809-3");
        expect(higherLowerEngine).toContain("entity-guesser-catalog.js?v=20260809-3");
        expect(higherLowerController).toContain("higher-lower-renderer.js?v=20260814-metric-card-labels");
        expect(minigamesState).toContain("higher-lower-engine.js?v=20260809-3");
    });

    it('provides high-contrast dark variants for every game icon used on the page', () => {
        const styles = readFileSync('src/assets/css/minigames.css', 'utf8');
        ['daily', 'guess', 'higher-lower', 'streak', 'scenery-scout'].forEach(icon => {
            expect(page).toContain(`/assets/icons/games/${icon}.svg`);
            expect(styles).toContain(`/assets/icons/games/dark/${icon}.svg`);
            expect(readFileSync(`src/assets/icons/games/dark/${icon}.svg`, 'utf8')).toContain('stroke="#c8bfff"');
        });
    });

    it('starts the public game heading closer to the page header', () => {
        const styles = readFileSync('src/assets/css/minigames.css', 'utf8');
        expect(styles).toContain('padding-block: 3rem 3rem');
    });

    it('keeps the Games hero header visible while a game is focused', () => {
        const styles = readFileSync('src/assets/css/minigames.css', 'utf8');
        expect(styles).not.toContain('body[data-game-focus="true"] .minigames-hero');
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
