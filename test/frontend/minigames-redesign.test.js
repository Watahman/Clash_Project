import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    getEntityGameFixture,
    getHigherLowerGameFixture
} from '../../src/assets/js/minigames/minigames-fixtures.js';
import { isValidHigherLowerDailyRun } from '../../src/assets/js/minigames/minigames-state.js';

const page = readFileSync('src/minigames.html', 'utf8');
const gameStyles = [
    'minigames.css',
    'minigames-entity-guesser.css',
    'minigames-entity-guesser-board.css',
    'minigames-entity-guesser-responsive.css'
].map(file => readFileSync(`src/assets/css/${file}`, 'utf8')).join('\n');
const higherLowerStyles = [
    'minigames-higher-lower.css',
    'minigames-higher-lower-responsive.css'
].map(file => readFileSync(`src/assets/css/${file}`, 'utf8')).join('\n');

describe('Minigames redesign boundaries', () => {
    const dateKey = '2026-08-11';

    it('provides deterministic Entity Guesser boundary fixtures through the real state shape', () => {
        const fresh = getEntityGameFixture('entity-fresh', dateKey);
        const mid = getEntityGameFixture('entity-mid', dateKey);
        const won = getEntityGameFixture('entity-won', dateKey);
        const lost = getEntityGameFixture('entity-lost', dateKey);

        expect(fresh).toMatchObject({ mode: 'daily', dateKey, guesses: [], hints: [], completed: false, won: false });
        expect(mid).toMatchObject({ mode: 'daily', guesses: expect.any(Array), hints: [expect.any(String)], completed: false });
        expect(mid.guesses).toHaveLength(3);
        expect(won).toMatchObject({ completed: true, won: true, score: expect.any(Number) });
        expect(won.guesses.at(-1)).toBe(won.answerId);
        expect(lost).toMatchObject({ completed: true, won: false, score: 0 });
        expect(lost.guesses).not.toContain(lost.answerId);
    });

    it('provides Higher or Lower fresh, revealed, and final fixtures through the real engine', () => {
        const fresh = getHigherLowerGameFixture('higher-lower-fresh', dateKey);
        const correct = getHigherLowerGameFixture('higher-lower-correct', dateKey);
        const final = getHigherLowerGameFixture('higher-lower-final', dateKey);

        expect(isValidHigherLowerDailyRun(fresh, dateKey)).toBe(true);
        expect(correct).toMatchObject({ mode: 'daily', revealed: true, completed: false, answers: [{ correct: true }] });
        expect(final).toMatchObject({ mode: 'daily', revealed: true, completed: true });
        expect(final.answers).toHaveLength(9);
    });

    it('keeps game action order deliberate on mobile and keeps Practice category in Higher or Lower controls', () => {
        const higherLowerSection = page.indexOf('data-minigame-view="higher-lower"');
        const filter = page.indexOf('data-hl-filter-wrap');
        const layout = page.indexOf('<div class="hl-layout">');
        expect(filter).toBeGreaterThan(higherLowerSection);
        expect(layout).toBeGreaterThan(filter);
        expect(gameStyles).toMatch(/@media \(max-width: 70rem\)[\s\S]*\.game-sidebar \{ order: 2;[\s\S]*\.game-board \{ order: 1;/);
        expect(higherLowerStyles).toMatch(/\.hl-arena\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 360px\) auto minmax\(0, 360px\);/);
        expect(higherLowerStyles).toMatch(/@media \(max-width: 42rem\)[\s\S]*\.hl-arena \{[\s\S]*grid-template-columns: 1fr;/);
    });

    it('routes game imagery through the central resolver and leaves hidden Entity Guesser imagery unset until result', () => {
        expect(readFileSync('src/assets/js/minigames/entity-guesser-images.js', 'utf8')).toMatch(/entity-assets|getEntityAsset/);
        expect(readFileSync('src/assets/js/pages/higher-lower.js', 'utf8')).toMatch(/entity-assets\.js/);
        expect(page).toContain('data-result-image alt=""');
        expect(page).toContain('data-hl-left-image alt=""');
        expect(page).toContain('data-hl-right-image alt=""');
        expect(page).not.toContain('/assets/game/troops/');
    });
});
