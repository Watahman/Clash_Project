import { getUserInfo } from "../Supabase/Supabase-User.js";
import { getGroupInfo, getGroupMembers } from "../Supabase/Supabase-Group.js";

export function createGroupCard(groupsInfo) {
    groupsInfo.forEach((group) => {
        const groupCard = document.querySelector("#groups-item-template").content.cloneNode(true);
        getGroupInfo(group.group_id).then(groupData => {
            getGroupMembers(groupData[0].id).then(groupMembers => {
                groupCard.querySelector(".groups-item-meta").textContent = groupMembers.length + " leden";
                groupCard.querySelector(".groups-item-name").textContent = groupData[0].name;
                if (localStorage.getItem("id") === groupData[0].owner_id) {
                    groupCard.querySelector(".groups-role-badge").textContent = "Leader";
                    groupCard.querySelector(".groups-role-badge").classList.add("leader");
                }
                groupCard.querySelector(".groups-item").onclick = () => {
                    document.querySelector("#groups-member-list").replaceChildren();
                    openGroup(groupData[0], groupMembers);
                };
                document.querySelector("#groups-list").appendChild(groupCard);
                document.querySelector(".groups-empty").classList.add("hidden");
            });
        });
    });
}

function openGroup(data, groupMembers) {
    document.querySelector("#groups-detail-empty").classList.add("hidden");
    document.querySelector("#groups-detail-content").classList.remove("hidden");
    document.querySelector("#groups-detail-name").textContent = data.name;
    document.querySelector("#groups-detail-count").textContent = groupMembers.length + " Leden";
    document.querySelector("#groups-detail-code-text").textContent = data.code;
    document.querySelector("#groups-detail-since").textContent = "since - " + data.created_at.split("T")[0];
    const roleBadge = document.querySelector("#groups-detail-role");
    roleBadge.classList.remove("leader");

    if (localStorage.getItem("id") === data.owner_id) {
        roleBadge.textContent = "Leader";
        roleBadge.classList.add("leader");
    } else {
        roleBadge.textContent = "Lid";
    }
    addAllMembers(groupMembers, data.owner_id);
}

function addAllMembers(groupMembers, creatorId) {
    const memberList = document.querySelector("#groups-member-list");
    const emptyEl = memberList.querySelector(".groups-empty");

    groupMembers.forEach(member => {
        const groupMemberCard = document.querySelector("#groups-member-template").content.cloneNode(true);
        getUserInfo(member.user_id).then(userData => {
            groupMemberCard.querySelector(".groups-member-name").textContent = userData[0].name;
            if (userData[0].id === creatorId) {
                groupMemberCard.querySelector(".groups-role-badge").textContent = "Leader";
                groupMemberCard.querySelector(".groups-role-badge").classList.add("leader");
            }
            memberList.appendChild(groupMemberCard);
            if (emptyEl) emptyEl.classList.add("hidden");
        });
    });
}
