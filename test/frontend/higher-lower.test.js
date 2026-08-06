import { describe, expect, it } from 'vitest';
import {
    COMPARISON_PROFILES,
    DAILY_CATEGORY_IDS,
    DAILY_QUESTION_COUNT,
    HIGHER_LOWER_DATA_VERSION,
    advanceRun,
    applyChoice,
    buildComparablePairs,
    buildDailyQuestions,
    buildPracticeQuestion,
    createDailyRun,
    createPracticeRun,
    getComboBonus,
    getMetricValue,
    resultSymbols,
    scoreChoice,
    updateLifetimeStats
} from '../../src/assets/js/minigames/higher-lower-engine.js';

describe('Higher or Lower engine', () => {
    it('defines only comparison profiles with non-tied pairs', () => {
        expect(HIGHER_LOWER_DATA_VERSION).toContain('higher-lower-v1');
        expect(COMPARISON_PROFILES.length).toBeGreaterThanOrEqual(18);
        COMPARISON_PROFILES.forEach(profile => {
            const pairs = buildComparablePairs(profile);
            expect(pairs.length).toBeGreaterThan(0);
            pairs.forEach(pair => {
                expect(pair.left.id).not.toBe(pair.right.id);
                expect(pair.leftValue).not.toBe(pair.rightValue);
                expect(getMetricValue(pair.left, profile)).toBe(pair.leftValue);
                expect(getMetricValue(pair.right, profile)).toBe(pair.rightValue);
            });
        });
    });

    it('creates a deterministic ten-question Daily with every category exactly once', () => {
        const first = buildDailyQuestions('2026-08-06');
        const second = buildDailyQuestions('2026-08-06');
        expect(first).toEqual(second);
        expect(first).toHaveLength(DAILY_QUESTION_COUNT);
        expect(new Set(first.map(question => question.categoryId)))
            .toEqual(new Set(DAILY_CATEGORY_IDS));
        first.forEach(question => {
            expect(question.leftValue).not.toBe(question.rightValue);
            expect(question.correctChoice)
                .toBe(question.rightValue > question.leftValue ? 'higher' : 'lower');
        });
    });

    it('changes Daily questions on another UTC date', () => {
        const first = buildDailyQuestions('2026-08-06');
        const second = buildDailyQuestions('2026-08-07');
        expect(second.map(question => question.id)).not.toEqual(first.map(question => question.id));
    });

    it('uses the documented combo bonus thresholds and 1170 maximum score', () => {
        expect(getComboBonus(1)).toBe(0);
        expect(getComboBonus(3)).toBe(10);
        expect(getComboBonus(5)).toBe(20);
        expect(getComboBonus(8)).toBe(30);

        let combo = 0;
        let score = 0;
        for (let index = 0; index < DAILY_QUESTION_COUNT; index += 1) {
            const result = scoreChoice(true, combo);
            combo = result.combo;
            score += result.points;
        }
        expect(combo).toBe(10);
        expect(score).toBe(1170);
        expect(scoreChoice(false, combo)).toEqual({ points: 0, combo: 0, bonus: 0 });
    });

    it('applies answers, reveals values and advances a Daily run', () => {
        const questions = buildDailyQuestions('2026-08-06');
        const question = questions[0];
        const initial = createDailyRun('2026-08-06');
        const answered = applyChoice(initial, question, question.correctChoice);
        expect(answered.revealed).toBe(true);
        expect(answered.correctCount).toBe(1);
        expect(answered.score).toBe(100);
        expect(answered.answers).toHaveLength(1);

        const advanced = advanceRun(answered);
        expect(advanced.currentIndex).toBe(1);
        expect(advanced.revealed).toBe(false);
    });

    it('completes the Daily after ten answers and updates lifetime stats once', () => {
        const questions = buildDailyQuestions('2026-08-06');
        let run = createDailyRun('2026-08-06');
        questions.forEach((question, index) => {
            run = applyChoice(run, question, question.correctChoice);
            if (index < questions.length - 1) run = advanceRun(run);
        });

        expect(run.completed).toBe(true);
        expect(run.correctCount).toBe(10);
        expect(run.score).toBe(1170);
        const stats = updateLifetimeStats({}, run);
        expect(stats).toMatchObject({
            runsPlayed: 1,
            totalCorrect: 10,
            totalQuestions: 10,
            bestScore: 1170,
            bestCombo: 10,
            perfectRuns: 1,
            lastCompletedDate: '2026-08-06'
        });
        expect(updateLifetimeStats(stats, run)).toEqual(stats);
    });

    it('creates category-filtered, repeatable Practice questions without completing the run', () => {
        const randomValues = [0.1, 0.2, 0.9, 0.4, 0.7, 0.3];
        let index = 0;
        const random = () => randomValues[index++ % randomValues.length];
        const first = buildPracticeQuestion('defenses', '', random);
        const second = buildPracticeQuestion('defenses', first.id, random);
        expect(first.categoryId).toBe('defenses');
        expect(second.categoryId).toBe('defenses');
        expect(second.id).not.toBe(first.id);

        const run = createPracticeRun('defenses');
        const answered = applyChoice(run, first, first.correctChoice);
        expect(answered.completed).toBe(false);
        expect(resultSymbols(answered.answers)).toBe('✅');
    });
});
