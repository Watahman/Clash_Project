import { answerGroupPoll, createGroupPoll, deleteGroupPoll, getGroupPolls, sendGroupPollReminder, setGroupPollStatus } from '../Supabase/Supabase-GroupPolls.js';
import { checkUserId } from '../Supabase/Supabase-User.js';
import { t } from '../i18n/i18n.js';
import { getCurrentUserId } from '../utils/user.js';
import { withGlobalLoading } from '../utils/loading-state.js';
import { bindGroupDialog, closeGroupDialog, openGroupDialog } from './groups-dialog.js';
import { isGroupAdmin } from './groups-roles.js';
import { familyCopy } from './clan-family-copy.js';
import { OPEN_POLL_STORAGE_KEY } from '../notifications/poll-notifications.js';

const MAX_POLLS_PER_GROUP = 3;

export function initGroupPolls(emptyMessage = message => Object.assign(document.createElement('p'), { textContent: message })) {
    const el = query();
    const state = { group: null, members: [], polls: [], fixturePolls: null, currentRole: 'member', currentUserId: '', entry: {}, activePoll: null, selectedPoll: null, loaded: false, limitBlocked: false };
    const closeAnswer = () => closeGroupDialog(el.answerOverlay);
    const isAdmin = () => isGroupAdmin(state.currentRole);
    const responseLabel = poll => {
        const answered = Object.keys(poll?.answers || {}).length;
        const suffix = answered === 1 ? familyCopy('response') : familyCopy('responses');
        return `${answered} / ${state.members.length} ${suffix}`;
    };

    bindGroupDialog(el.answerOverlay, closeAnswer);
    el.createBtn?.addEventListener('click', createPoll);
    el.answerBtn?.addEventListener('click', openAnswerOverlay);
    el.answerClose?.addEventListener('click', closeAnswer);
    el.answerCancel?.addEventListener('click', closeAnswer);
    el.answerSave?.addEventListener('click', saveAnswer);
    el.reminderBtn?.addEventListener('click', sendReminder);
    window.addEventListener('clashtools:group-opened', event => {
        state.group = event.detail?.group || null;
        state.members = Array.isArray(event.detail?.members) ? event.detail.members : [];
        state.currentRole = event.detail?.currentRole || 'member';
        state.currentUserId = event.detail?.currentUserId || getCurrentUserId();
        state.entry = event.detail?.entry || {};
        state.fixturePolls = state.entry?.fixture ? clonePolls(state.entry.polls) : null;
        void loadPolls();
    });

    async function loadPolls() {
        resetView();
        if (!state.group || !state.currentUserId) return;
        const requestedGroupId = state.group.id;
        try {
            const data = state.entry?.fixture
                ? state.fixturePolls || []
                : await getGroupPolls(requestedGroupId, state.currentUserId);
            if (state.group?.id !== requestedGroupId) return;
            state.polls = Array.isArray(data) ? data : [];
            state.loaded = true;
            state.limitBlocked = state.polls.length >= MAX_POLLS_PER_GROUP;
            state.activePoll = findLatestOpenCwlPoll(state.polls);
            const requestedPollId = sessionStorage.getItem(OPEN_POLL_STORAGE_KEY) || '';
            state.selectedPoll = state.polls.find(poll => poll.id === requestedPollId) || state.activePoll || state.polls[0] || null;
            renderNotice();
            renderPolls();
            syncCreatePollState();
            if (isAdmin()) renderResults(state.selectedPoll);
            window.dispatchEvent(new CustomEvent('clan-family:polls-updated', { detail: { groupId: requestedGroupId, polls: state.polls } }));
            if (requestedPollId) {
                sessionStorage.removeItem(OPEN_POLL_STORAGE_KEY);
                window.dispatchEvent(new CustomEvent('clashtools:group-tab-requested', { detail: { tab: 'polls' } }));
            }
        } catch (error) {
            console.error(error);
            state.loaded = false;
            el.pollsList?.replaceChildren(emptyMessage(t('groups.pollLoadError')));
            el.notice?.classList.add('hidden');
            el.empty?.classList.remove('hidden');
            el.retry?.classList.remove('hidden');
        }
    }

    function resetView() {
        state.polls = [];
        state.activePoll = null;
        state.selectedPoll = null;
        state.loaded = false;
        state.limitBlocked = false;
        el.notice?.classList.add('hidden');
        el.empty?.classList.remove('hidden');
        el.pollsList?.replaceChildren(emptyMessage(t('groups.loading')));
        el.results?.replaceChildren(emptyMessage(t('groups.noPollSelected')));
        el.retry?.classList.add('hidden');
        syncCreatePollState();
    }

    function renderNotice() {
        const poll = state.activePoll;
        if (!poll) {
            el.empty?.classList.remove('hidden');
            el.notice?.classList.add('hidden');
            return;
        }
        el.empty?.classList.add('hidden');
        el.notice?.classList.remove('hidden');
        if (el.noticeTitle) el.noticeTitle.textContent = poll.title;
        if (el.noticeProgress) el.noticeProgress.textContent = responseLabel(poll);
        if (el.answerBtn) el.answerBtn.textContent = hasAnswer(poll, state.currentUserId) ? t('groups.editPollAnswer') : t('groups.answerPoll');
    }

    function renderPolls() {
        el.pollsList?.replaceChildren();
        if (!state.polls.length) {
            el.pollsList?.appendChild(emptyMessage(t('groups.noPolls')));
            return;
        }
        state.polls.forEach(poll => el.pollsList?.appendChild(pollNode(poll)));
    }

    function pollNode(poll) {
        const item = document.createElement('article');
        item.className = 'cf-poll-row groups-admin-member';
        const info = document.createElement('div');
        info.className = 'cf-poll-row-copy';
        const answered = Object.keys(poll.answers || {}).length;
        const date = poll.created_at ? formatPollDate(poll.created_at) : '';
        const details = [`${statusLabel(poll.status)}`, `${answered}/${state.members.length} ${familyCopy('responses')}`, `${poll.rounds || 7} ${t('op.roundsShort')}`, date].filter(Boolean).join(' · ');
        info.append(textNode('strong', poll.title), textNode('span', details));
        const actions = document.createElement('div');
        actions.className = 'cf-row-actions';
        if (poll.status === 'open') actions.appendChild(actionButton(hasAnswer(poll, state.currentUserId) ? t('groups.editPollAnswer') : t('groups.answerPoll'), () => openAnswerFor(poll), 'button-primary'));
        if (isAdmin()) {
            actions.appendChild(actionButton(t('groups.viewResults'), () => showResults(poll), 'button-secondary'));
            actions.appendChild(actionButton(poll.status === 'open' ? t('groups.closePoll') : t('groups.openPoll'), () => toggleStatus(poll), 'button-secondary'));
            actions.appendChild(actionButton(t('groups.deletePoll'), () => removePoll(poll), 'button-danger'));
        }
        item.append(info, actions);
        return item;
    }

    function createPoll() {
        if (!state.group || !isAdmin() || state.polls.length >= MAX_POLLS_PER_GROUP) return syncCreatePollState();
        const title = el.titleInput?.value?.trim() || t('groups.defaultPollTitle');
        const rounds = Math.max(1, Math.min(7, Number(el.roundsInput?.value || 7)));
        if (state.entry?.fixture) {
            state.fixturePolls = [{ id: `fixture-poll-${Date.now()}`, title, type: 'cwl_availability', status: 'open', rounds, answers: {}, created_at: new Date().toISOString() }, ...state.polls];
            if (el.titleInput) el.titleInput.value = '';
            void loadPolls();
            return;
        }
        withGlobalLoading(() => createGroupPoll(state.group.id, state.currentUserId, title, rounds)
            .then(() => { if (el.titleInput) el.titleInput.value = ''; window.dispatchEvent(new CustomEvent('clashtools:notifications-refresh-requested')); return loadPolls(); })
            .catch(error => { if (error?.code === 'POLL_LIMIT_REACHED') state.limitBlocked = true; showPollError(error); syncCreatePollState(); }), t('groups.loading'));
    }

    function toggleStatus(poll) {
        if (!isAdmin()) return;
        const status = poll.status === 'open' ? 'closed' : 'open';
        if (state.entry?.fixture) {
            poll.status = status;
            void loadPolls();
            return;
        }
        withGlobalLoading(() => setGroupPollStatus(state.group.id, state.currentUserId, poll.id, status).then(loadPolls).catch(showPollError), t('groups.loading'));
    }

    function removePoll(poll) {
        if (!isAdmin() || !window.confirm(t('groups.deletePollConfirm', { title: poll.title }))) return;
        if (state.entry?.fixture) {
            state.fixturePolls = state.polls.filter(item => item.id !== poll.id);
            void loadPolls();
            return;
        }
        withGlobalLoading(() => deleteGroupPoll(state.group.id, state.currentUserId, poll.id)
            .then(() => { window.dispatchEvent(new CustomEvent('clashtools:notifications-refresh-requested')); return loadPolls(); })
            .catch(showPollError), t('groups.loading'));
    }

    function syncCreatePollState() {
        const allowed = isAdmin() && state.loaded && !state.limitBlocked && state.polls.length < MAX_POLLS_PER_GROUP;
        if (el.createBtn) el.createBtn.disabled = !allowed;
        if (el.limitFeedback) el.limitFeedback.hidden = !isAdmin() || !state.limitBlocked;
    }

    async function openAnswerOverlay() {
        openAnswerFor(state.activePoll);
    }

    async function openAnswerFor(poll) {
        if (!poll || !state.group) return;
        state.activePoll = poll;
        const profile = state.entry?.fixture
            ? state.members.find(member => member.user_id === state.currentUserId)?.profile
            : await checkUserId(state.currentUserId).then(data => Array.isArray(data) ? data[0] : data).catch(() => null);
        el.answerOverlay?.classList.remove('hidden');
        if (el.answerTitle) el.answerTitle.textContent = poll.title;
        if (el.answerGroup) el.answerGroup.textContent = `${t('groups.group')}: ${state.group.name}`;
        renderAnswerForm(profile, poll);
        openGroupDialog(el.answerOverlay, el.answerClose);
    }

    function renderAnswerForm(profile, poll) {
        el.answerBody?.replaceChildren();
        const accounts = parseAccounts(profile?.accounts);
        if (!accounts.length) return el.answerBody?.appendChild(emptyMessage(t('groups.noAccountsForPoll')));
        const previous = poll.answers?.[state.currentUserId]?.accounts || [];
        accounts.forEach((account, index) => el.answerBody?.appendChild(accountAnswerNode(account, previousAnswer(account, previous), index, poll.rounds || 7)));
    }

    function accountAnswerNode(account, previous, index, rounds) {
        const card = document.createElement('div');
        card.className = 'groups-poll-account-card';
        const tag = account.tag || account.playerTag || account.accountTag || '';
        const name = account.name || account.playerName || tag || `${t('op.player')} ${index + 1}`;
        card.dataset.tag = tag; card.dataset.name = name; card.dataset.townHall = account.townHallLevel || account.townHall || '';
        const head = document.createElement('label');
        head.className = 'groups-poll-account-head';
        const wants = document.createElement('input');
        wants.type = 'checkbox'; wants.className = 'groups-poll-wants'; wants.checked = previous ? Boolean(previous.wantsCwl) : true;
        head.append(wants, textNode('strong', `${name} ${tag}`), textNode('span', t('groups.wantsCwl')));
        const days = document.createElement('div'); days.className = 'groups-poll-days';
        for (let day = 1; day <= rounds; day += 1) days.appendChild(dayToggle(day, previous?.days?.[day] ?? true));
        wants.addEventListener('change', () => days.classList.toggle('hidden', !wants.checked));
        days.classList.toggle('hidden', !wants.checked);
        card.append(head, days);
        return card;
    }

    function dayToggle(day, checked) {
        const label = document.createElement('label'); label.className = 'groups-poll-day-toggle';
        const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.day = String(day); input.checked = checked;
        label.append(input, document.createTextNode(`${t('op.day')} ${day}`));
        return label;
    }

    function saveAnswer() {
        if (!state.activePoll || !state.group) return;
        const accounts = [...(el.answerBody?.querySelectorAll('.groups-poll-account-card') || [])].map(readAccountAnswer);
        if (state.entry?.fixture) {
            state.activePoll.answers = { ...(state.activePoll.answers || {}), [state.currentUserId]: { accounts } };
            closeGroupDialog(el.answerOverlay);
            void loadPolls();
            return;
        }
        withGlobalLoading(() => answerGroupPoll(state.group.id, state.currentUserId, state.activePoll.id, accounts)
            .then(() => { closeGroupDialog(el.answerOverlay); return loadPolls(); })
            .catch(error => showPollError(error, el.answerBody)), t('groups.loading'));
    }

    function showResults(poll) {
        state.selectedPoll = poll;
        renderResults(poll);
        window.dispatchEvent(new CustomEvent('clashtools:group-tab-requested', { detail: { tab: 'polls' } }));
    }

    function renderResults(poll) {
        if (!el.results || !isAdmin()) return;
        el.results.replaceChildren();
        if (!poll) return el.results.appendChild(emptyMessage(t('groups.noPollSelected')));
        const total = state.members.length;
        const answered = Object.keys(poll.answers || {}).length;
        el.results.appendChild(textNode('p', `${t('groups.pollMembersTotal')}: ${total} · ${t('groups.pollAnswered')}: ${answered} · ${t('groups.pollMissing')}: ${Math.max(0, total - answered)}`, 'groups-poll-summary'));
        const rounds = poll.rounds || 7;
        const table = document.createElement('div');
        table.className = 'cf-poll-results-table';
        table.setAttribute('role', 'table');
        table.appendChild(matrixHeader(rounds));
        state.members.forEach(member => renderMemberResults(table, member, poll, rounds));
        el.results.appendChild(table);
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

    function renderMemberResults(table, member, poll, rounds) {
        const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
        const name = profile?.name || member.name || t('groups.member');
        const answer = poll.answers?.[member.user_id];
        if (!answer || !answer.accounts?.length) {
            table.appendChild(matrixRow(name, t('groups.notAnswered'), null, rounds, member.user_id));
            return;
        }
        answer.accounts.forEach(account => table.appendChild(matrixRow(`${name} / ${account.name || account.tag || t('groups.account')}`, '', account, rounds, member.user_id)));
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

    function sendReminder() {
        const poll = state.selectedPoll || state.activePoll;
        if (!isAdmin() || !state.group || !poll) return;
        el.reminderBtn.disabled = true;
        const result = state.entry?.fixture ? Promise.resolve({ created: Math.max(0, state.members.length - Object.keys(poll.answers || {}).length), skipped: 0 }) : sendGroupPollReminder(state.group.id, poll.id, state.currentUserId);
        result.then(value => {
            window.dispatchEvent(new CustomEvent('clashtools:notifications-refresh-requested'));
            el.results?.prepend(textNode('p', t('groups.reminderResult', { created: value?.created || 0, skipped: value?.skipped || 0 }), 'cf-inline-status'));
        }).catch(() => el.results?.prepend(textNode('p', t('groups.reminderError'), 'cf-inline-status'))).finally(() => { el.reminderBtn.disabled = false; });
    }

    function showPollError(error, container = el.results) {
        console.error(error);
        container?.replaceChildren(emptyMessage(t('groups.pollActionError')));
    }

    el.retry?.addEventListener('click', () => void loadPolls());
}

function query() {
    return {
        empty: document.querySelector('#groups-poll-empty'), notice: document.querySelector('#groups-poll-notice'), noticeTitle: document.querySelector('#groups-poll-notice-title'), noticeProgress: document.querySelector('#groups-poll-notice-progress'), answerBtn: document.querySelector('#groups-poll-answer-btn'), retry: document.querySelector('#groups-polls-retry'), createBtn: document.querySelector('#groups-poll-create-btn'), limitFeedback: document.querySelector('#groups-poll-limit-feedback'), titleInput: document.querySelector('#groups-poll-title-input'), roundsInput: document.querySelector('#groups-poll-rounds-input'), pollsList: document.querySelector('#groups-admin-polls-list'), results: document.querySelector('#groups-poll-results'), reminderBtn: document.querySelector('#groups-poll-reminder-btn'), answerOverlay: document.querySelector('#groups-poll-answer-overlay'), answerClose: document.querySelector('#groups-poll-answer-close'), answerCancel: document.querySelector('#groups-poll-answer-cancel'), answerSave: document.querySelector('#groups-poll-answer-save'), answerTitle: document.querySelector('#groups-poll-answer-title'), answerGroup: document.querySelector('#groups-poll-answer-group'), answerBody: document.querySelector('#groups-poll-answer-body')
    };
}

function findLatestOpenCwlPoll(polls) {
    return [...polls].filter(poll => poll.type === 'cwl_availability' && poll.status === 'open').sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
}

function hasAnswer(poll, userId) {
    return Boolean(poll?.answers?.[userId]);
}

function previousAnswer(account, previous) {
    const tag = account.tag || account.playerTag || account.accountTag || '';
    return previous.find(answer => answer.tag && answer.tag === tag) || null;
}

function readAccountAnswer(card) {
    const wants = card.querySelector('.groups-poll-wants')?.checked || false;
    const days = {};
    card.querySelectorAll('[data-day]').forEach(input => { days[input.dataset.day] = input.checked; });
    return { name: card.dataset.name, tag: card.dataset.tag, townHall: card.dataset.townHall, wantsCwl: wants, days: wants ? days : {} };
}

function parseAccounts(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function clonePolls(value) {
    return Array.isArray(value) ? value.map(poll => ({ ...poll, answers: { ...(poll.answers || {}) } })) : [];
}

function statusLabel(status) {
    return status === 'open' ? familyCopy('openStatus') : familyCopy('closedStatus');
}

function formatPollDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function actionButton(label, onClick, style = 'button-secondary') {
    const button = document.createElement('button'); button.type = 'button'; button.className = `button button-small ${style}`; button.textContent = label; button.addEventListener('click', onClick); return button;
}

function textNode(tag, text, className = '') {
    const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
}
