import { answerGroupPoll, createGroupPoll, deleteGroupPoll, getGroupPolls, sendGroupPollReminder, setGroupPollStatus } from '../Supabase/Supabase-GroupPolls.js';
import { checkUserId } from '../Supabase/Supabase-User.js';
import { getCurrentUserId } from '../utils/user.js';
import { withGlobalLoading } from '../utils/loading-state.js';
import { closeGroupDialog, openGroupDialog } from './groups-dialog.js?v=20260813-redesign';
import { isGroupAdmin } from './groups-roles.js';
import { clonePolls, findLatestOpenCwlPoll, MAX_POLLS_PER_GROUP, normalizePolls, readPollAccountAnswer, resetPollView } from './groups-polls-state.js';
import { OPEN_POLL_STORAGE_KEY } from '../notifications/poll-notifications.js';
import { t } from '../i18n/i18n.js';

export function createPollActions({ elements, state, renderer, getUserId = getCurrentUserId, loading = withGlobalLoading }) {
    const isAdmin = () => isGroupAdmin(state.currentRole);

    return {
        handleGroupOpened,
        loadPolls,
        createPoll,
        canAdmin: isAdmin,
        openActiveAnswer: () => openAnswerFor(state.activePoll),
        openAnswerFor,
        saveAnswer,
        sendReminder,
        showResults,
        toggleStatus,
        removePoll
    };

    function handleGroupOpened(detail = {}) {
        state.group = detail.group || null;
        state.members = Array.isArray(detail.members) ? detail.members : [];
        state.currentRole = detail.currentRole || 'member';
        state.currentUserId = detail.currentUserId || getUserId();
        state.entry = detail.entry || {};
        state.fixturePolls = state.entry?.fixture ? clonePolls(state.entry.polls) : null;
        void loadPolls();
    }

    async function loadPolls() {
        resetPollView(state);
        renderer.reset();
        if (!state.group || !state.currentUserId) return;
        const requestedGroupId = state.group.id;
        try {
            const data = state.entry?.fixture
                ? state.fixturePolls || []
                : await getGroupPolls(requestedGroupId, state.currentUserId);
            if (state.group?.id !== requestedGroupId) return;
            state.polls = normalizePolls(data);
            state.loaded = true;
            state.limitBlocked = state.polls.length >= MAX_POLLS_PER_GROUP;
            state.activePoll = findLatestOpenCwlPoll(state.polls);
            selectPollFromNavigation();
            renderer.renderNotice();
            renderer.renderPolls();
            renderer.syncCreateState();
            if (isAdmin()) renderer.renderResults(state.selectedPoll);
            dispatchPollUpdate(requestedGroupId);
        } catch (error) {
            state.loaded = false;
            renderer.showError(error, elements.pollsList);
            elements.notice?.classList.add('hidden');
            elements.empty?.classList.remove('hidden');
            elements.retry?.classList.remove('hidden');
        }
    }

    function selectPollFromNavigation() {
        const requestedPollId = sessionStorage.getItem(OPEN_POLL_STORAGE_KEY) || '';
        state.selectedPoll = state.polls.find(poll => poll.id === requestedPollId)
            || state.activePoll
            || state.polls[0]
            || null;
        if (!requestedPollId) return;
        sessionStorage.removeItem(OPEN_POLL_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('clashtools:group-tab-requested', { detail: { tab: 'polls' } }));
    }

    function dispatchPollUpdate(groupId) {
        window.dispatchEvent(new CustomEvent('clan-family:polls-updated', {
            detail: { groupId, polls: state.polls }
        }));
    }

    function createPoll() {
        if (!state.group || !isAdmin() || state.polls.length >= MAX_POLLS_PER_GROUP) {
            renderer.syncCreateState();
            return;
        }
        const title = elements.titleInput?.value?.trim() || t('groups.defaultPollTitle');
        const rounds = Math.max(1, Math.min(7, Number(elements.roundsInput?.value || 7)));
        if (state.entry?.fixture) return createFixturePoll(title, rounds);
        void runMutation(
            () => createGroupPoll(state.group.id, state.currentUserId, title, rounds)
                .then(() => { clearTitle(); dispatchNotificationRefresh(); return loadPolls(); }),
            elements.results
        );
    }

    function createFixturePoll(title, rounds) {
        state.fixturePolls = [{
            id: `fixture-poll-${Date.now()}`,
            title,
            type: 'cwl_availability',
            status: 'open',
            rounds,
            answers: {},
            created_at: new Date().toISOString()
        }, ...state.polls];
        clearTitle();
        void loadPolls();
    }

    function clearTitle() {
        if (elements.titleInput) elements.titleInput.value = '';
    }

    function toggleStatus(poll) {
        if (!isAdmin()) return;
        const status = poll.status === 'open' ? 'closed' : 'open';
        if (state.entry?.fixture) {
            poll.status = status;
            void loadPolls();
            return;
        }
        void runMutation(
            () => setGroupPollStatus(state.group.id, state.currentUserId, poll.id, status).then(loadPolls),
            elements.results
        );
    }

    function removePoll(poll) {
        if (!isAdmin() || !window.confirm(t('groups.deletePollConfirm', { title: poll.title }))) return;
        if (state.entry?.fixture) {
            state.fixturePolls = state.polls.filter(item => item.id !== poll.id);
            void loadPolls();
            return;
        }
        void runMutation(
            () => deleteGroupPoll(state.group.id, state.currentUserId, poll.id)
                .then(() => { dispatchNotificationRefresh(); return loadPolls(); }),
            elements.results
        );
    }

    async function openAnswerFor(poll) {
        if (!poll || !state.group) return;
        state.activePoll = poll;
        const profile = await answerProfile();
        elements.answerOverlay?.classList.remove('hidden');
        if (elements.answerTitle) elements.answerTitle.textContent = poll.title;
        if (elements.answerGroup) elements.answerGroup.textContent = `${t('groups.group')}: ${state.group.name}`;
        renderer.renderAnswerForm(profile, poll);
        openGroupDialog(elements.answerOverlay, elements.answerClose);
    }

    async function answerProfile() {
        if (state.entry?.fixture) {
            return state.members.find(member => member.user_id === state.currentUserId)?.profile;
        }
        return Promise.resolve(checkUserId(state.currentUserId))
            .then(data => Array.isArray(data) ? data[0] : data)
            .catch(() => null);
    }

    function saveAnswer() {
        if (!state.activePoll || !state.group) return;
        const accounts = [...(elements.answerBody?.querySelectorAll('.groups-poll-account-card') || [])]
            .map(readPollAccountAnswer);
        if (state.entry?.fixture) {
            state.activePoll.answers = {
                ...(state.activePoll.answers || {}),
                [state.currentUserId]: { accounts }
            };
            closeGroupDialog(elements.answerOverlay);
            void loadPolls();
            return;
        }
        void runMutation(
            () => answerGroupPoll(state.group.id, state.currentUserId, state.activePoll.id, accounts)
                .then(() => { closeGroupDialog(elements.answerOverlay); return loadPolls(); }),
            elements.answerBody
        );
    }

    function showResults(poll) {
        state.selectedPoll = poll;
        renderer.renderResults(poll);
        window.dispatchEvent(new CustomEvent('clashtools:group-tab-requested', { detail: { tab: 'polls' } }));
    }

    function sendReminder() {
        const poll = state.selectedPoll || state.activePoll;
        if (!isAdmin() || !state.group || !poll) return;
        elements.reminderBtn.disabled = true;
        const result = state.entry?.fixture
            ? Promise.resolve({ created: Math.max(0, state.members.length - Object.keys(poll.answers || {}).length), skipped: 0 })
            : sendGroupPollReminder(state.group.id, poll.id, state.currentUserId);
        result.then(value => {
            dispatchNotificationRefresh();
            elements.results?.prepend(textMessage(t('groups.reminderResult', {
                created: value?.created || 0,
                skipped: value?.skipped || 0
            })));
        }).catch(() => elements.results?.prepend(textMessage(t('groups.reminderError'))))
            .finally(() => { elements.reminderBtn.disabled = false; });
    }

    function runMutation(operation, errorContainer) {
        return loading(operation, t('groups.loading')).catch(error => {
            if (error?.code === 'POLL_LIMIT_REACHED') state.limitBlocked = true;
            renderer.showError(error, errorContainer);
            renderer.syncCreateState();
        });
    }

    function dispatchNotificationRefresh() {
        window.dispatchEvent(new CustomEvent('clashtools:notifications-refresh-requested'));
    }
}

function textMessage(message) {
    const node = document.createElement('p');
    node.className = 'cf-inline-status';
    node.textContent = message;
    return node;
}
