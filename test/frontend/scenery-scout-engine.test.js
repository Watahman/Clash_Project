import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    buildGameQuestions,
    createSeededRandom,
    getRoundDifficulty,
    scoreAnswer,
    validateManifest
} from '../../src/assets/js/minigames/scenery-scout-engine.js';

const manifest = JSON.parse(readFileSync('src/assets/scenery-scout/scenery-manifest.json', 'utf8'));

describe('Scenery Scout engine and catalog', () => {
    it('ships a complete, traceable local scenery library', () => {
        expect(validateManifest(manifest)).toBe(true);
        expect(manifest.sceneries).toHaveLength(67);
        expect(manifest.sceneries.every(scenery => scenery.active)).toBe(true);
        expect(manifest.sceneries.every(scenery => scenery.crops.length === 8)).toBe(true);
        expect(new Set(manifest.sceneries.map(scenery => scenery.id)).size).toBe(67);

        for (const scenery of manifest.sceneries) {
            expect(scenery.source.provider).toBe('clash-of-clans-wiki');
            expect(scenery.source.filePage).toMatch(/^https:\/\/clashofclans\.fandom\.com\/wiki\/File:/);
            expect(existsSync(`src${scenery.sourceImage}`)).toBe(true);
            scenery.crops.forEach(crop => expect(existsSync(`src${crop.image}`)).toBe(true));
        }
    });

    it('builds the same globally deterministic daily challenge for a date', () => {
        const input = { mode: 'daily', dateKey: '2026-08-31' };
        const first = buildGameQuestions(manifest, input);
        const second = buildGameQuestions(manifest, input);
        expect(second).toEqual(first);
        expect(first).toHaveLength(5);
        expect(new Set(first.map(question => question.sceneryId)).size).toBe(5);
        expect(new Set(first.map(question => question.crop.id)).size).toBe(5);
        first.forEach(question => {
            expect(question.options).toHaveLength(4);
            expect(question.options.some(option => option.id === question.sceneryId)).toBe(true);
        });
    });

    it('changes the daily challenge with the UTC date', () => {
        const first = buildGameQuestions(manifest, { mode: 'daily', dateKey: '2026-08-31' });
        const next = buildGameQuestions(manifest, { mode: 'daily', dateKey: '2026-09-01' });
        expect(next.map(question => question.id)).not.toEqual(first.map(question => question.id));
    });

    it('honors mode-specific choices, crops and escalating sudden death', () => {
        const random = createSeededRandom('mode-contract');
        const hard = buildGameQuestions(manifest, { mode: 'hard', random });
        const expert = buildGameQuestions(manifest, { mode: 'expert', seed: 'expert' });
        expect(hard).toHaveLength(10);
        expect(hard.every(question => question.options.length === 6 && question.difficulty === 'hard')).toBe(true);
        expect(expert.every(question => question.options.length === 8 && question.difficulty === 'expert')).toBe(true);
        expect([getRoundDifficulty('sudden-death', 0), getRoundDifficulty('sudden-death', 7), getRoundDifficulty('sudden-death', 12)])
            .toEqual(['normal', 'hard', 'expert']);
    });

    it('awards only correct answers and caps time and streak bonuses', () => {
        expect(scoreAnswer({ correct: false, responseMs: 1, timeLimit: 20, difficulty: 'expert', streak: 99 }).total).toBe(0);
        const fast = scoreAnswer({ correct: true, responseMs: 0, timeLimit: 10, difficulty: 'expert', streak: 99 });
        const slow = scoreAnswer({ correct: true, responseMs: 10000, timeLimit: 10, difficulty: 'expert', streak: 0 });
        expect(fast).toEqual({ base: 1000, timeBonus: 400, streakBonus: 400, total: 1800 });
        expect(slow.total).toBe(1000);
    });
});
