import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Entity Guesser answer selection', () => {
    beforeEach(() => {
        vi.resetModules();
        localStorage.clear();
        document.documentElement.lang = 'en';
        document.body.innerHTML = readFileSync('src/minigames.html', 'utf8')
            .match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || '';
    });

    it('lets a player replace a selected answer before submitting it', async () => {
        await import('../../src/assets/js/pages/minigames-phase2b.js');

        document.querySelector('[data-game-mode="practice"]').click();
        const category = document.querySelector('[data-category-select]');
        category.value = 'troopsHeroes';
        category.dispatchEvent(new Event('change', { bubbles: true }));
        const input = document.querySelector('[data-guess-input]');
        input.click();

        const answerButton = name => [...document.querySelectorAll('.entity-suggestion')]
            .find(option => option.textContent === name);

        answerButton('Barbarian').click();
        expect(input.value).toBe('Barbarian');
        expect(document.querySelector('[data-guess-suggestions]').hidden).toBe(true);

        input.click();
        expect(document.querySelector('[data-guess-suggestions]').hidden).toBe(false);
        expect(document.querySelectorAll('.entity-suggestion')).toHaveLength(50);

        answerButton('Archer').click();
        expect(input.value).toBe('Archer');

        document.querySelector('[data-guess-form]').dispatchEvent(new Event('submit', {
            bubbles: true,
            cancelable: true
        }));
        expect(document.querySelector('.guess-name')?.textContent).toBe('Archer');
        expect(document.querySelector('[data-attempts-value]')?.textContent).toBe('1/6');
    });
});
