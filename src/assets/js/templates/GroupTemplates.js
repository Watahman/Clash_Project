import { t } from '../i18n/i18n.js';
import { getUserInfo } from "../Supabase/Supabase-User.js";
import { getGroupInfo, getGroupMembers } from "../Supabase/Supabase-Group.js";

function memberLabel(count) {
    return count === 1 ? '1 ' + t('groups.memberSingle') : count + ' ' + t('groups.members');
}

export function createGroupCard(groupsInfo) {
    if (!Array.isArray(groupsInfo)) return;

    groupsInfo.forEach((group) => {
        const groupCard = document.querySelector("#groups-item-template").content.cloneNode(true);
        getGroupInfo(group.group_id).then(groupData => {
            if (!Array.isArray(groupData) || groupData.length === 0) return;
            getGroupMembers(groupData[0].id).then(groupMembers => {
                groupMembers = Array.isArray(groupMembers) ? groupMembers : [];
                groupCard.querySelector(".groups-item-meta").textContent = memberLabel(groupMembers.length);
                groupCard.querySelector(".groups-item-name").textContent = groupData[0].name;
                if (localStorage.getItem("id") === groupData[0].owner_id) {
                    groupCard.querySelector(".groups-role-badge").textContent = "Leader";
                    groupCard.querySelector(".groups-role-badge").classList.add("leader");
                }
                const item = groupCard.querySelector(".groups-item");
                item.onclick = () => {
                    document.querySelectorAll(".groups-item.active").forEach(activeItem => activeItem.classList.remove("active"));
                    item.classList.add("active");
                    document.querySelector("#groups-member-list").replaceChildren();
                    openGroup(groupData[0], groupMembers);
                };
                document.querySelector("#groups-list").appendChild(groupCard);
                document.querySelector("#groups-list .groups-empty")?.classList.add("hidden");
            });
        }).catch(error => console.error(error));
    });
}

function openGroup(data, groupMembers) {
    document.querySelector("#groups-detail-empty").classList.add("hidden");
    document.querySelector("#groups-detail-content").classList.remove("hidden");
    document.querySelector("#groups-detail-name").textContent = data.name;
    document.querySelector("#groups-detail-count").textContent = memberLabel(groupMembers.length);
    document.querySelector("#groups-detail-code-text").textContent = data.code;
    document.querySelector('#groups-detail-since').textContent = t('groups.since') + ' ' + data.created_at.split('T')[0];
    const roleBadge = document.querySelector("#groups-detail-role");
    roleBadge.classList.remove("leader");

    if (localStorage.getItem("id") === data.owner_id) {
        roleBadge.textContent = "Leader";
        roleBadge.classList.add("leader");
    } else {
        roleBadge.textContent = t('groups.member');
    }
    addAllMembers(groupMembers, data.owner_id);
}

function addAllMembers(groupMembers, creatorId) {
    const memberList = document.querySelector("#groups-member-list");
    if (!Array.isArray(groupMembers) || groupMembers.length === 0) {
        const p = document.createElement("p");
        p.className = "groups-empty";
        p.textContent = 'Geen leden';
        memberList.appendChild(p);
        return;
    }

    groupMembers.forEach(member => {
        const groupMemberCard = document.querySelector("#groups-member-template").content.cloneNode(true);
        getUserInfo(member.user_id).then(userData => {
            const user = Array.isArray(userData) ? userData[0] : userData;
            if (!user || user.error) return;
            groupMemberCard.querySelector(".groups-member-name").textContent = user.name;
            if (user.id === creatorId || user.id === localStorage.getItem("id") && creatorId === user.id) {
                groupMemberCard.querySelector(".groups-role-badge").textContent = "Leader";
                groupMemberCard.querySelector(".groups-role-badge").classList.add("leader");
            }
            memberList.appendChild(groupMemberCard);
        }).catch(error => console.error(error));
    });
}
