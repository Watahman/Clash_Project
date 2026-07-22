import { getGroupClans, getGroupInfo, getGroupMembers, getGroupsOfUser } from "../Supabase/Supabase-Group.js";
import { getGroupPolls } from "../Supabase/Supabase-GroupPolls.js";
import { getUserBases } from "../Supabase/Supabase-User.js";
import { createClanCard, createPlayerCard } from "../templates/CWLTemplates.js";
import { getCurrentUserId } from "../utils/user.js";
import { clearActiveCwlPoll, setActiveCwlPoll } from "./cwl-availability.js";
import { escapeCssIdentifier, normalizeTag, uniquePlayers } from "./cwl-utils.js";
import { t } from "../i18n/i18n.js";

let refs = {};
let currentUserId = '';
let loadToken = 0;
const groupState = new Map();

export function initGroupOverlay(selectGroup, overlayRefs = {}) {
    currentUserId = getCurrentUserId();
    refs = {
        selectGroup,
        loadGroupBtn: overlayRefs.loadGroupBtn || document.querySelector('#cwl-overlay-load-group-button'),
        groupPreview: overlayRefs.groupPreview || document.querySelector('#cwl-group-preview'),
        groupPreviewList: overlayRefs.groupPreviewList || document.querySelector('#cwl-group-preview-list'),
        pollSelect: overlayRefs.selectGroupPoll || document.querySelector('#cwl-select-group-poll'),
        linkedClans: overlayRefs.groupLinkedClans || document.querySelector('#cwl-group-linked-clans')
    };

    resetPollSelect();
    if (!currentUserId || !refs.selectGroup) return;

    loadGroups();
    refs.selectGroup.addEventListener('change', () => loadSelectedGroup(refs.selectGroup.value));
    refs.pollSelect?.addEventListener('change', () => activateSelectedPoll());
    refs.loadGroupBtn?.addEventListener('click', addSelectedGroupToPlanner);
    window.addEventListener('clashtools:cwl-plan-meta-loaded', event => {
        const { groupId, pollId } = event.detail || {};
        applyPlannerGroupSelection(groupId, pollId);
    });
}

export async function applyPlannerGroupSelection(groupId, pollId = '') {
    if (!groupId || !refs.selectGroup) {
        clearActiveCwlPoll();
        return;
    }
    refs.selectGroup.value = groupId;
    await loadSelectedGroup(groupId, pollId);
}

async function loadGroups() {
    try {
        const memberships = await getGroupsOfUser(currentUserId);
        if (!Array.isArray(memberships)) return;
        for (const membership of memberships) {
            const info = await getGroupInfo(membership.group_id).catch(() => null);
            const group = Array.isArray(info) ? info[0] : info;
            if (!group?.id || refs.selectGroup.querySelector(`option[value="${escapeCssIdentifier(group.id)}"]`)) continue;
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            refs.selectGroup.appendChild(option);
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadSelectedGroup(groupId, preferredPollId = '') {
    const token = ++loadToken;
    clearGroupPreview();
    resetPollSelect();
    clearActiveCwlPoll();
    if (!groupId) return;

    try {
        const [members, clans, polls] = await Promise.all([
            getGroupMembers(groupId).catch(error => {
                console.error(error);
                return [];
            }),
            getGroupClans(groupId).catch(error => {
                console.error(error);
                return [];
            }),
            getGroupPolls(groupId, currentUserId).catch(error => {
                console.error(error);
                return [];
            })
        ]);
        const players = await loadGroupPlayers(members);
        if (token !== loadToken) return;
        const safePolls = normalizePolls(polls);
        groupState.set(groupId, { members, clans: Array.isArray(clans) ? clans : [], polls: safePolls, players });
        renderGroupPreview(groupId);
        renderLinkedClans(groupId);
        renderPollSelect(groupId, preferredPollId);
    } catch (error) {
        console.error(error);
        showPreviewMessage(t('cwl.groupLoadError'));
    }
}

async function loadGroupPlayers(members) {
    const users = await Promise.all((Array.isArray(members) ? members : []).map(member =>
        getUserBases(member.user_id).catch(() => null)
    ));
    const accounts = users.flatMap(userData => parseAccounts((Array.isArray(userData) ? userData[0] : userData)?.accounts));
    return uniquePlayers(accounts);
}

function parseAccounts(accounts) {
    if (Array.isArray(accounts)) return accounts;
    if (typeof accounts !== 'string' || !accounts.trim()) return [];
    try {
        const parsed = JSON.parse(accounts);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function renderGroupPreview(groupId) {
    clearGroupPreview();
    const state = groupState.get(groupId);
    if (!state?.players?.length) {
        showPreviewMessage(t('cwl.noValidGroupAccounts'));
        return;
    }
    refs.groupPreview?.classList.add('hidden');
    refs.groupPreviewList?.classList.remove('hidden');
    createPlayerCard(state.players, `group|${groupId}`);
    refs.groupPreviewList?.querySelectorAll(`[data-clanuuid="${escapeCssIdentifier(groupId)}"]`)
        .forEach(card => card.classList.remove('hidden'));
}

function renderLinkedClans(groupId) {
    refs.linkedClans?.replaceChildren();
    const clans = groupState.get(groupId)?.clans || [];
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
    const polls = groupState.get(groupId)?.polls || [];
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
        setActiveCwlPoll(groupId, selectedPoll);
    }
}

function activateSelectedPoll() {
    const groupId = refs.selectGroup?.value || '';
    const pollId = refs.pollSelect?.value || '';
    const poll = groupState.get(groupId)?.polls?.find(item => item.id === pollId);
    if (poll) setActiveCwlPoll(groupId, poll);
    else clearActiveCwlPoll();
}

function addSelectedGroupToPlanner() {
    const groupId = refs.selectGroup?.value || '';
    const state = groupState.get(groupId);
    if (!state) return;
    createPlayerCard(state.players);
    state.clans.forEach(clan => createClanCard(toPlannerClan(clan), 15));
    activateSelectedPoll();
    window.dispatchEvent(new CustomEvent('clashtools:cwl-close-add-player-overlay'));
}

function toPlannerClan(clan) {
    return {
        name: clan.clan_name || normalizeTag(clan.clan_tag),
        tag: normalizeTag(clan.clan_tag),
        badgeUrls: { small: clan.badge_url || '../assets/css/pictures/default-clan-banner.png' }
    };
}

function normalizePolls(polls) {
    return (Array.isArray(polls) ? polls : [])
        .filter(poll => poll?.type === 'cwl_availability')
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
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
