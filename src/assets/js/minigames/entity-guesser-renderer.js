export function createEntityGuesserRenderer({
    elements,
    entityCategories,
    text,
    categoryLabel,
    getState,
    getCategory,
    getAnswer,
    getStats,
    availableHintCount,
    buildHint,
    getLocale = () => 'en',
    message,
    picker,
    board,
    setImage
}) {
    function translate(category) {
        document.querySelectorAll('[data-game-i18n]').forEach(node => {
            node.textContent = text(node.dataset.gameI18n);
        });
        elements.input.placeholder = `${text('input')} — ${categoryLabel(category.id)}`;
        elements.inputLabel.textContent = text('chooseAnswer');
        elements.categoryTitle.textContent = categoryLabel(category.id);
        elements.gameTitle.textContent = text('question');
        elements.suggestions.setAttribute(
            'aria-label',
            `${categoryLabel(category.id)} ${text('availableAnswers')}`
        );
    }

    function renderCategory(state, category) {
        elements.categorySelect.replaceChildren();
        entityCategories.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = categoryLabel(item.id);
            elements.categorySelect.append(option);
        });
        elements.categorySelect.value = category.id;
        elements.categorySelect.disabled = state.mode === 'daily';
        elements.categoryPicker.hidden = state.mode === 'daily';
    }

    function renderHints(state, category, answer) {
        elements.hints.replaceChildren();
        state.hints.forEach((unused, index) => {
            const item = document.createElement('li');
            item.textContent = buildHint(answer, category, index + 1, getLocale());
            elements.hints.append(item);
        });
        const available = availableHintCount(
            state.guesses.length,
            state.hints.length,
            category.maxAttempts
        );
        elements.hint.disabled = state.completed || available === 0;
        elements.hint.hidden = state.completed;
        if (!state.completed) message(available > 0 ? text('hintReady') : text('noHint'));
    }

    function renderResult(state, answer) {
        elements.result.hidden = !state.completed;
        elements.share.hidden = !state.completed || state.mode !== 'daily';
        elements.result.classList.toggle('is-visible', state.completed);
        if (!state.completed) {
            if (elements.resultImage) {
                elements.resultImage.removeAttribute('src');
                delete elements.resultImage.dataset.entityId;
                elements.resultImage.alt = '';
            }
            return;
        }
        elements.result.querySelector('[data-result-heading]').textContent = (
            state.won ? text('win') : text('loss')
        );
        elements.result.querySelector('[data-result-body]').textContent = (
            `${text('answer')}: ${answer.name}.`
        );
        setImage(elements.resultImage, answer, answer.name);
        message(
            state.mode === 'daily' ? text('dailyDone') : text('practiceNote'),
            state.won ? 'success' : 'warning'
        );
    }

    function renderMode(state) {
        elements.modes.forEach(button => {
            const active = button.dataset.gameMode === state.mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        elements.newPractice.hidden = state.mode !== 'practice';
        elements.modeNote.textContent = state.mode === 'daily'
            ? text('dailyNote')
            : text('practiceNote');
    }

    function renderStats(state, category) {
        const stats = getStats();
        elements.attempts.textContent = `${state.guesses.length}/${category.maxAttempts}`;
        elements.score.textContent = String(state.score || 0);
        elements.streak.textContent = String(stats?.currentStreak || 0);
        elements.best.textContent = String(stats?.bestStreak || 0);
        elements.input.disabled = state.completed;
        elements.form.querySelector('button[type="submit"]').disabled = state.completed;
        elements.board.dataset.state = state.completed
            ? state.won ? 'won' : 'lost'
            : state.guesses.length ? 'in-progress' : 'fresh';
    }

    function render() {
        const state = getState();
        const category = getCategory();
        const answer = getAnswer();
        translate(category);
        renderMode(state);
        renderCategory(state, category);
        board.render();
        renderHints(state, category, answer);
        renderResult(state, answer);
        renderStats(state, category);

        if (elements.root.hidden) {
            elements.suggestions.replaceChildren();
            elements.suggestions.hidden = true;
        } else {
            picker.render(false);
        }
    }

    return { render };
}
