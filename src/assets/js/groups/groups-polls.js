import { bindGroupDialog, closeGroupDialog } from './groups-dialog.js';
import { createPollActions } from './groups-polls-actions.js';
import { createPollRenderer } from './groups-polls-render.js';
import { createPollState } from './groups-polls-state.js';

export function initGroupPolls(emptyMessage = message => Object.assign(document.createElement('p'), { textContent: message })) {
    const elements = queryPollElements();
    const state = createPollState();
    const actionRef = { current: null };
    const renderer = createPollRenderer({
        elements,
        state,
        emptyMessage,
        canAdmin: () => actionRef.current?.canAdmin?.() || ['leader', 'co_leader'].includes(state.currentRole),
        onAnswer: poll => actionRef.current?.openAnswerFor(poll),
        onShowResults: poll => actionRef.current?.showResults(poll),
        onToggleStatus: poll => actionRef.current?.toggleStatus(poll),
        onDelete: poll => actionRef.current?.removePoll(poll)
    });
    const actions = createPollActions({ elements, state, renderer });
    actionRef.current = actions;
    bindPollEvents(elements, actions);
    return actions;
}

function bindPollEvents(elements, actions) {
    bindGroupDialog(elements.answerOverlay, () => closeGroupDialog(elements.answerOverlay));
    elements.createBtn?.addEventListener('click', actions.createPoll);
    elements.answerBtn?.addEventListener('click', actions.openActiveAnswer);
    elements.answerClose?.addEventListener('click', () => closeGroupDialog(elements.answerOverlay));
    elements.answerCancel?.addEventListener('click', () => closeGroupDialog(elements.answerOverlay));
    elements.answerSave?.addEventListener('click', actions.saveAnswer);
    elements.reminderBtn?.addEventListener('click', actions.sendReminder);
    elements.retry?.addEventListener('click', actions.loadPolls);
    window.addEventListener('clashtools:group-opened', event => actions.handleGroupOpened(event.detail));
}

function queryPollElements() {
    return {
        empty: document.querySelector('#groups-poll-empty'),
        notice: document.querySelector('#groups-poll-notice'),
        noticeTitle: document.querySelector('#groups-poll-notice-title'),
        noticeProgress: document.querySelector('#groups-poll-notice-progress'),
        answerBtn: document.querySelector('#groups-poll-answer-btn'),
        retry: document.querySelector('#groups-polls-retry'),
        createBtn: document.querySelector('#groups-poll-create-btn'),
        limitFeedback: document.querySelector('#groups-poll-limit-feedback'),
        titleInput: document.querySelector('#groups-poll-title-input'),
        roundsInput: document.querySelector('#groups-poll-rounds-input'),
        pollsList: document.querySelector('#groups-admin-polls-list'),
        results: document.querySelector('#groups-poll-results'),
        reminderBtn: document.querySelector('#groups-poll-reminder-btn'),
        answerOverlay: document.querySelector('#groups-poll-answer-overlay'),
        answerClose: document.querySelector('#groups-poll-answer-close'),
        answerCancel: document.querySelector('#groups-poll-answer-cancel'),
        answerSave: document.querySelector('#groups-poll-answer-save'),
        answerTitle: document.querySelector('#groups-poll-answer-title'),
        answerGroup: document.querySelector('#groups-poll-answer-group'),
        answerBody: document.querySelector('#groups-poll-answer-body')
    };
}
