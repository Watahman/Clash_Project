import { formatScoutCopy } from './scenery-scout-copy.js';

export function createScoutView(root, initialCopy) {
    let copy = initialCopy;
    const one = selector => root.querySelector(selector);
    const all = selector => [...root.querySelectorAll(selector)];
    const elements = {
        screens: all('[data-ss-screen]'),
        image: one('[data-ss-image]'),
        answers: one('[data-ss-answers]'),
        feedback: one('[data-ss-feedback]'),
        next: one('[data-ss-next]'),
        question: one('[data-ss-question]'),
        round: one('[data-ss-stat="round"]'),
        timer: one('[data-ss-stat="timer"]'),
        score: one('[data-ss-stat="score"]'),
        streak: one('[data-ss-stat="streak"]'),
        resultTitle: one('[data-ss-result-title]'),
        resultSummary: one('[data-ss-result-summary]'),
        resultScore: one('[data-ss-result-score]'),
        resultAccuracy: one('[data-ss-result-accuracy]'),
        resultTime: one('[data-ss-result-time]'),
        resultStreak: one('[data-ss-result-streak]'),
        best: one('[data-ss-new-best]'),
        lifetimeGames: all('[data-ss-lifetime="games"]'),
        lifetimeAccuracy: all('[data-ss-lifetime="accuracy"]'),
        dailyStreak: all('[data-ss-lifetime="daily-streak"]')
    };

    function showScreen(name) {
        for (const screen of elements.screens) screen.hidden = screen.dataset.ssScreen !== name;
    }

    function renderRound(question, run) {
        showScreen('game');
        elements.question.textContent = copy.question;
        elements.image.src = question.crop.image;
        elements.image.alt = formatScoutCopy(copy.clueAlt, { difficulty: question.difficulty });
        elements.round.textContent = `${run.index + 1} / ${run.questions.length}`;
        elements.score.textContent = run.score.toLocaleString();
        elements.streak.textContent = String(run.streak);
        elements.feedback.hidden = true;
        elements.feedback.dataset.state = 'neutral';
        elements.next.hidden = true;
        elements.answers.replaceChildren(...question.options.map((option, index) => answerButton(option, index)));
    }

    function revealAnswer(question, selectedId, scored, timedOut = false) {
        for (const button of elements.answers.querySelectorAll('button')) {
            const isCorrect = button.dataset.ssAnswer === question.sceneryId;
            const isSelected = button.dataset.ssAnswer === selectedId;
            button.disabled = true;
            button.dataset.state = isCorrect ? 'correct' : isSelected ? 'incorrect' : 'idle';
            if (isCorrect) button.querySelector('[data-ss-answer-status]').textContent = '✓';
            else if (isSelected) button.querySelector('[data-ss-answer-status]').textContent = '×';
        }
        const correct = selectedId === question.sceneryId;
        elements.feedback.hidden = false;
        elements.feedback.dataset.state = correct ? 'correct' : 'incorrect';
        const heading = timedOut ? copy.timedOut : correct ? copy.correct : copy.incorrect;
        const detail = correct ? formatScoutCopy(copy.points, { score: scored.total }) : formatScoutCopy(copy.answerWas, { name: question.correctName });
        elements.feedback.innerHTML = `<strong>${escapeHtml(heading)}</strong><span>${escapeHtml(detail)}</span>`;
        elements.next.hidden = false;
    }

    function renderTimer(seconds, urgent = false) {
        elements.timer.textContent = `${Math.max(0, seconds).toFixed(1)}s`;
        elements.timer.dataset.urgent = String(urgent);
    }

    function renderResult(run, result) {
        showScreen('result');
        const correct = run.answers.filter(answer => answer.correct).length;
        const totalMs = run.answers.reduce((sum, answer) => sum + answer.responseMs, 0);
        const average = run.answers.length ? totalMs / run.answers.length / 1000 : 0;
        elements.resultTitle.textContent = result.newBest ? copy.newBest : copy.scoutingComplete;
        elements.resultSummary.textContent = formatScoutCopy(copy.resultCorrect, { correct, total: run.answers.length });
        elements.resultScore.textContent = run.score.toLocaleString();
        elements.resultAccuracy.textContent = `${Math.round(correct / Math.max(1, run.answers.length) * 100)}%`;
        elements.resultTime.textContent = `${average.toFixed(1)}s`;
        elements.resultStreak.textContent = String(run.bestStreak);
        elements.best.hidden = !result.newBest;
    }

    function renderLifetime(stats) {
        const accuracy = stats.totalGuesses ? Math.round(stats.correctGuesses / stats.totalGuesses * 100) : 0;
        elements.lifetimeGames.forEach(node => { node.textContent = stats.totalGames.toLocaleString(); });
        elements.lifetimeAccuracy.forEach(node => { node.textContent = `${accuracy}%`; });
        elements.dailyStreak.forEach(node => { node.textContent = String(stats.daily.streak); });
    }

    function showError(message) {
        const target = one('[data-ss-error-message]');
        if (target) target.textContent = message;
        showScreen('error');
    }

    function setCopy(nextCopy) {
        copy = nextCopy;
    }

    function answerButton(option, index) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ss-answer';
        button.dataset.ssAnswer = option.id;
        button.innerHTML = `<span class="ss-answer-key" aria-hidden="true">${index + 1}</span><span>${escapeHtml(option.name)}</span><span data-ss-answer-status aria-hidden="true"></span>`;
        return button;
    }

    return { elements, setCopy, showScreen, renderRound, revealAnswer, renderTimer, renderResult, renderLifetime, showError };
}

function escapeHtml(value) {
    const span = document.createElement('span');
    span.textContent = String(value ?? '');
    return span.innerHTML;
}
