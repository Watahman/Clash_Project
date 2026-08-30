import { createClanCard, createPlayerCard } from "../templates/CWLTemplates.js?v=20260830-card-settings";
import { clearActiveCwlPoll, getActiveCwlPollMeta, setActiveCwlPoll } from "./cwl-availability.js?v=20260829-public-auth-v1";
import { escapeCssIdentifier, normalizeTag } from "./cwl-utils.js";
import { createGroupSourceController } from "./cwl-group-source-controller.js?v=20260829-public-auth-v1";
import { t } from "../i18n/i18n.js?v=20260829-public-auth-v1";
import { ASSET_FALLBACKS } from "../assets/entity-assets.js";

let refs = {};
const groupSource = createGroupSourceController({
    onAuthStateChange: handleAuthStateChange,
    onGroupsLoaded: handleGroupsLoaded,
    onGroupsLoadError: handleGroupsLoadError,
    onGroupLoaded: handleGroupLoaded,
    onGroupLoadError: handleGroupLoadError
});

export function initGroupOverlay(selectGroup, overlayRefs = {}) {
    refs = {
        selectGroup,
        loadGroupBtn: overlayRefs.loadGroupBtn || document.querySelector('#cwl-overlay-load-group-button'),
        groupPreview: overlayRefs.groupPreview || document.querySelector('#cwl-group-preview'),
        groupPreviewList: overlayRefs.groupPreviewList || document.querySelector('#cwl-group-preview-list'),
        pollSelect: overlayRefs.selectGroupPoll || document.querySelector('#cwl-select-group-poll'),
        linkedClans: overlayRefs.groupLinkedClans || document.querySelector('#cwl-group-linked-clans'),
        rosterPollSelect: overlayRefs.rosterPollSelect || document.querySelector('#cwl-roster-poll-select')
    };

    groupSource.init(overlayRefs.authState);
    resetPollSelect();
    setRosterPollSelectState('loading');
    if (!groupSource.canRead() || !groupSource.getUserId() || !refs.selectGroup) {
        setRosterPollSelectState('empty');
        return;
    }

    void groupSource.loadGroups();
    refs.selectGroup.addEventListener('change', () => loadSelectedGroup(refs.selectGroup.value));
    refs.pollSelect?.addEventListener('change', () => activateSelectedPoll());
    refs.rosterPollSelect?.addEventListener('change', activateRosterPollSelection);
    refs.loadGroupBtn?.addEventListener('click', addSelectedGroupToPlanner);
    window.addEventListener('clashtools:cwl-plan-meta-loaded', event => {
        const { groupId, pollId } = event.detail || {};
        applyPlannerGroupSelection(groupId, pollId);
    });
    window.addEventListener('clashtools:language-changed', renderRosterPollSelect);
}

function handleAuthStateChange(state) {
    clearActiveCwlPoll();
    clearGroupPreview();
    refs.linkedClans?.replaceChildren();
    refs.linkedClans?.classList.add('hidden');
    refs.selectGroup?.replaceChildren();
    resetPollSelect();
    setRosterPollSelectState(groupSource.canRead() ? 'loading' : 'empty');
}

function handleGroupsLoaded(groups) {
    if (!groups.length) {
        setRosterPollSelectState('empty');
        return;
    }
    groups.forEach(group => appendGroupOption(group));
    const polls = groupSource.getPollCatalog();
    if (!polls.size) {
        const results = groupSource.getPollCatalogGroups();
        setRosterPollSelectState(results.every(result => result.failed) ? 'error' : 'empty');
        return;
    }
    renderRosterPollSelect();
}

function handleGroupsLoadError() {
    setRosterPollSelectState('error');
}

function handleGroupLoaded(groupId, preferredPollId) {
    renderGroupPreview(groupId);
    renderLinkedClans(groupId);
    renderPollSelect(groupId, preferredPollId);
}

function handleGroupLoadError() {
    showPreviewMessage(t('cwl.groupLoadError'));
}

function appendGroupOption(group) {
    if (!group?.id || refs.selectGroup.querySelector(`option[value="${escapeCssIdentifier(group.id)}"]`)) return;
    const optionElement = document.createElement('option');
    optionElement.value = group.id;
    optionElement.textContent = group.name;
    refs.selectGroup.appendChild(optionElement);
}

export async function applyPlannerGroupSelection(groupId, pollId = '') {
    if (!groupId || !refs.selectGroup) {
        clearActiveCwlPoll();
        syncRosterPollSelection();
        return;
    }
    refs.selectGroup.value = groupId;
    await loadSelectedGroup(groupId, pollId);
}

async function loadSelectedGroup(groupId, preferredPollId = '') {
    clearGroupPreview();
    resetPollSelect();
    clearActiveCwlPoll();
    syncRosterPollSelection();
    await groupSource.loadSelectedGroup(groupId, preferredPollId);
}

function renderGroupPreview(groupId) {
    clearGroupPreview();
    const state = groupSource.getGroupState(groupId);
    if (!state?.players?.length) {
        showPreviewMessage(t('cwl.noValidGroupAccounts'));
        return;
    }
    refs.groupPreview?.classList.add('hidden');
    refs.groupPreviewList?.classList.remove('hidden');
    createPlayerCard(state.players.map(player => ({ ...player, source: 'group' })), `group|${groupId}`);
    refs.groupPreviewList?.querySelectorAll(`[data-clanuuid="${escapeCssIdentifier(groupId)}"]`)
        .forEach(card => card.classList.remove('hidden'));
}

function renderLinkedClans(groupId) {
    refs.linkedClans?.replaceChildren();
    const clans = groupSource.getGroupState(groupId)?.clans || [];
    refs.linkedClans?.classList.toggle('hidden', clans.length === 0);
    clans.forEach(clan => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'modal-linked-clan-option';
        button.textContent = `${clan.clan_name || clan.clan_tag} ${normalizeTag(clan.clan_tag)}`;
        button.title = t('cwl.addClanToPlan');
        button.setAttribute('aria-label', t('cwl.addClanToPlan'));
        button.addEventListener('click', () => createClanCard(toPlannerClan(clan), 15));
        refs.linkedClans.appendChild(button);
    });
}

function renderPollSelect(groupId, preferredPollId = '') {
    resetPollSelect();
    const polls = groupSource.getGroupState(groupId)?.polls || [];
    polls.forEach(poll => {
        const option = document.createElement('option');
        option.value = poll.id;
        option.textContent = `${poll.title || 'CWL poll'} (${poll.status || 'open'})`;
        refs.pollSelect?.appendChild(option);
    });

    const selectedPoll = polls.find(poll => poll.id === preferredPollId)
        || polls.find(poll => poll.status === 'open')
        || polls[0];
    if (selectedPoll && refs.pollSelect) {
        refs.pollSelect.value = selectedPoll.id;
        activatePoll(groupId, selectedPoll);
    }
}

function activateSelectedPoll(notify = true) {
    const groupId = refs.selectGroup?.value || '';
    const pollId = refs.pollSelect?.value || '';
    const poll = groupSource.getGroupState(groupId)?.polls?.find(item => item.id === pollId);
    activatePoll(groupId, poll || null, notify);
}

function activateRosterPollSelection() {
    const selection = groupSource.getPollCatalog().get(refs.rosterPollSelect?.value || '');
    activatePoll(selection?.group?.id || '', selection?.poll || null, true);
}

function activatePoll(groupId, poll, notify = false) {
    if (poll) setActiveCwlPoll(groupId, poll);
    else clearActiveCwlPoll();
    syncRosterPollSelection();
    if (!notify) return;
    window.dispatchEvent(new CustomEvent('clashtools:cwl-active-poll-changed', {
        detail: getActiveCwlPollMeta()
    }));
}

function addSelectedGroupToPlanner() {
    if (!groupSource.canRead()) return;
    const groupId = refs.selectGroup?.value || '';
    const state = groupSource.getGroupState(groupId);
    if (!state) return;
    createPlayerCard(state.players.map(player => ({ ...player, source: 'group' })));
    state.clans.forEach(clan => createClanCard(toPlannerClan(clan), 15));
    activateSelectedPoll(false);
    window.dispatchEvent(new CustomEvent('clashtools:cwl-close-add-player-overlay'));
}

function toPlannerClan(clan) {
    return {
        name: clan.clan_name || normalizeTag(clan.clan_tag),
        tag: normalizeTag(clan.clan_tag),
        badgeUrls: { small: clan.badge_url || ASSET_FALLBACKS.clan }
    };
}

function renderRosterPollSelect() {
    const select = refs.rosterPollSelect;
    const pollCatalog = groupSource.getPollCatalog();
    if (!select || !pollCatalog.size) return;
    const selectedValue = activePollSelectionValue();
    select.replaceChildren(option('', t('cwl.noPollSelected')));

    groupSource.getPollCatalogGroups().forEach(({ group, polls }) => {
        if (!polls.length) return;
        const groupOptions = document.createElement('optgroup');
        groupOptions.label = group.name;
        polls.forEach(poll => {
            const pollOption = option(
                pollSelectionValue(group.id, poll.id),
                `${group.name} — ${poll.title || 'CWL poll'} (${pollStatusLabel(poll.status)})`
            );
            groupOptions.appendChild(pollOption);
        });
        select.appendChild(groupOptions);
    });

    select.disabled = false;
    select.value = pollCatalog.has(selectedValue) ? selectedValue : '';
}

function setRosterPollSelectState(state) {
    const select = refs.rosterPollSelect;
    if (!select) return;
    const key = {
        loading: 'cwl.pollSelectLoading',
        error: 'cwl.pollSelectError',
        empty: 'cwl.noGroupPolls'
    }[state] || 'cwl.noPollSelected';
    select.replaceChildren(option('', t(key)));
    select.disabled = state !== 'ready';
}

function syncRosterPollSelection() {
    const select = refs.rosterPollSelect;
    if (!select || select.disabled) return;
    const value = activePollSelectionValue();
    select.value = groupSource.getPollCatalog().has(value) ? value : '';
}

function activePollSelectionValue() {
    const { groupId, pollId } = getActiveCwlPollMeta();
    return pollSelectionValue(groupId, pollId);
}

function pollSelectionValue(groupId, pollId) {
    return groupId && pollId ? `${groupId}::${pollId}` : '';
}

function pollStatusLabel(status) {
    const key = {
        open: 'cwl.pollStatusOpen',
        closed: 'cwl.pollStatusClosed',
        archived: 'cwl.pollStatusArchived'
    }[status];
    return key ? t(key) : String(status || '');
}

function clearGroupPreview() {
    refs.groupPreviewList?.replaceChildren();
    refs.groupPreviewList?.classList.add('hidden');
    showPreviewMessage(t('cwl.previewGroup'));
}

function showPreviewMessage(message) {
    if (!refs.groupPreview) return;
    refs.groupPreview.classList.remove('hidden');
    refs.groupPreview.textContent = message;
}

function resetPollSelect() {
    refs.pollSelect?.replaceChildren(option('', t('cwl.noPollSelected')));
}

function option(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
}
