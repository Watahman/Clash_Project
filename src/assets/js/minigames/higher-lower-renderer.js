import { resolveMinigameAssetEntity } from './entity-asset-resolution.js';

export function createHigherLowerRenderer({
    root,
    elements,
    text,
    entityCategories,
    dailyCategoryIds,
    dailyQuestionCount,
    getLatestAnswer,
    getEntityAsset,
    installImageFallback
}) {
    let assetRenderToken = 0;

    function populateFilter(run) {
        elements.filter.replaceChildren();
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = text('allCategories');
        elements.filter.append(all);

        entityCategories
            .filter(category => dailyCategoryIds.includes(category.id))
            .forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = text(category.id);
                elements.filter.append(option);
            });

        elements.filter.value = run.mode === 'practice' ? run.categoryId : 'all';
    }

    function renderTranslation(run) {
        root.querySelectorAll('[data-hl-i18n]').forEach(node => {
            node.textContent = text(node.dataset.hlI18n);
        });
        elements.sidebarTitle.textContent = text('sidebarTitle');
        populateFilter(run);
    }

    function setCardImage(image, entity, token) {
        if (image.dataset.entityId === entity.id && image.getAttribute('src')) return;
        image.dataset.entityId = entity.id;
        void getEntityAsset(resolveMinigameAssetEntity(entity)).then(asset => {
            if (!image.isConnected || token !== assetRenderToken || image.dataset.entityId !== entity.id) return;
            image.src = asset.image;
            installImageFallback(image);
        });
    }

    function renderCardImages(question) {
        if (root.hidden) return;
        const token = ++assetRenderToken;
        setCardImage(elements.leftImage, {
            id: question.leftEntityId,
            name: question.leftName
        }, token);
        setCardImage(elements.rightImage, {
            id: question.rightEntityId,
            name: question.rightName
        }, token);
    }

    function renderFeedback(run, question) {
        if (!run.revealed) {
            elements.feedback.textContent = '';
            elements.feedback.dataset.state = 'neutral';
            return;
        }
        const answerWord = text(question.correctChoice);
        const resultWord = run.lastCorrect ? text('correctAnswer') : text('wrongAnswer');
        const bonus = run.lastBonus ? ` · +${run.lastBonus} ${text('bonus')}` : '';
        elements.feedback.textContent = (
            `${resultWord}. ${question.rightName}: ${question.rightDisplayValue} — ${answerWord}.${bonus}`
        );
        elements.feedback.dataset.state = run.lastCorrect ? 'correct' : 'wrong';
    }

    function renderResult(run) {
        elements.result.hidden = !run.completed;
        elements.share.hidden = !run.completed || run.mode !== 'daily';
        elements.result.classList.toggle('is-visible', run.completed);
        if (!run.completed) return;

        const accuracy = Math.round((run.correctCount / dailyQuestionCount) * 100);
        elements.resultTitle.textContent = text('completed');
        elements.resultBody.textContent = (
            `${run.correctCount}/${dailyQuestionCount} · ${accuracy}% `
            + `${text('accuracy').toLowerCase()} · ${run.score} ${text('points')} · `
            + `${text('bestCombo')}: ${run.bestCombo}`
        );
    }

    function renderMode(run) {
        elements.modes.forEach(button => {
            const active = button.dataset.hlMode === run.mode;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        elements.filterWrap.hidden = run.mode !== 'practice';
        elements.reset.hidden = run.mode !== 'practice';
        elements.modeNote.textContent = run.mode === 'daily'
            ? text('dailyNote')
            : text('practiceNote');
    }

    function renderQuestion(run, question) {
        const count = run.mode === 'daily'
            ? `${Math.min(run.currentIndex + 1, dailyQuestionCount)}/${dailyQuestionCount}`
            : String(run.currentIndex + 1);
        elements.question.textContent = count;
        elements.score.textContent = String(run.score);
        elements.correct.textContent = String(run.correctCount);
        elements.combo.textContent = String(run.combo);
        const metricLabel = text(question.labelKey);
        elements.metric.textContent = `${metricLabel} · ${text(question.unitKey)}`;
        elements.leftLabel.textContent = metricLabel;
        elements.rightLabel.textContent = metricLabel;
        elements.prompt.textContent = text('choose');
        elements.leftName.textContent = question.leftName;
        elements.leftValue.textContent = question.leftDisplayValue;
        elements.rightName.textContent = question.rightName;
        elements.rightValue.textContent = run.revealed ? question.rightDisplayValue : '?';
        elements.rightValue.classList.toggle('is-hidden-value', !run.revealed);
    }

    function renderChoices(run, question) {
        const latest = getLatestAnswer(run);
        elements.choices.forEach(button => {
            const selected = Boolean(latest && button.dataset.hlChoice === latest.choice);
            button.disabled = run.revealed || run.completed;
            button.dataset.selected = String(selected);
            button.setAttribute('aria-pressed', String(selected));
            button.classList.toggle(
                'is-correct-choice',
                run.revealed && button.dataset.hlChoice === question.correctChoice
            );
            button.classList.toggle(
                'is-wrong-choice',
                run.revealed && selected && !latest.correct
            );
        });
    }

    function render(run, question) {
        renderTranslation(run);
        renderMode(run);
        renderQuestion(run, question);
        renderChoices(run, question);
        root.dataset.state = run.completed
            ? 'complete'
            : run.revealed
                ? run.lastCorrect ? 'correct' : 'wrong'
                : 'fresh';
        elements.next.hidden = !run.revealed || run.completed;
        renderCardImages(question);
        renderFeedback(run, question);
        renderResult(run);
    }

    return { render, populateFilter };
}
