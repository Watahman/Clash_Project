import { getGroupsOfUser, getGroupInfo, getGroupMembers } from "../Supabase/Supabase-Group.js";
import { getUserBases } from "../Supabase/Supabase-User.js";
import { createPlayerCard } from "../templates/CWLTemplates.js";
import { getCurrentUserId } from "../utils/user.js";

export function initGroupOverlay(selectGroup) {
    const userId = getCurrentUserId();
    if (!userId) return;

    getGroupsOfUser(userId).then(data => {
        if (!Array.isArray(data)) return;
        data.forEach(group => {
            getGroupInfo(group.group_id).then(groupInfo => {
                if (!Array.isArray(groupInfo) || groupInfo.length === 0) return;
                const option = document.createElement("option");
                option.value = groupInfo[0].id;
                option.textContent = groupInfo[0].name;
                selectGroup.appendChild(option);
                localStorage.setItem(groupInfo[0].name, groupInfo[0].id);
                loadPreviewData(groupInfo[0].id);
            });
        });
    }).catch(error => console.error(error));

    selectGroup.addEventListener('change', () => {
        const value = selectGroup.value;
        document.querySelectorAll(".groupBase").forEach(groupBase => {
            document.querySelector("#cwl-group-preview").classList.remove("hidden");
            groupBase.classList.add("hidden");
        });
        if (value === "") return;
        document.querySelectorAll(`[data-clanuuid="${value}"]`).forEach(base => {
            document.querySelector("#cwl-group-preview").classList.add("hidden");
            base.classList.remove("hidden");
        });
    });
}

function loadPreviewData(groupId) {
    getGroupMembers(groupId).then(groupMembers => {
        if (!Array.isArray(groupMembers)) return;
        groupMembers.forEach(member => {
            getUserBases(member.user_id).then(userBases => {
                const accounts = userBases?.[0]?.accounts;
                if (!Array.isArray(accounts) || accounts.length === 0) return;
                createPlayerCard(accounts, "group|" + groupId);
            });
        });
    }).catch(error => console.error(error));
}
