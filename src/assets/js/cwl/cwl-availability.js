import { getCardTag, normalizeTag } from "./cwl-utils.js";
import { t } from "../i18n/i18n.js";

let activePoll = null;
let activeGroupId = '';
let activePollId = '';

export function setActiveCwlPoll(groupId, poll) {
    activeGroupId = groupId || '';
    activePoll = poll || null;
    activePollId = poll?.id || '';
    applyAvailabilityToAllPlayerCards();
}

export function clearActiveCwlPoll() {
    activeGroupId = '';
    activePollId = '';
    activePoll = null;
    applyAvailabilityToAllPlayerCards();
}

export function getActiveCwlPollMeta() {
    return { groupId: activeGroupId, pollId: activePollId };
}

export function applyAvailabilityToAllPlayerCards() {
    document.querySelectorAll('.cwl-player-article[data-planner-card="true"]').forEach(applyAvailabilityToCard);
}

export function applyAvailabilityToCard(card) {
    if (!card) return;
    card.querySelector('.cwl-availability-indicator')?.remove();
    if (!activePoll) {
        card.removeAttribute('data-availability');
        card.removeAttribute('title');
        return;
    }
    const status = getAvailabilityStatus(getCardTag(card));
    card.dataset.availability = status.state;
    card.title = status.tooltip;
    const indicator = document.createElement('span');
    indicator.className = `cwl-availability-indicator cwl-availability-${status.state}`;
    indicator.textContent = status.label;
    indicator.title = status.tooltip;
    card.appendChild(indicator);
}

export function getPlayerAvailability(tag) {
    const status = getAvailabilityStatus(tag);
    return {
        state: status.state,
        rounds: status.rounds,
        availableDays: [...status.availableDays]
    };
}

function getAvailabilityStatus(tag) {
    const answer = findPollAccount(tag);
    const rounds = clampRounds(activePoll?.rounds);
    const allDays = Array.from({ length: rounds }, (_, index) => index + 1);
    if (!activePoll || !answer) {
        return {
            state: 'unknown',
            label: t('cwl.availabilityUnknown'),
            tooltip: t('cwl.noPollData'),
            rounds,
            availableDays: allDays
        };
    }
    if (answer.wantsCwl === false) {
        return {
            state: 'no',
            label: t('cwl.availabilityNo'),
            tooltip: t('cwl.notAvailableCwl'),
            rounds,
            availableDays: []
        };
    }

    const days = answer.days && typeof answer.days === 'object' ? answer.days : {};
    const unavailable = [];
    const available = [];
    for (let day = 1; day <= rounds; day += 1) {
        const value = days[String(day)];
        if (value === false) unavailable.push(day);
        else available.push(day);
    }

    if (unavailable.length === 0) {
        return {
            state: 'yes',
            label: t('cwl.availabilityYes'),
            tooltip: t('cwl.availableAllDays', { rounds }),
            rounds,
            availableDays: available
        };
    }
    if (available.length === 0) {
        return {
            state: 'no',
            label: t('cwl.availabilityNo'),
            tooltip: t('cwl.notAvailableCwl'),
            rounds,
            availableDays: []
        };
    }
    return {
        state: 'partial',
        label: t('cwl.availabilityPartial'),
        tooltip: t('cwl.partialAvailabilityTooltip', { available: available.join(', '), unavailable: unavailable.join(', ') }),
        rounds,
        availableDays: available
    };
}

function findPollAccount(tag) {
    const normalizedTag = normalizeTag(tag);
    if (!activePoll || !normalizedTag) return null;
    const answers = activePoll.answers && typeof activePoll.answers === 'object' ? activePoll.answers : {};
    for (const answer of Object.values(answers)) {
        const accounts = Array.isArray(answer?.accounts) ? answer.accounts : [];
        const match = accounts.find(account => normalizeTag(account?.tag) === normalizedTag);
        if (match) return match;
    }
    return null;
}

function clampRounds(value) {
    const rounds = Number(value || 7);
    if (!Number.isFinite(rounds)) return 7;
    return Math.max(1, Math.min(7, Math.round(rounds)));
}
