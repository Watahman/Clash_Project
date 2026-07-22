import { setGroupMemberRole, transferGroupLeadership } from "../Supabase/Supabase-GroupRoles.js";
import { t } from "../i18n/i18n.js";
import { withGlobalLoading } from "../utils/loading-state.js";
import {
    applyRoleBadge,
    isGroupLeader,
    normalizeGroupRole,
    ROLE_CO_LEADER,
    ROLE_LEADER,
    ROLE_MEMBER
} from "./groups-roles.js";

export function createMemberRoleAdmin(elements, getState, setMessage, emptyMessage, refreshMembers) {
    let pendingTransfer = null;

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

        const info = document.createElement('div');
        info.className = 'groups-admin-member-info';
        info.append(textNode('strong', user?.name || member.user_id), textNode('span', member.user_id));

        const badge = document.createElement('span');
        badge.className = 'groups-role-badge';
        applyRoleBadge(badge, normalizeGroupRole(member.role), t);

        const actions = document.createElement('div');
        actions.className = 'groups-admin-member-actions';
        addRoleActions(actions, member, user?.name || member.user_id);

        item.append(info, badge, actions);
        return item;
    }

    function addRoleActions(actions, member, displayName) {
        const { currentRole } = getState();
        const targetRole = normalizeGroupRole(member.role);
        if (!isGroupLeader(currentRole) || targetRole === ROLE_LEADER) return;

        if (targetRole === ROLE_MEMBER) {
            actions.appendChild(actionButton(t('groups.makeCoLeader'), () => updateRole(member.user_id, ROLE_CO_LEADER)));
        }
        if (targetRole === ROLE_CO_LEADER) {
            actions.appendChild(actionButton(t('groups.makeMember'), () => updateRole(member.user_id, ROLE_MEMBER), 'btn-groups-default'));
        }
        actions.appendChild(actionButton(t('groups.transferLeadership'), () => askTransfer(member.user_id, displayName)));
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
        pendingTransfer = targetUserId;
        if (elements.confirmText) {
            elements.confirmText.textContent = t('groups.transferText', { name: displayName });
        }
        elements.confirmOverlay?.classList.remove('hidden');
    }

    function closeTransferConfirm() {
        pendingTransfer = null;
        elements.confirmOverlay?.classList.add('hidden');
    }

    function confirmTransfer() {
        const { group, userId } = getState();
        const targetId = pendingTransfer;
        closeTransferConfirm();
        if (!group || !userId || !targetId) return;

        withGlobalLoading(() => transferGroupLeadership(group.id, userId, targetId)
            .then(() => refreshMembers())
            .then(() => setMessage(t('groups.transferDone'), 'success'))
            .catch(error => {
                console.error(error);
                setMessage(t('groups.transferError'));
            }), t('groups.loading'));
    }

    function textNode(tagName, text) {
        const node = document.createElement(tagName);
        node.textContent = text;
        return node;
    }

    elements.confirmCancel?.addEventListener('click', closeTransferConfirm);
    elements.confirmAccept?.addEventListener('click', confirmTransfer);
    elements.confirmOverlay?.addEventListener('click', event => {
        if (event.target === elements.confirmOverlay) closeTransferConfirm();
    });

    return { render, closeTransferConfirm };
}
