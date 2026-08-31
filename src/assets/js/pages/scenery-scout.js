import { buildGameQuestions, scoreAnswer, utcDateKey, validateManifest } from '../minigames/scenery-scout-engine.js';
import { getScoutCopy } from '../minigames/scenery-scout-copy.js';
import { loadScoutStats, recordCompletedRun, saveScoutStats } from '../minigames/scenery-scout-state.js';
import { createScoutView } from '../minigames/scenery-scout-renderer.js';

const MANIFEST_URL = '/assets/scenery-scout/scenery-manifest.json';

export function initSceneryScout(root, dependencies = {}) {
    if (!root || root.dataset.ssReady === 'true') return null;
    root.dataset.ssReady = 'true';
    const suppliedCopy = dependencies.copy;
    let copy = suppliedCopy || getScoutCopy();
    const view = createScoutView(root, copy);
    const fetchManifest = dependencies.fetchManifest || (() => fetch(MANIFEST_URL).then(checkResponse).then(response => response.json()));
    const now = dependencies.now || (() => Date.now());
    const timers = dependencies.timers || globalThis;
    let manifest = null;
    let stats = loadScoutStats(dependencies.storage);
    let run = null;
    let lastResult = null;
    let timerId = null;
    let roundStartedAt = 0;

    localizeStaticCopy();
    view.renderLifetime(stats);
    bindActions();
    view.showScreen('loading');
    fetchManifest().then(value => {
        if (!validateManifest(value) || !value.sceneries.some(scenery => scenery.active)) throw new Error(copy.empty);
        manifest = value;
        view.showScreen('landing');
    }).catch(error => view.showError(error.message || copy.loadError));

    function bindActions() {
        root.addEventListener('click', event => {
            const start = event.target.closest('[data-ss-start]');
            const answer = event.target.closest('[data-ss-answer]');
            if (start) startRun(start.dataset.ssStart);
            else if (answer) submitAnswer(answer.dataset.ssAnswer);
            else if (event.target.closest('[data-ss-next]')) nextRound();
            else if (event.target.closest('[data-ss-back]')) returnToModes();
            else if (event.target.closest('[data-ss-retry]')) globalThis.location?.reload();
        });
        document.addEventListener('keydown', handleKeydown);
        globalThis.addEventListener?.('clashtools:language-changed', refreshCopy);
    }

    function refreshCopy() {
        if (suppliedCopy) return;
        copy = getScoutCopy();
        view.setCopy(copy);
        localizeStaticCopy();
        if (!run) return;
        const activeScreen = view.elements.screens.find(screen => !screen.hidden)?.dataset.ssScreen;
        if (activeScreen === 'result' && lastResult) view.renderResult(run, lastResult);
        if (activeScreen !== 'game') return;
        view.elements.question.textContent = copy.question;
        if (!run.revealed) return;
        const answer = run.answers.at(-1);
        const question = run.questions[run.index];
        view.revealAnswer(question, answer.selectedId, { total: answer.score }, answer.timedOut);
        const complete = run.mode === 'sudden-death' && !answer.correct || run.index >= run.questions.length - 1;
        view.elements.next.textContent = complete ? copy.finish : copy.next;
    }

    function localizeStaticCopy() {
        root.querySelectorAll('[data-ss-i18n]').forEach(node => {
            node.textContent = copy[node.dataset.ssI18n] || node.textContent;
        });
        const answerGroup = root.querySelector('[data-ss-answers]');
        if (answerGroup) answerGroup.setAttribute('aria-label', copy.answerLabel);
    }

    function startRun(mode) {
        if (!manifest) return;
        stopTimer();
        lastResult = null;
        const questions = buildGameQuestions(manifest, { mode, dateKey: utcDateKey(new Date(now())) });
        run = { mode, questions, index: 0, score: 0, streak: 0, bestStreak: 0, answers: [], revealed: false };
        renderCurrentRound();
    }

    function renderCurrentRound() {
        const question = run.questions[run.index];
        run.revealed = false;
        roundStartedAt = now();
        view.renderRound(question, run);
        view.renderTimer(question.timeLimit);
        preloadUpcoming();
        timerId = timers.setInterval(updateTimer, 100);
    }

    function updateTimer() {
        if (!run || run.revealed) return;
        const question = run.questions[run.index];
        const remaining = question.timeLimit - (now() - roundStartedAt) / 1000;
        view.renderTimer(remaining, remaining <= 5);
        if (remaining <= 0) submitAnswer(null, true);
    }

    function submitAnswer(selectedId, timedOut = false) {
        if (!run || run.revealed) return;
        stopTimer();
        run.revealed = true;
        const question = run.questions[run.index];
        const responseMs = Math.min(question.timeLimit * 1000, Math.max(0, now() - roundStartedAt));
        const correct = selectedId === question.sceneryId;
        run.streak = correct ? run.streak + 1 : 0;
        run.bestStreak = Math.max(run.bestStreak, run.streak);
        const scored = scoreAnswer({ correct, responseMs, timeLimit: question.timeLimit, difficulty: question.difficulty, streak: run.streak - 1 });
        run.score += scored.total;
        run.answers.push({ questionId: question.id, selectedId, correct, responseMs, score: scored.total, timedOut });
        view.revealAnswer(question, selectedId, scored, timedOut);
        view.elements.score.textContent = run.score.toLocaleString();
        view.elements.streak.textContent = String(run.streak);
        const ended = run.mode === 'sudden-death' && !correct;
        const complete = ended || run.index >= run.questions.length - 1;
        view.elements.next.textContent = complete ? copy.finish : copy.next;
        view.elements.next.dataset.ssFinish = String(complete);
        view.elements.next.focus({ preventScroll: true });
    }

    function nextRound() {
        if (!run?.revealed) return;
        if (view.elements.next.dataset.ssFinish === 'true') finishRun();
        else {
            run.index += 1;
            renderCurrentRound();
        }
    }

    function finishRun() {
        stopTimer();
        lastResult = recordCompletedRun(stats, run, utcDateKey(new Date(now())));
        stats = lastResult.stats;
        saveScoutStats(stats, dependencies.storage);
        view.renderLifetime(stats);
        view.renderResult(run, lastResult);
    }

    function returnToModes() {
        stopTimer();
        run = null;
        lastResult = null;
        view.showScreen('landing');
    }

    function handleKeydown(event) {
        if (!run || root.closest('[hidden]') || event.altKey || event.ctrlKey || event.metaKey) return;
        if (/^[1-8]$/.test(event.key) && !run.revealed) {
            const answer = view.elements.answers.querySelectorAll('[data-ss-answer]')[Number(event.key) - 1];
            if (answer) { event.preventDefault(); answer.click(); }
        } else if (event.key === 'Enter' && run.revealed) {
            event.preventDefault(); nextRound();
        }
    }

    function preloadUpcoming() {
        run.questions.slice(run.index + 1, run.index + 3).forEach(question => {
            const image = new Image();
            image.src = question.crop.image;
        });
    }

    function stopTimer() {
        if (timerId !== null) timers.clearInterval(timerId);
        timerId = null;
    }

    return { startRun, submitAnswer, nextRound, getRun: () => run, destroy: () => {
        stopTimer();
        document.removeEventListener('keydown', handleKeydown);
        globalThis.removeEventListener?.('clashtools:language-changed', refreshCopy);
    } };
}

function checkResponse(response) {
    if (!response.ok) throw new Error('The scenery library could not be loaded.');
    return response;
}

function boot() {
    document.querySelectorAll('[data-scenery-scout-game]').forEach(root => initSceneryScout(root));
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
}
