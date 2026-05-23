import { getGroupsOfUser, getGroupInfo, getGroupMembers } from "../Supabase/Supabase-Group.js";
import { getUserBases } from "../Supabase/Supabase-User.js";
import { createPlayerCard } from "../templates/CWLTemplates.js";
import { getCurrentUserId } from "../utils/user.js";

export function initGroupOverlay(selectGroup) {
    getGroupsOfUser(getCurrentUserId()).then(data => {
        data.forEach(group => {
            getGroupInfo(group.group_id).then(groupInfo => {
                let newOption = document.createElement("option");
                newOption.value = groupInfo[0].id;
                newOption.textContent = groupInfo[0].name;
                selectGroup.appendChild(newOption);
                localStorage.setItem(groupInfo[0].name, groupInfo[0].id);
                loadPreviewData(groupInfo[0].id);
            });
        });
    });

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
        groupMembers.forEach(member => {
            getUserBases(member.user_id).then(userBases => {
                if (userBases[0].accounts === null) return;
                createPlayerCard(userBases[0].accounts, "group|" + groupId);
            });
        });
    });
}
