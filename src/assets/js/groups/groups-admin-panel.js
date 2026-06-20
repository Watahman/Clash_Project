import { getGroupInfo, getGroupMembers } from "../Supabase/Supabase-Group.js";
import { t } from "../i18n/i18n.js";
import { getCurrentUserId } from "../utils/user.js";
import { createClanAdmin } from "./groups-admin-clans.js";
import { createMemberRoleAdmin } from "./groups-admin-members.js";
import { getCurrentUserRole, isGroupAdmin } from "./groups-roles.js";

export function initGroupsAdminPanel(emptyMessage) {
    const elements = queryElements();
    let group = null;
    let members = [];
    let currentRole = 'member';

    const getState = () => ({
        group,
        members,
        currentRole,
        userId: getCurrentUserId(),
        canAdmin: isGroupAdmin(currentRole)
    });

    const clanAdmin = createClanAdmin(elements, getState, setMessage, emptyMessage);
    const memberAdmin = createMemberRoleAdmin(elements, getState, setMessage, emptyMessage, refreshMembers);

    window.addEventListener('clashtools:group-opened', event => {
        group = event.detail?.group || null;
        members = Array.isArray(event.detail?.members) ? event.detail.members : [];
        currentRole = event.detail?.currentRole || 'member';
        resetPanel();
        if (isGroupAdmin(currentRole)) preloadAdminData();
    });

    elements.settingsBtn?.addEventListener('click', open);
    elements.closeBtn?.addEventListener('click', close);
    elements.overlay?.addEventListener('click', event => { if (event.target === elements.overlay) close(); });
    elements.tabs.forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.adminTab)));

    function open() {
        if (!isGroupAdmin(currentRole)) return;
        elements.overlay?.classList.remove('hidden');
        showTab('members');
        preloadAdminData();
    }

    function close() {
        elements.overlay?.classList.add('hidden');
        memberAdmin.closeTransferConfirm();
    }

    function resetPanel() {
        close();
        clearMessage();
        updateTitle();
        clanAdmin.reset();
        memberAdmin.render();
    }

    function preloadAdminData() {
        clanAdmin.load();
        memberAdmin.render();
    }

    function updateTitle() {
        if (!elements.title) return;
        elements.title.textContent = group ? `${t('groups.adminTitle')}: ${group.name}` : t('groups.adminTitle');
    }

    function showTab(tabName) {
        elements.tabs.forEach(tab => tab.classList.toggle('groups-admin-tab-active', tab.dataset.adminTab === tabName));
        elements.sections.forEach(section => section.classList.toggle('hidden', section.dataset.adminSection !== tabName));
    }

    function setMessage(message, type = 'error') {
        if (!elements.message) return;
        elements.message.textContent = message;
        elements.message.classList.toggle('error', type === 'error');
        elements.message.classList.toggle('success', type === 'success');
    }

    function clearMessage() {
        setMessage('', 'success');
    }

    async function refreshMembers() {
        if (!group) return;
        const [groupData, groupMembers] = await Promise.all([getGroupInfo(group.id), getGroupMembers(group.id)]);
        group = Array.isArray(groupData) ? groupData[0] : groupData;
        members = Array.isArray(groupMembers) ? groupMembers : [];
        currentRole = getCurrentUserRole(group, members, getCurrentUserId());
        updateTitle();
        await memberAdmin.render();
        window.dispatchEvent(new CustomEvent('clashtools:group-roles-updated', { detail: { group, members, currentRole } }));
    }

    function closeAll() {
        close();
    }

    return { closeAll };
}

function queryElements() {
    return {
        settingsBtn: document.querySelector('#groups-settings-btn'),
        overlay: document.querySelector('#groups-admin-overlay'),
        closeBtn: document.querySelector('#groups-admin-close'),
        title: document.querySelector('#groups-admin-title'),
        message: document.querySelector('#groups-admin-message'),
        tabs: Array.from(document.querySelectorAll('[data-admin-tab]')),
        sections: Array.from(document.querySelectorAll('[data-admin-section]')),
        clanTag: document.querySelector('#groups-admin-clan-tag'),
        addClan: document.querySelector('#groups-admin-add-clan'),
        linkedClans: document.querySelector('#groups-linked-clans'),
        scanUnlinked: document.querySelector('#groups-admin-scan-unlinked'),
        unlinkedAccounts: document.querySelector('#groups-unlinked-accounts'),
        members: document.querySelector('#groups-admin-members'),
        roleHelp: document.querySelector('#groups-admin-role-help'),
        confirmOverlay: document.querySelector('#groups-role-confirm-overlay'),
        confirmText: document.querySelector('#groups-role-confirm-text'),
        confirmCancel: document.querySelector('#groups-role-confirm-cancel'),
        confirmAccept: document.querySelector('#groups-role-confirm-accept')
    };
}
