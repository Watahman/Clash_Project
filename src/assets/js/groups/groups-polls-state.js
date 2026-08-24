export const MAX_POLLS_PER_GROUP = 3;

export function createPollState() {
    return {
        group: null,
        members: [],
        polls: [],
        fixturePolls: null,
        currentRole: 'member',
        currentUserId: '',
        entry: {},
        activePoll: null,
        selectedPoll: null,
        loaded: false,
        limitBlocked: false
    };
}

export function resetPollView(state) {
    state.polls = [];
    state.activePoll = null;
    state.selectedPoll = null;
    state.loaded = false;
    state.limitBlocked = false;
}

export function normalizePolls(value) {
    return Array.isArray(value) ? value : [];
}

export function clonePolls(value) {
    return normalizePolls(value).map(poll => ({
        ...poll,
        answers: cloneAnswers(poll.answers)
    }));
}

function cloneAnswers(value) {
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).map(([userId, answer]) => [userId, {
        ...answer,
        accounts: Array.isArray(answer?.accounts)
            ? answer.accounts.map(account => ({ ...account, days: { ...(account.days || {}) } }))
            : []
    }]));
}

export function findLatestOpenCwlPoll(polls) {
    return [...normalizePolls(polls)]
        .filter(poll => poll.type === 'cwl_availability' && poll.status === 'open')
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
}

export function hasPollAnswer(poll, userId) {
    return Boolean(poll?.answers?.[userId]);
}

export function pollResponseCount(poll) {
    return Object.keys(poll?.answers || {}).length;
}

export function previousPollAnswer(account, previous) {
    const tag = account.tag || account.playerTag || account.accountTag || '';
    return (Array.isArray(previous) ? previous : []).find(answer => answer.tag && answer.tag === tag) || null;
}

export function parsePollAccounts(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function readPollAccountAnswer(card) {
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
