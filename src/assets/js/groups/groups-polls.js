import { answerGroupPoll, createGroupPoll, getGroupPolls, setGroupPollStatus, sendGroupPollReminder } from "../Supabase/Supabase-GroupPolls.js";
import { checkUserId } from "../Supabase/Supabase-User.js";
import { t } from "../i18n/i18n.js";
import { getCurrentUserId } from "../utils/user.js";
import { withGlobalLoading } from "../utils/loading-state.js";
import { bindBackdropClick } from "../utils/backdrop-click.js";
import { isGroupAdmin } from "./groups-roles.js";

export function initGroupPolls(emptyMessage) {
    const el = query();
    let group = null;
    let members = [];
    let polls = [];
    let currentRole = 'member';
    let activePoll = null;
    let selectedResultPoll = null;
    let currentUser = null;

    window.addEventListener('clashtools:group-opened', event => {
        group = event.detail?.group || null;
        members = Array.isArray(event.detail?.members) ? event.detail.members : [];
        currentRole = event.detail?.currentRole || 'member';
        loadPolls();
    });

    el.createBtn?.addEventListener('click', createPoll);
    el.answerBtn?.addEventListener('click', openAnswerOverlay);
    el.answerClose?.addEventListener('click', closeAnswerOverlay);
    el.answerCancel?.addEventListener('click', closeAnswerOverlay);
    el.answerSave?.addEventListener('click', saveAnswer);
    bindBackdropClick(el.answerOverlay, closeAnswerOverlay);
    el.reminderBtn?.addEventListener('click', sendReminder);

    async function loadPolls() {
        const userId = getCurrentUserId();
        resetView();
        if (!group || !userId) return;
        const requestedGroupId = group.id;
        getGroupPolls(requestedGroupId, userId)
            .then(data => {
                if (group?.id !== requestedGroupId) return;
                polls = Array.isArray(data) ? data : [];
                activePoll = findLatestOpenCwlPoll(polls);
                renderNotice();
                if (isAdmin()) {
                    renderAdminPolls();
                    renderResults(activePoll || polls[0] || null);
                }
            })
            .catch(() => {
                if (group?.id !== requestedGroupId) return;
                el.results?.replaceChildren(emptyMessage(t('groups.pollLoadError')));
            });
    }

    function resetView() {
        polls = [];
        activePoll = null;
        selectedResultPoll = null;
        el.notice?.classList.add('hidden');
        el.availabilityEmpty?.classList.remove('hidden');
        el.pollsList?.replaceChildren(emptyMessage(t('groups.noPolls')));
        el.results?.replaceChildren(emptyMessage(t('groups.noPollSelected')));
    }

    function renderNotice() {
        if (!activePoll || !el.notice) return;
        el.notice.classList.remove('hidden');
        el.availabilityEmpty?.classList.add('hidden');
        if (el.noticeTitle) el.noticeTitle.textContent = activePoll.title;
        if (el.answerBtn) {
            el.answerBtn.textContent = hasAnswer(activePoll, getCurrentUserId()) ? t('groups.editPollAnswer') : t('groups.answerPoll');
        }
    }

    function renderAdminPolls() {
        el.pollsList?.replaceChildren();
        if (!isAdmin()) return;
        if (!polls.length) return el.pollsList?.appendChild(emptyMessage(t('groups.noPolls')));
        polls.forEach(poll => el.pollsList?.appendChild(pollNode(poll)));
    }

    function pollNode(poll) {
        const item = document.createElement('div');
        item.className = 'groups-admin-member';
        const info = document.createElement('div');
        info.className = 'groups-admin-member-info';
        info.append(textNode('strong', poll.title), textNode('span', `${poll.status} - ${poll.rounds || 7} ${t('op.roundsShort')}`));
        const actions = document.createElement('div');
        actions.className = 'groups-admin-member-actions';
        actions.append(actionButton(t('groups.viewResults'), () => openResults(poll), 'btn-groups-default'));
        actions.append(actionButton(poll.status === 'open' ? t('groups.closePoll') : t('groups.openPoll'), () => toggleStatus(poll)));
        item.append(info, actions);
        return item;
    }

    function createPoll() {
        if (!group || !isAdmin()) return;
        const title = el.titleInput?.value?.trim() || t('groups.defaultPollTitle');
        const rounds = Math.max(1, Math.min(7, Number(el.roundsInput?.value || 7)));
        withGlobalLoading(() => createGroupPoll(group.id, getCurrentUserId(), title, rounds)
            .then(() => {
                if (el.titleInput) el.titleInput.value = '';
                loadPolls();
            })
            .catch(error => showPollError(error)), t('groups.loading'));
    }

    function toggleStatus(poll) {
        if (!isAdmin()) return;
        const status = poll.status === 'open' ? 'closed' : 'open';
        withGlobalLoading(() => setGroupPollStatus(group.id, getCurrentUserId(), poll.id, status)
            .then(loadPolls)
            .catch(error => showPollError(error)), t('groups.loading'));
    }

    async function openAnswerOverlay() {
        if (!activePoll || !group) return;
        currentUser = await checkUserId(getCurrentUserId()).then(data => Array.isArray(data) ? data[0] : data).catch(() => null);
        el.answerOverlay?.classList.remove('hidden');
        if (el.answerTitle) el.answerTitle.textContent = activePoll.title;
        if (el.answerGroup) el.answerGroup.textContent = `${t('groups.group')}: ${group.name}`;
        renderAnswerForm();
    }

    function closeAnswerOverlay() {
        el.answerOverlay?.classList.add('hidden');
    }

    function renderAnswerForm() {
        el.answerBody?.replaceChildren();
        const accounts = Array.isArray(currentUser?.accounts) ? currentUser.accounts : parseAccounts(currentUser?.accounts);
        if (!accounts.length) return el.answerBody?.appendChild(emptyMessage(t('groups.noAccountsForPoll')));
        const previous = activePoll?.answers?.[getCurrentUserId()]?.accounts || [];
        accounts.forEach((account, index) => el.answerBody?.appendChild(accountAnswerNode(account, previousAnswer(account, previous), index)));
    }

    function previousAnswer(account, previous) {
        const tag = account.tag || account.playerTag || account.accountTag || '';
        return previous.find(answer => answer.tag && answer.tag === tag) || null;
    }

    function accountAnswerNode(account, previous, index) {
        const card = document.createElement('div');
        card.className = 'groups-poll-account-card';
        const tag = account.tag || account.playerTag || account.accountTag || '';
        const name = account.name || account.playerName || tag || `${t('op.player')} ${index + 1}`;
        card.dataset.index = String(index);
        card.dataset.tag = tag;
        card.dataset.name = name;
        card.dataset.townHall = account.townHallLevel || account.townHall || '';

        const head = document.createElement('label');
        head.className = 'groups-poll-account-head';
        const wants = document.createElement('input');
        wants.type = 'checkbox';
        wants.className = 'groups-poll-wants';
        wants.checked = previous ? Boolean(previous.wantsCwl) : true;
        head.append(wants, textNode('strong', `${name} ${tag}`), textNode('span', t('groups.wantsCwl')));

        const days = document.createElement('div');
        days.className = 'groups-poll-days';
        for (let day = 1; day <= (activePoll.rounds || 7); day += 1) {
            days.appendChild(dayToggle(day, previous?.days?.[day] ?? true));
        }
        wants.addEventListener('change', () => days.classList.toggle('hidden', !wants.checked));
        days.classList.toggle('hidden', !wants.checked);
        card.append(head, days);
        return card;
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

    function saveAnswer() {
        if (!activePoll || !group) return;
        const accounts = Array.from(el.answerBody.querySelectorAll('.groups-poll-account-card')).map(readAccountAnswer);
        withGlobalLoading(() => answerGroupPoll(group.id, getCurrentUserId(), activePoll.id, accounts)
            .then(() => {
                closeAnswerOverlay();
                loadPolls();
            })
            .catch(error => showPollError(error, el.answerBody)), t('groups.loading'));
    }

    function showPollError(error, container = el.results) {
        console.error(error);
        container?.replaceChildren(emptyMessage(t('groups.pollActionError')));
    }

    function readAccountAnswer(card) {
        const wants = card.querySelector('.groups-poll-wants')?.checked || false;
        const days = {};
        card.querySelectorAll('[data-day]').forEach(input => { days[input.dataset.day] = input.checked; });
        return {
            name: card.dataset.name,
            tag: card.dataset.tag,
            townHall: card.dataset.townHall,
            wantsCwl: wants,
            days: wants ? days : {}
        };
    }

    async function renderResults(poll) {
        el.results?.replaceChildren();
        if (!isAdmin()) return;
        if (!poll) return el.results?.appendChild(emptyMessage(t('groups.noPollSelected')));
        selectedResultPoll = poll;
        const resultMembers = Array.isArray(poll.members) ? poll.members : members;
        const answerUserIds = Object.keys(poll.answers || {});
        el.results.appendChild(summaryNode(resultMembers.length, answerUserIds.length));
        el.results.appendChild(daySummaryNode(poll));
        resultMembers.forEach(member => el.results.appendChild(userResultNode(member, poll)));
    }

    function openResults(poll) {
        renderResults(poll);
        window.dispatchEvent(new CustomEvent('clashtools:group-tab-requested', { detail: { tab: 'availability' } }));
    }

    function summaryNode(total, answered) {
        const node = document.createElement('div');
        node.className = 'groups-poll-summary';
        node.textContent = `${t('groups.pollMembersTotal')}: ${total} - ${t('groups.pollAnswered')}: ${answered} - ${t('groups.pollMissing')}: ${Math.max(0, total - answered)}`;
        return node;
    }

    function daySummaryNode(poll) {
        const counts = {};
        for (let day = 1; day <= (poll.rounds || 7); day += 1) counts[day] = 0;
        Object.values(poll.answers || {}).forEach(answer => {
            (answer.accounts || []).forEach(account => {
                if (!account.wantsCwl) return;
                Object.entries(account.days || {}).forEach(([day, value]) => { if (value) counts[day] = (counts[day] || 0) + 1; });
            });
        });
        const node = document.createElement('div');
        node.className = 'groups-poll-day-summary';
        Object.entries(counts).forEach(([day, count]) => node.appendChild(textNode('span', `${t('op.day')} ${day}: ${count}`)));
        return node;
    }

    function userResultNode(member, poll) {
        const answer = poll.answers?.[member.user_id];
        const node = document.createElement('div');
        node.className = 'groups-poll-result-user';
        node.dataset.userId = member.user_id;
        const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;
        node.appendChild(textNode('strong', profile?.name || member.name || member.user_id));
        if (!answer) {
            node.appendChild(textNode('span', t('groups.notAnswered')));
            return node;
        }
        (answer.accounts || []).forEach(account => node.appendChild(textNode('span', accountResultText(account))));
        return node;
    }

    function accountResultText(account) {
        const days = Object.entries(account.days || {}).filter(([, value]) => value).map(([day]) => day).join(', ');
        return `${account.name || account.tag} (${account.tag || '-'}) - ${account.wantsCwl ? t('groups.yesCwl') : t('groups.noCwl')} - ${days || '-'}`;
    }

    function sendReminder() {
        const poll = selectedResultPoll || activePoll;
        if (!isAdmin() || !group || !poll) return;
        el.reminderBtn.disabled = true;
        sendGroupPollReminder(group.id, poll.id)
            .then(result => {
                const message = t('groups.reminderResult', {
                    created: result?.created || 0,
                    skipped: result?.skipped || 0,
                    answered: result?.answered || 0
                });
                el.results?.prepend(Object.assign(document.createElement('p'), {
                    className: 'groups-admin-help',
                    textContent: message
                }));
            })
            .catch(() => {
                el.results?.prepend(Object.assign(document.createElement('p'), {
                    className: 'groups-admin-help',
                    textContent: t('groups.reminderError')
                }));
            })
            .finally(() => {
                el.reminderBtn.disabled = false;
            });
    }

    function hasAnswer(poll, userId) {
        return Boolean(poll?.answers?.[userId]);
    }

    function findLatestOpenCwlPoll(allPolls) {
        return [...allPolls]
            .filter(poll => poll.type === 'cwl_availability' && poll.status === 'open')
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
    }

    function parseAccounts(value) {
        if (!value || typeof value !== 'string') return [];
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function isAdmin() {
        return isGroupAdmin(currentRole);
    }

    function actionButton(label, onClick, className = 'btn-groups-accent') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    function textNode(tagName, text) {
        const node = document.createElement(tagName);
        node.textContent = text;
        return node;
    }
}

function query() {
    return {
        notice: document.querySelector('#groups-poll-notice'),
        availabilityEmpty: document.querySelector('#groups-availability-empty'),
        noticeTitle: document.querySelector('#groups-poll-notice-title'),
        answerBtn: document.querySelector('#groups-poll-answer-btn'),
        createBtn: document.querySelector('#groups-poll-create-btn'),
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
