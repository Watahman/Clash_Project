import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initSceneryScout } from '../../src/assets/js/pages/scenery-scout.js';

const source = readFileSync('src/minigames.html', 'utf8');
const manifest = JSON.parse(readFileSync('src/assets/scenery-scout/scenery-manifest.json', 'utf8'));
const rootMarkup = new JSDOM(source).window.document.querySelector('[data-scenery-scout-game]').outerHTML;

describe('Scenery Scout controller', () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.lang = 'en';
        document.body.innerHTML = rootMarkup;
        document.querySelector('[data-scenery-scout-game]').hidden = false;
    });

    it('loads the verified catalog and exposes every V1 mode', async () => {
        const root = document.querySelector('[data-scenery-scout-game]');
        initSceneryScout(root, { fetchManifest: async () => manifest, now: () => Date.parse('2026-08-31T12:00:00Z') });
        await vi.waitFor(() => expect(root.querySelector('[data-ss-screen="landing"]').hidden).toBe(false));
        expect([...root.querySelectorAll('[data-ss-start]')].map(button => button.dataset.ssStart))
            .toEqual(expect.arrayContaining(['daily', 'normal', 'hard', 'expert', 'sudden-death']));
    });

    it('updates its static and active-round copy when the page language changes', async () => {
        document.documentElement.lang = 'nl';
        const root = document.querySelector('[data-scenery-scout-game]');
        const controller = initSceneryScout(root, { fetchManifest: async () => manifest, now: () => Date.parse('2026-08-31T12:00:00Z') });
        await vi.waitFor(() => expect(root.querySelector('[data-ss-screen="landing"]').hidden).toBe(false));
        expect(root.querySelector('[data-ss-i18n="landingTitle"]').textContent).toContain('Hoe goed ken jij');
        controller.startRun('daily');

        document.documentElement.lang = 'en';
        window.dispatchEvent(new CustomEvent('clashtools:language-changed'));

        expect(root.querySelector('[data-ss-i18n="landingTitle"]').textContent).toContain('How well do you know');
        expect(root.querySelector('[data-ss-question]').textContent).toBe('Which scenery is this?');
        controller.destroy();
    });

    it('locks answers, shows text feedback and completes a run', async () => {
        const root = document.querySelector('[data-scenery-scout-game]');
        const controller = initSceneryScout(root, { fetchManifest: async () => manifest, now: () => Date.parse('2026-08-31T12:00:00Z') });
        await vi.waitFor(() => expect(root.querySelector('[data-ss-screen="landing"]').hidden).toBe(false));
        controller.startRun('daily');

        while (controller.getRun()?.index < 4) {
            const current = controller.getRun().questions[controller.getRun().index];
            controller.submitAnswer(current.sceneryId);
            expect([...root.querySelectorAll('[data-ss-answer]')].every(button => button.disabled)).toBe(true);
            expect(root.querySelector('[data-ss-feedback]').textContent).toContain('Correct');
            controller.nextRound();
        }

        const finalQuestion = controller.getRun().questions[4];
        controller.submitAnswer(finalQuestion.sceneryId);
        controller.nextRound();
        expect(root.querySelector('[data-ss-screen="result"]').hidden).toBe(false);
        expect(root.querySelector('[data-ss-result-accuracy]').textContent).toBe('100%');
        expect(JSON.parse(localStorage.getItem('clashpanel:minigames:scenery-scout:v1')).totalGames).toBe(1);
        controller.destroy();
    });
});
