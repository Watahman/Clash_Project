import { t } from '../i18n/i18n.js?v=20260829-public-auth-v1';
import { familyCopy } from './clan-family-copy.js?v=20260829-public-auth-v1';
import {
    hasPollAnswer,
    MAX_POLLS_PER_GROUP,
    parsePollAccounts,
    pollResponseCount,
    previousPollAnswer
} from './groups-polls-state.js';

export function createPollRenderer({
    elements,
    state,
    emptyMessage,
    canAdmin,
    onAnswer,
    onShowResults,
    onToggleStatus,
    onDelete
}) {
    return {
        reset,
        renderNotice,
        renderPolls,
        renderAnswerForm,
        renderResults,
        syncCreateState,
        showError
    };

    function reset() {
        elements.notice?.classList.add('hidden');
        elements.empty?.classList.remove('hidden');
        elements.pollsList?.replaceChildren(emptyMessage(t('groups.loading')));
        elements.results?.replaceChildren(emptyMessage(t('groups.noPollSelected')));
        elements.retry?.classList.add('hidden');
        syncCreateState();
    }

    function renderNotice() {
        const poll = state.activePoll;
        if (!poll) {
            elements.empty?.classList.remove('hidden');
            elements.notice?.classList.add('hidden');
            return;
        }
        elements.empty?.classList.add('hidden');
        elements.notice?.classList.remove('hidden');
        if (elements.noticeTitle) elements.noticeTitle.textContent = poll.title;
        if (elements.noticeProgress) elements.noticeProgress.textContent = responseLabel(poll);
        if (elements.answerBtn) {
            elements.answerBtn.textContent = hasPollAnswer(poll, state.currentUserId)
                ? t('groups.editPollAnswer')
                : t('groups.answerPoll');
        }
    }

    function renderPolls() {
        elements.pollsList?.replaceChildren();
        if (!state.polls.length) {
            elements.pollsList?.appendChild(emptyMessage(t('groups.noPolls')));
            return;
        }
        state.polls.forEach(poll => elements.pollsList?.appendChild(pollNode(poll)));
    }

    function pollNode(poll) {
        const item = document.createElement('article');
        item.className = 'cf-poll-row groups-admin-member';
        const info = document.createElement('div');
        info.className = 'cf-poll-row-copy';
        const details = [
            statusLabel(poll.status),
            `${pollResponseCount(poll)}/${state.members.length} ${familyCopy('responses')}`,
            `${poll.rounds || 7} ${t('op.roundsShort')}`,
            poll.created_at ? formatPollDate(poll.created_at) : ''
        ].filter(Boolean).join(' · ');
        info.append(textNode('strong', poll.title), textNode('span', details));
        item.append(info, pollActions(poll));
        return item;
    }

    function pollActions(poll) {
        const actions = document.createElement('div');
        actions.className = 'cf-row-actions';
        if (poll.status === 'open') {
            actions.appendChild(actionButton(
                hasPollAnswer(poll, state.currentUserId) ? t('groups.editPollAnswer') : t('groups.answerPoll'),
                () => onAnswer(poll),
                'button-primary'
            ));
        }
        if (!canAdmin()) return actions;
        actions.appendChild(actionButton(t('groups.viewResults'), () => onShowResults(poll)));
        actions.appendChild(actionButton(
            poll.status === 'open' ? t('groups.closePoll') : t('groups.openPoll'),
            () => onToggleStatus(poll)
        ));
        actions.appendChild(actionButton(t('groups.deletePoll'), () => onDelete(poll), 'button-danger'));
        return actions;
    }

    function renderAnswerForm(profile, poll) {
        elements.answerBody?.replaceChildren();
        const accounts = parsePollAccounts(profile?.accounts);
        if (!accounts.length) {
            elements.answerBody?.appendChild(emptyMessage(t('groups.noAccountsForPoll')));
            return;
        }
        const previous = poll.answers?.[state.currentUserId]?.accounts || [];
        accounts.forEach((account, index) => {
            elements.answerBody?.appendChild(accountAnswerNode(
                account,
                previousPollAnswer(account, previous),
                index,
                poll.rounds || 7
            ));
        });
    }

    function accountAnswerNode(account, previous, index, rounds) {
        const card = document.createElement('div');
        card.className = 'groups-poll-account-card';
        const tag = account.tag || account.playerTag || account.accountTag || '';
        const name = account.name || account.playerName || tag || `${t('op.player')} ${index + 1}`;
        card.dataset.tag = tag;
        card.dataset.name = name;
        card.dataset.townHall = account.townHallLevel || account.townHall || '';
        const wants = document.createElement('input');
        wants.type = 'checkbox';
        wants.className = 'groups-poll-wants';
        wants.checked = previous ? Boolean(previous.wantsCwl) : true;
        const head = document.createElement('label');
        head.className = 'groups-poll-account-head';
        head.append(wants, textNode('strong', `${name} ${tag}`), textNode('span', t('groups.wantsCwl')));
        const days = document.createElement('div');
        days.className = 'groups-poll-days';
        for (let day = 1; day <= rounds; day += 1) days.appendChild(dayToggle(day, previous?.days?.[day] ?? true));
        wants.addEventListener('change', () => days.classList.toggle('hidden', !wants.checked));
        days.classList.toggle('hidden', !wants.checked);
        card.append(head, days);
        return card;
    }

    function renderResults(poll) {
        if (!elements.results || !canAdmin()) return;
        elements.results.replaceChildren();
        if (!poll) {
            elements.results.appendChild(emptyMessage(t('groups.noPollSelected')));
            return;
        }
        const total = state.members.length;
        const answered = pollResponseCount(poll);
        elements.results.appendChild(textNode(
            'p',
            `${t('groups.pollMembersTotal')}: ${total} · ${t('groups.pollAnswered')}: ${answered} · ${t('groups.pollMissing')}: ${Math.max(0, total - answered)}`,
            'groups-poll-summary'
        ));
        const rounds = poll.rounds || 7;
        const table = document.createElement('div');
        table.className = 'cf-poll-results-table';
        table.setAttribute('role', 'table');
        table.appendChild(matrixHeader(rounds));
        state.members.forEach(member => renderMemberResults(table, member, poll, rounds));
        elements.results.appendChild(table);
    }

    function showError(error, container = elements.results) {
        console.error(error);
        container?.replaceChildren(emptyMessage(t('groups.pollActionError')));
    }

    function syncCreateState() {
        const allowed = canAdmin()
            && state.loaded
            && !state.limitBlocked
            && state.polls.length < MAX_POLLS_PER_GROUP;
        if (elements.createBtn) elements.createBtn.disabled = !allowed;
        if (elements.limitFeedback) elements.limitFeedback.hidden = !canAdmin() || !state.limitBlocked;
    }

    function responseLabel(poll) {
        const answered = pollResponseCount(poll);
        const suffix = answered === 1 ? familyCopy('response') : familyCopy('responses');
        return `${answered} / ${state.members.length} ${suffix}`;
    }
}

function renderMemberResults(table, member, poll, rounds) {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
    const name = profile?.name || member.name || t('groups.member');
    const answer = poll.answers?.[member.user_id];
    if (!answer || !answer.accounts?.length) {
        table.appendChild(matrixRow(name, t('groups.notAnswered'), null, rounds, member.user_id));
        return;
    }
    answer.accounts.forEach(account => table.appendChild(matrixRow(
        `${name} / ${account.name || account.tag || t('groups.account')}`,
        '',
        account,
        rounds,
        member.user_id
    )));
}

function matrixHeader(rounds) {
    const row = document.createElement('div');
    row.className = 'cf-poll-matrix-row cf-poll-matrix-header';
    row.style.setProperty('--poll-days', rounds);
    row.setAttribute('role', 'row');
    row.appendChild(textNode('span', t('groups.member'), 'cf-poll-matrix-cell'));
    for (let day = 1; day <= rounds; day += 1) row.appendChild(textNode('span', `${t('op.day')} ${day}`, 'cf-poll-matrix-cell'));
    return row;
}

function matrixRow(name, status, account, rounds, userId) {
    const row = document.createElement('div');
    row.className = 'cf-poll-matrix-row';
    row.dataset.userId = userId;
    row.style.setProperty('--poll-days', rounds);
    row.setAttribute('role', 'row');
    const nameCell = textNode('span', name, 'cf-poll-matrix-cell cf-poll-matrix-name');
    if (status) nameCell.title = status;
    row.appendChild(nameCell);
    for (let day = 1; day <= rounds; day += 1) {
        const available = account ? Boolean(account.wantsCwl && account.days?.[day]) : false;
        const cell = textNode('span', account ? (available ? 'Yes' : 'No') : '-', 'cf-poll-matrix-cell');
        cell.dataset.state = account ? (available ? 'available' : 'unavailable') : 'missing';
        cell.setAttribute('aria-label', `${t('op.day')} ${day}: ${cell.textContent}`);
        row.appendChild(cell);
    }
    return row;
}

function dayToggle(day, checked) {
    const label = document.createElement('label');
    label.className = 'groups-poll-day-toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.day = String(day);
    input.checked = checked;
    label.append(input, document.createTextNode(`${t('op.day')} ${day}`));
    return label;
}

function statusLabel(status) {
    return status === 'open' ? familyCopy('openStatus') : familyCopy('closedStatus');
}

function formatPollDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function actionButton(label, onClick, style = 'button-secondary') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button button-small ${style}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function textNode(tag, text, className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}
