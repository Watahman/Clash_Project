import { describe, expect, it } from 'vitest';
import {
    applyChoice,
    buildDailyQuestions,
    createDailyRun
} from '../../src/assets/js/minigames/higher-lower-engine.js';
import {
    getLatestHigherLowerAnswer,
    isValidHigherLowerDailyRun
} from '../../src/assets/js/minigames/minigames-state.js';

describe('Minigames persisted state', () => {
    const dateKey = '2026-08-06';

    it('accepts untouched and correctly answered Daily runs', () => {
        const initial = createDailyRun(dateKey);
        expect(isValidHigherLowerDailyRun(initial, dateKey)).toBe(true);

        const question = buildDailyQuestions(dateKey)[0];
        const answered = applyChoice(initial, question, question.correctChoice);
        expect(isValidHigherLowerDailyRun(answered, dateKey)).toBe(true);
        expect(getLatestHigherLowerAnswer(answered)).toMatchObject({
            questionId: question.id,
            choice: question.correctChoice,
            correct: true
        });
    });

    it('accepts a wrong revealed answer so the selected button can be restored', () => {
        const initial = createDailyRun(dateKey);
        const question = buildDailyQuestions(dateKey)[0];
        const wrongChoice = question.correctChoice === 'higher' ? 'lower' : 'higher';
        const answered = applyChoice(initial, question, wrongChoice);

        expect(isValidHigherLowerDailyRun(answered, dateKey)).toBe(true);
        expect(getLatestHigherLowerAnswer(answered)).toMatchObject({
            choice: wrongChoice,
            correctChoice: question.correctChoice,
            correct: false
        });
    });

    it('rejects stale, malformed and internally inconsistent state', () => {
        const valid = createDailyRun(dateKey);
        expect(isValidHigherLowerDailyRun({ ...valid, dateKey: '2026-08-05' }, dateKey)).toBe(false);
        expect(isValidHigherLowerDailyRun({ ...valid, currentIndex: 99 }, dateKey)).toBe(false);
        expect(isValidHigherLowerDailyRun({ ...valid, answers: {} }, dateKey)).toBe(false);
        expect(isValidHigherLowerDailyRun({ ...valid, completed: true }, dateKey)).toBe(false);

        const question = buildDailyQuestions(dateKey)[0];
        const answered = applyChoice(valid, question, question.correctChoice);
        expect(isValidHigherLowerDailyRun({ ...answered, correctCount: 0 }, dateKey)).toBe(false);
        expect(isValidHigherLowerDailyRun({
            ...answered,
            answers: [{ ...answered.answers[0], correct: false }]
        }, dateKey)).toBe(false);
    });

    it('returns no latest answer before a value has been revealed', () => {
        expect(getLatestHigherLowerAnswer(createDailyRun(dateKey))).toBeNull();
        expect(getLatestHigherLowerAnswer(null)).toBeNull();
    });
});
