import { t } from '../i18n/i18n.js';
import { getGroupInfo, getGroupMembers } from "../Supabase/Supabase-Group.js";
import { applyRoleBadge, getCurrentUserRole, getMemberRole, isGroupAdmin } from "../groups/groups-roles.js";
import { renderBadge } from "../groups/groups-badges.js";

function memberLabel(count) {
    return count === 1 ? '1 ' + t('groups.memberSingle') : count + ' ' + t('groups.members');
}

export function createGroupCard(groupsInfo, options = {}) {
    if (!Array.isArray(groupsInfo)) return Promise.resolve(false);

    const autoOpenGroupId = options.autoOpenGroupId || '';
    const groupPromises = groupsInfo.map((group) => {
        const groupCard = document.querySelector("#groups-item-template").content.cloneNode(true);
        return getGroupInfo(group.group_id).then(groupData => {
            if (!Array.isArray(groupData) || groupData.length === 0) return false;
            return getGroupMembers(groupData[0].id).then(groupMembers => {
                groupMembers = Array.isArray(groupMembers) ? groupMembers : [];
                groupCard.querySelector(".groups-item-meta").textContent = memberLabel(groupMembers.length);
                groupCard.querySelector(".groups-item-name").textContent = groupData[0].name;
                renderBadge(groupCard.querySelector(".groups-item-logo"), groupData[0].badge, groupData[0].badge_url);
                const currentRole = getCurrentUserRole(groupData[0], groupMembers, localStorage.getItem("id"), group);
                applyRoleBadge(groupCard.querySelector(".groups-role-badge"), currentRole, t);
                const item = groupCard.querySelector(".groups-item");
                item.dataset.groupId = groupData[0].id;
                item.onclick = () => {
                    document.querySelectorAll(".groups-item.active").forEach(activeItem => activeItem.classList.remove("active"));
                    item.classList.add("active");
                    document.querySelector("#groups-member-list").replaceChildren();
                    openGroup(groupData[0], groupMembers);
                };
                document.querySelector("#groups-list").appendChild(groupCard);
                document.querySelector("#groups-list .groups-empty")?.classList.add("hidden");
                if (autoOpenGroupId && groupData[0].id === autoOpenGroupId) {
                    item.click();
                    return true;
                }
                return false;
            });
        }).catch(error => console.error(error));
    });

    return Promise.all(groupPromises).then(results => results.some(Boolean));
}

function openGroup(data, groupMembers) {
    document.querySelector("#groups-detail-empty").classList.add("hidden");
    document.querySelector("#groups-detail-content").classList.remove("hidden");
    document.querySelector("#groups-detail-name").textContent = data.name;
    renderBadge(document.querySelector("#groups-detail-logo"), data.badge, data.badge_url);
    document.querySelector("#groups-detail-count").textContent = memberLabel(groupMembers.length);
    document.querySelector("#groups-detail-code-text").textContent = data.code;
    document.querySelector('#groups-detail-since').textContent = t('groups.since') + ' ' + data.created_at.split('T')[0];
    const roleBadge = document.querySelector("#groups-detail-role");
    roleBadge.classList.remove("leader", "co-leader");
    const currentUserId = localStorage.getItem("id");
    const currentRole = getCurrentUserRole(data, groupMembers, currentUserId);
    const canAdmin = isGroupAdmin(currentRole);
    const settingsBtn = document.querySelector("#groups-settings-btn");
    if (settingsBtn) settingsBtn.classList.toggle("hidden", !canAdmin);
    const pollBtn = document.querySelector("#groups-poll-btn");
    if (pollBtn) pollBtn.classList.add("hidden");

    applyRoleBadge(roleBadge, currentRole, t);
    addAllMembers(groupMembers, data.owner_id);
    window.dispatchEvent(new CustomEvent("clashtools:group-opened", {
        detail: { group: data, members: groupMembers, currentRole, canAdmin }
    }));
}

function addAllMembers(groupMembers, creatorId) {
    const memberList = document.querySelector("#groups-member-list");
    if (!Array.isArray(groupMembers) || groupMembers.length === 0) {
        const p = document.createElement("p");
        p.className = "groups-empty";
        p.textContent = t('groups.noMembers');
        memberList.appendChild(p);
        return;
    }

    groupMembers.forEach(member => {
        const groupMemberCard = document.querySelector("#groups-member-template").content.cloneNode(true);
        const user = member.profile || { id: member.user_id, name: member.user_id };
        groupMemberCard.querySelector(".groups-member-name").textContent = user.name || member.user_id;
        applyRoleBadge(groupMemberCard.querySelector(".groups-role-badge"), getMemberRole(member, { owner_id: creatorId }, user.id), t);
        memberList.appendChild(groupMemberCard);
    });
}
