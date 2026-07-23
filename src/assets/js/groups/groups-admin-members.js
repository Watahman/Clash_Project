import { kickGroupMember, setGroupMemberRole, transferGroupLeadership } from "../Supabase/Supabase-GroupRoles.js";
import { t } from "../i18n/i18n.js";
import { withGlobalLoading } from "../utils/loading-state.js";
import { bindBackdropClick } from "../utils/backdrop-click.js";
import { getNameInitials } from "../utils/name-initials.js";
import {
    applyRoleBadge,
    canKickGroupMember,
    isGroupLeader,
    normalizeGroupRole,
    ROLE_CO_LEADER,
    ROLE_LEADER,
    ROLE_MEMBER
} from "./groups-roles.js";

export function createMemberRoleAdmin(elements, getState, setMessage, emptyMessage, refreshMembers) {
    let pendingAction = null;

    async function render() {
        const { members, currentRole } = getState();
        elements.members?.replaceChildren();
        setRoleHelp(currentRole);
        if (!members?.length) return elements.members?.appendChild(emptyMessage(t('groups.noMembers')));

        members.forEach(member => elements.members?.appendChild(memberNode(member, member.profile)));
    }

    function setRoleHelp(role) {
        if (!elements.roleHelp) return;
        elements.roleHelp.textContent = isGroupLeader(role) ? t('groups.roleLeaderHelp') : t('groups.roleCoLeaderHelp');
    }

    function memberNode(member, userData) {
        const user = Array.isArray(userData) ? userData[0] : userData;
        const item = document.createElement('div');
        item.className = 'groups-admin-member';
        item.dataset.userId = user?.id || member.user_id;

        const identity = document.createElement('div');
        identity.className = 'groups-admin-member-identity';

        const avatar = document.createElement('span');
        avatar.className = 'groups-admin-member-avatar';
        avatar.setAttribute('aria-hidden', 'true');

        const info = document.createElement('div');
        info.className = 'groups-admin-member-info';
        const displayName = String(user?.name || '').trim() || t('groups.member');
        avatar.textContent = getNameInitials(displayName, '?');

        const heading = document.createElement('div');
        heading.className = 'groups-admin-member-heading';
        heading.appendChild(textNode('strong', displayName));

        const publicId = String(user?.code || '').trim().replace(/^#+/, '');
        if (publicId) {
            const id = textNode('span', `#${publicId}`);
            id.className = 'groups-admin-member-code';
            heading.appendChild(id);
        }

        info.appendChild(heading);
        identity.append(avatar, info);

        const badge = document.createElement('span');
        badge.className = 'groups-role-badge';
        applyRoleBadge(badge, normalizeGroupRole(member.role), t);

        const actions = document.createElement('div');
        actions.className = 'groups-admin-member-actions';
        addRoleActions(actions, member, displayName);

        item.append(identity, badge, actions);
        return item;
    }

    function addRoleActions(actions, member, displayName) {
        const { currentRole } = getState();
        const actorRole = normalizeGroupRole(currentRole);
        const targetRole = normalizeGroupRole(member.role);
        if (targetRole === ROLE_LEADER) return;

        if (isGroupLeader(actorRole)) {
            if (targetRole === ROLE_MEMBER) {
                actions.appendChild(actionButton(t('groups.makeCoLeader'), () => updateRole(member.user_id, ROLE_CO_LEADER)));
            }
            if (targetRole === ROLE_CO_LEADER) {
                actions.appendChild(actionButton(t('groups.makeMember'), () => updateRole(member.user_id, ROLE_MEMBER), 'btn-groups-default'));
            }
            actions.appendChild(actionButton(t('groups.transferLeadership'), () => askTransfer(member.user_id, displayName)));
        }

        if (canKickGroupMember(actorRole, targetRole)) {
            actions.appendChild(actionButton(t('groups.kickMember'), () => askKick(member.user_id, displayName), 'btn-groups-danger'));
        }
    }

    function actionButton(label, onClick, className = 'btn-groups-accent') {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', onClick);
        return button;
    }

    function updateRole(targetUserId, role) {
        const { group, userId } = getState();
        withGlobalLoading(() => setGroupMemberRole(group.id, userId, targetUserId, role)
            .then(() => refreshMembers())
            .then(() => setMessage(t('groups.roleUpdated'), 'success'))
            .catch(error => {
                console.error(error);
                setMessage(t('groups.roleUpdateError'));
            }), t('groups.loading'));
    }

    function askTransfer(targetUserId, displayName) {
        pendingAction = { type: 'transfer', targetUserId };
        if (elements.confirmTitle) elements.confirmTitle.textContent = t('groups.transferTitle');
        if (elements.confirmAcceptText) elements.confirmAcceptText.textContent = t('groups.transferConfirm');
        elements.confirmAccept?.classList.remove('groups-danger');
        if (elements.confirmText) {
            elements.confirmText.textContent = t('groups.transferText', { name: displayName });
        }
        elements.confirmOverlay?.classList.remove('hidden');
    }

    function askKick(targetUserId, displayName) {
        pendingAction = { type: 'kick', targetUserId };
        if (elements.confirmTitle) elements.confirmTitle.textContent = t('groups.kickTitle');
        if (elements.confirmText) elements.confirmText.textContent = t('groups.kickText', { name: displayName });
        if (elements.confirmAcceptText) elements.confirmAcceptText.textContent = t('groups.kickConfirm');
        elements.confirmAccept?.classList.add('groups-danger');
        elements.confirmOverlay?.classList.remove('hidden');
    }

    function closeConfirm() {
        pendingAction = null;
        elements.confirmOverlay?.classList.add('hidden');
        elements.confirmAccept?.classList.remove('groups-danger');
    }

    function confirmAction() {
        const { group, userId } = getState();
        const action = pendingAction;
        closeConfirm();
        if (!group || !userId || !action?.targetUserId) return;

        const request = action.type === 'kick'
            ? kickGroupMember(group.id, userId, action.targetUserId)
            : transferGroupLeadership(group.id, userId, action.targetUserId);
        const doneKey = action.type === 'kick' ? 'groups.kickDone' : 'groups.transferDone';
        const errorKey = action.type === 'kick' ? 'groups.kickError' : 'groups.transferError';
        withGlobalLoading(() => request
            .then(() => refreshMembers())
            .then(() => setMessage(t(doneKey), 'success'))
            .catch(error => {
                console.error(error);
                setMessage(t(errorKey));
            }), t('groups.loading'));
    }

    function textNode(tagName, text) {
        const node = document.createElement(tagName);
        node.textContent = text;
        return node;
    }

    elements.confirmCancel?.addEventListener('click', closeConfirm);
    elements.confirmAccept?.addEventListener('click', confirmAction);
    bindBackdropClick(elements.confirmOverlay, closeConfirm);

    return { render, closeConfirm };
}
