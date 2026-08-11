import { kickGroupMember, setGroupMemberRole, transferGroupLeadership } from '../Supabase/Supabase-GroupRoles.js';
import { getGroupInfo, getGroupMembers } from '../Supabase/Supabase-Group.js';
import { t } from '../i18n/i18n.js';
import { getCurrentUserId } from '../utils/user.js';
import { withGlobalLoading } from '../utils/loading-state.js';
import { applyRoleBadge, canManageGroupMembers, canManageGroupRoles, getCurrentUserRole, normalizeGroupRole, ROLE_CO_LEADER, ROLE_MEMBER } from './groups-roles.js';
import { familyCopy } from './clan-family-copy.js';
import { closeGroupDialog, bindGroupDialog, openGroupDialog } from './groups-dialog.js';
import { memberAccounts } from '../templates/GroupTemplates.js';
import { getNameInitials } from '../utils/name-initials.js';

export function initGroupMemberDrawer(emptyMessage = () => document.createElement('p')) {
    const elements = queryElements();
    const state = { group: null, members: [], currentRole: 'member', currentUserId: '', entry: {}, member: null, pending: null };
    const close = () => {
        closeGroupDialog(elements.drawer);
        state.member = null;
    };

    bindGroupDialog(elements.drawer, close);
    elements.close?.addEventListener('click', close);
    elements.confirmCancel?.addEventListener('click', closeConfirm);
    elements.confirmAccept?.addEventListener('click', confirmAction);
    elements.confirmOverlay?.addEventListener('click', event => { if (event.target === elements.confirmOverlay) closeConfirm(); });
    window.addEventListener('clashtools:group-opened', event => {
        state.group = event.detail?.group || null;
        state.members = Array.isArray(event.detail?.members) ? event.detail.members : [];
        state.currentRole = event.detail?.currentRole || 'member';
        state.currentUserId = event.detail?.currentUserId || getCurrentUserId();
        state.entry = event.detail?.entry || {};
        close();
    });
    window.addEventListener('clan-family:member-selected', event => open(event.detail));

    function open(detail) {
        state.group = detail?.group || state.group;
        state.members = Array.isArray(detail?.members) ? detail.members : state.members;
        state.currentRole = detail?.currentRole || state.currentRole;
        state.currentUserId = detail?.currentUserId || state.currentUserId || getCurrentUserId();
        state.entry = detail?.fixture || state.entry || {};
        state.member = detail?.member || null;
        if (!state.member || !elements.drawer) return;
        render();
        openGroupDialog(elements.drawer, elements.close);
    }

    function render() {
        const member = state.member;
        const profile = profileOf(member);
        const name = String(profile?.name || member?.name || t('groups.member')).trim();
        elements.name.textContent = name;
        elements.avatar.textContent = getNameInitials(name, '?');
        elements.code.textContent = profile?.code ? `#${String(profile.code).replace(/^#+/, '')}` : '';
        elements.code.hidden = !profile?.code;
        applyRoleBadge(elements.role, normalizeGroupRole(member.role), t);
        elements.joined.textContent = `${familyCopy('joined')} ${formatDate(member.joined_at || state.group?.created_at)}`;
        renderAccounts(memberAccounts(member));
        renderActions(member);
    }

    function renderAccounts(accounts) {
        elements.accounts.replaceChildren();
        if (!accounts.length) {
            elements.accounts.appendChild(emptyMessage(t('groups.noLinkedAccounts')));
            return;
        }
        accounts.forEach((account, index) => {
            const row = document.createElement('div');
            row.className = 'cf-drawer-account';
            const name = account?.name || account?.playerName || account?.tag || `${t('groups.account')} ${index + 1}`;
            row.append(textNode('strong', name), textNode('span', account?.tag || account?.playerTag || ''));
            const townHall = account?.townHallLevel || account?.townHall;
            if (townHall) row.appendChild(textNode('em', `TH${townHall}`));
            elements.accounts.appendChild(row);
        });
    }

    function renderActions(member) {
        elements.actions.replaceChildren();
        const targetRole = normalizeGroupRole(member.role);
        const canManage = canManageGroupMembers(state.currentRole, targetRole);
        const canManageRole = canManageGroupRoles(state.currentRole, targetRole);
        if (canManageRole) {
            if (targetRole === ROLE_MEMBER) elements.actions.appendChild(action(t('groups.makeCoLeader'), () => updateRole(member.user_id, ROLE_CO_LEADER)));
            if (targetRole === ROLE_CO_LEADER) elements.actions.appendChild(action(t('groups.makeMember'), () => updateRole(member.user_id, ROLE_MEMBER), 'button-secondary'));
            elements.actions.appendChild(action(t('groups.transferLeadership'), () => askConfirm('transfer', member), 'button-secondary'));
        }
        if (canManage) elements.actions.appendChild(action(t('groups.kickMember'), () => askConfirm('kick', member), 'button-danger'));
        if (!elements.actions.children.length) elements.actions.appendChild(textNode('p', targetRole === 'leader' ? familyCopy('noActions') : familyCopy('noManagement'), 'cf-drawer-permission'));
    }

    function action(label, onClick, className = 'button-primary') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `button ${className}`;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    function updateRole(targetUserId, role) {
        if (state.entry?.fixture) {
            if (elements.status) elements.status.textContent = familyCopy('noManagement');
            return;
        }
        withGlobalLoading(() => setGroupMemberRole(state.group.id, state.currentUserId, targetUserId, role)
            .then(refreshState)
            .catch(error => showError(error)), t('groups.loading'));
    }

    function askConfirm(type, member) {
        state.pending = { type, targetUserId: member.user_id, name: displayName(member) };
        const transfer = type === 'transfer';
        elements.confirmTitle.textContent = t(transfer ? 'groups.transferTitle' : 'groups.kickTitle');
        elements.confirmText.textContent = t(transfer ? 'groups.transferText' : 'groups.kickText', { name: displayName(member) });
        elements.confirmAcceptText.textContent = t(transfer ? 'groups.transferConfirm' : 'groups.kickConfirm');
        elements.confirmAccept.classList.toggle('button-danger', !transfer);
        openGroupDialog(elements.confirmOverlay, elements.confirmCancel);
    }

    function closeConfirm() {
        state.pending = null;
        closeGroupDialog(elements.confirmOverlay);
        elements.confirmAccept?.classList.remove('button-danger');
    }

    function confirmAction() {
        const pending = state.pending;
        closeConfirm();
        if (!pending) return;
        if (state.entry?.fixture) {
            if (elements.status) elements.status.textContent = familyCopy('noManagement');
            return;
        }
        const request = pending.type === 'kick'
            ? kickGroupMember(state.group.id, state.currentUserId, pending.targetUserId)
            : transferGroupLeadership(state.group.id, state.currentUserId, pending.targetUserId);
        withGlobalLoading(() => request.then(refreshState).catch(error => showError(error)), t('groups.loading'));
    }

    async function refreshState() {
        const [groupData, members] = await Promise.all([getGroupInfo(state.group.id), getGroupMembers(state.group.id)]);
        state.group = Array.isArray(groupData) ? groupData[0] : groupData;
        state.members = Array.isArray(members) ? members : [];
        state.currentRole = getCurrentUserRole(state.group, state.members, state.currentUserId);
        state.member = state.members.find(item => item.user_id === state.member?.user_id) || state.member;
        window.dispatchEvent(new CustomEvent('clashtools:group-roles-updated', {
            detail: { group: state.group, members: state.members, currentRole: state.currentRole, currentUserId: state.currentUserId, entry: state.entry }
        }));
        render();
    }

    function showError(error) {
        console.error(error);
        if (elements.status) elements.status.textContent = t('groups.roleUpdateError');
    }

    return { close, render };
}

function queryElements() {
    return {
        drawer: document.querySelector('#groups-member-drawer'),
        close: document.querySelector('#groups-member-drawer-close'),
        avatar: document.querySelector('#groups-member-drawer-avatar'),
        name: document.querySelector('#groups-member-drawer-name'),
        code: document.querySelector('#groups-member-drawer-code'),
        role: document.querySelector('#groups-member-drawer-role'),
        joined: document.querySelector('#groups-member-drawer-joined'),
        accounts: document.querySelector('#groups-member-drawer-accounts'),
        actions: document.querySelector('#groups-member-drawer-actions'),
        status: document.querySelector('#groups-member-drawer-status'),
        confirmOverlay: document.querySelector('#groups-role-confirm-overlay'),
        confirmTitle: document.querySelector('#groups-role-confirm-title'),
        confirmText: document.querySelector('#groups-role-confirm-text'),
        confirmCancel: document.querySelector('#groups-role-confirm-cancel'),
        confirmAccept: document.querySelector('#groups-role-confirm-accept'),
        confirmAcceptText: document.querySelector('#groups-role-confirm-accept-text')
    };
}

function profileOf(member) {
    return Array.isArray(member?.profile) ? member.profile[0] : member?.profile;
}

function displayName(member) {
    const profile = profileOf(member);
    return String(profile?.name || member?.name || t('groups.member')).trim();
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).split('T')[0] || '—';
    return new Intl.DateTimeFormat(document.documentElement.lang || 'en', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function textNode(tag, text, className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}
